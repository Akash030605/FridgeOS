import React from 'react';

export default function ScanOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]"
      style={{
        maskImage: 'linear-gradient(to bottom, black 0%, black 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 100%)',
      }}
    >
      <div className="scan-line-bar" />
    </div>
  );
}
