import { createApp } from '../src/server/app.js';

// Vercel serverless entry: the API only. Vercel serves the built page from dist/client.
// Only /tmp is writable on Vercel, and it is wiped whenever an instance is recycled.
export default createApp({
  dataDir: process.env.DATA_DIR ?? '/tmp/roadline-data',
  clientDir: '/nonexistent',
});
