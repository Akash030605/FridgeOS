import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createApiApp, attachErrorHandler } from './apiApp';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = createApiApp();

  // Mount Vite middleware in development or serve static build in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  attachErrorHandler(app);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
