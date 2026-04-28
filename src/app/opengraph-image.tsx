import { ImageResponse } from "next/og";

// Standard OG image size — Twitter, Slack, iMessage, WhatsApp all crop to ~1.91:1.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Buen Tiro — Puerto Rico Pickleball";

// Marketing copy shown in the OG card (English; the link unfurls don't carry
// per-locale variants in practice, so we ship the English version).
const HEADLINE = "Find your next tournament.";
const SUBHEAD = "Tournaments, clinics, and private lessons across Puerto Rico.";
const KICKER = "Puerto Rico Pickleball";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#09090b",
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Subtle emerald gradient blob top-right for depth */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -160,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0) 70%)",
          }}
        />

        {/* Top: Buen Tiro wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: -1,
              color: "#fafafa",
              display: "flex",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            buen tiro
          </div>
          <div
            style={{
              height: 4,
              width: 56,
              borderRadius: 2,
              background: "#10b981",
              marginLeft: 8,
              alignSelf: "center",
            }}
          />
        </div>

        {/* Middle: kicker + headline + subhead */}
        <div
          style={{
            marginTop: 80,
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#10b981",
            }}
          >
            {KICKER}
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.04,
              color: "#fafafa",
              maxWidth: 940,
            }}
          >
            {HEADLINE}
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.4,
              color: "#a1a1aa",
              maxWidth: 880,
            }}
          >
            {SUBHEAD}
          </div>
        </div>

        {/* Bottom: domain + emerald arc accent (trajectory ball) */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 22, color: "#52525b", letterSpacing: 0.5 }}>
            buentiro.app
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 220,
                height: 6,
                borderRadius: 3,
                background:
                  "linear-gradient(90deg, rgba(16,185,129,0) 0%, #10b981 100%)",
              }}
            />
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: "#10b981",
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
