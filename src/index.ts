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

/**
 * Creates the Express API app (shared between local server and Vercel serverless functions)
 */
export function createApiApp() {
  const app = express();

  // Trust proxy headers on Vercel / Cloud Run so express-rate-limit reads client IP accurately
  app.set('trust proxy', 1);

  const configuredOrigin = (process.env.FRONTEND_ORIGIN || '')
    .trim()
    .replace(/\/+$/, '');

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        const normalizedOrigin = origin.replace(/\/+$/, '');
        if (
          normalizedOrigin === configuredOrigin ||
          normalizedOrigin === 'http://localhost:3000' ||
          normalizedOrigin === 'http://localhost:5173' ||
          normalizedOrigin.endsWith('.vercel.app') ||
          normalizedOrigin.endsWith('.run.app')
        ) {
          callback(null, true);
          return;
        }
        // Allow same-deployment origins even if FRONTEND_ORIGIN is misconfigured
        callback(null, true);
      },
      methods: ['GET', 'POST', 'OPTIONS'],
    })
  );

  // Parse JSON bodies up to 1MB
  app.use(express.json({ limit: '1mb' }));

  // Health check route
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: Date.now(),
    });
  });

  // API Routes
  app.use('/api/analyze', analyzeRouter);
  app.use('/api/recipes', recipesRouter);
  app.post('/api/search-recipes', recipesRateLimiter, handleSearchRecipes);

  return app;
}

/**
 * Attaches the global JSON error handler (must be registered after routes)
 */
export function attachErrorHandler(app: express.Express) {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof GeminiServiceError) {
      console.error(`[GeminiServiceError] Status ${err.statusCode}:`, err.message);
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    if (
      err &&
      typeof err === 'object' &&
      'type' in err &&
      (err as { type?: string }).type === 'entity.too.large'
    ) {
      res.status(413).json({
        error: 'Request payload is too large. Maximum allowed size is 1MB.',
      });
      return;
    }

    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON payload.' });
      return;
    }

    const message =
      err instanceof Error ? err.message : 'Internal server error.';
    console.error('[UnhandledServerError]:', message);

    res.status(500).json({
      error: message || 'An unexpected error occurred.',
    });
  });
}

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

// Only start a persistent HTTP listener when not running inside Vercel Serverless Functions
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
