import { ImageResponse } from "next/og";
import {
  C,
  Chip,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  OgTitle,
  Tri,
  clip,
  ogFonts,
} from "@/lib/og";
import { getAnalysis } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { verdictLabel, verdictOf, type VerdictKey } from "@/lib/analysis";
import { formatPercentPlain, formatPrice } from "@/lib/utils";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Açılış Zili — Bilanço Analizi";

/**
 * Bilanço analizinin paylaşım kartı.
 *
 * WhatsApp'a bir analiz linki düştüğünde karşı taraf, tıklamadan önce üç
 * şeyi görüyor: hangi şirketin hangi çeyreği, sitenin görüşü (AL/TUT/SAT +
 * skor) ve çeyreğin tek cümlelik manşeti. Eskiden buraya sitenin genel
 * tanıtım görseli düşüyordu — link nereye giderse gitsin aynı kart.
 *
 * Kayıt bulunamazsa (silinmiş analiz, yanlış dönem) çerçeve yine basılıyor
 * ama sembolle: boş bir kart yerine en azından doğru şirketin adı görünür.
 */

/** Görüş rengi — sitedeki `verdictTextClass` ile aynı eşleme, sabit renkle. */
function verdictTone(v: VerdictKey) {
  if (v === "buy") return { fg: C.up, bg: C.upWash };
  if (v === "sell") return { fg: C.down, bg: C.downWash };
  return { fg: C.body, bg: C.primaryTint };
}

/** Skor halkası — sitedeki `ScoreRing`in Satori'de çizilebilen hâli. */
function ScoreDisc({ score, tone }: { score: number; tone: string }) {
  return (
    <div
      style={{
        width: 132,
        height: 132,
        borderRadius: 999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        border: `10px solid ${tone}`,
        background: C.surface,
      }}
    >
      <span
        style={{
          fontSize: 52,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: C.strong,
          lineHeight: 1,
        }}
      >
        {score}
      </span>
      <span style={{ fontSize: 17, color: C.muted, lineHeight: 1.4 }}>
        / 100
      </span>
    </div>
  );
}

export default async function AnalysisOgImage({
  params,
}: {
  params: Promise<{ symbol: string; period: string }>;
}) {
  const { symbol: rawSymbol, period } = await params;
  const symbol = rawSymbol.toUpperCase();
  const { locale, t } = await getI18n();
  const row = await getAnalysis(symbol, period, locale);

  const fonts = await ogFonts();

  if (!row) {
    return new ImageResponse(
      (
        <OgFrame eyebrow="Bilanço Analizi">
          <OgTitle>{symbol}</OgTitle>
        </OgFrame>
      ),
      { ...size, fonts },
    );
  }

  const verdict = verdictOf(row.verdict);
  const tone = verdictTone(verdict);
  const upside =
    row.upsidePct ??
    (row.targetPrice !== null && row.price !== null && row.price > 0
      ? ((row.targetPrice - row.price) / row.price) * 100
      : null);

  return new ImageResponse(
    (
      <OgFrame
        eyebrow="Bilanço Analizi"
        accent={
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: C.muted,
                }}
              >
                GENEL GÖRÜŞ
              </span>
              <span
                style={{
                  fontSize: 50,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: tone.fg,
                  lineHeight: 1,
                }}
              >
                {verdictLabel(verdict, t)}
              </span>
            </div>
            <ScoreDisc score={row.score} tone={tone.fg} />
          </div>
        }
        footer={
          <>
            <Chip tone="primary">
              {symbol}
              {row.exchange ? ` · ${row.exchange}` : ""}
            </Chip>
            <Chip>{row.periodLabel}</Chip>
            {row.targetPrice !== null && (
              <Chip tone={upside !== null && upside < 0 ? "down" : "up"}>
                {`Hedef ${formatPrice(row.targetPrice, locale, { currency: true })}`}
                {upside !== null && (
                  <>
                    <span style={{ color: C.muted }}>·</span>
                    <Tri up={upside >= 0} color={upside >= 0 ? C.up : C.down} />
                    {formatPercentPlain(upside, locale, 0)}
                  </>
                )}
              </Chip>
            )}
          </>
        }
      >
        {/* Şirket adı kartın manşeti; uzun adlar (ör. "Palantir
            Technologies") tek satırda kalsın diye punto ada göre iner. */}
        <OgTitle size={row.company.length > 22 ? 56 : 68}>
          {clip(row.company, 34)}
        </OgTitle>
        <div
          style={{
            fontSize: 29,
            lineHeight: 1.32,
            color: C.body,
            display: "flex",
            maxWidth: 1000,
          }}
        >
          {clip(row.headline, 168)}
        </div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
