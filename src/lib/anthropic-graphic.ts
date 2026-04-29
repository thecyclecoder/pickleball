/**
 * Sonnet-driven SVG graphic generation for tournament announcements.
 *
 * Talks directly to Anthropic's /v1/messages endpoint via fetch — no
 * SDK dependency. Sends the tournament's reference image (first
 * slideshow image) as a vision input, asks Sonnet to return SVG that
 * uses that image as a backdrop with overlay design.
 *
 * Output is parsed defensively: Sonnet sometimes wraps SVG in
 * ```svg fences or adds preamble text. We strip both before returning.
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

export type GraphicType =
  | "base"
  | "pool_result"
  | "bracket_qf"
  | "bracket_sf"
  | "bracket_f"
  | "tournament_result";

export type FeedbackEntry = {
  ts: string;
  prompt: string;
};

type GenerateArgs = {
  type: GraphicType;
  tournamentTitle: string;
  /** Public URL of the reference image (tournament's first slideshow). */
  referenceImageUrl: string;
  /** Optional prior SVG to keep visual consistency on regeneration. */
  priorSvg?: string;
  /** Free-form admin feedback for this iteration. */
  feedback?: string;
  /** Earlier feedback rounds — gives Sonnet awareness of what's been
   *  asked for already so it doesn't undo prior course-corrections. */
  feedbackHistory?: FeedbackEntry[];
};

const BASE_SYSTEM_PROMPT = `You generate Instagram-format SVG graphics (1080×1350, 4:5) for pickleball tournament announcements.

OUTPUT RULES — non-negotiable:
- Output ONLY valid SVG. No markdown fences, no preamble, no explanation.
- Root <svg> element MUST have width="1080" height="1350" and viewBox="0 0 1080 1350".
- Embed the provided reference image as a backdrop via <image> with href set to the EXACT URL provided. Use preserveAspectRatio="xMidYMid slice" so it fills the canvas.
- Apply a darkening linear-gradient or semi-transparent overlay rectangle so any text is readable against the image.
- Include a "BUEN TIRO PICKLEBALL" brand strip — small caps, modern, near the top.
- Use a polished, modern, bold typography style. Sans-serif. White text against the darkened backdrop. Emerald (#10b981) accents are encouraged but optional.
- Composition should look INTENTIONAL — clear hierarchy, generous whitespace, strong focal point.

DESIGN RULES:
- The "base" template is a VISUAL SHELL: the design language for this tournament. It should have a prominent headline placeholder that says exactly the tournament title given, then an empty content region beneath where future application data will live. Make the empty region clearly framed — a subtle box, divider, or column — so we can see WHERE pool results / bracket / final results will eventually go.
- Do NOT use Mustache placeholders or {{tokens}} — render real, final content. The base template's "real content" is just the tournament title plus a placeholder caption like "Match results · Bracket · Final standings".

The SVG you output gets rasterized to PNG by Sharp, so use only standard SVG features that rasterize reliably (no <foreignObject>, no animations).`;

function buildUserPrompt(args: GenerateArgs): string {
  const { type, tournamentTitle, referenceImageUrl, priorSvg, feedback, feedbackHistory } = args;
  const lines: string[] = [];
  lines.push(`Tournament title: ${tournamentTitle}`);
  lines.push(`Reference image URL (use exactly this in the <image href="..."> tag): ${referenceImageUrl}`);
  lines.push(`Variant requested: ${type}`);

  if (priorSvg) {
    lines.push("");
    lines.push("Your previous SVG output (for context — improve on this, don't restart from scratch):");
    lines.push("```");
    lines.push(priorSvg);
    lines.push("```");
  }
  if (feedbackHistory && feedbackHistory.length > 0) {
    lines.push("");
    lines.push("Earlier feedback rounds (already addressed):");
    for (const f of feedbackHistory) {
      lines.push(`- ${f.prompt}`);
    }
  }
  if (feedback) {
    lines.push("");
    lines.push(`This iteration's feedback (apply this on top of everything above): ${feedback}`);
  } else if (!priorSvg) {
    lines.push("");
    lines.push("This is the first generation. Aim for something striking and on-brand.");
  }

  return lines.join("\n");
}

function extractSvg(text: string): string {
  const trimmed = text.trim();
  // Strip ```svg ... ``` or ``` ... ``` fences
  const fenceMatch = trimmed.match(/```(?:svg)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  // If the response starts with <svg, take from there
  const svgStart = trimmed.indexOf("<svg");
  if (svgStart >= 0) {
    const svgEnd = trimmed.lastIndexOf("</svg>");
    if (svgEnd > svgStart) {
      return trimmed.slice(svgStart, svgEnd + "</svg>".length);
    }
  }
  return trimmed;
}

export async function generateTournamentGraphic(args: GenerateArgs): Promise<{
  svg: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const userPrompt = buildUserPrompt(args);

  const body = {
    model: MODEL,
    max_tokens: 8000,
    system: BASE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: args.referenceImageUrl,
            },
          },
          {
            type: "text",
            text: userPrompt,
          },
        ],
      },
    ],
  };

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Anthropic: ${msg}`);
  }

  const content = (data as { content?: { type: string; text?: string }[] })?.content ?? [];
  const text = content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  if (!text) throw new Error("Anthropic: empty response");

  const svg = extractSvg(text);
  if (!svg.includes("<svg")) {
    throw new Error("Anthropic: response did not contain an <svg> element");
  }
  return { svg };
}
