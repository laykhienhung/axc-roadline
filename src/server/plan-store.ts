import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plan } from '../shared/model.js';

/**
 * The one shared current plan, kept as JSON on disk. Saves replace `plan.json` atomically
 * (temp file + rename), keep the previous plan as `plan.prev.json`, keep the uploaded file under
 * `uploads/`, and run one at a time.
 */
export class PlanStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dataDir: string) {}

  private get planFile() {
    return path.join(this.dataDir, 'plan.json');
  }

  async load(): Promise<Plan | null> {
    try {
      return JSON.parse(await readFile(this.planFile, 'utf8')) as Plan;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  save(plan: Plan, original: Buffer, fileName: string): Promise<void> {
    const run = this.queue.then(() => this.write(plan, original, fileName));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async write(plan: Plan, original: Buffer, fileName: string): Promise<void> {
    const uploads = path.join(this.dataDir, 'uploads');
    await mkdir(uploads, { recursive: true });
    try {
      await copyFile(this.planFile, path.join(this.dataDir, 'plan.prev.json'));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    const stamp = plan.source.importedAt.replace(/[:.]/g, '-');
    const safeName = path.basename(fileName).replace(/[^\w.-]+/g, '_');
    await writeFile(path.join(uploads, `${stamp}-${safeName}`), original);
    const tmp = path.join(this.dataDir, 'plan.tmp.json');
    await writeFile(tmp, JSON.stringify(plan, null, 2));
    await rename(tmp, this.planFile);
  }
}
