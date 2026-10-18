import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import type { Overview } from "@/lib/investor-data";
import type { CrowdEntry } from "@/lib/investor-view";
import { investorBySlug, type Investor } from "@/lib/investors";
import { quarterLabel } from "./format";
import { Portrait } from "./Portrait";
import styles from "./InvestorsIndex.module.css";

/**
 * "Hisse Hisse Alanlar ve Satanlar" — çeyreğin ortak hareketleri tek bir
 * ayrışan grafikte (18 Ekim).
 *
 * NEDEN İKİ SÜTUN DEĞİL. Pano iki listeydi ("En Çok Alınanlar" / "En Çok
 * Satılanlar"), her satırda logo, sembol, ad, üç noktalı döküm ("1 Yeni
 * Aldı · 5 Artırdı · Karşısında 5 Satıcı"), bir çubuk, sayı ve portre
 * yığını: yoğun bir tablo gibi okunuyordu ve aynı hisse (GOOGL) iki sütunda
 * iki ayrı satırdı. Şimdi HİSSE BAŞINA TEK SATIR, ortada sıfır çizgisi:
 * sağa alanlar, sola satanlar. Kalabalığın yönü ve tartışmalı hisse bir
 * bakışta okunuyor — iki yana da uzanan satır tartışmalı.
 *
 * HER YÜZ BİR KİŞİ (isotype). Çubuk kişi sayısını ölçüyor; o yüzden çubuğun
 * birimi bir portre: yüzler sıfır çizgisinden dışa doğru diziliyor, altındaki
 * 5 piksellik şerit (kulvar üstünde, CLAUDE.md grafik dili) aynı birimle
 * uzuyor. Koyu parça güçlü hareket (yeni alım / tamamen satış) ve o kişiler
 * sıfır çizgisine en yakında; açık parça artıran / azaltan. Ölçek iki yanda
 * ve bütün satırlarda ORTAK (`--peak`): soldaki 4 ile sağdaki 4 aynı boy.
 *
 * VERİ TAM. `CrowdEntry` dört listenin hepsini taşıyor (`crowdMoves`); alım
 * listesinden gelen satırın satıcıları da eksiksiz. Liste iki yönün en
 * kalabalık hisselerinin birleşimi (`topBuys` ∪ `topSells`, en az iki kişi);
 * sıra net farka göre, en net alınan üstte.
 *
 * Satır bağlantı (hisse sitede biliniyorsa) ve `data-cc` ile şirket kartını
 * açıyor. Ekran okuyucu satırı tek cümle olarak duyuyor (ad listesi dahil);
 * grafiğin kendisi `aria-hidden`.
 */

/** Ölçeğin tabanı: tek satırlık "2 kişi" yarım şeridi doldurmasın. */
const PEAK_FLOOR = 4;

type Row = {
  entry: CrowdEntry;
  buyers: { investor: Investor; strong: boolean }[];
  sellers: { investor: Investor; strong: boolean }[];
};

function people(strong: string[], light: string[]) {
  return [
    ...strong.map((slug) => ({ slug, strong: true })),
    ...light.map((slug) => ({ slug, strong: false })),
  ]
    .map(({ slug, strong: isStrong }) => {
      const investor = investorBySlug(slug);
      return investor ? { investor, strong: isStrong } : null;
    })
    .filter((item): item is { investor: Investor; strong: boolean } => item !== null);
}

