import { Type, Schema } from '@google/genai';
import { z } from 'zod';

/**
 * Request body validation for POST /api/recipes
 */
export const recipesRequestSchema = z.object({
  ingredients: z
    .array(z.string().trim().min(1, 'Ingredient name cannot be empty').max(80))
    .min(1, 'At least one ingredient is required')
    .max(50, 'Too many ingredients provided (max 50)'),
});

export type RecipesRequestInput = z.infer<typeof recipesRequestSchema>;

/**
 * Request body validation for POST /api/search-recipes
 */
export const searchRecipesRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'Search query must be at least 1 character')
    .max(100, 'Search query must be 100 characters or fewer'),
});

export type SearchRecipesRequestInput = z.infer<
  typeof searchRecipesRequestSchema
>;

/**
 * Response validation for POST /api/analyze (initial pass)
 */
export const analyzeResponseSchema = z.object({
  ingredients: z
    .array(z.string().trim().min(1))
    .max(20)
    .transform((items) =>
      Array.from(new Set(items.map((item) => item.toLowerCase().trim())))
    ),
  confidence: z.number().min(0).max(1),
});

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

/**
 * Response validation for POST /api/analyze self-verification pass
 */
export const verifyIngredientsResponseSchema = z.object({
  verified: z
    .array(z.string().trim().min(1))
    .transform((items) =>
      Array.from(new Set(items.map((item) => item.toLowerCase().trim())))
    ),
  removed: z.array(z.string()),
});

export type VerifyIngredientsResponse = z.infer<
  typeof verifyIngredientsResponseSchema
>;

/**
 * Recipe Type & Zod validation for POST /api/recipes and POST /api/search-recipes response
 */
export const recipeSchema = z.object({
  name: z.string().min(1),
  time: z.string().min(1),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  ingredients: z.array(z.string()),
  missingIngredients: z.array(z.string()),
  steps: z.array(z.string()).min(1).max(8),
  nutrition: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
  }),
});

export type Recipe = z.infer<typeof recipeSchema>;

export const recipesResponseSchema = z.object({
  recipes: z.array(recipeSchema),
});

export type RecipesResponse = z.infer<typeof recipesResponseSchema>;

/**
 * Gemini structured output responseSchema for /api/analyze (initial pass)
 */
export const geminiAnalyzeResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ingredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Directly visible food ingredients in common English',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Overall detection certainty between 0 and 1',
    },
  },
  required: ['ingredients', 'confidence'],
};

/**
 * Gemini structured output responseSchema for /api/analyze (verification pass)
 */
export const geminiVerifyIngredientsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    verified: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Items confidently located in the photo',
    },
    removed: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Items that cannot be directly located in the photo',
    },
  },
  required: ['verified', 'removed'],
};

/**
 * Gemini structured output responseSchema for /api/recipes and /api/search-recipes
 */
export const geminiRecipesResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recipes: {
      type: Type.ARRAY,
      description: 'List of generated recipes',
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: 'Recipe title',
          },
          time: {
            type: Type.STRING,
            description: 'Total preparation and cook time, e.g. "15 min"',
          },
          difficulty: {
            type: Type.STRING,
            enum: ['Easy', 'Medium', 'Hard'],
            description: 'Difficulty level: Easy, Medium, or Hard',
          },
          ingredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Full list of ingredients for this recipe',
          },
          missingIngredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Ingredients the user needs to buy for this recipe',
          },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3 to 5 concise preparation steps, under 15 words each',
          },
          nutrition: {
            type: Type.OBJECT,
            properties: {
              calories: {
                type: Type.NUMBER,
                description: 'Estimated calories per serving',
              },
              protein: {
                type: Type.NUMBER,
                description: 'Estimated protein in grams per serving',
              },
              carbs: {
                type: Type.NUMBER,
                description: 'Estimated carbohydrates in grams per serving',
              },
            },
            required: ['calories', 'protein', 'carbs'],
          },
        },
        required: [
          'name',
          'time',
          'difficulty',
          'ingredients',
          'missingIngredients',
          'steps',
          'nutrition',
        ],
      },
    },
  },
  required: ['recipes'],
};
