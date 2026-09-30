import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import type { FundCard, Overview } from "@/lib/investor-data";
import { investorBySlug, investorFirm, type Investor } from "@/lib/investors";
import { plural } from "@/lib/utils";
import { quarterLabel } from "./format";
import { Portrait } from "./Portrait";
import styles from "./Investors.module.css";

/** Şeridin ortası, yüzde. Denge çizgisi ve portrenin kalkış noktası. */
const CENTER = 50;

type BalanceRow = {
  investor: Investor;
  counts: FundCard["counts"];
  buy: number;
  sell: number;
  total: number;
  /** Satış yönündeki payı, yüzde — şeritte düğümün soldan konumu. */
  sellPct: number;
};

/**
 * "Kim Alıyor, Kim Satıyor" — her yatırımcının çeyreği tek bir halat
 * çekmesi olarak (1 Ekim).
 *
 * NEDEN BU PANEL. Sayfa hisse başına kalabalığı ("GOOGL: 7 Alan") ve kişi
 * başına dört sayıyı (kartın dibindeki "1 Yeni · 7 Artırdı · 6 Azalttı ·
 * 1 Tamamen Satış") gösteriyordu; "bu çeyrek kim alıcıydı, kim satıcı"
 * sorusunun cevabı on dört kartın dibindeki sayıları tek tek toplamaktı.
 * Veri zaten orada (`FundCard.counts`); panel yalnızca onu yan yana koyuyor.
 *
 * ÖLÇÜ PAY, ADET DEĞİL. Şerit bir yatırımcının bu çeyrekteki pozisyon
 * HAREKETLERİNİ ikiye bölüyor: solda azaltılan + tamamen satılan, sağda
 * yeni alınan + artırılan. Ham adet ortak ölçekle çizilemezdi: Dalio'nun
 * ~1.200 hareketinin yanında Icahn'ın dördü görünmez bir çizgi olurdu ve
 * şerit yön yerine fon büyüklüğünü anlatırdı. Adet yine yazılı (iki uçta
 * sayı, sağda toplam), yani oran hangi büyüklükten geldiğini saklamıyor.
 * DOLAR DEĞİL, POZİSYON SAYISI: küçük bir pozisyonu kapatmak da büyük bir
 * alım kadar sayılıyor — künye bunu açıkça söylüyor.
 *
 * KÜME KAPAKTAKİYLE AYNI: en son çeyreği bildirmiş, önceki çeyrekle
 * karşılaştırılabilen, kapanmamış 13F fonları (`movers.investors` aynı
 * tanım). Kongre üyesi dışarıda: onun verisi işlem, pozisyon farkı değil.
 *
 * HAREKET. Düğüm (portre) şeridin ortasından, yani "dengede"den kalkıp
 * kendi yerine kayıyor (`data-motion-draw="travel"`), iki renk de ortadan
 * dışa doğru açılıyor (dönüşüm merkezi şeridin ortası, bkz. `origin`).
 * Okuyucu her satırda aynı şeyi görüyor: denge çizgisinden hangi yöne ve
 * ne kadar gittiği. Hareketi azaltan okuyucu son kareyi görüyor.
 */
