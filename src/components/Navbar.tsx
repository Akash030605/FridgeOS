import React from 'react';

interface NavbarProps {
  isInApp: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: (query: string) => void;
  onClearSearch: () => void;
  onGoHome: () => void;
  onOpenFridge: () => void;
}

export default function Navbar({
  isInApp,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  onClearSearch,
  onGoHome,
  onOpenFridge,
}: NavbarProps) {
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchSubmit(searchQuery.trim());
    }
  };

  return (
    <header className="no-print animate-navbar-entry fixed top-0 left-0 right-0 z-30 px-5 sm:px-10 md:px-14 py-4">
      <div
        className={`ease-custom mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[999px] backdrop-blur-xl px-5 py-2.5 transition-all duration-500 ${
          isInApp
            ? 'bg-white/[0.07] border border-white/15 shadow-[0_10px_36px_rgba(0,0,0,0.5)] translate-y-0'
            : 'bg-white/[0.04] border border-white/10 shadow-none'
        }`}
      >
        {/* Brand Logo: FridgeOS */}
        <button
          type="button"
          onClick={onGoHome}
          className="ease-custom group inline-flex items-center gap-2.5 text-left cursor-pointer"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-black text-xs font-bold tracking-tighter transition-transform duration-300 group-hover:scale-105">
            F
          </span>
          <span className="text-base sm:text-lg font-semibold tracking-tight text-white">
            Fridge<span className="text-white/55 font-normal">OS</span>
          </span>
        </button>

        {/* Right Side: Navbar Search Bar with gentle slide-and-fade transition + Scan CTA */}
        <div className="flex items-center gap-3">
          <form
            key={isInApp ? 'app-mode-search' : 'hero-mode-search'}
            onSubmit={handleFormSubmit}
            className="animate-search-slide-fade relative"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/45 transition-opacity duration-300"
            >
              <path
                d="M14.2939 14.2939L17.5 17.5M16.1111 9.55556C16.1111 13.1761 13.1761 16.1111 9.55556 16.1111C5.93502 16.1111 3 13.1761 3 9.55556C3 5.93502 5.93502 3 9.55556 3C13.1761 3 16.1111 5.93502 16.1111 9.55556Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search recipes..."
              aria-label="Search recipes from navbar"
              className={`ease-custom rounded-[999px] backdrop-blur-xl pl-9 pr-8 py-1.5 text-xs sm:text-sm text-white placeholder-[#8e8e8e] focus:outline-none focus:border-white/35 focus:bg-white/[0.1] transition-all duration-500 ${
                isInApp
                  ? 'w-48 sm:w-68 md:w-80 bg-white/[0.08] border border-white/20'
                  : 'w-40 sm:w-56 md:w-64 bg-white/[0.05] border border-white/15'
              }`}
            />

            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={onClearSearch}
                aria-label="Clear search"
                className="ease-custom absolute right-2.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-[11px] text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                ×
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={onOpenFridge}
            className={`ease-custom hidden sm:inline-flex items-center gap-1.5 rounded-[999px] border px-4 py-1.5 text-xs font-medium transition-all duration-500 cursor-pointer whitespace-nowrap ${
              isInApp
                ? 'bg-white text-black border-white hover:scale-[1.02]'
                : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
            }`}
          >
            <span>Scan Fridge</span>
          </button>
        </div>
      </div>
    </header>
  );
}
