# FridgeOS — Your Fridge. Reinvented.

**FridgeOS** is a full-stack kitchen intelligence web application that turns a photo of your open refrigerator into tailored, step-by-step recipes, nutritional breakdowns, and a persistent shopping list in seconds.

Built with a cinematic dark glassmorphic interface, a persistent ambient video stage, and a two-pass forensic computer-vision pipeline, FridgeOS eliminates ingredient hallucinations while providing both fridge-based recipe generation and universal recipe discovery.

---

## Core Functionalities

### 1. Cinematic Hero & Persistent Video Stage
- **Adaptive Resolution Stage**: Uses a persistent looping background video (`src/assets/animationn.mp4`) that never unmounts across view transitions.
- **Responsive Framing**: Fullscreen `object-cover` on mobile and tablet viewports (`< 1024px`) and a native-resolution feathered stage (`object-fit: contain` with radial edge masking into `#000000`) on desktop viewports (`>= 1024px`) so the video remains sharp on ultra-wide screens.
- **Top Glassmorphic Navbar (`FridgeOS`)**: Features brand navigation, a quick **"Scan Fridge"** trigger, and a global **Recipe Search Bar** with smooth slide-and-fade transitions when switching between Hero and App modes.

---

### 2. Photo Upload & Client-Side Optimization (`UploadState`)
- **Drag-and-Drop & File Picker**: Accepts `JPG`, `PNG`, and `WEBP` photos up to `10MB`.
- **Automatic Client-Side Canvas Optimization**: Large camera/phone photos (`> 800KB`) are automatically downscaled on an HTML5 `<canvas>` (max `1600px` dimension at `0.85` JPEG quality) prior to upload, reducing multi-megabyte payloads to ~200KB for fast, reliable uploads.
- **Sample Fridge Mode**: Includes a **"Try a sample fridge"** option so users can test the entire workflow immediately without uploading a photo.

---

### 3. Two-Pass Forensic Fridge Scanner (`POST /api/analyze`)
To prevent the vision model from guessing common fridge staples that aren't actually in the photo, FridgeOS uses a strict two-stage pipeline:
1. **Pass 1 — Zone-by-Zone Forensic Scan (`temperature: 0.1`, High Media Resolution)**:
   - Scans 6 distinct zones (Door Top/Middle/Bottom shelves, Main Top/Middle shelves, and Crisper Drawers).
   - Explicitly forbids inferring common items (`milk`, `cheese`, `butter`, `tomatoes`, `spinach`, `onions`, `garlic`) unless directly visible in a specific container and shelf position.
2. **Pass 2 — Self-Verification Fact-Check (`temperature: 0.1`)**:
   - Sends the initial candidate list back with the **same photo** to verify every item (`verified` vs. `removed`).
3. **Canonical Deduplication**:
   - Deduplicates plural/singular and substring overlaps (e.g., `"eggs"` vs. `"egg"`, `"cheddar cheese"` vs. `"cheese"`) before returning `{ ingredients, confidence }`.

---

### 4. Interactive Ingredient Editor (`IngredientsState`)
- **Live Scan Animation (`ScanOverlay`, `SkeletonChip`, `RotatingText`)**:
  - While `/api/analyze` is running, displays the uploaded fridge photo at `40%` opacity with a looping vertical laser scan line (`1.8s`), 7 staggered shimmer ghost chips (`100ms` delay), and rotating status messages (`"Scanning your fridge..."`, `"Identifying items..."`, `"Almost there..."`).
- **Editable Ingredient Chips**:
  - Remove any detected item with a single click (`×`).
- **Autocomplete Ingredient Input**:
  - Add extra pantry or fridge items manually with keyboard-navigable (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) autocomplete suggestions across 60+ common ingredients.

---

### 5. Tailored Recipe Generation (`POST /api/recipes`)
- Generates **3 tailored recipes** prioritizing the user's available ingredients while clearly separating any extra pantry items into `missingIngredients`.
- **Skeleton Recipe Cards (`SkeletonRecipeCard`)**:
  - While `/api/recipes` is in flight, displays 3 glassmorphic skeleton recipe cards with a staggered diagonal shimmer (`2.4s`) and rotating status prompts (`"Reading your ingredients..."`, `"Thinking of recipes..."`, `"Plating your options..."`).
- Each recipe includes:
  - **Title, Prep/Cook Time, and Difficulty Badge** (`Easy`, `Medium`, `Hard`)
  - **Concise Step-by-Step Instructions** (under 15 words per step)
  - **Missing Ingredients Callout** with one-click shopping list integration
  - **Estimated Nutrition Per Serving** (`Calories`, `Protein`, `Carbs`)

---

