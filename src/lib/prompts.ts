export const ANALYZE_IMAGE_PROMPT = `You are a forensic fridge scanner. Your job is to list ONLY items you 
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

SCAN METHOD — check each zone separately:
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

export function buildVerifyIngredientsPrompt(ingredients: string[]): string {
  return `You previously identified these items in a fridge photo:
${ingredients.join(', ')}

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

export function buildRecipesPrompt(ingredients: string[]): string {
  return `You are a professional chef. Given these available ingredients:
${ingredients.join(', ')}

Generate 3 recipes that use mostly these ingredients. Some recipes may 
need 1-3 additional pantry staples (salt, oil, butter, pasta, rice, etc.) 
— list those separately as "missingIngredients".

Rules:
- Prefer recipes that use MORE of the available ingredients
- Keep steps under 15 words each
- Nutrition values are estimates per serving
- No markdown, no prose, JSON only`;
}

export function buildSearchRecipesPrompt(query: string): string {
  return `Generate 3-5 recipes that match this search query: "${query}"

Return ONLY valid JSON:
{
  "recipes": [{
    "name": string,
    "time": string,
    "difficulty": "Easy" | "Medium" | "Hard",
    "ingredients": string[],
    "missingIngredients": string[],  // assume user has NOTHING — list all needed
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
