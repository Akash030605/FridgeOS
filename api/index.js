// src/apiApp.ts
import express from "express";
import cors from "cors";
import dotenv2 from "dotenv";

// src/routes/analyze.ts
import { Router } from "express";
import multer, { MulterError } from "multer";

// src/lib/gemini.ts
import { GoogleGenAI, MediaResolution } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
var ACTIVE_VISION_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash"
];
var REQUEST_TIMEOUT_MS = 25e3;
var GeminiServiceError = class extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "GeminiServiceError";
    this.statusCode = statusCode;
  }
};
var ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
function isQuotaOrBusyError(err) {
  if (!err || typeof err !== "object") return false;
  const maybeStatus = err.status ?? err.statusCode;
  if (maybeStatus === 429 || maybeStatus === 503) return true;
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return message.includes("429") || message.includes("503") || message.includes("quota") || message.includes("resource_exhausted") || message.includes("rate limit") || message.includes("too many requests") || message.includes("high demand") || message.includes("unavailable");
}
function isRetryableModelError(err) {
  if (!err || typeof err !== "object") return false;
  const maybeStatus = err.status ?? err.statusCode;
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return maybeStatus === 404 || maybeStatus === 503 || maybeStatus === 429 || message.includes("no longer available") || message.includes("not_found") || message.includes("high demand") || message.includes("unavailable");
}
async function generateJSON(options) {
  if (!process.env.GEMINI_API_KEY) {
    throw new GeminiServiceError(
      "Server configuration error: GEMINI_API_KEY is not set.",
      500
    );
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const parts = [{ text: options.prompt }];
    if (options.image) {
      parts.push({
        inlineData: {
          mimeType: options.image.mimeType,
          data: options.image.base64Data
        }
      });
    }
    const callModel = async (modelName) => ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts
        }
      ],
      config: {
        responseMimeType: "application/json",
        ...options.temperature !== void 0 ? { temperature: options.temperature } : {},
        ...options.image ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH } : {},
        ...options.responseSchema ? { responseSchema: options.responseSchema } : {},
        abortSignal: controller.signal
      }
    });
    let response;
    let lastErr;
    for (let i = 0; i < ACTIVE_VISION_MODELS.length; i++) {
      try {
        response = await callModel(ACTIVE_VISION_MODELS[i]);
        lastErr = void 0;
        break;
      } catch (err) {
        lastErr = err;
        if (!isRetryableModelError(err) || i === ACTIVE_VISION_MODELS.length - 1) {
          throw err;
        }
      }
    }
    if (!response) {
      throw lastErr ?? new Error("No response from AI service.");
    }
    const rawText = response.text;
    if (!rawText || typeof rawText !== "string") {
      throw new GeminiServiceError("AI returned malformed response.", 502);
    }
    try {
      return JSON.parse(rawText.trim());
    } catch {
      throw new GeminiServiceError("AI returned malformed response.", 502);
    }
  } catch (err) {
    if (err instanceof GeminiServiceError) {
      throw err;
    }
    if (controller.signal.aborted || err instanceof Error && err.name === "AbortError") {
      throw new GeminiServiceError(
        "AI request timed out after 25 seconds.",
        504
      );
    }
    if (isQuotaOrBusyError(err)) {
      throw new GeminiServiceError(
        "AI service is busy, try again in a moment.",
        503
      );
    }
    throw new GeminiServiceError(
      "Failed to process request with AI service.",
      500
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// src/lib/prompts.ts
var ANALYZE_IMAGE_PROMPT = `You are a forensic fridge scanner. Your job is to list ONLY items you 
can directly see. Accuracy matters more than completeness.

CRITICAL RULE: Do NOT add ingredients just because they're commonly 
found in fridges. If you don't see it, don't list it. Common fridge 
ingredients like milk, cheese, butter, tomatoes, spinach, onions, and 
garlic are NOT to be listed unless you can point to the exact item in 
the photo.

For each item you list, you must be able to say WHERE it is:
- Which shelf or door position
- What color/shape the container is
- Why you're confident it's that specific item

If you can't answer all three, DO NOT list it.

SCAN METHOD \u2014 check each zone separately:
1. Door top shelf
2. Door middle shelf
3. Door bottom shelf
4. Main top shelf
5. Main middle shelf
6. Crisper drawers

RULES:
- List generic names, not brands
- If you see a bottle but can't identify contents, skip it
- If you see a container but can't identify contents, skip it
- Consolidate duplicates ("juice" once, not three times)
- Do NOT use vague categories like "condiment", "drink", "sauce"
- Aim for 4-10 items. Fewer accurate items beat more wrong ones.
- If you only see 3 things, return 3 things.

Return ONLY this JSON shape:
{ "ingredients": string[], "confidence": number }`;
function buildVerifyIngredientsPrompt(ingredients) {
  return `You previously identified these items in a fridge photo:
${ingredients.join(", ")}

Now look at the SAME photo again. For each item, answer:
- "Yes, I can point to this exact item in the photo"
- OR "No, I inferred this from common fridge contents"

Return ONLY a JSON object:
{
  "verified": string[],   // items you can confidently point to
  "removed": string[]     // items you cannot locate in the photo
}

Be strict. If you're not sure, move it to "removed".`;
}
function buildRecipesPrompt(ingredients) {
  return `You are a professional chef. Given these available ingredients:
${ingredients.join(", ")}

Generate 3 recipes that use mostly these ingredients. Some recipes may 
need 1-3 additional pantry staples (salt, oil, butter, pasta, rice, etc.) 
\u2014 list those separately as "missingIngredients".

Rules:
- Prefer recipes that use MORE of the available ingredients
- Keep steps under 15 words each
- Nutrition values are estimates per serving
- No markdown, no prose, JSON only`;
}
function buildSearchRecipesPrompt(query) {
  return `Generate 3-5 recipes that match this search query: "${query}"

Return ONLY valid JSON:
{
  "recipes": [{
    "name": string,
    "time": string,
    "difficulty": "Easy" | "Medium" | "Hard",
    "ingredients": string[],
    "missingIngredients": string[],  // assume user has NOTHING \u2014 list all needed
    "steps": string[],
    "nutrition": { "calories": number, "protein": number, "carbs": number }
  }]
}

Rules:
- If the query is a specific dish, give variations of it
- If the query is a cuisine or ingredient, give 3-5 distinct dishes
- Steps under 15 words each
- Set missingIngredients to ALL ingredients since this is a discovery search`;
}

// src/lib/rateLimits.ts
import rateLimit from "express-rate-limit";
var analyzeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many image analysis requests. Limit is 10 requests per hour."
  }
});
var recipesRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many recipe generation requests. Limit is 20 requests per hour."
  }
});

