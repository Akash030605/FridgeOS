import { GoogleGenAI, MediaResolution, Schema } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ACTIVE_VISION_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
];
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Custom typed error for upstream Gemini API failures
 */
export class GeminiServiceError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'GeminiServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Singleton GoogleGenAI client instance
 */
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface GenerateJSONOptions {
  prompt: string;
  image?: {
    mimeType: string;
    base64Data: string;
  };
  responseSchema?: Schema;
  temperature?: number;
}

function isQuotaOrBusyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const maybeStatus =
    (err as { status?: number; statusCode?: number }).status ??
    (err as { statusCode?: number }).statusCode;
  if (maybeStatus === 429 || maybeStatus === 503) return true;

  const message =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('503') ||
    message.includes('quota') ||
    message.includes('resource_exhausted') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('high demand') ||
    message.includes('unavailable')
  );
}

function isRetryableModelError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const maybeStatus =
    (err as { status?: number; statusCode?: number }).status ??
    (err as { statusCode?: number }).statusCode;
  const message =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    maybeStatus === 404 ||
    maybeStatus === 503 ||
    maybeStatus === 429 ||
    message.includes('no longer available') ||
    message.includes('not_found') ||
    message.includes('high demand') ||
    message.includes('unavailable')
  );
}

/**
 * Calls Gemini Flash with a 25-second AbortController timeout,
 * enforces JSON output, and parses the response into type T.
 * Sets mediaResolution to HIGH for image analysis calls and supports optional temperature.
 * Never logs the API key or image payload.
 */
export async function generateJSON<T>(options: GenerateJSONOptions): Promise<T> {
  if (!process.env.GEMINI_API_KEY) {
    throw new GeminiServiceError(
      'Server configuration error: GEMINI_API_KEY is not set.',
      500
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [{ text: options.prompt }];

    if (options.image) {
      parts.push({
        inlineData: {
          mimeType: options.image.mimeType,
          data: options.image.base64Data,
        },
      });
    }

    const callModel = async (modelName: string) =>
      ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          ...(options.temperature !== undefined
            ? { temperature: options.temperature }
            : {}),
          ...(options.image
            ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH }
            : {}),
          ...(options.responseSchema
            ? { responseSchema: options.responseSchema }
            : {}),
          abortSignal: controller.signal,
        },
      });

    let response;
    let lastErr: unknown;

    for (let i = 0; i < ACTIVE_VISION_MODELS.length; i++) {
      try {
        response = await callModel(ACTIVE_VISION_MODELS[i]);
        lastErr = undefined;
        break;
      } catch (err: unknown) {
        lastErr = err;
        if (!isRetryableModelError(err) || i === ACTIVE_VISION_MODELS.length - 1) {
          throw err;
        }
      }
    }

    if (!response) {
      throw lastErr ?? new Error('No response from AI service.');
    }

    const rawText = response.text;
    if (!rawText || typeof rawText !== 'string') {
      throw new GeminiServiceError('AI returned malformed response.', 502);
    }

    try {
      return JSON.parse(rawText.trim()) as T;
    } catch {
      throw new GeminiServiceError('AI returned malformed response.', 502);
    }
  } catch (err: unknown) {
    if (err instanceof GeminiServiceError) {
      throw err;
    }

    if (
      controller.signal.aborted ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
      throw new GeminiServiceError(
        'AI request timed out after 25 seconds.',
        504
      );
    }

    if (isQuotaOrBusyError(err)) {
      throw new GeminiServiceError(
        'AI service is busy, try again in a moment.',
        503
      );
    }

    throw new GeminiServiceError(
      'Failed to process request with AI service.',
      500
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
