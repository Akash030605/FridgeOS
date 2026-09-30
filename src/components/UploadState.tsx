import React, { useRef, useState } from 'react';

interface UploadStateProps {
  isUploading: boolean;
  errorMessage?: string | null;
  onUploadFile: (file: File) => void;
  onUseSamplePhoto: () => void;
  onBack: () => void;
}

export default function UploadState({
  isUploading,
  errorMessage,
  onUploadFile,
  onUseSamplePhoto,
  onBack,
}: UploadStateProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  return (
    <div className="animate-view-in w-full max-w-xl mx-auto px-5 py-10">
      <button
        type="button"
        onClick={onBack}
        disabled={isUploading}
        className="ease-custom mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#8e8e8e] hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
      >
        <span>←</span>
        <span>Back</span>
      </button>

      <div className="rounded-[24px] backdrop-blur-xl bg-white/5 border border-white/10 p-7 sm:p-9">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Drop your fridge photo
        </h2>
        <p className="mt-2 text-sm sm:text-base text-[#8e8e8e]">
          We&apos;ll find what&apos;s inside and suggest recipes.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-[16px] backdrop-blur-md bg-red-500/15 border border-red-400/30 px-4 py-3 text-xs text-red-200"
          >
            {errorMessage}
          </div>
        )}

        <div
          role="button"
          tabIndex={0}
          aria-label="Drop your fridge photo or click to upload"
          onClick={() => {
            if (!isUploading) {
              fileInputRef.current?.click();
            }
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`ease-custom mt-7 flex flex-col items-center justify-center rounded-[20px] border-2 border-dashed px-6 py-14 text-center transition-all duration-300 cursor-pointer backdrop-blur-md ${
            isDragging
              ? 'border-white/50 bg-white/10 scale-[1.01]'
              : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/[0.08]'
          } ${isUploading ? 'pointer-events-none opacity-75' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="text-4xl select-none" aria-hidden="true">
            📷
          </div>

          {isUploading ? (
            <div className="mt-4">
              <p className="text-base font-medium text-white">
                Scanning your fridge...
              </p>
              <p className="mt-1 text-xs text-[#8e8e8e]">
                Identifying fresh ingredients with Gemini AI
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-base font-medium text-white">
                Click to upload or drag and drop
              </p>
              <p className="mt-1 text-xs text-[#8e8e8e]">
                JPG, PNG, or WEBP photo of your open fridge (max 5MB)
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 pt-4 border-t border-white/10">
          <span className="text-xs text-[#8e8e8e]">
            Don&apos;t have a fridge photo handy?
          </span>
          <button
            type="button"
            disabled={isUploading}
            onClick={onUseSamplePhoto}
            className="ease-custom rounded-[999px] backdrop-blur-md bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-2 text-xs font-medium text-white transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
          >
            Try sample fridge →
          </button>
        </div>
      </div>
    </div>
  );
}
