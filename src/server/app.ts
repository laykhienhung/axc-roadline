import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import type { Dropdowns, Grid, ParseResult } from '../shared/model.js';
import { parseAxcWorkbook } from '../shared/parse-axc.js';
import { parseFlatCsv } from '../shared/parse-csv.js';
import { MappingStore, parseMappingField } from './mapping-store.js';
import { PlanStore } from './plan-store.js';
import { readGrid } from './read-grid.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface AppOptions {
  dataDir: string;
  /** Built SPA (`dist/client`). Missing directory → API only. */
  clientDir: string;
  /** Dev mode: send page requests to the Vite dev server instead of serving `clientDir`. */
  devClientUrl?: string;
}

export function createApp({ dataDir, clientDir, devClientUrl }: AppOptions) {
  const store = new PlanStore(dataDir);
  const mappingStore = new MappingStore(dataDir);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });
  const app = express();

  app.get('/api/plan', async (_req, res) => {
    const plan = await store.load();
    if (plan) res.json(plan);
    else res.status(404).json({ error: 'no_plan' });
  });

  app.post('/api/plan', (req, res, next) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'file_too_large' });
        return;
      }
      if (err) return next(err);
      importPlan(req, res).catch(next);
    });
  });

  async function importPlan(req: Request, res: Response) {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'no_file' });
      return;
    }
    // multer decodes the multipart filename as latin1; browsers send UTF-8.
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(fileName).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.csv') {
      res.status(415).json({ error: 'unsupported_type' });
      return;
    }
    const submitted = parseMappingField((req.body as Record<string, unknown> | undefined)?.mapping);
    if (!submitted) {
      res.status(400).json({ error: 'invalid_mapping' });
      return;
    }
    let grid: Grid;
    let dropdowns: Dropdowns;
    try {
      ({ grid, dropdowns } = readGrid(file.buffer, fileName));
    } catch {
      res.status(400).json({
        error: 'invalid_plan',
        problems: [{ message: `the file could not be read as ${ext}` }],
      });
      return;
    }
    // Saved mappings, overridden by what this upload submits.
    const saved = await mappingStore.load();
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
      res.status(422).json({ error: 'needs_mapping', unknown: result.needsMapping });
      return;
    }
    if (!result.ok) {
      res.status(400).json({ error: 'invalid_plan', problems: result.problems });
      return;
    }
    await store.save(result.plan, file.buffer, fileName);
    await mappingStore.merge(submitted, result.plan.templateVersion);
    res.json({ plan: result.plan, warnings: result.warnings, applied: result.applied });
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  if (devClientUrl) {
    // `npm run dev`: the web page is served (and hot-reloaded) by Vite.
    app.get(/.*/, (req, res) => res.redirect(302, new URL(req.originalUrl, devClientUrl).href));
    return app;
  }

  const indexHtml = path.join(clientDir, 'index.html');
  app.use(express.static(clientDir, { index: false }));
  app.get(/.*/, (_req, res) => {
    if (existsSync(indexHtml)) res.sendFile(path.resolve(indexHtml));
    else res.status(404).send('Web page not built. Run `npm run build`.');
  });

  return app;
}
