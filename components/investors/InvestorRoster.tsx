import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { Dictionary } from "@/lib/i18n";
import type { Overview } from "@/lib/investor-data";
import { INVESTORS, investorFirm } from "@/lib/investors";
import { formatMoneyCompact, formatPercentPlain } from "@/lib/utils";
import { Portrait } from "./Portrait";
import styles from "./Investors.module.css";

/** Şeridin altında adıyla anılan en büyük pay sayısı; kalanı tek "Diğer". */
const STRIP_NAMED = 5;
/** Bu paydan büyük dilim portresini ve payını şeridin içinde taşıyor (yüzde). */
const INLINE_SHARE = 8;
/** Adı da sığdıran pay: %10'luk dilim 1440'ta ~125 piksel ve ad "Phil…" diye kesiliyordu. */
const INLINE_NAME_SHARE = 20;
/**
 * Dilimin ortası şeridin bu kadar ucundaysa (yüzde) bilgi kartı kenara
 * yaslanıyor. 16'ydı; 390'da ilk dilim (%60) ortalı açılıyor ve kart
 * ekranın solundan 12 piksel taşıyordu (28 Eylül denetimi). 35'te ilk ve
 * son dilimlerin kartı her genişlikte kenardan açılıyor.
 */
const EDGE_SHARE = 35;

/**
 * Dizin kapağının görseli (28 Eylül) — portre mozaiğinin yerine.
 *
 * Mozaik on altı büyük fotoğraftı ve sahibi haklı olarak "fazla fotoğraf
 * odaklı" buldu: kapak bir veri ekranının değil bir galeri sayfasının
 * kapağı gibiydi ve hiçbir şey söylemiyordu. Şimdi iki parça:
 *
 *   1. SERMAYE ŞERİDİ — takip edilen hisse portföylerinin toplamı tek bir
 *      yatay çizgi; her fon kendi payı kadar uzun (doğrusal, uzunluk bir
 *      BÜYÜKLÜK: CLAUDE.md "karşılaştırılan her büyüklük bir de çizgi").
 *      Kapanan fon (Burry) ve Kongre üyesi toplamın dışında, kahramandaki
 *      sayıyla aynı tanım (`trackedValue`). En büyük beşi adıyla, kalanı
 *      tek "Diğer" satırında.
 *   2. KADRO KALKTI (28 Eylül, sahibinin isteği). Kişi başına portreli
 *      satırlardan oluşan ızgara "insan portresi galerisi" gibi okunuyordu
 *      ve aşağıdaki yatırımcı kartlarını tekrar ediyordu. Kapak artık
 *      yalnızca şerit; sayfa doğrudan kartlarla devam ediyor.
 *
 * Şerit girişi `clip-path` ile soldan açılıyor (opaklık yok, LCP
 * beklemiyor); hareketi azaltan okuyucu son kareyi görüyor.
 */
