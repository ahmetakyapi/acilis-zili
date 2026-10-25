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
  VERDICT_OG,
} from "@/lib/og";
import { getAnalysis } from "@/lib/data";
import { DEFAULT_LOCALE, getDictionary } from "@/lib/i18n";
import { verdictLabel, verdictOf, type VerdictKey } from "@/lib/analysis";
import { formatPercentPlain, formatPrice } from "@/lib/utils";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/* DİL SABİT, İSTEKTEN OKUNMUYOR — gerekçenin tamamı lib/og.tsx başında.
   Özeti: paylaşım kartının adresi önek taşımıyor, dolayısıyla `getI18n()`
   buradan hiçbir zaman `en` döndürmüyordu; çıktıyı değiştirmeden yalnızca
   her istekte `headers()` ve `cookies()` okuyordu. */
export const alt = "Bilanço Analizi · Açılış Zili";

/**
 * Bilanço analizinin paylaşım kartı.
 *
 * WhatsApp'a bir analiz linki düştüğünde karşı taraf, tıklamadan önce üç
 * şeyi görüyor: hangi şirketin hangi çeyreği, sitenin görüşü (AL/TUT/SAT +
 * skor) ve çeyreğin tek cümlelik manşeti. Eskiden buraya sitenin genel
 * tanıtım görseli düşüyordu — link nereye giderse gitsin aynı kart.
 *
 * KAYIT YOKSA 404 (20 Ekim). Kayıt bulunamazsa (silinmiş analiz, yanlış
 * dönem) çerçeve yine basılıyordu, adresteki sembolle: "boş bir kart yerine
 * en azından doğru şirketin adı" diye. Ama sayfanın kendisi aynı durumda
 * 404 veriyor, yani kartın anlatacağı bir sayfa yok; üstelik sembol adresin
 * HAM metniydi — `/bilancolar/<herhangi bir metin>/x/opengraph-image`
 * sitenin "Bilanço Analizi" çerçevesinde istenen cümleyle 200 dönüyor ve
 * her biri bir sorgu + Satori çizimi harcıyordu. Biçimi tutmayan sembol
 * sorguya hiç gitmiyor; kalıp yazma ucununkiyle aynı (`/api/analiz` →
 * `BodySchema.symbol`), yani var olabilecek her analiz geçiyor.
 *
 * OKUNAMADI ≠ YOK (20 Ekim). 404 yalnız okuma BAŞARILI olup kayıt
 * çıkmadığında. Kart önce yutan yoldan okuyordu: Neon'un kısa bir
 * kesintisinde `null` da "kayıt yok" sayılıp 404 dönüyordu — sayfa aynı
 * anda `throwOnError` ile hata sınırına giderken. Tarayıcı botu sayfayı
 * veritabanı ayaktayken alıp görseli kesinti anında isterse 404'ü saklıyor
 * ve WhatsApp/X o önizlemeyi günlerce tutuyor: link kesinti bittikten sonra
 * da görselsiz kalıyordu. Şimdi okuma `throwOnError` ile; okunamazsa eski
 * sembollü çerçeve basılır (sembol kalıptan geçmiş; adresin keyfi metni
 * basılmıyor) ve `no-store` taşır ki kesinti kartı hiçbir ara önbellekte kalmasın
 * (`ReadOptions`, lib/data.ts).
 */
const ANALYSIS_SYMBOL = /^[A-Z.-]{1,12}$/;

/** Görüş rengi — sitedeki üçlünün sabit karşılığı (`VERDICT_OG`, lib/og.tsx).
    TUT burada gri basılıyordu; sitede pirinç. */
function verdictTone(v: VerdictKey) {
  return VERDICT_OG[v];
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
  if (!ANALYSIS_SYMBOL.test(symbol)) return new Response(null, { status: 404 });
  const locale = DEFAULT_LOCALE;
  const t = getDictionary(locale);
  let row: Awaited<ReturnType<typeof getAnalysis>>;
  try {
    row = await getAnalysis(symbol, period, locale, { throwOnError: true });
  } catch (error) {
    // Okunamadı: 404 değil, sembollü çerçeve (yukarıdaki "OKUNAMADI ≠ YOK").
    const mesaj = error instanceof Error ? error.message : String(error);
    console.error(`[veri] getAnalysis (paylaşım kartı) okunamadı: ${mesaj}`);
    return new ImageResponse(
      (
        <OgFrame eyebrow={t.analysis.ogEyebrow} locale={locale}>
          <OgTitle>{symbol}</OgTitle>
        </OgFrame>
      ),
      {
        ...size,
        fonts: await ogFonts(),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  if (!row) return new Response(null, { status: 404 });

  const fonts = await ogFonts();

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
        eyebrow={t.analysis.ogEyebrow} locale={locale}
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
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "0.01em",
                  color: C.muted,
                }}
              >
                {t.analysis.verdictLabel}
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
            <ScoreDisc score={row.score} tone={tone.ink} />
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
                {`${t.analysis.ogTarget} ${formatPrice(row.targetPrice, locale, { currency: true })}`}
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
