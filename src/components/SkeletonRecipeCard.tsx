import React from 'react';

interface SkeletonRecipeCardProps {
  index?: number;
}

export default function SkeletonRecipeCard({
  index = 0,
}: SkeletonRecipeCardProps) {
  return (
    <div
      aria-hidden="true"
      style={{ animationDelay: `${index * 300}ms` }}
      className="skeleton-card-shimmer relative flex flex-col justify-between rounded-[24px] backdrop-blur-xl bg-white/5 border border-white/10 p-6 min-h-[320px] overflow-hidden"
    >
      <div>
        {/* Title line (60% width) */}
        <div className="h-5 w-[60%] rounded-[999px] bg-white/[0.06]" />

        {/* Tags row */}
        <div className="mt-3.5 flex items-center gap-2">
          <div className="h-6 w-16 rounded-[999px] bg-white/[0.06]" />
          <div className="h-6 w-20 rounded-[999px] bg-white/[0.06]" />
        </div>

        {/* 4 step lines (variable width 80-100%) */}
        <div className="mt-6 space-y-3.5">
          <div className="h-3.5 w-[96%] rounded-[999px] bg-white/[0.06]" />
          <div className="h-3.5 w-[88%] rounded-[999px] bg-white/[0.06]" />
          <div className="h-3.5 w-[100%] rounded-[999px] bg-white/[0.06]" />
          <div className="h-3.5 w-[82%] rounded-[999px] bg-white/[0.06]" />
        </div>
      </div>

      {/* Footer skeleton row */}
      <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
        <div className="h-3 w-16 rounded-[999px] bg-white/[0.06]" />
        <div className="h-3 w-28 rounded-[999px] bg-white/[0.06]" />
      </div>
    </div>
  );
}
