import React, { useState, useRef, useEffect } from 'react';
import ScanOverlay from './ScanOverlay';
import SkeletonChip from './SkeletonChip';
import RotatingText from './RotatingText';

interface IngredientsStateProps {
  imageUrl: string;
  ingredients: string[];
  isAnalyzing?: boolean;
  isFindingRecipes: boolean;
  onRemoveIngredient: (item: string) => void;
  onAddIngredient: (item: string) => void;
  onFindRecipes: () => void;
  onBack: () => void;
}

const COMMON_INGREDIENTS = [
  'avocado',
  'bacon',
  'basil',
  'beef',
  'bell pepper',
  'black beans',
  'Blueberries',
  'broccoli',
  'butter',
  'cabbage',
  'carrots',
  'cauliflower',
  'celery',
  'cheddar cheese',
  'cheese',
  'cherry tomatoes',
  'chicken breast',
  'chickpeas',
  'cilantro',
  'coconut milk',
  'corn',
  'cream cheese',
  'cucumber',
  'eggs',
  'feta cheese',
  'fish',
  'garlic',
  'ginger',
  'green beans',
  'green onions',
  'Greek yogurt',
  'ground beef',
  'ham',
  'heavy cream',
  'jalapeño',
  'kale',
  'lemon',
  'lettuce',
  'lime',
  'milk',
  'mozzarella',
  'mushrooms',
  'olive oil',
  'onion',
  'orange juice',
  'parmesan',
  'parsley',
  'pasta',
  'peas',
  'pesto',
  'pork chops',
  'potatoes',
  'quinoa',
  'red onion',
  'rice',
  'salmon',
  'salsa',
  'sausage',
  'shrimp',
  'sour cream',
  'soy sauce',
  'spinach',
  'strawberries',
  'sweet potato',
  'tofu',
  'tomatoes',
  'tortillas',
  'turkey',
  'yogurt',
  'zucchini',
];

const ANALYZE_STATUS_MESSAGES = [
  'Scanning your fridge...',
  'Identifying items...',
  'Almost there...',
];

const GHOST_CHIP_COUNT = 7;

