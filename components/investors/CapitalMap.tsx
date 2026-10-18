import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { RollingFigure } from "@/components/ui/RollingFigure";
import type { Dictionary } from "@/lib/i18n";
import type { FundCard, Overview } from "@/lib/investor-data";
import { INVESTORS, investorFirm, type Investor } from "@/lib/investors";
import { squarify } from "@/lib/theme-view";
import { formatEtDateMedium, formatMoneyCompact, formatPercentPlain, NO_VALUE } from "@/lib/utils";
import { formatWeight, quarterLabel, shortName } from "./format";
import { Portrait } from "./Portrait";
import styles from "./InvestorsIndex.module.css";

/**
 * "Takip Edilen Sermaye Kimde" — portreli sermaye haritası (18 Ekim).
 *
 * NEDEN ŞERİT DEĞİL. Sermaye tek bir yatay şeritti (InvestorRoster, 28
 * Eylül): Buffett'ın ~%60'lık dilimi şeridin çoğunu kaplıyor, kalan on iki
 * fon 4–26 piksellik çizgilere düşüyordu (390'da ölçülmüştü); şerit "biri
 * çok büyük" diyor, kimin ne kadar olduğunu söylemiyordu. Sahibi sayfayı
 * "zayıf ve kötü görünüyor" diye buldu. Harita aynı sayıyı ALANLA veriyor:
 * iki boyut, en büyük pay bile ekranı yalnız yarıdan biraz fazla kaplıyor
 * ve küçük fonlar okunur karolar oluyor. Karonun içinde kişinin kendisi
 * (portre, `PORTRAITS` kaydı), payı, değeri ve en büyük pozisyonu.
 *
 * UZUN KUYRUK TEK KARO. Payı `TAIL_SHARE` altında kalan fonlar ayrı ayrı
 * çizilse telefonda parmak ucundan küçük karolar olurdu (tek fon kalırsa
 * gruplanmıyor). Grup karosu bağlantı değil; üyeleri haritanın hemen
 * altında adıyla, değeriyle ve payıyla bağlantı olarak duruyor. Şeritteki
 * "Diğer" ile aynı anlam, yalnızca okunur.
 *
 * KÜME KAPAKTAKİ TOPLAMLA AYNI (`trackedValue`): en son çeyreği bildiren,
 * kapanmamış 13F fonları. Kongre üyesi ve kapanan fon dışarıda; künye bunu
 * söylüyor.
 *
 * TEK DOM, İKİ YERLEŞİM. Karo konumları iki oran için sunucuda hesaplanıyor
 * (`squarify`, tema haritasının saf hesabı) ve satır içi değişken olarak
 * iniyor; CSS genişliğe göre birini okuyor. İki ayrı liste basılsaydı her
 * yatırımcı iki bağlantı olurdu.
 *
 * Giriş: karolar pay sırasıyla `clip-path` ile açılıyor (ilk ekran: opaklık
 * yok, LCP beklemiyor); hareketi azaltan okuyucu son kareyi görüyor.
 */

/** Bu paydan (yüzde) küçük fonlar tek "Diğer" karosunda. */
const TAIL_SHARE = 2.5;
/**
 * Geniş ve dar yerleşimin oranı (en / boy). CSS'teki `aspect-ratio` ile aynı
 * sayılar (InvestorsIndex.module.css → `.map`). 2,2: 1100 piksellik panelde
 * 500 piksel; 0,92: 358 piksellik telefonda 389 piksel — ilk ekranı tek
 * başına doldurmuyor.
 */
const WIDE_ASPECT = 2.2;
const NARROW_ASPECT = 0.92;
/** Grup karosunda en çok kaç portre; fazlası adıyla alttaki listede. */
const GROUP_FACES = 6;

type Tile = {
  key: string;
  investor: Investor | null;
  card: FundCard | null;
  value: number;
  members: { investor: Investor; value: number }[];
};

