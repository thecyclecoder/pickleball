"use client";

import { useEffect, useState } from "react";
import { largestSrc, srcSetAttr, type TournamentImage } from "@/lib/types";

const AUTO_ADVANCE_MS = 5000;

export function ImageCarousel({ images, alt }: { images: TournamentImage[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const hasMultiple = images.length > 1;

  // Auto-advance every 5s. Pauses on hover/focus.
  useEffect(() => {
    if (!hasMultiple || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [hasMultiple, paused, images.length]);

  if (images.length === 0) return null;

  function goTo(i: number) {
    setIndex(((i % images.length) + images.length) % images.length);
  }

  return (
    <div
      className="w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="relative overflow-hidden rounded-2xl bg-zinc-900"
        style={{ aspectRatio: "9 / 16", maxHeight: "min(80vh, 720px)" }}
      >
        {images.map((img, i) => (
          <picture key={i}>
            <source
              type="image/webp"
              srcSet={srcSetAttr(img)}
              sizes="(min-width: 1024px) 420px, (min-width: 768px) 50vw, 100vw"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={largestSrc(img)}
              srcSet={srcSetAttr(img)}
              sizes="(min-width: 1024px) 420px, (min-width: 768px) 50vw, 100vw"
              alt={`${alt} — ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              aria-hidden={i !== index}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            />
          </picture>
        ))}

        {hasMultiple && (
          <>
            {/* Pagination dots */}
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-black/70"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-black/70"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to image ${i + 1}`}
              aria-current={i === index}
              className={`relative flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === index ? "border-emerald-500" : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={{ width: 64, height: 64 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={largestSrc(img)}
                srcSet={srcSetAttr(img)}
                sizes="64px"
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
