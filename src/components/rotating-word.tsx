"use client";

import { useEffect, useState } from "react";

/** Cycles through a list of words with a smooth slide+fade transition.
 *  No width reservation — the period (or whatever follows) sits flush
 *  against the current word, and the centered heading recenters
 *  naturally as the word length changes. */
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
      setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setAnimating(false);
      }, 350);
    }, intervalMs);
    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  if (words.length === 0) return null;

  return (
    <span
      key={words[index]}
      className={`inline-block whitespace-nowrap text-emerald-400 transition-all duration-300 ease-out ${
        animating ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      {words[index]}
    </span>
  );
}
