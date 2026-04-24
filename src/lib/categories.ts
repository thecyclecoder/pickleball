import type { CategoryType, TournamentCategory } from "./types";

const TYPE_NAMES: Record<CategoryType, string> = {
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  MXD: "Mixed Doubles",
};

export function categoryLabel(category: Pick<TournamentCategory, "type" | "rating" | "label">): string {
  if (category.label && category.label.trim()) return category.label;
  const base = TYPE_NAMES[category.type];
  const rating = category.rating === "open" ? "Open" : category.rating;
  return `${base} ${rating}`;
}

export function shortCategoryLabel(category: Pick<TournamentCategory, "type" | "rating" | "label">): string {
  if (category.label && category.label.trim()) return category.label;
  const rating = category.rating === "open" ? "Open" : category.rating;
  return `${category.type} ${rating}`;
}
