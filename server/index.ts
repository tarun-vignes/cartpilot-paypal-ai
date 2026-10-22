import 'dotenv/config';
import { createServer } from 'vite';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { settingsFromEnv } from './config';

const settings = settingsFromEnv(process.env);
const app = createApp(settings);
if (process.argv.includes('--production')) {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(`${dist}/index.html`));
} else {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
const server = app.listen(settings.port, () =>
  console.log(
    `CartPilot: ${settings.origin}\nSandbox only. AI: ${settings.aiProvider === 'gemini' && settings.geminiKey ? 'Gemini configured' : 'demo recommendation logic'}. PayPal: ${settings.paypalId && settings.paypalSecret ? 'sandbox configured' : 'unavailable — add sandbox credentials'}.`,
  ),
);
const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
