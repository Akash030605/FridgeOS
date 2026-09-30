import React from 'react';

interface SkeletonChipProps {
  index?: number;
  widthClass?: string;
}

const DEFAULT_WIDTHS = [
  'w-20',
  'w-24',
  'w-28',
  'w-16',
  'w-24',
  'w-20',
  'w-28',
  'w-22',
];

export default function SkeletonChip({
  index = 0,
  widthClass,
}: SkeletonChipProps) {
  const resolvedWidth =
    widthClass || DEFAULT_WIDTHS[index % DEFAULT_WIDTHS.length];

  return (
    <span
      aria-hidden="true"
      style={{ animationDelay: `${index * 100}ms` }}
      className={`skeleton-chip-shimmer inline-block h-[38px] rounded-[999px] ${resolvedWidth}`}
    />
  );
}
