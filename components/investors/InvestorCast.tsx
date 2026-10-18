import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { Dictionary } from "@/lib/i18n";
import type { Overview } from "@/lib/investor-data";
import { INVESTORS, investorFirm } from "@/lib/investors";
import { quarterLean, shortName } from "./format";
import { Portrait } from "./Portrait";
import styles from "./InvestorsIndex.module.css";

/**
 * Kapaktaki kadro — takip edilen herkes, tek sırada, kendi sayfasına
 * bağlantı (18 Ekim).
 *
 * 28 Eylül'deki büyük portre mozaiği "fazla fotoğraf odaklı" bulunup
 * kaldırılmıştı: on altı büyük kare bir galeri kapağıydı ve hiçbir şey
 * söylemiyordu. Bu kadro ondan iki yerde ayrılıyor: yüzler küçük (48, telefonda
 * 36 piksel) ve her yüz BİR BİLGİ taşıyor — sağ alttaki nokta yatırımcının bu
 * çeyrekteki yönü (pozisyon hareketlerinin sayısıyla net alıcı yeşil, net
 * satıcı kırmızı; `quarterLean`, aynı tanımı "Kim Alıyor, Kim Satıyor"
 * paneli kullanıyor). Bu çeyrek için yönü olmayan kişide (kapanan fon, Kongre
 * üyesi, karşılaştırılamayan ilk bildirim) nokta yok; kapanan fonun yüzü
 * soluk. Sıra listenin ünlülük sırası (`INVESTORS`), portföy sırası değil:
 * büyüklük hemen alttaki haritada.
 *
 * Giriş: yüzler soldan sırayla 10 piksel aşağıdan yerine oturuyor — yalnızca
 * dönüşüm, opaklık yok (ilk ekran). Hareketi azaltan okuyucu son kareyi
 * görüyor.
 */
export function InvestorCast({
  overview,
  locale,
  t,
}: {
  overview: Overview | null;
  locale: string;
  t: Dictionary["investors"];
}) {
  const period = overview?.movers.period ?? null;
  const cardOf = new Map((overview?.cards ?? []).map((card) => [card.slug, card]));
  const leans = INVESTORS.map((investor) => {
    const card = cardOf.get(investor.slug);
    return card ? quarterLean(card, period, investor.status === "closed") : null;
  });
  const anyLean = leans.some((lean) => lean === "up" || lean === "down");

  return (
    <div className={styles.cast}>
      <div className={styles.castHead}>
        <h2 className={styles.castTitle}>
          {t.castTitle}
          <span className="numeral">{INVESTORS.length}</span>
        </h2>
        {anyLean && (
          <ul className={styles.castLegend}>
            <li data-lean="up">{t.castBuyer}</li>
            <li data-lean="down">{t.castSeller}</li>
          </ul>
        )}
      </div>
      <ol className={styles.castList}>
        {INVESTORS.map((investor, index) => {
          const lean = leans[index];
          const firm = investorFirm(investor, locale);
          const aria = (lean === "up" ? t.castAriaUp : lean === "down" ? t.castAriaDown : t.castAria)
            .replace("{name}", investor.name)
            .replace("{firm}", firm);
          return (
            <li key={investor.slug} className="min-w-0" style={{ "--i": index } as CSSProperties}>
              <Link
                href={`/yatirimcilar/${investor.slug}`}
                prefetch={false}
                className={styles.castFace}
                data-lean={lean === "up" || lean === "down" ? lean : undefined}
                data-closed={investor.status === "closed" || undefined}
                aria-label={aria}
                title={investor.name}
              >
                <span className={styles.castPhoto}>
                  <Portrait investor={investor} size="cast" />
                </span>
                <span className={styles.castName} aria-hidden>
                  {shortName(investor.name)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
