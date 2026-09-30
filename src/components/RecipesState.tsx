import React, { useState, useEffect, useRef } from 'react';
import SkeletonRecipeCard from './SkeletonRecipeCard';
import RotatingText from './RotatingText';

export interface Recipe {
  name: string;
  time: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  ingredients: string[];
  missingIngredients: string[];
  steps: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
  };
}

export interface ShoppingListItem {
  name: string;
  checked: boolean;
  fromRecipe?: string;
}

interface RecipesStateProps {
  recipes: Recipe[];
  availableIngredients: string[];
  favoriteNames: string[];
  shoppingList: ShoppingListItem[];
  isLoading?: boolean;
  externalSearchQuery?: string;
  onExternalSearchQueryChange?: (value: string) => void;
  onToggleFavorite: (name: string) => void;
  onToggleShoppingItem: (ingredientName: string, fromRecipe?: string) => void;
  onAddMultipleToShoppingList: (
    ingredientNames: string[],
    fromRecipe?: string
  ) => void;
  onToggleCheckShoppingItem: (ingredientName: string) => void;
  onRemoveShoppingItem: (ingredientName: string) => void;
  onClearShoppingList: () => void;
  onBack: () => void;
}

type FilterMode = 'all' | 'favorites';

const RECIPE_LOADING_MESSAGES = [
  'Reading your ingredients...',
  'Thinking of recipes...',
  'Plating your options...',
];

