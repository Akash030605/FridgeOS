import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { generateJSON, GeminiServiceError } from '../lib/gemini';
import {
  ANALYZE_IMAGE_PROMPT,
  buildVerifyIngredientsPrompt,
} from '../lib/prompts';
import { analyzeRateLimiter } from '../lib/rateLimits';
import {
  analyzeResponseSchema,
  geminiAnalyzeResponseSchema,
  verifyIngredientsResponseSchema,
  geminiVerifyIngredientsResponseSchema,
} from '../lib/schemas';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ANALYZE_TEMPERATURE = 0.1;

class InvalidMimeTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMimeTypeError';
  }
}

function dedupeIngredients(items: string[]): string[] {
  const seen: string[] = [];
  const canon = (s: string) => s.toLowerCase().trim().replace(/s$/, '');
  for (const item of items) {
    const key = canon(item);
    const isDupe = seen.some(
      (existing) => existing.includes(key) || key.includes(existing)
    );
    if (!isDupe) seen.push(key);
    else continue;
    seen[seen.length - 1] = key;
  }
  // Return original-cased items that survived dedupe
  const result: string[] = [];
  const usedKeys = new Set<string>();
  for (const item of items) {
    const key = canon(item);
    const alreadyCovered = [...usedKeys].some(
      (k) => k.includes(key) || key.includes(k)
    );
    if (!alreadyCovered) {
      usedKeys.add(key);
      result.push(item);
    }
  }
  return result;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new InvalidMimeTypeError('Only image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post(
  '/',
  analyzeRateLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({
              error: 'Image file is too large. Maximum allowed size is 10MB.',
            });
            return;
          }
          res.status(400).json({ error: `Upload error: ${err.message}` });
          return;
        }
        if (err instanceof InvalidMimeTypeError) {
          res.status(400).json({ error: err.message });
          return;
        }
        next(err);
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file || !req.file.buffer) {
        res.status(400).json({
          error: 'Missing required image file in field "image".',
        });
        return;
      }

      const base64String = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype || 'image/jpeg';

      const pass1Start = Date.now();

      // Pass 1: Initial forensic scan at temperature 0.1
      const rawResult = await generateJSON<unknown>({
        prompt: ANALYZE_IMAGE_PROMPT,
        image: {
          mimeType,
          base64Data: base64String,
        },
        responseSchema: geminiAnalyzeResponseSchema,
        temperature: ANALYZE_TEMPERATURE,
      });

      const validation = analyzeResponseSchema.safeParse(rawResult);
      if (!validation.success) {
        throw new GeminiServiceError('AI returned malformed response.', 502);
      }

      const parsed = validation.data;

      if (parsed.ingredients.length === 0) {
        res.json({ ingredients: [], confidence: parsed.confidence });
        return;
      }

      // Pass 2: Self-verification fact-check against the SAME photo at temperature 0.1
      // On Vercel Serverless Functions, skip or cap Pass 2 if Pass 1 already took >3.5s to prevent 10s serverless timeouts
      let finalIngredients = parsed.ingredients;
      const pass1Elapsed = Date.now() - pass1Start;

      if (!process.env.VERCEL && pass1Elapsed < 4000) {
        try {
          const verifyRawResult = await Promise.race([
            generateJSON<unknown>({
              prompt: buildVerifyIngredientsPrompt(parsed.ingredients),
              image: {
                mimeType,
                base64Data: base64String,
              },
              responseSchema: geminiVerifyIngredientsResponseSchema,
              temperature: ANALYZE_TEMPERATURE,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Verify pass timeout')), 4500)
            ),
          ]);

          const verifyValidation =
            verifyIngredientsResponseSchema.safeParse(verifyRawResult);
          if (verifyValidation.success) {
            finalIngredients = verifyValidation.data.verified;
          }
        } catch {
          // Retain Pass 1 forensic results if Pass 2 times out or spikes
        }
      }

      const cleaned = dedupeIngredients(finalIngredients);
      res.json({ ingredients: cleaned, confidence: parsed.confidence });
    } catch (err: unknown) {
      next(err);
    }
  }
);

export default router;
