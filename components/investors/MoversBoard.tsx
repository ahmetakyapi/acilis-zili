import type { CSSProperties } from "react";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react/dist/ssr";
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
 * "Hisse Hisse Alanlar ve Satanlar" — çeyreğin ortak hareketleri, HİSSE
 * KARTI olarak (18 Ekim; 25 Ekim kartlara döndü).
 *
 * 18 Ekim'de iki sütunlu liste tek bir ayrışan grafiğe dönmüştü: hisse
 * başına tek satır, ortada sıfır çizgisi. Doğru soruyu soruyordu ama
 * telefonda her satır iki kat yükseklikte, geniş ekranda ise yüzler
 * satırın ortasında küçük bir küme olarak kalıyordu. Sayfa kartlı bir
 * dile geçince (yatırımcı kart ızgarası) bu bölüm de kart oldu: her hisse
 * bir kart — logo ve ad, net fark rozeti, ALANLAR ve SATANLAR iki satırda
 * (yüz yığını + sayı), altlarında aynı ölçekli iki çizgi.
 *
 * HER YÜZ BİR KİŞİ. Çizginin birimi kişi; ölçek bütün kartlarda ORTAK
 * (`--peak`): bir karttaki 4 ile ötekindeki 4 aynı boy. Koyu parça güçlü
 * hareket (yeni alım / tamamen satış), açık parça artıran / azaltan.
 *
 * VERİ TAM. `CrowdEntry` dört listenin hepsini taşıyor (`crowdMoves`);
 * liste iki yönün en kalabalık hisselerinin birleşimi (`topBuys` ∪
 * `topSells`, en az iki kişi); sıra net farka göre, en net alınan önde.
 * Kart bağlantı (hisse sitede biliniyorsa) ve `data-cc` ile şirket kartını
 * açıyor. Ekran okuyucu kartı tek cümle olarak duyuyor (ad listesi dahil).
 */

/** Ölçeğin tabanı: tek kartlık "2 kişi" çizgiyi doldurmasın. */
const PEAK_FLOOR = 4;
/** Yığında görünen en çok yüz; fazlası sayıda. */
const FACES = 5;

type Person = { investor: Investor; strong: boolean };

function people(strong: string[], light: string[]): Person[] {
  return [
    ...strong.map((slug) => ({ slug, strong: true })),
    ...light.map((slug) => ({ slug, strong: false })),
  ]
    .map(({ slug, strong: isStrong }) => {
      const investor = investorBySlug(slug);
      return investor ? { investor, strong: isStrong } : null;
    })
    .filter((item): item is Person => item !== null);
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
  const rows = [...byKey.values()]
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
        <div className={styles.stocks} style={{ "--peak": peak } as CSSProperties}>
          <ol className={styles.stockGrid} data-motion-stagger>
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
                  <span className={styles.stockHead} aria-hidden>
                    {entry.ticker ? (
                      <LogoTile symbol={entry.ticker} logoUrl={meta?.logoUrl} size="md" />
                    ) : (
                      <span className={styles.noLogo} aria-hidden />
                    )}
                    <span className={styles.stockId}>
                      <b className="numeral">{label}</b>
                      <small>{meta?.name ?? entry.issuer}</small>
                    </span>
                    <b className={`${styles.stockNet} numeral`} data-tone={net > 0 ? "up" : net < 0 ? "down" : "flat"}>
                      {signed(net)}
                    </b>
                  </span>
                  <Side side="buy" label={t.moversBuyers} crowd={buyers} />
                  <Side side="sell" label={t.moversSellers} crowd={sellers} />
                  <span className="sr-only">{spoken}</span>
                </>
              );
              return (
                <li key={entry.key} className="flex min-w-0">
                  {entry.ticker && meta ? (
                    <Link href={`/hisse/${entry.ticker}`} prefetch={false} className={styles.stockCard} data-cc={entry.ticker}>
                      {body}
                    </Link>
                  ) : (
                    <div className={styles.stockCard}>{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
          <ul className={styles.stockLegend} aria-hidden>
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

/** Bir yön: etiket, yüz yığını ve sayı; altında aynı ölçekli çizgi. */
function Side({ side, label, crowd }: { side: "buy" | "sell"; label: string; crowd: Person[] }) {
  const strong = crowd.filter((item) => item.strong).length;
  const shown = crowd.slice(0, FACES);
  return (
    <span className={styles.stockSide} data-side={side} data-empty={crowd.length === 0 || undefined} aria-hidden>
      <span className={styles.stockSideRow}>
        {side === "buy" ? <ArrowUp size={12} weight="bold" /> : <ArrowDown size={12} weight="bold" />}
        <span className={styles.stockSideLabel}>{label}</span>
        <span className={styles.stockFaces}>
          {shown.map(({ investor, strong: isStrong }) => (
            <span key={investor.slug} className={styles.stockFace} data-strong={isStrong || undefined} title={investor.name}>
              <Portrait investor={investor} size="chip" />
            </span>
          ))}
        </span>
        <b className="numeral">{crowd.length}</b>
      </span>
      <span className={styles.stockLane} style={{ "--n": crowd.length } as CSSProperties}>
        {crowd.length > 0 && (
          <span data-motion-draw="line">
            {strong > 0 && <i data-strong style={{ flexGrow: strong }} />}
            {crowd.length - strong > 0 && <i style={{ flexGrow: crowd.length - strong }} />}
          </span>
        )}
      </span>
    </span>
  );
}
