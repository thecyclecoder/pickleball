"use client";

import { useEffect, useState } from "react";
import { largestSrc, srcSetAttr, type TournamentImage } from "@/lib/types";

const AUTO_ADVANCE_MS = 5000;

/** Fading cover slideshow for list cards.
 *  - Single image: renders as a static <picture> (no interval, no fade).
 *  - Multiple: auto-advances every 5s with a cross-fade. No controls.
 *  - Each card gets a staggered start offset so a grid of cards doesn't
 *    advance in lockstep (feels more alive).
 */
export function CoverSlideshow({
  images,
  alt,
  sizes,
  stagger = 0,
  className = "h-full w-full object-cover",
}: {
  images: TournamentImage[];
  alt: string;
  sizes: string;
  stagger?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const start = setTimeout(() => {
      setIndex((i) => (i + 1) % images.length);
      // Start the regular cadence after the staggered first tick
      const id = setInterval(() => {
        setIndex((i) => (i + 1) % images.length);
      }, AUTO_ADVANCE_MS);
      cleanup.id = id;
    }, AUTO_ADVANCE_MS + stagger);
    const cleanup: { id?: ReturnType<typeof setInterval> } = {};
    return () => {
      clearTimeout(start);
      if (cleanup.id) clearInterval(cleanup.id);
    };
  }, [images.length, stagger]);

  if (images.length === 0) return null;

  if (images.length === 1) {
    const only = images[0];
    return (
      <picture>
        <source type="image/webp" srcSet={srcSetAttr(only)} sizes={sizes} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={largestSrc(only)}
          srcSet={srcSetAttr(only)}
          sizes={sizes}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={className}
        />
      </picture>
    );
  }

  return (
    <div className="relative h-full w-full">
      {images.map((img, i) => (
        <picture key={i}>
          <source type="image/webp" srcSet={srcSetAttr(img)} sizes={sizes} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={largestSrc(img)}
            srcSet={srcSetAttr(img)}
            sizes={sizes}
            alt={i === 0 ? alt : ""}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            aria-hidden={i !== index}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${className} ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        </picture>
      ))}
    </div>
  );
}