export default function RecipesState({
  recipes,
  availableIngredients,
  favoriteNames,
  shoppingList,
  isLoading = false,
  externalSearchQuery,
  onExternalSearchQueryChange,
  onToggleFavorite,
  onToggleShoppingItem,
  onAddMultipleToShoppingList,
  onToggleCheckShoppingItem,
  onRemoveShoppingItem,
  onClearShoppingList,
  onBack,
}: RecipesStateProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState(
    externalSearchQuery ?? ''
  );
  const searchQuery =
    externalSearchQuery !== undefined
      ? externalSearchQuery
      : internalSearchQuery;
  const setSearchQuery = (val: string) => {
    setInternalSearchQuery(val);
    onExternalSearchQueryChange?.(val);
  };
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState(false);

  // Universal search state
  const [isSearchingUniversal, setIsSearchingUniversal] = useState(false);
  const [universalSearchResults, setUniversalSearchResults] = useState<{
    query: string;
    recipes: Recipe[];
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);

  const normalizedAvailable = new Set(
    availableIngredients.map((i) => i.toLowerCase().trim())
  );

  const isInShoppingList = (ingredientName: string) => {
    const norm = ingredientName.toLowerCase().trim();
    return shoppingList.some((item) => item.name.toLowerCase() === norm);
  };

  // Compute missing ingredients for a recipe
  const getMissingForRecipe = (
    recipe: Recipe,
    isUniversalResult: boolean
  ): string[] => {
    if (isUniversalResult) {
      return recipe.missingIngredients && recipe.missingIngredients.length > 0
        ? recipe.missingIngredients
        : recipe.ingredients;
    }

    const fromMissingField = recipe.missingIngredients ?? [];
    const fromIngredientsDiff = recipe.ingredients.filter(
      (ing) => !normalizedAvailable.has(ing.toLowerCase().trim())
    );
    const combined = [...fromMissingField, ...fromIngredientsDiff];
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const item of combined) {
      const norm = item.toLowerCase().trim();
      if (norm && !seen.has(norm) && !normalizedAvailable.has(norm)) {
        seen.add(norm);
        unique.push(item);
      }
    }
    return unique;
  };

  const trimmedQuery = searchQuery.trim();

  // 1. Instant local filtering of the 3 fridge-generated recipes
  const localMatches = recipes.filter((recipe) => {
    const matchesSearch = recipe.name
      .toLowerCase()
      .includes(trimmedQuery.toLowerCase());
    const matchesFavorites =
      filterMode === 'all' || favoriteNames.includes(recipe.name);
    return matchesSearch && matchesFavorites;
  });

  // Also check raw local matches ignoring the Favorites tab for deciding auto-universal search
  const rawLocalQueryMatches = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(trimmedQuery.toLowerCase())
  );

  const executeUniversalSearch = async (queryToRun: string) => {
    const cleanQuery = queryToRun.trim();
    if (!cleanQuery) return;

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearchingUniversal(true);
    setSearchError(null);

    try {
      const response = await fetch('/api/search-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanQuery }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          errBody.error || 'Could not search recipes right now.'
        );
      }

      const data = (await response.json()) as {
        recipes?: Recipe[];
        query?: string;
      };

      if (!controller.signal.aborted) {
        setUniversalSearchResults({
          query: data.query || cleanQuery,
          recipes: Array.isArray(data.recipes) ? data.recipes : [],
        });
        setIsSearchingUniversal(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (!controller.signal.aborted) {
        setSearchError(
          err instanceof Error
            ? err.message
            : 'Could not search recipes right now.'
        );
        setIsSearchingUniversal(false);
      }
    }
  };

  // Debounce search input by 400ms after user stops typing
  useEffect(() => {
    if (isLoading) return;

    if (!trimmedQuery) {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      setIsSearchingUniversal(false);
      setUniversalSearchResults(null);
      setSearchError(null);
      return;
    }

    // Check if local matches exist for the typed query
    const matchingLocal = recipes.filter((r) =>
      r.name.toLowerCase().includes(trimmedQuery.toLowerCase())
    );

    // If user changed query from previous universal search and local matches exist, exit old universal results
    if (
      universalSearchResults &&
      universalSearchResults.query.toLowerCase() !==
        trimmedQuery.toLowerCase() &&
      matchingLocal.length > 0
    ) {
      setUniversalSearchResults(null);
    }

    const timer = window.setTimeout(() => {
      // 3. If no local matches exist, automatically call POST /api/search-recipes
      if (matchingLocal.length === 0) {
        executeUniversalSearch(trimmedQuery);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [trimmedQuery, recipes, isLoading]);

  const handleClearSearch = () => {
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    setSearchQuery('');
    setIsSearchingUniversal(false);
    setUniversalSearchResults(null);
    setSearchError(null);
  };

  const isUniversalSearchMode = universalSearchResults !== null;
  const displayedRecipes = isUniversalSearchMode
    ? universalSearchResults.recipes
    : localMatches;

  const handlePrintRecipe = () => {
    window.print();
  };

  const uncheckedCount = shoppingList.filter((i) => !i.checked).length;

  return (
    <>
      {/* Main Screen UI (hidden when printing) */}
      <div className="no-print animate-view-in w-full max-w-5xl mx-auto px-5 py-10">
        {/* Top Navigation Row with Back & Shopping List Trigger */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="ease-custom inline-flex items-center gap-2 text-sm font-medium text-[#8e8e8e] hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            <span>←</span>
            <span>Edit ingredients</span>
          </button>

          <button
            type="button"
            onClick={() => setIsShoppingModalOpen(true)}
            className="ease-custom inline-flex items-center gap-2 rounded-[999px] backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/15 px-4 py-2 text-xs sm:text-sm font-medium text-white transition-all duration-200 cursor-pointer"
          >
            <span>Shopping List</span>
            {shoppingList.length > 0 && (
              <span className="rounded-[999px] bg-white text-black px-2 py-0.5 text-[11px] font-semibold leading-none">
                {uncheckedCount > 0 ? uncheckedCount : shoppingList.length}
              </span>
            )}
          </button>
        </div>

        {/* Heading + Search & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              {isUniversalSearchMode
                ? `Results for '${universalSearchResults.query}'`
                : 'Recipes you can make right now'}
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-[#8e8e8e]">
              {isUniversalSearchMode
                ? `Results for '${universalSearchResults.query}' — showing all recipes (not filtered by your fridge)`
                : 'Tailored to the ingredients inside your fridge.'}
            </p>
          </div>

          {/* Search Input + All/Favorites Toggle (disabled/hidden while initial recipe generation is loading) */}
          {!isLoading && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex flex-col">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search any recipe or dish..."
                    aria-label="Search recipes"
                    className="ease-custom w-full sm:w-64 rounded-[999px] backdrop-blur-xl bg-white/5 border border-white/15 pl-4 pr-9 py-2 text-sm text-white placeholder-[#8e8e8e] focus:outline-none focus:border-white/35 transition-colors"
                  />
                  {searchQuery.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      aria-label="Clear search"
                      title="Clear search"
                      className="ease-custom absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-xs text-white/80 hover:text-white transition-colors cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                {isSearchingUniversal && (
                  <span className="mt-1.5 pl-3 text-xs text-white/75 animate-pulse">
                    Searching all recipes...
                  </span>
                )}
              </div>

              {/* Hide All/Favorites pill filter during universal search mode */}
              {!isUniversalSearchMode && (
                <div className="inline-flex rounded-[999px] backdrop-blur-xl bg-white/5 border border-white/10 p-1 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`ease-custom rounded-[999px] px-4 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      filterMode === 'all'
                        ? 'bg-white text-black'
                        : 'text-[#8e8e8e] hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('favorites')}
                    className={`ease-custom rounded-[999px] px-4 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      filterMode === 'favorites'
                        ? 'bg-white text-black'
                        : 'text-[#8e8e8e] hover:text-white'
                    }`}
                  >
                    Favorites ({favoriteNames.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {searchError && !isLoading && (
          <div
            role="alert"
            className="mt-5 rounded-[16px] backdrop-blur-md bg-red-500/15 border border-red-400/30 px-4 py-3 text-xs text-red-200"
          >
            {searchError}
          </div>
        )}

        {/* LOADING STATE 2: Rotating status text + 3 SkeletonRecipeCards */}
        {isLoading ? (
          <div className="mt-8">
            <div className="mb-4">
              <RotatingText messages={RECIPE_LOADING_MESSAGES} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[0, 1, 2].map((idx) => (
                <SkeletonRecipeCard key={idx} index={idx} />
              ))}
            </div>
          </div>
        ) : displayedRecipes.length === 0 ? (
          <div className="mt-8 rounded-[24px] backdrop-blur-xl bg-white/5 border border-white/10 p-10 text-center">
            {isSearchingUniversal ? (
              <p className="text-base text-white/80">
                Searching all recipes for &ldquo;{trimmedQuery}&rdquo;...
              </p>
            ) : (
              <>
                <p className="text-base text-white/80">
                  {filterMode === 'favorites' && favoriteNames.length === 0
                    ? 'You have no favorite recipes yet. Tap the ♡ icon on a card to save one.'
                    : 'No matching recipes found.'}
                </p>
                {trimmedQuery && !isUniversalSearchMode && (
                  <button
                    type="button"
                    onClick={() => executeUniversalSearch(trimmedQuery)}
                    className="ease-custom mt-4 inline-flex items-center gap-2 rounded-[999px] bg-white text-black px-5 py-2.5 text-xs font-semibold hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    <span>
                      Search all recipes for &ldquo;{trimmedQuery}&rdquo;
                    </span>
                    <span>→</span>
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              {displayedRecipes.map((recipe, index) => {
                const isFavorite = favoriteNames.includes(recipe.name);
                const missingItems = getMissingForRecipe(
                  recipe,
                  isUniversalSearchMode
                );
                const allMissingAdded =
                  missingItems.length > 0 &&
                  missingItems.every((item) => isInShoppingList(item));

                return (
                  <article
                    key={`${recipe.name}-${index}`}
                    style={{ animationDelay: `${index * 60}ms` }}
                    onClick={() => setActiveRecipe(recipe)}
                    className="animate-chip-in ease-custom group flex flex-col justify-between rounded-[24px] backdrop-blur-xl bg-white/5 border border-white/10 p-6 hover:-translate-y-1 hover:border-white/20 transition-all duration-300 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold tracking-tight text-white">
                          {recipe.name}
                        </h3>

                        {/* Favorite Heart Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(recipe.name);
                          }}
                          aria-label={
                            isFavorite
                              ? `Remove ${recipe.name} from favorites`
                              : `Add ${recipe.name} to favorites`
                          }
                          className={`ease-custom shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 cursor-pointer ${
                            isFavorite
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-white/75 border-white/15 hover:bg-white/15 hover:text-white'
                          }`}
                        >
                          {isFavorite ? '♥' : '♡'}
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-[999px] bg-white/10 border border-white/15 px-3 py-1 text-xs font-medium text-white/90">
                          {recipe.time}
                        </span>
                        <span className="rounded-[999px] bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-[#8e8e8e]">
                          {recipe.difficulty}
                        </span>
                      </div>

                      <ol className="mt-5 space-y-3 text-sm text-white/80 leading-relaxed">
                        {recipe.steps.map((step, stepIdx) => (
                          <li key={stepIdx} className="flex gap-3">
                            <span className="font-semibold text-white/50 select-none">
                              {stepIdx + 1}.
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>

                      {/* Missing Ingredients / "You'd need to buy" Section */}
                      {missingItems.length > 0 && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-5 pt-4 border-t border-white/10"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="text-[11px] uppercase tracking-wider font-medium text-[#8e8e8e]">
                              {isUniversalSearchMode
                                ? `You'd need to buy (${missingItems.length})`
                                : `Missing (${missingItems.length})`}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onAddMultipleToShoppingList(
                                  missingItems,
                                  recipe.name
                                )
                              }
                              disabled={allMissingAdded}
                              className="ease-custom text-[11px] font-medium text-white/80 hover:text-white disabled:text-white/40 transition-colors cursor-pointer disabled:cursor-default"
                            >
                              {allMissingAdded
                                ? '✓ Added to list'
                                : '+ Add all to list'}
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {missingItems.map((missing) => {
                              const added = isInShoppingList(missing);
                              return (
                                <button
                                  key={missing}
                                  type="button"
                                  onClick={() =>
                                    onToggleShoppingItem(missing, recipe.name)
                                  }
                                  title={
                                    added
                                      ? 'Remove from shopping list'
                                      : 'Add to shopping list'
                                  }
                                  className={`ease-custom inline-flex items-center gap-1.5 rounded-[999px] px-2.5 py-1 text-xs transition-all duration-200 cursor-pointer border ${
                                    added
                                      ? 'bg-white text-black border-white font-medium'
                                      : 'bg-white/5 text-white/75 border-white/15 hover:bg-white/15 hover:text-white'
                                  }`}
                                >
                                  <span>{added ? '✓' : '+'}</span>
                                  <span className="capitalize">{missing}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-[#8e8e8e] group-hover:text-white/90 transition-colors">
                      <span>{recipe.nutrition.calories} kcal</span>
                      <span>View nutrition &amp; print →</span>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* 2. If local matches exist during a search query, also show a "Search all recipes" option below */}
            {trimmedQuery &&
              !isUniversalSearchMode &&
              rawLocalQueryMatches.length > 0 && (
                <div className="mt-7 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[20px] backdrop-blur-xl bg-white/5 border border-white/10 px-6 py-4">
                  <p className="text-xs sm:text-sm text-[#8e8e8e]">
                    Showing matches from your current fridge recipes. Want more{' '}
                    <span className="text-white font-medium">
                      &ldquo;{trimmedQuery}&rdquo;
                    </span>{' '}
                    ideas?
                  </p>
                  <button
                    type="button"
                    disabled={isSearchingUniversal}
                    onClick={() => executeUniversalSearch(trimmedQuery)}
                    className="ease-custom shrink-0 inline-flex items-center gap-2 rounded-[999px] bg-white text-black px-5 py-2 text-xs font-semibold hover:scale-[1.02] transition-all duration-200 cursor-pointer disabled:opacity-50"
                  >
                    <span>
                      {isSearchingUniversal
                        ? 'Searching all recipes...'
                        : 'Search all recipes'}
                    </span>
                    <span>→</span>
                  </button>
                </div>
              )}
          </>
        )}

        {/* Nutrition & Print Modal */}
        {activeRecipe && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-recipe-title"
            onClick={() => setActiveRecipe(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-view-in w-full max-w-lg rounded-[24px] backdrop-blur-xl bg-white/[0.08] border border-white/15 p-6 sm:p-8 text-white shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id="modal-recipe-title"
                    className="text-xl sm:text-2xl font-semibold tracking-tight text-white"
                  >
                    {activeRecipe.name}
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-[999px] bg-white/10 border border-white/15 px-3 py-1 text-xs font-medium text-white/90">
                      {activeRecipe.time}
                    </span>
                    <span className="rounded-[999px] bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-[#8e8e8e]">
                      {activeRecipe.difficulty}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Print Button inside Modal */}
                  <button
                    type="button"
                    onClick={handlePrintRecipe}
                    aria-label="Print recipe"
                    className="ease-custom inline-flex items-center gap-1.5 rounded-[999px] bg-white text-black px-4 py-1.5 text-xs font-semibold hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <span>Print</span>
                  </button>

                  {/* Close Modal Button */}
                  <button
                    type="button"
                    onClick={() => setActiveRecipe(null)}
                    aria-label="Close modal"
                    className="ease-custom inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 border border-white/15 text-sm text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Estimated Nutrition Facts */}
              <div className="mt-6">
                <h4 className="text-xs uppercase tracking-wider text-[#8e8e8e] font-medium">
                  Estimated Nutrition (Per Serving)
                </h4>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="rounded-[16px] bg-white/5 border border-white/10 p-3.5 text-center">
                    <div className="text-xl font-semibold text-white">
                      {activeRecipe.nutrition.calories}
                    </div>
                    <div className="mt-0.5 text-xs text-[#8e8e8e]">Calories</div>
                  </div>
                  <div className="rounded-[16px] bg-white/5 border border-white/10 p-3.5 text-center">
                    <div className="text-xl font-semibold text-white">
                      {activeRecipe.nutrition.protein}g
                    </div>
                    <div className="mt-0.5 text-xs text-[#8e8e8e]">Protein</div>
                  </div>
                  <div className="rounded-[16px] bg-white/5 border border-white/10 p-3.5 text-center">
                    <div className="text-xl font-semibold text-white">
                      {activeRecipe.nutrition.carbs}g
                    </div>
                    <div className="mt-0.5 text-xs text-[#8e8e8e]">Carbs</div>
                  </div>
                </div>
              </div>

              {/* Ingredients List with Missing / Shopping List Badges */}
              <div className="mt-6">
                <h4 className="text-xs uppercase tracking-wider text-[#8e8e8e] font-medium">
                  Ingredients
                </h4>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {activeRecipe.ingredients.map((item) => {
                    const isMissing =
                      isUniversalSearchMode ||
                      !normalizedAvailable.has(item.toLowerCase().trim()) ||
                      (activeRecipe.missingIngredients ?? []).some(
                        (m) =>
                          m.toLowerCase().trim() === item.toLowerCase().trim()
                      );
                    const inList = isInShoppingList(item);

                    if (isMissing) {
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            onToggleShoppingItem(item, activeRecipe.name)
                          }
                          className={`ease-custom inline-flex items-center gap-1.5 rounded-[999px] px-3 py-1 text-xs capitalize border transition-all cursor-pointer ${
                            inList
                              ? 'bg-white text-black border-white font-medium'
                              : 'bg-white/5 border-dashed border-white/30 text-white/85 hover:bg-white/15'
                          }`}
                        >
                          <span>{inList ? '✓ In list:' : '+ Buy:'}</span>
                          <span>{item}</span>
                        </button>
                      );
                    }

                    return (
                      <span
                        key={item}
                        className="rounded-[999px] bg-white/10 border border-white/15 px-3 py-1 text-xs text-white/90 capitalize"
                      >
                        ✓ {item}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Preparation Steps */}
              <div className="mt-6">
                <h4 className="text-xs uppercase tracking-wider text-[#8e8e8e] font-medium">
                  Preparation Steps
                </h4>
                <ol className="mt-3 space-y-2.5 text-sm text-white/85 leading-relaxed">
                  {activeRecipe.steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="font-semibold text-white/50 select-none">
                        {idx + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Persistent Shopping List Modal */}
        {isShoppingModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shopping-list-title"
            onClick={() => setIsShoppingModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-view-in w-full max-w-md rounded-[24px] backdrop-blur-xl bg-white/[0.08] border border-white/15 p-6 sm:p-8 text-white shadow-2xl max-h-[85vh] flex flex-col"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id="shopping-list-title"
                    className="text-xl sm:text-2xl font-semibold tracking-tight text-white"
                  >
                    Shopping List
                  </h3>
                  <p className="mt-1 text-xs text-[#8e8e8e]">
                    Saved automatically on this device.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsShoppingModalOpen(false)}
                  aria-label="Close shopping list"
                  className="ease-custom inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 border border-white/15 text-sm text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                >
                  ×
                </button>
              </div>

              {shoppingList.length === 0 ? (
                <div className="my-10 text-center">
                  <p className="text-sm text-white/75">
                    Your shopping list is empty.
                  </p>
                  <p className="mt-1 text-xs text-[#8e8e8e]">
                    Tap any missing ingredient on a recipe card to save it here.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="mt-6 space-y-2.5 overflow-y-auto pr-1 flex-1">
                    {shoppingList.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-center justify-between gap-3 rounded-[16px] bg-white/5 border border-white/10 px-4 py-3"
                      >
                        <button
                          type="button"
                          onClick={() => onToggleCheckShoppingItem(item.name)}
                          className="flex items-center gap-3 text-left flex-1 cursor-pointer"
                        >
                          <span
                            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${
                              item.checked
                                ? 'bg-white text-black border-white font-bold'
                                : 'border-white/30 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <div>
                            <div
                              className={`text-sm capitalize transition-colors ${
                                item.checked
                                  ? 'line-through text-[#8e8e8e]'
                                  : 'text-white font-medium'
                              }`}
                            >
                              {item.name}
                            </div>
                            {item.fromRecipe && (
                              <div className="text-[11px] text-[#8e8e8e]">
                                For {item.fromRecipe}
                              </div>
                            )}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => onRemoveShoppingItem(item.name)}
                          aria-label={`Remove ${item.name}`}
                          className="ease-custom inline-flex h-7 w-7 items-center justify-center rounded-full text-[#8e8e8e] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-[#8e8e8e]">
                      {uncheckedCount} remaining of {shoppingList.length}
                    </span>
                    <button
                      type="button"
                      onClick={onClearShoppingList}
                      className="ease-custom text-xs font-medium text-[#8e8e8e] hover:text-white transition-colors cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Clean Printable Sheet (Only visible during window.print()) */}
      {activeRecipe && (
        <div className="print-only p-8 text-black bg-white">
          <h1 className="text-3xl font-bold">{activeRecipe.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Time: {activeRecipe.time} • Difficulty: {activeRecipe.difficulty}
          </p>

          <div className="mt-6 border-t border-b border-gray-300 py-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Estimated Nutrition (Per Serving)
            </h2>
            <p className="mt-1 text-sm">
              <strong>Calories:</strong> {activeRecipe.nutrition.calories} kcal
              {' | '}
              <strong>Protein:</strong> {activeRecipe.nutrition.protein}g{' | '}
              <strong>Carbs:</strong> {activeRecipe.nutrition.carbs}g
            </p>
          </div>

          <div className="mt-6">
            <h2 className="text-base font-bold">Ingredients</h2>
            <ul className="mt-2 list-disc list-inside text-sm space-y-1">
              {activeRecipe.ingredients.map((ing) => (
                <li key={ing} className="capitalize">
                  {ing}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <h2 className="text-base font-bold">Preparation Steps</h2>
            <ol className="mt-2 list-decimal list-inside text-sm space-y-2">
              {activeRecipe.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
