"use client";

import { useEffect, useState } from "react";
import { largestSrc, srcSetAttr, type TournamentImage } from "@/lib/types";

const AUTO_ADVANCE_MS = 5000;

/** Fading cover slideshow for list cards.
 *  - The first image is inline (block w-full h-auto), so the container
 *    adopts that image's natural aspect ratio — no cropping on cards
 *    whose flyers aren't exactly 9:16.
 *  - Subsequent images overlay absolutely with object-cover for a clean
 *    cross-fade against that same box.
 *  - Auto-advances every 5s; each card gets a stagger so a grid doesn't
 *    flip in lockstep.
 *  - Single-image case renders as one inline <picture>. */
export function CoverSlideshow({
  images,
  alt,
  sizes,
  stagger = 0,
}: {
  images: TournamentImage[];
  alt: string;
  sizes: string;
  stagger?: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const startId = setTimeout(() => {
      setIndex((i) => (i + 1) % images.length);
      intervalId = setInterval(() => {
        setIndex((i) => (i + 1) % images.length);
      }, AUTO_ADVANCE_MS);
    }, AUTO_ADVANCE_MS + stagger);
    return () => {
      clearTimeout(startId);
      if (intervalId) clearInterval(intervalId);
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
          className="block h-auto w-full"
        />
      </picture>
    );
  }

  return (
    <div className="relative">
      {images.map((img, i) => {
        const isFirst = i === 0;
        const visible = i === index;
        const fade = `transition-opacity duration-700 ease-in-out ${
          visible ? "opacity-100" : "opacity-0"
        }`;
        if (isFirst) {
          // First image is in normal flow — sets the natural container aspect.
          return (
            <picture key={i}>
              <source type="image/webp" srcSet={srcSetAttr(img)} sizes={sizes} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={largestSrc(img)}
                srcSet={srcSetAttr(img)}
                sizes={sizes}
                alt={alt}
                loading="eager"
                decoding="async"
                aria-hidden={!visible}
                className={`block h-auto w-full ${fade}`}
              />
            </picture>
          );
        }
        return (
          <picture key={i} className="absolute inset-0">
            <source type="image/webp" srcSet={srcSetAttr(img)} sizes={sizes} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={largestSrc(img)}
              srcSet={srcSetAttr(img)}
              sizes={sizes}
              alt=""
              loading="lazy"
              decoding="async"
              aria-hidden={!visible}
              className={`absolute inset-0 h-full w-full object-cover ${fade}`}
            />
          </picture>
        );
      })}
    </div>
  );
}