### 6. Universal Recipe Search (`POST /api/search-recipes`)
Accessible from both the **Recipes view search input** and the **top Navbar search bar**:
1. **Instant Local Filtering**: Immediately filters the 3 locally-generated fridge recipes as you type.
2. **Hybrid Discovery Banner**: When local matches exist, displays them alongside a **"Search all recipes →"** button to expand the search globally.
3. **Automatic Universal Search (`400ms` Debounce)**:
   - If a query (e.g., `"pasta"`, `"ramen"`, `"tiramisu"`) has no local matches in the current fridge recipes, FridgeOS automatically queries `POST /api/search-recipes` (`temperature: 0.7`) after a `400ms` debounce.
   - Displays `"Results for '<query>' — showing all recipes (not filtered by your fridge)"` and lists all required ingredients under **"You'd need to buy"**.
   - Includes a one-click clear (`×`) button to return to the fridge-filtered recipes.

---

### 7. Favorites, Nutrition Modal, Print Sheet & Persistent Shopping List
- **Favorites Filter (`All` / `Favorites`)**: Bookmark any recipe card (`♥`) and filter your saved recipes.
- **Nutrition & Preparation Modal**: Click any recipe card to inspect per-serving macros (`Calories`, `Protein`, `Carbs`), interactive ingredient badges (`✓` in fridge vs. `+ Buy`), and full preparation steps.
- **Dedicated Print View (`window.print()`)**: Clicking **Print** inside the recipe modal renders a clean, ink-friendly black-on-white printable recipe sheet (`@media print`) while hiding all background video and glass UI chrome.
- **Persistent Shopping List (`localStorage`)**:
  - Add individual missing ingredients or click **`+ Add all to list`** on any recipe card.
  - Persists automatically in `localStorage` (`your_fridge_reinvented_shopping_list_v1`), tracks which recipe each item came from, and supports checking off items, removing individual items, or clearing the list.

---

### 8. Accessibility & Reduced Motion
- Respects `prefers-reduced-motion: reduce`: disables keyframe animations (`shimmer`, `scanline`, `fadeText`) and renders static skeleton placeholders with a clean `"Loading..."` status indicator.

---

## Project Structure

```text
├── server.ts                        # Production/dev server entry point
├── src/
│   ├── index.ts                     # Express app, CORS, rate limiters & Vite middleware
│   ├── App.tsx                      # Root state machine (Hero / Upload / Ingredients / Recipes)
│   ├── index.css                    # Tailwind CSS + custom keyframes & print styles
│   ├── components/
│   │   ├── Navbar.tsx               # Top FridgeOS glassmorphic navbar + global search bar
│   │   ├── Hero.tsx                 # Landing screen with display typography & CTA
│   │   ├── UploadState.tsx          # Drag-and-drop photo uploader & sample fridge trigger
│   │   ├── IngredientsState.tsx     # Photo scan view, ingredient chips & autocomplete input
│   │   ├── RecipesState.tsx         # Recipe grid, universal search, nutrition modal & shopping list
│   │   ├── ScanOverlay.tsx          # Vertical laser scan-line overlay for image analysis
│   │   ├── SkeletonChip.tsx         # Staggered shimmer ghost chips during image analysis
│   │   ├── SkeletonRecipeCard.tsx   # Diagonal shimmer skeleton cards during recipe generation
│   │   └── RotatingText.tsx         # Smoothly cycling status messages with reduced-motion support
│   ├── lib/
│   │   ├── gemini.ts                # GoogleGenAI client wrapper, 25s timeout & model failover
│   │   ├── prompts.ts               # Forensic scanner, verification, recipe & search prompts
│   │   ├── schemas.ts               # Zod schemas & Gemini structured output JSON schemas
│   │   └── rateLimits.ts            # Per-IP rate limiters for /api/analyze & /api/recipes
│   └── routes/
│       ├── analyze.ts               # POST /api/analyze (Multer memory storage + 2-pass scan)
│       └── recipes.ts               # POST /api/recipes & POST /api/search-recipes
```

---

## API Reference

| Endpoint | Method | Rate Limit | Description |
| :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | Unlimited | Returns `{ status: "ok", timestamp: number }`. |
| `/api/analyze` | `POST` | 10 req / hr / IP | Accepts `multipart/form-data` (`image` field, max 10MB). Runs two-pass forensic vision scan (`temperature: 0.1`) and returns `{ ingredients: string[], confidence: number }`. |
| `/api/recipes` | `POST` | 20 req / hr / IP | Accepts `{ ingredients: string[] }`. Returns `{ recipes: Recipe[] }` (3 recipes tailored to available fridge items). |
| `/api/search-recipes` | `POST` | 20 req / hr / IP | Accepts `{ query: string }` (1–100 chars). Runs discovery search (`temperature: 0.7`) and returns `{ recipes: Recipe[], query: string }`. |

---

## Local Development Setup

### 1. Prerequisites
- **Node.js** `v18+`
- A **Google Gemini API Key** (`GEMINI_API_KEY`)

### 2. Environment Variables
Copy `.env.example` to `.env` and add your Gemini API key:

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
FRONTEND_ORIGIN=http://localhost:3000
```

### 3. Install & Run
```bash
# Install dependencies
npm install

# Start full-stack Express + Vite server on http://localhost:3000
npm run dev

# Type-check with TypeScript
npm run lint

# Build production bundle
npm run build
```
