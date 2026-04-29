/**
 * WhatsApp template management via Meta's Graph API.
 *
 * Lets us own template content in code instead of clicking through the
 * Meta dashboard. Each canonical template lives in CANONICAL_TEMPLATES
 * with its body text + example values. The sync flow lists existing
 * templates by name, deletes any with the same name (regardless of
 * status), and re-creates from the canonical definition. That makes
 * the sync idempotent: running it twice produces the same end state.
 *
 * Notes:
 *   • Newly created templates start as PENDING and must be approved by
 *     Meta before they can be sent. Approval is usually fast for UTILITY
 *     content; can take longer if Meta auto-classifies as MARKETING.
 *   • Body text supports basic formatting and emoji. Bilingual content
 *     (Spanish first, English second) lives in a single body since
 *     audience is mixed and we don't want two separate sends.
 *   • Language code "en" is what the existing approved set uses; the
 *     code is metadata for routing/discovery only — content language
 *     isn't enforced.
 */

const GRAPH_API_VERSION = "v21.0";

export type CanonicalTemplate = {
  name: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  language: string;
  body: string;
  /** Example values for each {{N}} placeholder. Meta uses these to
   *  preview the template during review. Order must match {{1}}…{{N}}. */
  bodyExamples: string[];
};

export const CANONICAL_TEMPLATES: CanonicalTemplate[] = [
  {
    name: "match_starting",
    category: "UTILITY",
    language: "en",
    body:
      "🎾 Es tu turno en {{1}}. Tienes 5 minutos para calentar y luego comienza tu partido.\n" +
      "{{2}}\n" +
      "\n" +
      "🎾 You're up on {{1}}. You have 5 minutes to warm up, then start your game.\n" +
      "{{2}}",
    bodyExamples: [
      "Court 1",
      "Dylan Ralston & Jack Munro (2-0) vs Eddie Declet & Pedro Maldonado (1-1)",
    ],
  },
  {
    name: "match_score_update",
    category: "UTILITY",
    language: "en",
    body:
      "✅ Resultado registrado para {{1}}: {{2}} {{3}} - {{4}} {{5}}.\n" +
      "Mira la tabla actualizada en Buen Tiro.\n" +
      "\n" +
      "✅ Score recorded for {{1}}: {{2}} {{3}} - {{4}} {{5}}.\n" +
      "View the updated standings on Buen Tiro.",
    bodyExamples: [
      "Money Ball",
      "Dylan Ralston & Jack Munro",
      "11",
      "9",
      "Eddie Declet & Pedro Maldonado",
    ],
  },
  {
    name: "tournament_starting_pool",
    category: "UTILITY",
    language: "en",
    body:
      "🎾 ¡Empezamos {{1}}! Estás en Pool {{2}}.\n" +
      "\n" +
      "Tu horario:\n" +
      "{{3}}\n" +
      "\n" +
      "Llega 5 minutos antes de tu partido. ¡Buena suerte!\n" +
      "\n" +
      "🎾 Tournament starting: {{1}}! You're in Pool {{2}}.\n" +
      "\n" +
      "Your schedule:\n" +
      "{{3}}\n" +
      "\n" +
      "Arrive 5 minutes before your match. Good luck!",
    bodyExamples: [
      "Money Ball",
      "A",
      "R1 - Dylan Ralston & Jack Munro vs Eddie Declet & Pedro Maldonado · Court 1",
    ],
  },
  {
    name: "tournament_starting_first_match",
    category: "UTILITY",
    language: "en",
    body:
      "🎾 ¡Empezamos {{1}}! Estás en Pool {{2}}.\n" +
      "🏁 Tu partido es el primero en {{3}}.\n" +
      "\n" +
      "Tu horario completo:\n" +
      "{{4}}\n" +
      "\n" +
      "¡Buena suerte!\n" +
      "\n" +
      "🎾 Tournament starting: {{1}}! You're in Pool {{2}}.\n" +
      "🏁 Your match is up first on {{3}}.\n" +
      "\n" +
      "Your full pool schedule:\n" +
      "{{4}}\n" +
      "\n" +
      "Good luck!",
    bodyExamples: [
      "Money Ball",
      "A",
      "Court 1",
      "R1 - Dylan Ralston & Jack Munro vs Eddie Declet & Pedro Maldonado · Court 1",
    ],
  },
];

type ListedTemplate = {
  id: string;
  name: string;
  status: string;
  language?: string;
};

function envOrThrow(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function listTemplates(): Promise<ListedTemplate[]> {
  const wabaId = envOrThrow("META_WHATSAPP_WABA_ID");
  const token = envOrThrow("META_WHATSAPP_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?fields=id,name,status,language&limit=200`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`listTemplates: ${msg}`);
  }
  return ((data as { data?: ListedTemplate[] })?.data ?? []) as ListedTemplate[];
}

async function deleteTemplate(name: string, id?: string): Promise<void> {
  const wabaId = envOrThrow("META_WHATSAPP_WABA_ID");
  const token = envOrThrow("META_WHATSAPP_ACCESS_TOKEN");
  // Meta supports two delete shapes: by-name (deletes all language
  // variants) or by-id (deletes a single variant). We start by-name to
  // wipe stale duplicates; fall back to by-id if needed.
  const params = new URLSearchParams({ name });
  if (id) params.set("hsm_id", id);
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?${params.toString()}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    // 404 = template didn't exist, fine.
    if (res.status === 404) return;
    throw new Error(`deleteTemplate(${name}): ${msg}`);
  }
}

async function createTemplate(t: CanonicalTemplate): Promise<{ id: string; status: string }> {
  const wabaId = envOrThrow("META_WHATSAPP_WABA_ID");
  const token = envOrThrow("META_WHATSAPP_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`;
  const body = {
    name: t.name,
    category: t.category,
    language: t.language,
    components: [
      {
        type: "BODY",
        text: t.body,
        ...(t.bodyExamples.length > 0
          ? { example: { body_text: [t.bodyExamples] } }
          : {}),
      },
    ],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`createTemplate(${t.name}): ${msg}`);
  }
  const d = data as { id?: string; status?: string };
  return { id: d.id ?? "", status: d.status ?? "PENDING" };
}

export type SyncTemplateResult = {
  name: string;
  action: "created" | "replaced" | "skipped" | "failed";
  status?: string;
  error?: string;
};

export async function syncCanonicalTemplates(): Promise<SyncTemplateResult[]> {
  const existing = await listTemplates();
  const byName = new Map<string, ListedTemplate[]>();
  for (const t of existing) {
    const arr = byName.get(t.name) ?? [];
    arr.push(t);
    byName.set(t.name, arr);
  }

  const results: SyncTemplateResult[] = [];
  for (const def of CANONICAL_TEMPLATES) {
    try {
      const matches = byName.get(def.name) ?? [];
      const action: SyncTemplateResult["action"] = matches.length > 0 ? "replaced" : "created";
      if (matches.length > 0) {
        await deleteTemplate(def.name);
      }
      const { status } = await createTemplate(def);
      results.push({ name: def.name, action, status });
    } catch (e) {
      results.push({
        name: def.name,
        action: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
