"use client";

import { useEffect, useState } from "react";

/** Cycles through a list of words with a smooth slide+fade transition.
 *  Sized in a fixed-width(ish) inline-block so the surrounding heading
 *  doesn't reflow each tick. The word itself is colored emerald to
 *  draw the eye to the rotation. */
export function RotatingWord({
  words,
  intervalMs = 2200,
}: {
  words: string[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (words.length <= 1) return;
    const id = setInterval(() => {
      setAnimating(true);
      // Wait for the leave animation, then swap
      setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setAnimating(false);
      }, 350);
    }, intervalMs);
    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  if (words.length === 0) return null;

  return (
    <span className="relative inline-block align-baseline">
      {/* Invisible widest word reserves the layout width to avoid jitter */}
      <span className="invisible whitespace-nowrap" aria-hidden>
        {words.reduce((a, b) => (b.length > a.length ? b : a), words[0])}
      </span>
      <span
        key={words[index]}
        className={`absolute left-0 top-0 whitespace-nowrap text-emerald-400 transition-all duration-300 ease-out ${
          animating ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {words[index]}
      </span>
    </span>
  );
}
