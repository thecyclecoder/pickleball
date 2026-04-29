/**
 * Tournament graphic renderers — composite tournament data on top of
 * the admin-uploaded template image.
 *
 * Layout assumption: the template is 1080×1350. The headline area
 * (tournament name) is roughly y=0–300 and the footer/illustration
 * area is roughly y=850–1350. Data overlays live in y=320–820 (the
 * empty middle). If a template diverges meaningfully, V2 will let
 * admins shift Y-offsets per variant — for now we lean on convention.
 */

import sharp from "sharp";

const W = 1080;
const H = 1350;

const ESC_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

/** Common SVG header. White text default; sans-serif so librsvg has a
 *  fallback that ships on Vercel's Lambda. */
function svgOpen(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
}
function svgClose(): string {
  return `</svg>`;
}

/** Translucent background panel for the data area, so text stays
 *  readable against any template's middle section. */
function dataPanel(yTop: number, yBottom: number): string {
  return `<rect x="60" y="${yTop}" width="${W - 120}" height="${
    yBottom - yTop
  }" rx="20" ry="20" fill="rgba(0,0,0,0.55)" />`;
}

export type PoolResultTeam = {
  place: number;
  label: string;
  wins: number;
  losses: number;
  diff: number;
  /** True if this team advances to the bracket. */
  advancing: boolean;
};

export function renderPoolResultSvg(args: {
  poolLetter: string;
  teams: PoolResultTeam[];
}): string {
  const { poolLetter, teams } = args;
  const yTop = 320;
  const yBottom = 820;

  const headline = `<text x="${W / 2}" y="420" text-anchor="middle" font-family="sans-serif" font-size="80" font-weight="800" fill="#ffffff" letter-spacing="2">POOL ${esc(
    poolLetter
  )}</text>`;
  const subhead = `<text x="${W / 2}" y="465" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="600" fill="#fbbf24" letter-spacing="3">RESULTADOS · RESULTS</text>`;

  // Up to 4 rows. Y starts at 510, stride 70.
  const rows = teams.slice(0, 4).map((t, i) => {
    const y = 540 + i * 70;
    const placeColor = i === 0 ? "#10b981" : i === 1 ? "#10b981" : "#a1a1aa";
    const advanceBadge = t.advancing
      ? `<rect x="900" y="${y - 28}" width="100" height="36" rx="8" fill="#10b981" />
         <text x="950" y="${y - 4}" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="700" fill="#ffffff">ADVANCE</text>`
      : "";
    return `
      <text x="100" y="${y}" font-family="sans-serif" font-size="28" font-weight="800" fill="${placeColor}">${t.place}.</text>
      <text x="155" y="${y}" font-family="sans-serif" font-size="26" font-weight="700" fill="#ffffff">${esc(
        t.label
      )}</text>
      <text x="780" y="${y}" text-anchor="end" font-family="sans-serif" font-size="26" font-weight="700" fill="#ffffff" font-variant-numeric="tabular-nums">${t.wins}-${t.losses}</text>
      <text x="870" y="${y}" text-anchor="end" font-family="sans-serif" font-size="20" font-weight="600" fill="${
        t.diff >= 0 ? "#10b981" : "#f87171"
      }" font-variant-numeric="tabular-nums">${t.diff > 0 ? "+" : ""}${t.diff}</text>
      ${advanceBadge}
    `;
  });

  return [
    svgOpen(),
    dataPanel(yTop, yBottom),
    headline,
    subhead,
    ...rows,
    svgClose(),
  ].join("\n");
}

export type BracketMatchup = {
  /** Top/left team. */
  teamALabel: string;
  scoreA: number | null;
  /** Bottom/right team. */
  teamBLabel: string;
  scoreB: number | null;
  /** True when this matchup decided — used to bold the winner. */
  hasScore: boolean;
};

