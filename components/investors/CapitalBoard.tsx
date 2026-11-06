import type { CSSProperties } from "react";
import type { Dictionary } from "@/lib/i18n";
import { INVESTORS } from "@/lib/investors";
import { formatMoneyCompact, formatPercentPlain } from "@/lib/utils";
import { capitalLegend, type capitalShares } from "./card-view";
import { Portrait } from "./Portrait";
import styles from "./InvestorsIndex.module.css";

/**
 * KAPAKTAKİ SERMAYE PANOSU (6 Kasım) — "Takip Edilen Sermaye Kimde".
 *
 * TARİHÇE. 25 Ekim'de ekranın yarısını kaplayan sermaye haritası tek
 * satırlık yığılı şeride (`CapitalStrip`) indi: kapağın ALTINDA tam
 * genişlikte, 8 piksellik çizgi ve altına dağılmış iki-üç etiket. 6 Kasım'da
 * sahibi "sermaye kısmı üstteki başlık kısmının oraya geçebilir, alanı daha
 * güzel ve doğru kullanalım" dedi: 1440'ta kapağın sağ yarısı (Paylaş
 * dışında) bomboştu, şeridin etiketleri ise şeridin altında birbirinden
 * kopuk duruyordu ("Buffett %61" solda, "Laffont %10" ortada, "Diğer 7"
 * sağda; hangi etiketin hangi parçanın olduğu yerinden tahmin ediliyordu).
 *
 * ŞİMDİ. Pano kapağın sağ kolonu (telefonda başlığın altı), içi üç kat:
 *   1. Künye + büyük toplam + fon sayısı (ölçü, birimi bitişik).
 *   2. ŞERİT FON BAŞINA PARÇA — "Diğer" artık şeritte tek gri blok değil,
 *      her fon kendi parçası; okur kaç fonun ne kadar küçük olduğunu
 *      parçaların inceliğinden görüyor. İlk üç parça kendi tonunda,
 *      kalanlar ortak açık tonda.
 *   3. Lejant: ilk üç fon portresi, soyadı, payı ve tutarıyla; dördüncü
 *      satır "Diğer N Fon". Her satırın solundaki küçük çizgi şeritteki
 *      parçanın TONU — etiket parçaya yerinden değil renginden bağlanıyor.
 *
 * Renk yalnız büyüklük: sitenin yumuşak büyüklük tonu `--bar-soft` ve onun
 * açılan kademeleri (yatırımcı kartındaki pay çizgisiyle AYNI ton, yani
 * kapaktaki Buffett parçası ile Buffett kartının çizgisi aynı şeyin iki
 * okuması). Yön rengi (yeşil/kırmızı) burada yok: pay bir yargı değil.
 * Parçalar bağlantı değil (12 piksel dokunma hedefi olamaz); kişinin kartı
 * hemen altta.
 */

type Labels = Dictionary["investors"];

/** Lejantta adıyla ve portresiyle görünen fon sayısı. */
const LEAD = 3;

export function CapitalBoard({
  capital,
  locale,
  t,
}: {
  capital: ReturnType<typeof capitalShares>;
  locale: string;
  t: Labels;
}) {
  if (capital.total <= 0) return null;
  const { lead, rest } = capitalLegend(capital.slices, LEAD);
  const investorOf = (slug: string) => INVESTORS.find((investor) => investor.slug === slug);
  const pct = (share: number) => formatPercentPlain(share, locale, share >= 10 ? 0 : 1);
  /* Tekil/çoğul dal (6 Kasım, inceleme): EN "1 Other Funds" yazıyordu. */
  const otherLabel = (rest.count === 1 ? t.capitalOtherOne : t.capitalOther).replace("{count}", String(rest.count));
  const aria = [
    ...lead.map((slice) =>
      t.capitalLeadAria
        .replace("{name}", investorOf(slice.slug)?.name ?? slice.slug)
        .replace("{share}", formatPercentPlain(slice.share, locale, 1))
        .replace("{value}", formatMoneyCompact(slice.value, locale)),
    ),
    ...(rest.count > 0
      ? [
          t.capitalLeadAria
            .replace("{name}", otherLabel)
            .replace("{share}", formatPercentPlain(rest.share, locale, 1))
            .replace("{value}", formatMoneyCompact(rest.value, locale)),
        ]
      : []),
  ].join(" ");

  return (
    <div className={styles.capital}>
      <p className={styles.capitalHead}>
        <span>{t.capitalLabel}</span>
        <span className={styles.capitalFigure}>
          <b className="numeral">{formatMoneyCompact(capital.total, locale)}</b>
          <small className="numeral">{(capital.slices.length === 1 ? t.capitalFundsCountOne : t.capitalFundsCount).replace("{count}", String(capital.slices.length))}</small>
        </span>
      </p>
      <div className={styles.capitalBar} role="img" aria-label={`${t.capitalStripAria}. ${aria}`}>
        {capital.slices.map((slice, index) => (
          <i
            key={slice.slug}
            data-motion-draw="line"
            data-rank={Math.min(index, LEAD)}
            title={`${investorOf(slice.slug)?.name ?? slice.slug} ${formatPercentPlain(slice.share, locale, 1)}`}
            style={{ flexGrow: slice.share } as CSSProperties}
          />
        ))}
      </div>
      <ul className={styles.capitalLegend} aria-hidden>
        {lead.map((slice, index) => {
          const investor = investorOf(slice.slug);
          return (
            <li key={slice.slug} data-rank={index}>
              {investor ? <Portrait investor={investor} size="chip" /> : <span className={styles.legendMore} data-size="chip" />}
              <span className={styles.legendName}>{investor ? lastName(investor.name) : slice.slug}</span>
              <b className="numeral">{pct(slice.share)}</b>
              <small className="numeral">{formatMoneyCompact(slice.value, locale)}</small>
            </li>
          );
        })}
        {rest.count > 0 && (
          <li data-rank={LEAD}>
            <span className={styles.legendMore} data-size="chip">
              +{rest.count}
            </span>
            <span className={styles.legendName}>{otherLabel}</span>
            <b className="numeral">{pct(rest.share)}</b>
            <small className="numeral">{formatMoneyCompact(rest.value, locale)}</small>
          </li>
        )}
      </ul>
    </div>
  );
}

function lastName(name: string): string {
  return name.split(" ").at(-1) ?? name;
}
