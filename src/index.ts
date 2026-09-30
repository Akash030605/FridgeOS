import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import analyzeRouter from './routes/analyze';
import recipesRouter, { handleSearchRecipes } from './routes/recipes';
import { recipesRateLimiter } from './lib/rateLimits';
import { GeminiServiceError } from './lib/gemini';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export async function createServer() {
  const app = express();

  // Trust proxy for accurate IP rate limiting behind reverse proxies
  app.set('trust proxy', 1);

  // Short request trace logger: method, path, duration, status (never logs keys or image buffers)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      console.log(
        `[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`
      );
    });
    next();
  });

  // Configure CORS for API routes: allow configured FRONTEND_URL origins, APP_URL, and same-host origins
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || allowedOrigins.length === 0) {
          callback(null, true);
          return;
        }
        if (
          allowedOrigins.includes(requestOrigin) ||
          allowedOrigins.includes('*') ||
          requestOrigin.endsWith('.run.app') ||
          requestOrigin.includes('localhost') ||
          requestOrigin.includes('127.0.0.1') ||
          (process.env.APP_URL && requestOrigin === process.env.APP_URL)
        ) {
          callback(null, true);
          return;
        }
        // Do not throw an error that breaks static/module asset loading; omit CORS headers for disallowed external origins
        callback(null, false);
      },
    })
  );

  app.use(express.json({ limit: '100kb' }));

  // Healthcheck endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  // API Routes
  app.use('/api/analyze', analyzeRouter);
  app.use('/api/recipes', recipesRouter);
  app.post('/api/search-recipes', recipesRateLimiter, handleSearchRecipes);

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

  // Centralized error handler
  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof GeminiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }

      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ error: 'Invalid JSON payload.' });
        return;
      }

      res.status(500).json({ error: 'Internal server error.' });
    }
  );

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  createServer()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server listening on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err: unknown) => {
      console.error(
        'Failed to start server:',
        err instanceof Error ? err.message : 'Unknown error'
      );
      process.exit(1);
    });
}