export function CapitalMap({
  overview,
  locale,
  t,
}: {
  overview: Overview;
  locale: string;
  t: Dictionary["investors"];
}) {
  const period = overview.movers.period;
  const cardOf = new Map<string, FundCard>();
  for (const card of overview.cards) {
    if (card.kind === "13f" && card.period === period) cardOf.set(card.slug, card);
  }
  const funds = INVESTORS.filter((investor) => investor.kind === "13f" && investor.status !== "closed")
    .map((investor) => ({ investor, card: cardOf.get(investor.slug) ?? null, value: cardOf.get(investor.slug)?.longValue ?? 0 }))
    .filter((fund) => fund.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = funds.reduce((sum, fund) => sum + fund.value, 0);
  if (total <= 0) return null;
  const share = (value: number) => (value / total) * 100;

  let named = funds.filter((fund) => share(fund.value) >= TAIL_SHARE);
  let tail = funds.filter((fund) => share(fund.value) < TAIL_SHARE);
  if (tail.length < 2) {
    named = funds;
    tail = [];
  }
  const tiles: Tile[] = named.map((fund) => ({ key: fund.investor.slug, investor: fund.investor, card: fund.card, value: fund.value, members: [] }));
  const tailValue = tail.reduce((sum, fund) => sum + fund.value, 0);
  if (tail.length > 0) {
    tiles.push({ key: "rest", investor: null, card: null, value: tailValue, members: tail.map(({ investor, value }) => ({ investor, value })) });
  }
  const weights = tiles.map((tile) => tile.value);
  const wide = squarify(weights, WIDE_ASPECT);
  const narrow = squarify(weights, NARROW_ASPECT);
  const rectOf = (rects: typeof wide, index: number) => rects.find((rect) => rect.index === index);
  const shareText = (value: number) => formatPercentPlain(share(value), locale, share(value) >= 10 ? 0 : 1);

  return (
    <Panel>
      <PanelHeader
        title={t.capitalTitle}
        meta={period ? t.capitalMeta.replace("{period}", quarterLabel(period, t)) : undefined}
      />
      <div className={styles.mapWrap}>
        <ol className={styles.map} aria-label={t.capitalAria}>
          {tiles.map((tile, index) => {
            const w = rectOf(wide, index);
            const n = rectOf(narrow, index);
            if (!w || !n) return null;
            const place = {
              "--x": w.x, "--y": w.y, "--w": w.w, "--h": w.h,
              "--nx": n.x, "--ny": n.y, "--nw": n.w, "--nh": n.h,
              "--i": index,
            } as CSSProperties;
            const pct = shareText(tile.value);
            if (!tile.investor) {
              return (
                <li key={tile.key} className={styles.tile} data-rest style={place}>
                  <span className={styles.tileBody}>
                    <span className={styles.restFaces} aria-hidden>
                      {tile.members.slice(0, GROUP_FACES).map((member) => (
                        <Portrait key={member.investor.slug} investor={member.investor} size="chip" />
                      ))}
                    </span>
                    <span className={styles.tileText}>
                      <b className={`${styles.tileShare} numeral`}>{pct}</b>
                      <span className={styles.tileName}>{t.capitalRest.replace("{count}", String(tile.members.length))}</span>
                      <small className={`${styles.tileValue} numeral`}>{formatMoneyCompact(tile.value, locale)}</small>
                    </span>
                  </span>
                </li>
              );
            }
            const top = tile.card?.top[0];
            return (
              <li key={tile.key} className={styles.tile} data-rank={Math.min(index, 4)} style={place}>
                <Link
                  href={`/yatirimcilar/${tile.investor.slug}`}
                  prefetch={false}
                  className={styles.tileBody}
                  aria-label={`${tile.investor.name}, ${pct}, ${formatMoneyCompact(tile.value, locale)}`}
                >
                  <span className={styles.tilePortrait} aria-hidden>
                    <Portrait investor={tile.investor} size="tile" priority={index === 0} />
                  </span>
                  <span className={styles.tileText} aria-hidden>
                    <b className={`${styles.tileShare} numeral`}>{pct}</b>
                    <span className={styles.tileName}>
                      <span className={styles.tileFull}>{tile.investor.name}</span>
                      <span className={styles.tileShort}>{shortName(tile.investor.name)}</span>
                    </span>
                    <small className={`${styles.tileValue} numeral`}>
                      {formatMoneyCompact(tile.value, locale)}
                      <span className={styles.tileFirm}> · {investorFirm(tile.investor, locale)}</span>
                    </small>
                    {top?.ticker && (
                      <small className={`${styles.tileTop} numeral`}>
                        {t.capitalTop.replace("{ticker}", top.ticker).replace("{weight}", formatWeight(top.weight, locale))}
                      </small>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      {tail.length > 0 && (
        <div className={styles.tail}>
          <h3 className={styles.tailTitle}>{t.capitalRest.replace("{count}", String(tail.length))}</h3>
          <ol className={styles.tailList} data-motion-stagger>
            {tail.map((fund) => (
              <li key={fund.investor.slug} className="min-w-0">
                <Link href={`/yatirimcilar/${fund.investor.slug}`} prefetch={false} className={styles.tailItem}>
                  <Portrait investor={fund.investor} size="chip" />
                  <span className={styles.tailName}>{fund.investor.name}</span>
                  <span className={`${styles.tailFigures} numeral`}>
                    <b>{shareText(fund.value)}</b>
                    <small>{formatMoneyCompact(fund.value, locale)}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ÖLÇÜ IZGARASI haritanın altında (CLAUDE.md ekran sırası): dört
          sayı aynı taban çizgisinde biter, etiket sayının altında. */}
      <dl className={styles.figures}>
        <div data-lead>
          <dt>{t.trackedValue}</dt>
          <dd className="numeral">
            <RollingFigure value={formatMoneyCompact(overview.trackedValue, locale)} />
          </dd>
        </div>
        <div>
          <dt>{t.capitalFunds}</dt>
          <dd className="numeral">{funds.length}</dd>
        </div>
        <div>
          <dt>{t.periodLabel}</dt>
          <dd className="numeral">{period ? quarterLabel(period, t) : NO_VALUE}</dd>
        </div>
        <div>
          <dt>{t.lastFiled}</dt>
          <dd className="numeral">{overview.latestFiled ? formatEtDateMedium(overview.latestFiled, locale) : NO_VALUE}</dd>
        </div>
      </dl>
      <p className={styles.note}>
        {t.capitalNote.replace("{share}", formatPercentPlain(TAIL_SHARE, locale, 1))}
        {period && <> {t.lagNote.replace("{date}", formatEtDateMedium(period, locale))}</>}
      </p>
    </Panel>
  );
}