// src/lib/schemas.ts
import { Type } from "@google/genai";
import { z } from "zod";
var recipesRequestSchema = z.object({
  ingredients: z.array(z.string().trim().min(1, "Ingredient name cannot be empty").max(80)).min(1, "At least one ingredient is required").max(50, "Too many ingredients provided (max 50)")
});
var searchRecipesRequestSchema = z.object({
  query: z.string().trim().min(1, "Search query must be at least 1 character").max(100, "Search query must be 100 characters or fewer")
});
var analyzeResponseSchema = z.object({
  ingredients: z.array(z.string().trim().min(1)).max(20).transform(
    (items) => Array.from(new Set(items.map((item) => item.toLowerCase().trim())))
  ),
  confidence: z.number().min(0).max(1)
});
var verifyIngredientsResponseSchema = z.object({
  verified: z.array(z.string().trim().min(1)).transform(
    (items) => Array.from(new Set(items.map((item) => item.toLowerCase().trim())))
  ),
  removed: z.array(z.string())
});
var recipeSchema = z.object({
  name: z.string().min(1),
  time: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  ingredients: z.array(z.string()),
  missingIngredients: z.array(z.string()),
  steps: z.array(z.string()).min(1).max(8),
  nutrition: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number()
  })
});
var recipesResponseSchema = z.object({
  recipes: z.array(recipeSchema)
});
var geminiAnalyzeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    ingredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Directly visible food ingredients in common English"
    },
    confidence: {
      type: Type.NUMBER,
      description: "Overall detection certainty between 0 and 1"
    }
  },
  required: ["ingredients", "confidence"]
};
var geminiVerifyIngredientsResponseSchema = {
  type: Type.OBJECT,
  properties: {
    verified: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Items confidently located in the photo"
    },
    removed: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Items that cannot be directly located in the photo"
    }
  },
  required: ["verified", "removed"]
};
var geminiRecipesResponseSchema = {
  type: Type.OBJECT,
  properties: {
    recipes: {
      type: Type.ARRAY,
      description: "List of generated recipes",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Recipe title"
          },
          time: {
            type: Type.STRING,
            description: 'Total preparation and cook time, e.g. "15 min"'
          },
          difficulty: {
            type: Type.STRING,
            enum: ["Easy", "Medium", "Hard"],
            description: "Difficulty level: Easy, Medium, or Hard"
          },
          ingredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Full list of ingredients for this recipe"
          },
          missingIngredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Ingredients the user needs to buy for this recipe"
          },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3 to 5 concise preparation steps, under 15 words each"
          },
          nutrition: {
            type: Type.OBJECT,
            properties: {
              calories: {
                type: Type.NUMBER,
                description: "Estimated calories per serving"
              },
              protein: {
                type: Type.NUMBER,
                description: "Estimated protein in grams per serving"
              },
              carbs: {
                type: Type.NUMBER,
                description: "Estimated carbohydrates in grams per serving"
              }
            },
            required: ["calories", "protein", "carbs"]
          }
        },
        required: [
          "name",
          "time",
          "difficulty",
          "ingredients",
          "missingIngredients",
          "steps",
          "nutrition"
        ]
      }
    }
  },
  required: ["recipes"]
};

