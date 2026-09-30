import { Router, Request, Response, NextFunction } from 'express';
import { generateJSON, GeminiServiceError } from '../lib/gemini';
import { buildRecipesPrompt, buildSearchRecipesPrompt } from '../lib/prompts';
import { recipesRateLimiter } from '../lib/rateLimits';
import {
  recipesRequestSchema,
  searchRecipesRequestSchema,
  recipesResponseSchema,
  geminiRecipesResponseSchema,
} from '../lib/schemas';

const router = Router();

/**
 * POST /api/recipes
 * Generates 3 recipes based on the user's detected fridge ingredients
 */
export async function handleGenerateRecipes(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const bodyValidation = recipesRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      const firstIssue = bodyValidation.error.issues[0];
      res.status(400).json({
        error: firstIssue ? firstIssue.message : 'Invalid request body.',
      });
      return;
    }

    const { ingredients } = bodyValidation.data;
    const prompt = buildRecipesPrompt(ingredients);

    const rawResult = await generateJSON<unknown>({
      prompt,
      responseSchema: geminiRecipesResponseSchema,
    });

    const responseValidation = recipesResponseSchema.safeParse(rawResult);
    if (!responseValidation.success) {
      throw new GeminiServiceError('AI returned malformed response.', 502);
    }

    res.status(200).json({
      recipes: responseValidation.data.recipes,
    });
  } catch (err: unknown) {
    next(err);
  }
}

/**
 * POST /api/search-recipes
 * Universal recipe search by query (1-100 chars), temperature 0.7
 */
export async function handleSearchRecipes(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const bodyValidation = searchRecipesRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      const firstIssue = bodyValidation.error.issues[0];
      res.status(400).json({
        error: firstIssue ? firstIssue.message : 'Invalid search query.',
      });
      return;
    }

    const { query } = bodyValidation.data;
    const prompt = buildSearchRecipesPrompt(query);

    const rawResult = await generateJSON<unknown>({
      prompt,
      responseSchema: geminiRecipesResponseSchema,
      temperature: 0.7,
    });

    const responseValidation = recipesResponseSchema.safeParse(rawResult);
    if (!responseValidation.success) {
      throw new GeminiServiceError('AI returned malformed response.', 502);
    }

    const normalizedRecipes = responseValidation.data.recipes.map((recipe) => ({
      ...recipe,
      missingIngredients:
        recipe.missingIngredients.length > 0
          ? recipe.missingIngredients
          : recipe.ingredients,
    }));

    res.status(200).json({
      recipes: normalizedRecipes,
      query,
    });
  } catch (err: unknown) {
    next(err);
  }
}

router.post('/', recipesRateLimiter, handleGenerateRecipes);
router.post('/search-recipes', recipesRateLimiter, handleSearchRecipes);

export default router;
