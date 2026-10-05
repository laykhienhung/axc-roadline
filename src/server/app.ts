import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import { canImport } from '../shared/auth.js';
import type { Dropdowns, Grid, ParseResult } from '../shared/model.js';
import { parseAxcWorkbook } from '../shared/parse-axc.js';
import { parseFlatCsv } from '../shared/parse-csv.js';
import { FileStorage } from './file-storage.js';
import { adminRoutes } from './admin.js';
import type { AuthConfig } from './auth-config.js';
import type { AuthStore } from './auth-store.js';
import { authRoutes } from './auth.js';
import { parseMappingField } from './mapping-store.js';
import { readGrid } from './read-grid.js';
import { StorageUnavailableError, type ImportEntry, type Storage } from './storage.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface AppOptions {
  dataDir: string;
  /** Built SPA (`dist/client`). Missing directory → API only. */
  clientDir: string;
  /** Dev mode: send page requests to the Vite dev server instead of serving `clientDir`. */
  devClientUrl?: string;
  /** Persistence implementation. Defaults to JSON files in `dataDir`. */
  storage?: Storage;
  auth: { cfg: AuthConfig; store: AuthStore };
}

export function createApp({ dataDir, clientDir, devClientUrl, storage, auth }: AppOptions) {
  const appStorage = storage ?? new FileStorage(dataDir);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });
  const app = express();
  const middleware = authRoutes(app, auth);

  app.use('/api', middleware.apiGate, middleware.mustChangeGate);

  app.get('/api/plan', async (_req, res) => {
    try {
      const plan = await appStorage.loadPlan();
      if (plan) res.json(plan);
      else res.status(404).json({ error: 'no_plan' });
    } catch (err) {
      if (err instanceof StorageUnavailableError) res.status(503).json({ error: 'db_unavailable' });
      else throw err;
    }
  });

  app.post('/api/plan', middleware.originCheck, (req, res, next) => {
    if (!canImport(req.user!.role)) {
      logNonOk({
        userEmail: req.user!.email,
        fileName: null,
        fileSize: null,
        outcome: 'forbidden',
      })
        .then(() => res.status(403).json({ error: 'forbidden' }))
        .catch(next);
      return;
    }
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        logNonOk({
          userEmail: req.user!.email,
          fileName: req.file?.originalname ?? null,
          fileSize: null,
          outcome: 'file_too_large',
        }).then(() => res.status(413).json({ error: 'file_too_large' }));
        return;
      }
      if (err) return next(err);
      importPlan(req, res).catch((error: unknown) => {
        if (error instanceof StorageUnavailableError) {
          res.status(503).json({ error: 'db_unavailable' });
          return;
        }
        next(error);
      });
    });
  });

  async function importPlan(req: Request, res: Response) {
    const file = req.file;
    const userEmail = req.user!.email;
    if (!file) {
      await respondNonOk(
        res,
        { userEmail, fileName: null, fileSize: null, outcome: 'no_file' },
        400
      );
      return;
    }
    // multer decodes the multipart filename as latin1; browsers send UTF-8.
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(fileName).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.csv') {
      await respondNonOk(
        res,
        { userEmail, fileName, fileSize: file.size, outcome: 'unsupported_type' },
        415
      );
      return;
    }
    const submitted = parseMappingField((req.body as Record<string, unknown> | undefined)?.mapping);
    if (!submitted) {
      await respondNonOk(
        res,
        { userEmail, fileName, fileSize: file.size, outcome: 'invalid_mapping' },
        400
      );
      return;
    }
    let grid: Grid;
    let dropdowns: Dropdowns;
    try {
      ({ grid, dropdowns } = readGrid(file.buffer, fileName));
    } catch {
      const problems = [{ message: `the file could not be read as ${ext}` }];
      await respondNonOk(
        res,
        { userEmail, fileName, fileSize: file.size, outcome: 'invalid_plan', problems },
        400,
        problems
      );
      return;
    }
    // Saved mappings, overridden by what this upload submits.
    const saved = await appStorage.loadMappings();
    const mappings = {
      status: { ...saved.status, ...submitted.status },
      quarter: { ...saved.quarter, ...submitted.quarter },
      due: { ...saved.due, ...submitted.due },
      seenVersions: saved.seenVersions,
    };
    const importedAt = new Date().toISOString();
    const result: ParseResult =
      ext === '.csv'
        ? parseFlatCsv(grid, fileName, importedAt, { mappings })
        : parseAxcWorkbook(grid, fileName, importedAt, { mappings, dropdowns });
    if (!result.ok && 'needsMapping' in result) {
      await respondNonOk(
        res,
        {
          userEmail,
          fileName,
          fileSize: file.size,
          outcome: 'needs_mapping',
          problems: result.needsMapping,
        },
        422,
        result.needsMapping,
        'unknown'
      );
      return;
    }
    if (!result.ok) {
      await respondNonOk(
        res,
        {
          userEmail,
          fileName,
          fileSize: file.size,
          outcome: 'invalid_plan',
          problems: result.problems,
        },
        400,
        result.problems
      );
      return;
    }
    await appStorage.commitImport({
      plan: result.plan,
      file: file.buffer,
      fileName,
      submitted,
      templateVersion: result.plan.templateVersion,
      userEmail,
    });
    res.json({ plan: result.plan, warnings: result.warnings, applied: result.applied });
  }

  async function logNonOk(entry: ImportEntry): Promise<void> {
    try {
      await appStorage.logImport(entry);
    } catch (err) {
      console.error('roadline: could not write import audit entry', err);
    }
  }

  async function respondNonOk(
    res: Response,
    entry: ImportEntry,
    status: number,
    problems?: unknown,
    problemsKey = 'problems'
  ): Promise<void> {
    await logNonOk(entry);
    res.status(status).json({
      error: entry.outcome,
      ...(problems === undefined ? {} : { [problemsKey]: problems }),
    });
  }

  adminRoutes(app, { ...auth, storage: appStorage, middleware });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  if (devClientUrl) {
    // `npm run dev`: the web page is served (and hot-reloaded) by Vite; the client gate guards it.
    app.get(/.*/, (req, res) => res.redirect(302, new URL(req.originalUrl, devClientUrl).href));
    app.use(storageUnavailable);
    return app;
  }

  const indexHtml = path.join(clientDir, 'index.html');
  app.use(express.static(clientDir, { index: false }));
  app.use(middleware.pageGate);
  app.get(/.*/, (_req, res) => {
    if (existsSync(indexHtml)) res.sendFile(path.resolve(indexHtml));
    else res.status(404).send('Web page not built. Run `npm run build`.');
  });
  app.use(storageUnavailable);

  return app;
}

function storageUnavailable(
  error: unknown,
  req: Request,
  res: Response,
  next: express.NextFunction
): void {
  if (!(error instanceof StorageUnavailableError)) return next(error);
  if (req.path.startsWith('/api/')) {
    res.status(503).json({ error: 'db_unavailable' });
  } else {
    res.status(503).type('text').send("Roadline can't reach its database");
  }
}
