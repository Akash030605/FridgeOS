/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import bgVideo from './assets/animationn.mp4';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import UploadState from './components/UploadState';
import IngredientsState from './components/IngredientsState';
import RecipesState, {
  Recipe,
  ShoppingListItem,
} from './components/RecipesState';

type AppMode = 'hero' | 'app';
type SubState = 'upload' | 'ingredients' | 'recipes';

const SHOPPING_LIST_STORAGE_KEY = 'your_fridge_reinvented_shopping_list_v1';

const INITIAL_INGREDIENTS = [
  'eggs',
  'milk',
  'tomatoes',
  'cheese',
  'spinach',
  'onion',
  'garlic',
];

const MOCK_RECIPES: Recipe[] = [
  {
    name: 'Spinach & Cheese Omelette',
    time: '15 min',
    difficulty: 'Easy',
    ingredients: [
      'eggs',
      'milk',
      'spinach',
      'cheese',
      'onion',
      'garlic',
      'butter',
      'chives',
    ],
    missingIngredients: ['butter', 'chives'],
    steps: [
      'Whisk eggs with a splash of milk and season with a pinch of salt.',
      'Sauté diced onion, garlic, and fresh spinach in a warm skillet until wilted.',
      'Pour in the eggs, scatter grated cheese on top, and fold gently once set.',
    ],
    nutrition: {
      calories: 320,
      protein: 24,
      carbs: 4,
    },
  },
  {
    name: 'Tomato Garlic Pasta',
    time: '25 min',
    difficulty: 'Easy',
    ingredients: [
      'tomatoes',
      'garlic',
      'onion',
      'milk',
      'spinach',
      'cheese',
      'pasta',
      'olive oil',
      'basil',
    ],
    missingIngredients: ['pasta', 'olive oil', 'basil'],
    steps: [
      'Simmer chopped tomatoes, minced garlic, and diced onion until saucy.',
      'Stir in a splash of milk and wilted spinach to create a velvety pan sauce.',
      'Toss with warm pasta and finish with melted cheese on top.',
    ],
    nutrition: {
      calories: 480,
      protein: 16,
      carbs: 68,
    },
  },
  {
    name: 'Frittata Muffins',
    time: '30 min',
    difficulty: 'Medium',
    ingredients: [
      'eggs',
      'milk',
      'tomatoes',
      'spinach',
      'onion',
      'garlic',
      'cheese',
      'bell pepper',
      'parmesan',
    ],
    missingIngredients: ['bell pepper', 'parmesan'],
    steps: [
      'Sauté chopped onion, garlic, tomatoes, and spinach until tender.',
      'Beat eggs with milk and fold in the cooked vegetables and shredded cheese.',
      'Divide into a muffin tin and bake at 375°F until golden and puffed.',
    ],
    nutrition: {
      calories: 290,
      protein: 21,
      carbs: 7,
    },
  },
];