export function InvestorBalance({
  overview,
  locale,
  t,
}: {
  overview: Overview;
  locale: string;
  t: Dictionary["investors"];
}) {
  const period = overview.movers.period;
  const rows: BalanceRow[] = [];
  for (const card of overview.cards) {
    if (card.kind !== "13f" || card.period !== period || !card.compared) continue;
    const investor = investorBySlug(card.slug);
    if (!investor || investor.status === "closed") continue;
    const buy = card.counts.new + card.counts.increased;
    const sell = card.counts.decreased + card.counts.soldOut;
    const total = buy + sell;
    if (total === 0) continue;
    rows.push({ investor, counts: card.counts, buy, sell, total, sellPct: (sell / total) * 100 });
  }
  if (rows.length === 0) return null;
  /* En alıcı üstte, en satıcı altta: liste okundukça düğüm sağdan sola
     iniyor ve ortadaki çizgiyi geçtiği satır "net alıcılar bitti" demek. */
  rows.sort((a, b) => a.sellPct - b.sellPct || b.total - a.total);

  const buyers = rows.filter((row) => row.buy > row.sell).length;
  const sellers = rows.filter((row) => row.sell > row.buy).length;
  const even = rows.length - buyers - sellers;
  const number = new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR");

  return (
    <Panel className={styles.balancePanel}>
      <PanelHeader
        title={t.balanceTitle}
        meta={period ? t.balanceMeta.replace("{period}", quarterLabel(period, t)) : undefined}
      />
      {/* ÜÇ SAYI, TEK CEVAP: satırları okumadan önce çeyreğin yönü. Sayılar
          kişi sayısı; renk yalnızca yön (alıcı yeşil, satıcı kırmızı). */}
      <dl className={styles.balanceScore}>
        <div data-tone="up">
          <dt>{plural(buyers, t.balanceBuyersOne, t.balanceBuyers)}</dt>
          <dd className="numeral">{buyers}</dd>
        </div>
        <div data-tone="down">
          <dt>{plural(sellers, t.balanceSellersOne, t.balanceSellers)}</dt>
          <dd className="numeral">{sellers}</dd>
        </div>
        {even > 0 && (
          <div data-tone="flat">
            <dt>{t.balanceEven}</dt>
            <dd className="numeral">{even}</dd>
          </div>
        )}
      </dl>
      <div className={styles.balanceBody}>
        {/* Eksen başlığı satırlarla AYNI ızgarada: "Denge" yazısı her
            satırdaki orta çizginin tam üstünde. */}
        <div className={styles.balanceAxis} aria-hidden>
          <span className={styles.balanceAxisTrack}>
            <span data-side="sell">{t.balanceSellSide}</span>
            <span data-side="center">{t.balanceCenter}</span>
            <span data-side="buy">{t.balanceBuySide}</span>
          </span>
        </div>
        <ol className={styles.balanceList} data-motion-stagger>
          {rows.map((row) => {
            const buyPct = 100 - row.sellPct;
            /* Dönüşüm merkezi ŞERİDİN ORTASI, çubuğun kendi koordinatında:
               iki renk ortadan açılıyor ve düğümle aynı noktadan kalkıyor.
               Değer çubuğun dışına düşebilir (%160, %-40); CSS bunu kabul
               ediyor. */
            const sellOrigin = row.sellPct > 0 ? `${(CENTER / row.sellPct) * 100}% center` : undefined;
            const buyOrigin = buyPct > 0 ? `${((CENTER - row.sellPct) / buyPct) * 100}% center` : undefined;
            return (
              <li key={row.investor.slug} className="min-w-0">
                <Link
                  href={`/yatirimcilar/${row.investor.slug}`}
                  prefetch={false}
                  className={styles.balanceRow}
                  data-lean={row.buy > row.sell ? "up" : row.sell > row.buy ? "down" : "flat"}
                  aria-label={t.balanceAria
                    .replace("{name}", row.investor.name)
                    .replace("{buy}", number.format(row.buy))
                    .replace("{sell}", number.format(row.sell))}
                >
                  <span className={styles.balanceWho}>
                    <Portrait investor={row.investor} size="sm" />
                    <span className={styles.balanceId}>
                      <b>{row.investor.name}</b>
                      <small>{investorFirm(row.investor, locale)}</small>
                    </span>
                  </span>
                  <b className={`${styles.balanceCount} numeral`} data-side="sell" aria-hidden>
                    {number.format(row.sell)}
                  </b>
                  <span className={styles.balanceTrack} aria-hidden>
                    {row.sell > 0 && (
                      <span
                        className={styles.balanceSell}
                        data-motion-draw="line"
                        style={{ width: `${row.sellPct}%`, transformOrigin: sellOrigin }}
                      >
                        {/* Dış uçta koyu ton (tamamen satılan), düğüme
                            yakın açık ton (azaltılan): yoğunluk dışa doğru
                            artıyor, iki yanda simetrik. */}
                        <i data-strong style={{ flexGrow: row.counts.soldOut }} />
                        <i style={{ flexGrow: row.counts.decreased }} />
                      </span>
                    )}
                    {buyPct > 0 && (
                      <span
                        className={styles.balanceBuy}
                        data-motion-draw="line"
                        style={{ left: `${row.sellPct}%`, width: `${buyPct}%`, transformOrigin: buyOrigin }}
                      >
                        <i style={{ flexGrow: row.counts.increased }} />
                        <i data-strong style={{ flexGrow: row.counts.new }} />
                      </span>
                    )}
                    <span
                      className={styles.balanceKnot}
                      data-motion-draw="travel"
                      data-delta={(CENTER - row.sellPct).toFixed(2)}
                      style={{ "--knot": `${row.sellPct}%` } as CSSProperties}
                    >
                      <Portrait investor={row.investor} size="chip" />
                    </span>
                  </span>
                  <b className={`${styles.balanceCount} numeral`} data-side="buy" aria-hidden>
                    {number.format(row.buy)}
                  </b>
                  <small className={`${styles.balanceTotal} numeral`} aria-hidden>
                    {plural(row.total, t.balanceMovesOne, t.balanceMoves).replace("{count}", number.format(row.total))}
                  </small>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">{t.balanceNote}</p>
    </Panel>
  );
}
