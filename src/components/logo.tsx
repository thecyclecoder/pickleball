export function Logo({
  className = "",
  height = 28,
}: {
  className?: string;
  height?: number;
}) {
  // viewBox 280x100, so width = height * 2.8
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 100"
      className={className}
      style={{ height, width: "auto" }}
      role="img"
      aria-label="Buen Tiro"
    >
      <text
        x="10"
        y="60"
        fontFamily="var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="52"
        fontWeight="700"
        letterSpacing="-2.5"
        fill="currentColor"
      >
        buen tiro
      </text>
      <path
        d="M 14 80 Q 135 102 252 80"
        fill="none"
        stroke="#10b981"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="254" cy="79" r="5.5" fill="#10b981" />
    </svg>
  );
}