// Clean fallback SVG data URI for sample/fallback fridge preview
const FALLBACK_FRIDGE_PREVIEW =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#141418"/>
          <stop offset="100%" stop-color="#08080a"/>
        </linearGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#bg)"/>
      <rect x="140" y="110" width="520" height="780" rx="28" fill="#1d1f26" stroke="rgba(255,255,255,0.16)" stroke-width="3"/>
      <line x1="170" y1="360" x2="630" y2="360" stroke="rgba(255,255,255,0.18)" stroke-width="4"/>
      <line x1="170" y1="610" x2="630" y2="610" stroke="rgba(255,255,255,0.18)" stroke-width="4"/>
      <circle cx="270" cy="290" r="38" fill="#ef4444"/>
      <circle cx="360" cy="298" r="32" fill="#ef4444"/>
      <rect x="460" y="200" width="90" height="145" rx="12" fill="#f8fafc"/>
      <ellipse cx="280" cy="540" rx="55" ry="38" fill="#fef3c7"/>
      <rect x="400" y="490" width="130" height="75" rx="10" fill="#facc15"/>
      <circle cx="310" cy="760" r="52" fill="#22c55e"/>
      <circle cx="460" cy="770" r="40" fill="#f59e0b"/>
    </svg>
  `);

/**
 * Optimizes large camera/phone photos client-side (max 1600px, JPEG 0.85)
 * so uploads through the reverse proxy are fast and never drop connection.
 */
async function optimizeImageForUpload(file: File): Promise<File> {
  if (file.size <= 800 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const tempUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      const maxDim = 1600;
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
            })
          );
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      resolve(file);
    };

    img.src = tempUrl;
  });
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('hero');
  const [subState, setSubState] = useState<SubState>('upload');
  const [previewUrl, setPreviewUrl] = useState<string>(FALLBACK_FRIDGE_PREVIEW);
  const [ingredients, setIngredients] = useState<string[]>(INITIAL_INGREDIENTS);
  const [recipes, setRecipes] = useState<Recipe[]>(MOCK_RECIPES);
  const [favoriteNames, setFavoriteNames] = useState<string[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>(() => {
    try {
      const saved = window.localStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed as ShoppingListItem[];
        }
      }
    } catch {
      // Ignore storage access errors
    }
    return [];
  });
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isFindingRecipes, setIsFindingRecipes] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  const handleNavbarSearchChange = (value: string) => {
    setGlobalSearchQuery(value);
    if (value.trim().length >= 2) {
      setMode('app');
      setSubState('recipes');
    }
  };

  const handleNavbarSearchSubmit = (query: string) => {
    setGlobalSearchQuery(query);
    setMode('app');
    setSubState('recipes');
  };

  const handleNavbarClearSearch = () => {
    setGlobalSearchQuery('');
  };

  const objectUrlRef = useRef<string | null>(null);

  // Clean up created object URLs on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  // Sync shoppingList to persistent localStorage whenever it changes
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SHOPPING_LIST_STORAGE_KEY,
        JSON.stringify(shoppingList)
      );
    } catch {
      // Ignore storage write errors
    }
  }, [shoppingList]);

  const isInApp = mode === 'app';

  const handleToggleFavorite = (name: string) => {
    setFavoriteNames((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
  };

  const handleToggleShoppingItem = (
    ingredientName: string,
    fromRecipe?: string
  ) => {
    const normalized = ingredientName.trim().toLowerCase();
    if (!normalized) return;

    setShoppingList((prev) => {
      const exists = prev.some((item) => item.name.toLowerCase() === normalized);
      if (exists) {
        return prev.filter((item) => item.name.toLowerCase() !== normalized);
      }
      return [
        ...prev,
        {
          name: normalized,
          checked: false,
          fromRecipe,
        },
      ];
    });
  };

  const handleAddMultipleToShoppingList = (
    ingredientNames: string[],
    fromRecipe?: string
  ) => {
    setShoppingList((prev) => {
      const existingNames = new Set(prev.map((i) => i.name.toLowerCase()));
      const additions: ShoppingListItem[] = [];

      for (const raw of ingredientNames) {
        const normalized = raw.trim().toLowerCase();
        if (normalized && !existingNames.has(normalized)) {
          existingNames.add(normalized);
          additions.push({
            name: normalized,
            checked: false,
            fromRecipe,
          });
        }
      }

      return [...prev, ...additions];
    });
  };

  const handleToggleCheckShoppingItem = (ingredientName: string) => {
    const normalized = ingredientName.trim().toLowerCase();
    setShoppingList((prev) =>
      prev.map((item) =>
        item.name.toLowerCase() === normalized
          ? { ...item, checked: !item.checked }
          : item
      )
    );
  };

  const handleRemoveShoppingItem = (ingredientName: string) => {
    const normalized = ingredientName.trim().toLowerCase();
    setShoppingList((prev) =>
      prev.filter((item) => item.name.toLowerCase() !== normalized)
    );
  };

  const handleClearShoppingList = () => {
    setShoppingList([]);
  };

  const handleOpenFridge = () => {
    setUploadError(null);
    setSubState('upload');
    setMode('app');
  };

  const handleUseSamplePhoto = () => {
    setUploadError(null);
    setPreviewUrl(FALLBACK_FRIDGE_PREVIEW);
    setIsUploading(true);
    setSubState('ingredients');
    window.setTimeout(() => {
      setIngredients(INITIAL_INGREDIENTS);
      setIsUploading(false);
    }, 2200);
  };

  const handleUploadFile = async (file: File) => {
    setUploadError(null);

    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files (JPG, PNG, WEBP) are allowed.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image file is too large. Maximum allowed size is 10MB.');
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);

    setIsUploading(true);
    setSubState('ingredients');

    try {
      const optimizedFile = await optimizeImageForUpload(file);
      const formData = new FormData();
      formData.append('image', optimizedFile);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = (await response.json()) as {
          ingredients?: string[];
          confidence?: number;
        };
        if (Array.isArray(data.ingredients)) {
          setIngredients(data.ingredients);
          setIsUploading(false);
          return;
        }
      } else {
        const errData = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setUploadError(
          errData.error || 'Could not analyze image. Please try again.'
        );
        setIsUploading(false);
        setSubState('upload');
        return;
      }
    } catch {
      setUploadError(
        'Network error while analyzing photo. Please try again.'
      );
      setIsUploading(false);
      setSubState('upload');
      return;
    }
  };

  const handleRemoveIngredient = (itemToRemove: string) => {
    setIngredients((prev) => prev.filter((item) => item !== itemToRemove));
  };

  const handleAddIngredient = (newItem: string) => {
    const normalized = newItem.trim().toLowerCase();
    if (!normalized) return;
    setIngredients((prev) =>
      prev.some((item) => item.toLowerCase() === normalized)
        ? prev
        : [...prev, normalized]
    );
  };

  const handleFindRecipes = async () => {
    if (ingredients.length === 0) return;
    setIsFindingRecipes(true);
    setSubState('recipes');

    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });

      if (response.ok) {
        const data = (await response.json()) as { recipes?: Recipe[] };
        if (Array.isArray(data.recipes) && data.recipes.length > 0) {
          setRecipes(data.recipes);
          setIsFindingRecipes(false);
          return;
        }
      }
    } catch {
      // Fallback to mock recipes if backend/API is temporarily busy
    }

    window.setTimeout(() => {
      setRecipes(MOCK_RECIPES);
      setIsFindingRecipes(false);
    }, 1800);
  };

  return (
    <div
      className={`relative min-h-screen w-full bg-black text-white ${
        isInApp ? 'overflow-y-auto overflow-x-hidden' : 'h-screen overflow-hidden'
      }`}
    >
      {/* Persistent Fullscreen Looping Background Video (z-index: 0, never unmounts) */}
      <div className="bg-video-stage fixed inset-0 z-0 pointer-events-none">
        <video
          src={bgVideo}
          autoPlay
          muted
          playsInline
          loop
          className={`bg-video-element ease-custom h-full w-full object-cover pointer-events-none transition-opacity duration-700 ${
            isInApp ? 'opacity-25' : 'opacity-100'
          }`}
        />
      </div>

      {/* Dark Overlay with Radial Vignette and Side Gradients (z-index: 1) */}
      <div
        aria-hidden="true"
        className={`no-print ease-custom fixed inset-0 z-[1] pointer-events-none transition-opacity duration-700 ${
          isInApp ? 'opacity-95' : 'opacity-80'
        }`}
        style={{
          background: isInApp
            ? 'radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.68) 0%, rgba(0, 0, 0, 0.92) 100%), linear-gradient(90deg, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.55) 50%, rgba(0, 0, 0, 0.88) 100%)'
            : 'radial-gradient(circle at 58% 45%, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.72) 100%), linear-gradient(90deg, rgba(0, 0, 0, 0.82) 0%, rgba(0, 0, 0, 0.28) 52%, rgba(0, 0, 0, 0.68) 100%), linear-gradient(0deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0) 45%)',
        }}
      />

      {/* Top Glassmorphic Navbar with FridgeOS Branding and Side Recipe Search Bar (z-index: 30) */}
      <Navbar
        isInApp={isInApp}
        searchQuery={globalSearchQuery}
        onSearchQueryChange={handleNavbarSearchChange}
        onSearchSubmit={handleNavbarSearchSubmit}
        onClearSearch={handleNavbarClearSearch}
        onGoHome={() => {
          setGlobalSearchQuery('');
          setMode('hero');
        }}
        onOpenFridge={handleOpenFridge}
      />

      {/* Foreground Content Layer (z-index: 10) */}
      <main className="relative z-10 min-h-screen w-full flex flex-col justify-center">
        {!isInApp ? (
          <Hero onOpenFridge={handleOpenFridge} />
        ) : (
          <div className="w-full pt-20 pb-8">
            {subState === 'upload' && (
              <UploadState
                isUploading={isUploading}
                errorMessage={uploadError}
                onUploadFile={handleUploadFile}
                onUseSamplePhoto={handleUseSamplePhoto}
                onBack={() => setMode('hero')}
              />
            )}

            {subState === 'ingredients' && (
              <IngredientsState
                imageUrl={previewUrl}
                ingredients={ingredients}
                isAnalyzing={isUploading}
                isFindingRecipes={isFindingRecipes}
                onRemoveIngredient={handleRemoveIngredient}
                onAddIngredient={handleAddIngredient}
                onFindRecipes={handleFindRecipes}
                onBack={() => {
                  setIsUploading(false);
                  setSubState('upload');
                }}
              />
            )}

            {subState === 'recipes' && (
              <RecipesState
                recipes={recipes}
                availableIngredients={ingredients}
                favoriteNames={favoriteNames}
                shoppingList={shoppingList}
                isLoading={isFindingRecipes}
                externalSearchQuery={globalSearchQuery}
                onExternalSearchQueryChange={setGlobalSearchQuery}
                onToggleFavorite={handleToggleFavorite}
                onToggleShoppingItem={handleToggleShoppingItem}
                onAddMultipleToShoppingList={handleAddMultipleToShoppingList}
                onToggleCheckShoppingItem={handleToggleCheckShoppingItem}
                onRemoveShoppingItem={handleRemoveShoppingItem}
                onClearShoppingList={handleClearShoppingList}
                onBack={() => {
                  setIsFindingRecipes(false);
                  setSubState('ingredients');
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
