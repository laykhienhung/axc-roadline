import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const dataDir = path.resolve(process.env.DATA_DIR ?? './data');
// Built layout: dist/server/index.js next to dist/client/.
const clientDir = path.resolve(process.env.CLIENT_DIR ?? path.join(here, '../client'));
// Running from source (`npm run dev` via tsx): the page comes from the Vite dev server.
const fromSource = import.meta.url.endsWith('.ts');
const devClientUrl =
  process.env.DEV_CLIENT_URL ?? (fromSource ? 'http://localhost:5173' : undefined);

createApp({ dataDir, clientDir, devClientUrl }).listen(port, () => {
  console.log(`roadline listening on http://localhost:${port} (data: ${dataDir})`);
  if (devClientUrl)
    console.log(`dev mode: web page at ${devClientUrl} (page requests redirect there)`);
});
