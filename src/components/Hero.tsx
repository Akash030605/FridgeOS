import React from 'react';

interface HeroProps {
  onOpenFridge: () => void;
}

export default function Hero({ onOpenFridge }: HeroProps) {
  return (
    <section
      aria-label="Hero"
      className="hero-container relative w-full min-h-screen flex flex-col justify-center overflow-hidden select-none pt-20 pb-12"
    >
      <div className="max-w-3xl">
        <div className="animate-hero-stagger-1 inline-flex items-center gap-2 rounded-[999px] backdrop-blur-xl bg-white/[0.06] border border-white/10 px-3.5 py-1.5 mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
          <span className="text-xs font-medium tracking-wide text-white/75">
            FridgeOS Vision Intelligence
          </span>
        </div>

        <h1 className="hero-headline animate-hero-stagger-1 text-white">
          <span className="block">Your fridge.</span>
          <span className="block text-white/50">Reinvented.</span>
        </h1>

        <p className="animate-hero-stagger-2 mt-6 max-w-md text-lg md:text-xl font-normal text-[#8e8e8e] tracking-tight leading-relaxed">
          Snap a photo. Get recipes. In seconds.
        </p>

        <div className="animate-hero-stagger-3 mt-9 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onOpenFridge}
            className="ease-custom inline-flex items-center justify-center rounded-[999px] bg-white px-8 py-4 text-base font-semibold text-black transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer whitespace-nowrap"
            style={{
              boxShadow: '0 0 28px rgba(255, 255, 255, 0.28)',
            }}
          >
            Open your fridge →
          </button>
        </div>
      </div>
    </section>
  );
}