export function renderBracketSvg(args: {
  stageLabel: string;
  matchups: BracketMatchup[];
}): string {
  const { stageLabel, matchups } = args;
  const yTop = 320;
  const yBottom = 820;

  const headline = `<text x="${W / 2}" y="420" text-anchor="middle" font-family="sans-serif" font-size="78" font-weight="800" fill="#ffffff" letter-spacing="3">${esc(
    stageLabel.toUpperCase()
  )}</text>`;

  // Layout: stack matchups vertically with even spacing.
  const n = matchups.length;
  const blockHeight = Math.min(120, Math.floor((yBottom - 470) / Math.max(n, 1)));
  const startY = 480 + (yBottom - 470 - blockHeight * n) / 2;

  const rows = matchups.map((m, i) => {
    const y = startY + blockHeight * i;
    const aWon = m.hasScore && (m.scoreA ?? 0) > (m.scoreB ?? 0);
    const bWon = m.hasScore && (m.scoreB ?? 0) > (m.scoreA ?? 0);
    const aWeight = aWon ? "800" : "600";
    const bWeight = bWon ? "800" : "600";
    const aFill = aWon ? "#ffffff" : m.hasScore ? "#a1a1aa" : "#ffffff";
    const bFill = bWon ? "#ffffff" : m.hasScore ? "#a1a1aa" : "#ffffff";
    const scoreA = m.hasScore ? `${m.scoreA}` : "";
    const scoreB = m.hasScore ? `${m.scoreB}` : "";
    const vsLabel = m.hasScore ? "" : "vs";
    return `
      <text x="100" y="${y + 30}" font-family="sans-serif" font-size="26" font-weight="${aWeight}" fill="${aFill}">${esc(
        m.teamALabel
      )}</text>
      <text x="${W - 100}" y="${y + 30}" text-anchor="end" font-family="sans-serif" font-size="32" font-weight="800" fill="#fbbf24" font-variant-numeric="tabular-nums">${scoreA}</text>

      ${
        vsLabel
          ? `<text x="${
              W / 2
            }" y="${y + 60}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#71717a" letter-spacing="2">${vsLabel}</text>`
          : ""
      }

      <text x="100" y="${y + 80}" font-family="sans-serif" font-size="26" font-weight="${bWeight}" fill="${bFill}">${esc(
        m.teamBLabel
      )}</text>
      <text x="${W - 100}" y="${y + 80}" text-anchor="end" font-family="sans-serif" font-size="32" font-weight="800" fill="#fbbf24" font-variant-numeric="tabular-nums">${scoreB}</text>

      <line x1="100" y1="${y + 95}" x2="${W - 100}" y2="${y + 95}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
    `;
  });

  return [svgOpen(), dataPanel(yTop, yBottom), headline, ...rows, svgClose()].join("\n");
}

export function renderTournamentResultSvg(args: {
  championLabel: string;
  runnerUpLabel: string | null;
  semifinalistLabels: string[];
  categoryDisplay?: string;
}): string {
  const { championLabel, runnerUpLabel, semifinalistLabels, categoryDisplay } = args;
  const yTop = 320;
  const yBottom = 820;

  const subhead = categoryDisplay
    ? `<text x="${W / 2}" y="${yTop + 50}" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="600" fill="#fbbf24" letter-spacing="3">${esc(
        categoryDisplay.toUpperCase()
      )}</text>`
    : "";

  const headline = `<text x="${W / 2}" y="${yTop + 110}" text-anchor="middle" font-family="sans-serif" font-size="62" font-weight="800" fill="#ffffff" letter-spacing="3">CAMPEONES · CHAMPIONS</text>`;

  const champion = `
    <text x="${W / 2}" y="${yTop + 200}" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#fbbf24">🏆</text>
    <text x="${W / 2}" y="${yTop + 250}" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="800" fill="#ffffff">${esc(
      championLabel
    )}</text>
  `;

  const runnerUp = runnerUpLabel
    ? `
      <text x="${W / 2}" y="${yTop + 320}" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="#a1a1aa" letter-spacing="3">SUBCAMPEONES · RUNNER-UP</text>
      <text x="${W / 2}" y="${yTop + 355}" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700" fill="#e4e4e7">${esc(
        runnerUpLabel
      )}</text>
    `
    : "";

  const sf = semifinalistLabels.length
    ? `
      <text x="${W / 2}" y="${yTop + 410}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#71717a" letter-spacing="3">SEMIFINALISTAS</text>
      ${semifinalistLabels
        .slice(0, 2)
        .map(
          (l, i) => `<text x="${W / 2}" y="${yTop + 440 + i * 32}" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#a1a1aa">${esc(
            l
          )}</text>`
        )
        .join("\n")}
    `
    : "";

  return [
    svgOpen(),
    dataPanel(yTop, yBottom),
    subhead,
    headline,
    champion,
    runnerUp,
    sf,
    svgClose(),
  ].join("\n");
}

/** Composite an SVG overlay on top of a template image and return PNG. */
export async function compositeOverTemplate(args: {
  templateUrl: string;
  overlaySvg: string;
}): Promise<Buffer> {
  const { templateUrl, overlaySvg } = args;
  const res = await fetch(templateUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch template: ${res.status}`);
  const templateBuf = Buffer.from(await res.arrayBuffer());

  const backdrop = await sharp(templateBuf)
    .resize(W, H, { fit: "cover" })
    .toBuffer();

  const overlay = await sharp(Buffer.from(overlaySvg, "utf8"), { density: 96 })
    .resize(W, H, { fit: "fill" })
    .png()
    .toBuffer();

  return await sharp(backdrop)
    .composite([{ input: overlay, blend: "over" }])
    .png()
    .toBuffer();
}