// src/routes/analyze.ts
var MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
var ANALYZE_TEMPERATURE = 0.1;
var InvalidMimeTypeError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidMimeTypeError";
  }
};
function dedupeIngredients(items) {
  const seen = [];
  const canon = (s) => s.toLowerCase().trim().replace(/s$/, "");
  for (const item of items) {
    const key = canon(item);
    const isDupe = seen.some(
      (existing) => existing.includes(key) || key.includes(existing)
    );
    if (!isDupe) seen.push(key);
    else continue;
    seen[seen.length - 1] = key;
  }
  const result = [];
  const usedKeys = /* @__PURE__ */ new Set();
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
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new InvalidMimeTypeError("Only image files are allowed."));
      return;
    }
    cb(null, true);
  }
});
var router = Router();
router.post(
  "/",
  analyzeRateLimiter,
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        if (err instanceof MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({
              error: "Image file is too large. Maximum allowed size is 10MB."
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
  async (req, res, next) => {
    try {
      if (!req.file || !req.file.buffer) {
        res.status(400).json({
          error: 'Missing required image file in field "image".'
        });
        return;
      }
      const base64String = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype || "image/jpeg";
      const pass1Start = Date.now();
      const rawResult = await generateJSON({
        prompt: ANALYZE_IMAGE_PROMPT,
        image: {
          mimeType,
          base64Data: base64String
        },
        responseSchema: geminiAnalyzeResponseSchema,
        temperature: ANALYZE_TEMPERATURE
      });
      const validation = analyzeResponseSchema.safeParse(rawResult);
      if (!validation.success) {
        throw new GeminiServiceError("AI returned malformed response.", 502);
      }
      const parsed = validation.data;
      if (parsed.ingredients.length === 0) {
        res.json({ ingredients: [], confidence: parsed.confidence });
        return;
      }
      let finalIngredients = parsed.ingredients;
      const pass1Elapsed = Date.now() - pass1Start;
      if (!process.env.VERCEL && pass1Elapsed < 4e3) {
        try {
          const verifyRawResult = await Promise.race([
            generateJSON({
              prompt: buildVerifyIngredientsPrompt(parsed.ingredients),
              image: {
                mimeType,
                base64Data: base64String
              },
              responseSchema: geminiVerifyIngredientsResponseSchema,
              temperature: ANALYZE_TEMPERATURE
            }),
            new Promise(
              (_, reject) => setTimeout(() => reject(new Error("Verify pass timeout")), 4500)
            )
          ]);
          const verifyValidation = verifyIngredientsResponseSchema.safeParse(verifyRawResult);
          if (verifyValidation.success) {
            finalIngredients = verifyValidation.data.verified;
          }
        } catch {
        }
      }
      const cleaned = dedupeIngredients(finalIngredients);
      res.json({ ingredients: cleaned, confidence: parsed.confidence });
    } catch (err) {
      next(err);
    }
  }
);
var analyze_default = router;

// src/routes/recipes.ts
import { Router as Router2 } from "express";
var router2 = Router2();
async function handleGenerateRecipes(req, res, next) {
  try {
    const bodyValidation = recipesRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      const firstIssue = bodyValidation.error.issues[0];
      res.status(400).json({
        error: firstIssue ? firstIssue.message : "Invalid request body."
      });
      return;
    }
    const { ingredients } = bodyValidation.data;
    const prompt = buildRecipesPrompt(ingredients);
    const rawResult = await generateJSON({
      prompt,
      responseSchema: geminiRecipesResponseSchema
    });
    const responseValidation = recipesResponseSchema.safeParse(rawResult);
    if (!responseValidation.success) {
      throw new GeminiServiceError("AI returned malformed response.", 502);
    }
    res.status(200).json({
      recipes: responseValidation.data.recipes
    });
  } catch (err) {
    next(err);
  }
}
async function handleSearchRecipes(req, res, next) {
  try {
    const bodyValidation = searchRecipesRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      const firstIssue = bodyValidation.error.issues[0];
      res.status(400).json({
        error: firstIssue ? firstIssue.message : "Invalid search query."
      });
      return;
    }
    const { query } = bodyValidation.data;
    const prompt = buildSearchRecipesPrompt(query);
    const rawResult = await generateJSON({
      prompt,
      responseSchema: geminiRecipesResponseSchema,
      temperature: 0.7
    });
    const responseValidation = recipesResponseSchema.safeParse(rawResult);
    if (!responseValidation.success) {
      throw new GeminiServiceError("AI returned malformed response.", 502);
    }
    const normalizedRecipes = responseValidation.data.recipes.map((recipe) => ({
      ...recipe,
      missingIngredients: recipe.missingIngredients.length > 0 ? recipe.missingIngredients : recipe.ingredients
    }));
    res.status(200).json({
      recipes: normalizedRecipes,
      query
    });
  } catch (err) {
    next(err);
  }
}
router2.post("/", recipesRateLimiter, handleGenerateRecipes);
router2.post("/search-recipes", recipesRateLimiter, handleSearchRecipes);
var recipes_default = router2;

// src/apiApp.ts
dotenv2.config();
function createApiApp() {
  const app2 = express();
  app2.set("trust proxy", 1);
  const configuredOrigin = (process.env.FRONTEND_ORIGIN || "").trim().replace(/\/+$/, "");
  app2.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        const normalizedOrigin = origin.replace(/\/+$/, "");
        if (normalizedOrigin === configuredOrigin || normalizedOrigin === "http://localhost:3000" || normalizedOrigin === "http://localhost:5173" || normalizedOrigin.endsWith(".vercel.app") || normalizedOrigin.endsWith(".run.app")) {
          callback(null, true);
          return;
        }
        callback(null, true);
      },
      methods: ["GET", "POST", "OPTIONS"]
    })
  );
  app2.use(express.json({ limit: "1mb" }));
  app2.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: Date.now()
    });
  });
  app2.use("/api/analyze", analyze_default);
  app2.use("/api/recipes", recipes_default);
  app2.post("/api/search-recipes", recipesRateLimiter, handleSearchRecipes);
  return app2;
}
function attachErrorHandler(app2) {
  app2.use((err, _req, res, _next) => {
    if (err instanceof GeminiServiceError) {
      console.error(
        `[GeminiServiceError] Status ${err.statusCode}:`,
        err.message
      );
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    if (err && typeof err === "object" && "type" in err && err.type === "entity.too.large") {
      res.status(413).json({
        error: "Request payload is too large. Maximum allowed size is 1MB."
      });
      return;
    }
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ error: "Invalid JSON payload." });
      return;
    }
    const message = err instanceof Error ? err.message : "Internal server error.";
    console.error("[UnhandledServerError]:", message);
    res.status(500).json({
      error: message || "An unexpected error occurred."
    });
  });
}

// src/vercelEntry.ts
var config = {
  maxDuration: 60
};
var app = createApiApp();
attachErrorHandler(app);
var vercelEntry_default = app;
export {
  config,
  vercelEntry_default as default
};