export default function IngredientsState({
  imageUrl,
  ingredients,
  isAnalyzing = false,
  isFindingRecipes,
  onRemoveIngredient,
  onAddIngredient,
  onFindRecipes,
  onBack,
}: IngredientsStateProps) {
  const [newItem, setNewItem] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const normalizedExisting = new Set(
    ingredients.map((item) => item.toLowerCase().trim())
  );

  const query = newItem.trim().toLowerCase();
  const suggestions =
    query.length > 0
      ? COMMON_INGREDIENTS.filter(
          (candidate) =>
            candidate.toLowerCase().includes(query) &&
            !normalizedExisting.has(candidate.toLowerCase())
        ).slice(0, 6)
      : [];

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const commitIngredient = (valueToCommit: string) => {
    const trimmed = valueToCommit.trim().toLowerCase();
    if (!trimmed) return;
    onAddIngredient(trimmed);
    setNewItem('');
    setIsDropdownOpen(false);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDropdownOpen && suggestions.length > 0 && highlightedIndex >= 0) {
      commitIngredient(suggestions[highlightedIndex]);
    } else {
      commitIngredient(newItem);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev - 1 < 0 ? suggestions.length - 1 : prev - 1
      );
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="animate-view-in w-full max-w-4xl mx-auto px-5 py-10">
      <button
        type="button"
        onClick={onBack}
        disabled={isFindingRecipes}
        className="ease-custom mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#8e8e8e] hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
      >
        <span>←</span>
        <span>Upload another photo</span>
      </button>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left: Image Thumbnail Card with ScanOverlay during analysis */}
        <div className="md:col-span-5 rounded-[24px] backdrop-blur-xl bg-white/5 border border-white/10 p-3">
          <div className="relative overflow-hidden rounded-[18px] aspect-[4/5] bg-black/50">
            <img
              src={imageUrl}
              alt="Uploaded fridge interior"
              className={`ease-custom h-full w-full object-cover transition-opacity duration-500 ${
                isAnalyzing ? 'opacity-40' : 'opacity-100'
              }`}
            />
            {isAnalyzing && <ScanOverlay />}
          </div>
        </div>

        {/* Right: Detected Ingredients or Ghost Chip Skeletons */}
        <div className="md:col-span-7 rounded-[24px] backdrop-blur-xl bg-white/5 border border-white/10 p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            {isAnalyzing
              ? 'Analyzing your fridge'
              : 'Ingredients we spotted'}
          </h2>
          <p className="mt-1.5 text-sm text-[#8e8e8e]">
            {isAnalyzing
              ? 'Hold tight while we inspect shelves and drawers.'
              : 'Remove anything you don’t want to use, or add extra items below.'}
          </p>

          {isAnalyzing ? (
            <div className="mt-6">
              {/* 7 Ghost Chips with 100ms stagger */}
              <div className="flex flex-wrap gap-2.5">
                {Array.from({ length: GHOST_CHIP_COUNT }).map((_, idx) => (
                  <SkeletonChip key={idx} index={idx} />
                ))}
              </div>

              {/* Rotating status text every 1.2s */}
              <div className="mt-5">
                <RotatingText messages={ANALYZE_STATUS_MESSAGES} />
              </div>
            </div>
          ) : (
            <>
              {/* Ingredient Chips with Staggered Entrance (40ms delay each) */}
              <div className="mt-6 flex flex-wrap gap-2.5 min-h-[44px]">
                {ingredients.length === 0 ? (
                  <p className="text-sm text-[#8e8e8e] py-2">
                    No ingredients selected. Add an ingredient below to continue.
                  </p>
                ) : (
                  ingredients.map((item, index) => (
                    <span
                      key={item}
                      style={{ animationDelay: `${index * 40}ms` }}
                      className="animate-chip-in inline-flex items-center gap-2 rounded-[999px] backdrop-blur-md bg-white/10 border border-white/15 px-4 py-2 text-sm font-medium text-white"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveIngredient(item)}
                        disabled={isFindingRecipes}
                        aria-label={`Remove ${item}`}
                        className="ease-custom inline-flex h-4 w-4 items-center justify-center rounded-full text-white/60 hover:bg-white/20 hover:text-white transition-colors cursor-pointer disabled:pointer-events-none"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Manual Add Input with Autocomplete Dropdown */}
              <div ref={wrapperRef} className="relative mt-6">
                <form onSubmit={handleAddSubmit} className="flex gap-2.5">
                  <input
                    type="text"
                    value={newItem}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setNewItem(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isFindingRecipes}
                    placeholder="Add another ingredient..."
                    aria-label="Add another ingredient"
                    aria-autocomplete="list"
                    aria-expanded={isDropdownOpen && suggestions.length > 0}
                    className="ease-custom flex-1 rounded-[999px] bg-white/5 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-[#8e8e8e] focus:outline-none focus:border-white/35 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isFindingRecipes || !newItem.trim()}
                    className="ease-custom rounded-[999px] backdrop-blur-md bg-white/10 hover:bg-white/20 border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  >
                    + Add
                  </button>
                </form>

                {/* Autocomplete Suggestions Popover */}
                {isDropdownOpen &&
                  suggestions.length > 0 &&
                  !isFindingRecipes && (
                    <ul
                      role="listbox"
                      className="animate-view-in absolute left-0 right-24 z-30 mt-2 overflow-hidden rounded-[18px] backdrop-blur-xl bg-black/85 border border-white/15 py-1.5 shadow-2xl"
                    >
                      {suggestions.map((suggestion, idx) => {
                        const isHighlighted = idx === highlightedIndex;
                        return (
                          <li
                            key={suggestion}
                            role="option"
                            aria-selected={isHighlighted}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              commitIngredient(suggestion);
                            }}
                            className={`ease-custom flex items-center justify-between px-4 py-2 text-sm cursor-pointer transition-colors ${
                              isHighlighted
                                ? 'bg-white/15 text-white'
                                : 'text-white/80 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="capitalize">{suggestion}</span>
                            <span className="text-xs text-[#8e8e8e]">
                              + Add
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </div>

              {/* Primary CTA */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={onFindRecipes}
                  disabled={isFindingRecipes || ingredients.length === 0}
                  className="ease-custom w-full inline-flex items-center justify-center gap-2 rounded-[999px] bg-white text-black px-7 py-3.5 text-sm sm:text-base font-semibold tracking-tight hover:scale-[1.02] active:scale-[0.99] transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Find Recipes</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