export function InvestorRoster({
  overview,
  locale,
  t,
}: {
  overview: Overview | null;
  locale: string;
  t: Dictionary["investors"];
}) {
  const valueOf = new Map<string, number>();
  /* KAPAKTAKİ TOPLAMLA AYNI KÜME (28 Eylül denetimi): `trackedValue` yalnızca
     en son çeyreği bildiren ve kapanmamış fonları sayıyor. Şerit her fonun
     son dosyasını topluyordu; bildirim sezonunda bir fon yeni çeyreği,
     öteki eskisini taşırken iki sayı ayrışırdı. */
  const period = overview?.movers.period ?? null;
  for (const card of overview?.cards ?? []) {
    if (card.kind === "13f" && card.period === period) valueOf.set(card.slug, card.longValue);
  }
  const segments = INVESTORS.filter((investor) => investor.kind === "13f" && investor.status !== "closed")
    .map((investor) => ({ investor, value: valueOf.get(investor.slug) ?? 0 }))
    .filter((segment) => segment.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const named = segments.slice(0, STRIP_NAMED);
  const rest = segments.slice(STRIP_NAMED);
  const restValue = rest.reduce((sum, segment) => sum + segment.value, 0);
  const share = (value: number) => (total > 0 ? (value / total) * 100 : 0);

  return (
    <div className={styles.roster}>
      {total > 0 && (
        <figure className={styles.capital}>
          <figcaption className={styles.capitalTitle}>{t.capitalTitle}</figcaption>
          {/* DİLİMLER BAĞLANTI (28 Eylül). Üzerine gelince ya da klavyeyle
              odaklanınca dilimin üstünde bir bilgi kartı açılıyor: portre,
              ad, kuruluş, değer ve pay. Öteki dilimler soluklaşıyor. Büyük
              pay (≥ `INLINE_SHARE`) adını şeridin İÇİNDE taşıyor; küçükler
              yalnızca kartla okunuyor. Kartın hizası dilimin şeritteki
              yerinden: baştaki sola, sondaki sağa yaslanıyor ki panelin
              kenarından taşmasın. */}
          <div className={styles.capitalBar} role="group" aria-label={t.capitalAria}>
            {(() => {
              let before = 0;
              return segments.map((segment, index) => {
                const pct = share(segment.value);
                const middle = before + pct / 2;
                before += pct;
                const align = middle < EDGE_SHARE ? "start" : middle > 100 - EDGE_SHARE ? "end" : "center";
                return (
                  <Link
                    key={segment.investor.slug}
                    href={`/yatirimcilar/${segment.investor.slug}`}
                    prefetch={false}
                    className={styles.capitalSegment}
                    data-rank={Math.min(index, STRIP_NAMED)}
                    data-rest={index >= STRIP_NAMED || undefined}
                    data-align={align}
                    style={{ flexGrow: segment.value } as CSSProperties}
                    aria-label={`${segment.investor.name}, ${formatPercentPlain(pct, locale, 1)}`}
                  >
                    {pct >= INLINE_SHARE && (
                      <span className={styles.capitalInline} aria-hidden>
                        <Portrait investor={segment.investor} size="chip" />
                        {pct >= INLINE_NAME_SHARE && (
                          <>
                            <span className={styles.capitalInlineName}>{segment.investor.name}</span>
                            <b className="numeral">{formatPercentPlain(pct, locale, 0)}</b>
                          </>
                        )}
                      </span>
                    )}
                    <span className={styles.capitalTip} aria-hidden>
                      <Portrait investor={segment.investor} size="sm" />
                      <span className={styles.capitalTipId}>
                        <b>{segment.investor.name}</b>
                        <small>{investorFirm(segment.investor, locale)}</small>
                      </span>
                      <span className={styles.capitalTipFigures}>
                        <b className="numeral">{formatPercentPlain(pct, locale, 1)}</b>
                        <small className="numeral">{formatMoneyCompact(segment.value, locale)}</small>
                      </span>
                    </span>
                  </Link>
                );
              });
            })()}
            {/* TELEFONDA "DİĞER" TEK DİLİM (30 Eylül). 390'da dokuz küçük fon
                4–8 piksellik şeritlere düşüyordu (ölçüldü: 163, 26, 13, 13,
                11, 11, 8, 7, 4×6): okunmuyor, parmakla seçilmiyor, üstelik her
                biri başka bir yatırımcıya giden bir bağlantıydı. Telefonda
                onlar gizli, yerlerinde lejanttaki "Diğer N Yatırımcı" ile
                aynı toplamı taşıyan tek bir dilim duruyor; şerit ile lejant
                aynı altı parçayı anlatıyor. Geniş ekranda gizli. */}
            {rest.length > 0 && (
              <span
                className={styles.capitalRestSegment}
                data-rank={STRIP_NAMED}
                style={{ flexGrow: restValue } as CSSProperties}
                aria-hidden
              />
            )}
          </div>
          <ol className={styles.capitalLegend}>
            {/* HER SAYI TEK YERDE (28 Eylül). Adını ve payını şeridin içinde
                taşıyan dilim lejantta tekrar ediliyordu: "Warren Buffett %60"
                alt alta iki kez. Artık ad + pay ya şeritte ya lejantta; orta
                boy dilim şeritte yalnızca portreyle, adı ve payı lejantta.
                Telefonda şerit yalnızca ilk dilimin adını basıyor, o yüzden
                orada gizlenen lejant satırı yalnızca ilk sıradaki. */}
            {named.map((segment, index) => (
              <li
                key={segment.investor.slug}
                data-rank={index}
                data-inline={share(segment.value) >= INLINE_NAME_SHARE || undefined}
              >
                <Link href={`/yatirimcilar/${segment.investor.slug}`} prefetch={false} className={styles.capitalItem}>
                  <Portrait investor={segment.investor} size="chip" />
                  <span className={styles.capitalName}>{segment.investor.name}</span>
                  <b className="numeral">{formatPercentPlain(share(segment.value), locale, 0)}</b>
                </Link>
              </li>
            ))}
            {rest.length > 0 && (
              <li data-rank={STRIP_NAMED} className={styles.capitalItem}>
                <span className={styles.capitalRestDot} aria-hidden />
                <span className={styles.capitalName}>{t.capitalRest.replace("{count}", String(rest.length))}</span>
                <b className="numeral">{formatPercentPlain(share(restValue), locale, 0)}</b>
              </li>
            )}
          </ol>
        </figure>
      )}

    </div>
  );
}