export function MoversBoard({
  movers,
  known,
  locale,
  t,
}: {
  movers: Overview["movers"];
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Dictionary["investors"];
}) {
  const byKey = new Map<string, CrowdEntry>();
  for (const entry of [...movers.buys, ...movers.sells]) if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
  const rows: Row[] = [...byKey.values()]
    .map((entry) => ({ entry, buyers: people(entry.opened, entry.added), sellers: people(entry.exited, entry.trimmed) }))
    .sort(
      (a, b) =>
        b.buyers.length - b.sellers.length - (a.buyers.length - a.sellers.length) ||
        b.buyers.length - a.buyers.length ||
        a.entry.key.localeCompare(b.entry.key),
    );
  const peak = Math.max(PEAK_FLOOR, ...rows.map((row) => Math.max(row.buyers.length, row.sellers.length)));
  const number = new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR");
  const signed = (value: number) => (value > 0 ? `+${number.format(value)}` : value < 0 ? `−${number.format(-value)}` : "0");

  return (
    <Panel>
      <PanelHeader
        title={t.moversTitle}
        meta={
          movers.period
            ? t.moversMeta.replace("{period}", quarterLabel(movers.period, t)).replace("{count}", String(movers.investors))
            : undefined
        }
      />
      {rows.length === 0 ? (
        <p className="border-t border-line px-4 py-4 text-small text-muted sm:px-5">{t.moversEmpty}</p>
      ) : (
        <div className={styles.moves} style={{ "--peak": peak } as CSSProperties}>
          {/* Eksen başlığı satırlarla AYNI ızgarada: "Satanlar" sol yarının,
              "Alanlar" sağ yarının üstünde, lejant ortada değil başlığın
              altında tek satır. */}
          <div className={styles.movesAxis} aria-hidden>
            <span className={styles.movesAxisChart}>
              <span data-side="sell">{t.moversSellers}</span>
              <span data-side="buy">{t.moversBuyers}</span>
            </span>
            <span className={styles.movesAxisNet}>{t.moversNet}</span>
          </div>
          <ol className={styles.movesList} data-motion-stagger>
            {rows.map(({ entry, buyers, sellers }) => {
              const meta = entry.ticker ? known[entry.ticker] : undefined;
              const net = buyers.length - sellers.length;
              const label = entry.ticker ?? entry.issuer;
              const spoken = [
                t.moversAria
                  .replace("{ticker}", label)
                  .replace("{buy}", number.format(buyers.length))
                  .replace("{sell}", number.format(sellers.length)),
                buyers.length > 0 ? t.moversWhoBuy.replace("{names}", buyers.map((b) => b.investor.name).join(", ")) : "",
                sellers.length > 0 ? t.moversWhoSell.replace("{names}", sellers.map((s) => s.investor.name).join(", ")) : "",
              ]
                .filter(Boolean)
                .join(" ");
              const body = (
                <>
                  <span className={styles.moveId}>
                    {entry.ticker ? (
                      <LogoTile symbol={entry.ticker} logoUrl={meta?.logoUrl} size="md" />
                    ) : (
                      <span className={styles.noLogo} aria-hidden />
                    )}
                    <span className={styles.moveIdText} aria-hidden>
                      <b className="numeral">{label}</b>
                      <small>{meta?.name ?? entry.issuer}</small>
                    </span>
                  </span>
                  <span className={styles.moveChart} aria-hidden>
                    <Side side="sell" crowd={sellers} />
                    <span className={styles.moveZero} />
                    <Side side="buy" crowd={buyers} />
                  </span>
                  <b className={`${styles.moveNet} numeral`} data-tone={net > 0 ? "up" : net < 0 ? "down" : "flat"} aria-hidden>
                    {signed(net)}
                  </b>
                  <span className="sr-only">{spoken}</span>
                </>
              );
              return (
                <li key={entry.key} className="min-w-0">
                  {entry.ticker && meta ? (
                    <Link href={`/hisse/${entry.ticker}`} prefetch={false} className={styles.moveRow} data-cc={entry.ticker}>
                      {body}
                    </Link>
                  ) : (
                    <div className={styles.moveRow}>{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
          <ul className={styles.movesLegend} aria-hidden>
            <li data-tone="up" data-strong>{t.moversOpened}</li>
            <li data-tone="up">{t.moveIncreased}</li>
            <li data-tone="down">{t.moveDecreased}</li>
            <li data-tone="down" data-strong>{t.moveSoldOut}</li>
          </ul>
        </div>
      )}
      <p className={styles.note}>{t.moversNote}</p>
    </Panel>
  );
}

/**
 * Bir yarı: sıfır çizgisinden dışa doğru yüzler, altında aynı birimle uzayan
 * şerit, ucunda sayı. Satış yarısı aynı ağacın aynası (`row-reverse`).
 * Şerit sıfır çizgisinden açılıyor (`data-motion-draw="line"`, dönüşüm
 * merkezi sıfır tarafı).
 */
function Side({ side, crowd }: { side: "buy" | "sell"; crowd: { investor: Investor; strong: boolean }[] }) {
  const strong = crowd.filter((item) => item.strong).length;
  return (
    <span className={styles.moveSide} data-side={side} style={{ "--n": crowd.length } as CSSProperties}>
      {crowd.length > 0 && (
        <>
          <span className={styles.moveFaces}>
            {crowd.map(({ investor, strong: isStrong }) => (
              <span key={investor.slug} className={styles.moveFace} data-strong={isStrong || undefined} title={investor.name}>
                <Portrait investor={investor} size="chip" />
              </span>
            ))}
            <b className={`${styles.moveCount} numeral`}>{crowd.length}</b>
          </span>
          <span
            className={styles.moveRail}
            data-motion-draw="line"
            style={{ transformOrigin: side === "buy" ? "left center" : "right center" }}
          >
            {strong > 0 && <i data-strong style={{ flexGrow: strong }} />}
            {crowd.length - strong > 0 && <i style={{ flexGrow: crowd.length - strong }} />}
          </span>
        </>
      )}
    </span>
  );
}
