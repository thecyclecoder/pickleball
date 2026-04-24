import { largestSrc, srcSetAttr, type TournamentImage } from "@/lib/types";

/** Renders a <picture>/<img srcset> for a TournamentImage. `sizes` tells the
 *  browser how wide the image will be at different viewport widths so it can
 *  pick the appropriate srcset entry. */
export function ResponsiveImage({
  image,
  alt,
  sizes,
  className,
  loading = "lazy",
}: {
  image: TournamentImage;
  alt: string;
  sizes: string;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  if (!image?.srcset?.length) return null;
  const fallback = largestSrc(image);
  const srcSet = srcSetAttr(image);
  return (
    <picture>
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fallback}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        decoding="async"
        className={className}
        draggable={false}
      />
    </picture>
  );
}
