import React, { useState, useEffect } from 'react';

interface RotatingTextProps {
  messages: string[];
  intervalMs?: number;
  className?: string;
}

export default function RotatingText({
  messages,
  intervalMs = 1200,
  className = '',
}: RotatingTextProps) {
  const [index, setIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || messages.length <= 1) return;

    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [messages, intervalMs, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <p
        className={`text-[13px] font-normal text-[#999999] ${className}`}
        role="status"
        aria-live="polite"
      >
        Loading...
      </p>
    );
  }

  return (
    <p
      key={index}
      className={`animate-fade-text ease-custom text-[13px] font-normal text-[#999999] transition-opacity duration-300 ${className}`}
      role="status"
      aria-live="polite"
    >
      {messages[index] || 'Loading...'}
    </p>
  );
}
