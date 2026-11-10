import type { CSSProperties } from "react";
import { ArrowRight, Lightning, ChartPieSlice, Plus } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { SentimentPulse } from "@/components/markets/SentimentPulse";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Money } from "@/components/portfolio/Money";
import { PrivacyToggle } from "@/components/portfolio/PrivacyToggle";
import { ButtonLink, DataStamp, LogoTile, Panel, PanelLink } from "@/components/ui/primitives";
import { formatLira } from "@/lib/fx";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatMeasure } from "@/lib/portfolio-risk";
import { panelModel } from "@/lib/portfolio-panel";
import { loadPortfolio, loadPortfolioSnapshot, type PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import { getPrivacy } from "@/lib/privacy-server";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain, formatPrice, plural } from "@/lib/utils";
import styles from "./PortfolioSlot.module.css";

/** Sunucunun bastığı en çok pozisyon satırı; TABANDAN sonrası `hidden` + `data-fill`. */
const MAX_ROWS = 8;
/** JS kapalıyken ve dar ekranda görünen satır sayısı. */
const BASE_ROWS = 3;
/** Pay ailesi — /portfoy'un halkasıyla AYNI tonlar (`--share-1..4`, `--share-rest`):
 *  okur MU'yu iki ekranda aynı renkte görür. Yön anlamı taşımaz. */
const SHARE_TOKENS = ["var(--share-1)", "var(--share-2)", "var(--share-3)", "var(--share-4)"] as const;
const REST_TOKEN = "var(--share-rest)";

/**
 * Ana sayfanın portföy yuvası (28 Eylül; yeniden tasarım 10 Kasım gecesi).
 *
 * PORTFÖYÜ OLANA PORTFÖYÜ, MİSAFİRE NABIZ. Sahibinin isteği iki şeyi birden
 * çözüyordu: portföy tutan okuyucu ana sayfada kendi sayısını görsün, ve
 * sağ kolon sol kolondan uzun kalmasın (ölçüldü, misafir: 1024'te 45,
 * 1280'de 100, 1440'ta 117 piksel; oturumlu okuyucuda favoriler paneli
 * uzadıkça fark büyüyor). Misafire aynı yerde kompakt Piyasa Nabzı basılıyor.
 * 10 KASIM GECESİ: giriş yapmış ama pozisyonu olmayan okura nabız yerine
 * DAVET KARTI (sahibinin brifi: "pozisyon ekle"). Nabız ona da gidiyordu ve
 * panel portföyün bu sayfada yaşadığını hiç söylemiyordu. Tablo okunamazsa
 * (migration yok, veritabanı düştü) eskisi gibi nabız.
 *
 * Sayılar /portfoy ile AYNI zincirden (`loadPortfolioSnapshot`); panelin
 * kendi hesabı `lib/portfolio-panel.ts`te (sembol başına satır, dağılım,
 * bugünü en çok taşıyan, yoğunlaşma).
 */
export async function PortfolioSlot({ locale, t }: { locale: Locale; t: Dictionary }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return <SentimentPulse locale={locale} t={t} variant="compact" />;
  const [snapshot, privacy] = await Promise.all([loadPortfolioSnapshot(userId), getPrivacy()]);
  if (snapshot) return <PortfolioSummary snapshot={snapshot} privacy={privacy} locale={locale} t={t} />;
  /* `loadPortfolio` istek içinde önbellekli: ikinci soru ücretsiz. */
  const data = await loadPortfolio(userId);
  if (!data.ok) return <SentimentPulse locale={locale} t={t} variant="compact" />;
  return <PortfolioInvite t={t} />;
}

/**
 * Pozisyonu olmayan okura davet. Panel içi tek satırlık boş durum: sahne
 * yok (`.claude/rules/arayuz.md` → Mürekkep Sahneleri), ama boş bir kutu da
 * değil — portföy dolunca burada ne göreceği tek cümlede, eylem tek dolu
 * buton (`/portfoy?ekle=` ekleme penceresini açık getirir).
 */
function PortfolioInvite({ t }: { t: Dictionary }) {
  const L = t.today;
  return (
    <Panel className={styles.panel}>
      <div className={styles.head}>
        <h2 className="display-ink display-ink-tight w-fit text-lead font-bold tracking-[-0.015em]">{L.portfolioSummary}</h2>
      </div>
      <div className={styles.invite}>
        {/* Boş hâlin çizimi: dağılım şeridinin kulvarı, dolacak yer. */}
        <span className={styles.inviteLane} aria-hidden />
        <p className={styles.inviteTitle}>{L.portfolioEmptyTitle}</p>
        <p className={styles.inviteBody}>{L.portfolioEmptyBody}</p>
        <ButtonLink href="/portfoy?ekle=" variant="primary" className={styles.inviteAction}>
          <Plus size={16} weight="bold" aria-hidden />
          {L.portfolioEmptyAction}
        </ButtonLink>
      </div>
    </Panel>
  );
}

function PortfolioSummary({
  snapshot,
  privacy,
  locale,
  t,
}: {
  snapshot: PortfolioSnapshot;
  privacy: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const { views, totals, names, quotes, days, day, dayBasis } = snapshot;
  const L = t.today;
  const usd = (value: number, signed = false, digits = 2) =>
    `${signed && value > 0 ? "+" : ""}${formatPrice(value, locale, { currency: true, digits })}`;
  const model = panelModel(views, days);
  const colorOf = (index: number) => (index < SHARE_TOKENS.length ? SHARE_TOKENS[index] : REST_TOKEN);

  const pnlUsdPct = totals.costUsd > 0 ? (totals.pnlUsd / totals.costUsd) * 100 : null;
  const pnlTlPct = totals.pnlTl !== null && totals.costTl ? (totals.pnlTl / totals.costTl) * 100 : null;
  const basisLabel =
    dayBasis === "session"
      ? t.companyCard.session
      : dayBasis === "pre-market"
        ? t.companyCard.preMarket
        : dayBasis === "after-hours"
          ? t.companyCard.afterHours
          : dayBasis === "sessionClose"
            ? t.companyCard.sessionClose
            : null;
  const showDay = basisLabel !== null && day.covered > 0;
  const rest = model.slices.find((slice) => slice.symbol === null);
  const rows = model.holdings.slice(0, MAX_ROWS);
  const count = views.length;

  /* Ölçü defteri: üç satır, aynı üç sütun (etiket · tutar · yüzde). */
  const ledger = [
    ...(showDay
      ? [
          {
            key: "day",
            label: L.portfolioToday,
            basis: basisLabel as string | null,
            amount: usd(day.changeUsd, true),
            pct: day.changePct,
            tone: day.changeUsd as number | null,
          },
        ]
      : []),
    { key: "usd", label: L.portfolioPnlUsd, basis: null as string | null, amount: usd(totals.pnlUsd, true), pct: pnlUsdPct, tone: totals.pnlUsd as number | null },
    {
      key: "tl",
      label: L.portfolioPnlTl,
      basis: null,
      amount: formatLira(totals.pnlTl, locale, 0, true),
      pct: pnlTlPct,
      tone: totals.pnlTl,
    },
  ];

  return (
    <Panel className={styles.panel}>
      {/* BAŞLIK: ad solda; sağda gizleme anahtarı ve "Tümünü Gör". Anahtar
          ikon (görünür 36, hedef 44): dar rayda etiketli düğme başlığı iki
          satıra bölüyordu. */}
      <div className={styles.head}>
        <h2 className="display-ink display-ink-tight w-fit text-lead font-bold tracking-[-0.015em]">{L.portfolioSummary}</h2>
        <div className={styles.headActions}>
          <PrivacyToggle
            initial={privacy}
            compact
            labels={{ hide: t.lira.portfolio.hideAmounts, show: t.lira.portfolio.showAmounts }}
          />
          <PanelLink href="/portfoy">{t.common.showAll}</PanelLink>
        </div>
      </div>

      {/* KAHRAMAN: toplam değer panelin en büyük puntosu (en anlamlı sayı);
          lira karşılığı ve pozisyon sayısı altında künye. */}
      <div className={styles.hero}>
        <span className={styles.label}>{L.portfolioValue}</span>
        <strong className={cn("numeral", styles.heroValue)}>
          <Money>{usd(totals.valueUsd)}</Money>
        </strong>
        <span className={cn("numeral", styles.heroSub)}>
          {totals.valueTl !== null && (
            <>
              <Money>{formatLira(totals.valueTl, locale, 0)}</Money>
              <span aria-hidden> · </span>
            </>
          )}
          {plural(count, L.portfolioPositionsOne, L.portfolioPositions).replace("{n}", String(count))}
        </span>
      </div>

      {/* ÖLÇÜ DEFTERİ (10 Kasım gecesi). Dolar K/Z ile Lira K/Z yan yana
          iki sütundu ve 350 piksellik rayda sığmıyordu: iki tutar
          ARALIKSIZ yapışıyordu ("−19.396,00 $− 826.105 ₺", sahibinin ekran
          görüntüsü). Şimdi alt alta satırlar, tek ızgarada üç sütun
          (`subgrid`): etiket solda, tutar ve yüzde sağda; tutarlar ve
          yüzdeler bütün satırlarda aynı hatta biter. Bugünkü değişim en
          üstte ve yalnız seansı KANITLANAN kotasyondan (seansın adı etiketin
          altında: "Bugün / Seans İçi"); kanıt yoksa satır hiç basılmaz. Lira
          K/Z dolar K/Z'nin çevirisi değil: maliyet alış gününün kuruyla, kur
          etkisini de taşır.
          Ölçüm (gerçek sayfa + sahte sağlayıcı, 9 pozisyon; 360/390/1024/
          1280/1440, iki tema): tutar ile yüzde arası en az 16 piksel (önce:
          iki tutar arası ≤ 0, yapışık), yatay taşma 0, kutudan taşan öğe 0,
          kırpılan metin 0 (adın bilinçli `ellipsis`i hariç). */}
      <dl className={styles.ledger}>
        {ledger.map((line) => {
          const tone = line.tone === null ? null : directionOf(line.tone);
          return (
            <div key={line.key} className={styles.ledgerRow}>
              <dt className={styles.ledgerLabel}>
                {line.label}
                {line.basis && <span className={styles.ledgerBasis}>{line.basis}</span>}
              </dt>
              <dd className={cn("numeral", styles.ledgerAmount, tone ? directionText(tone) : "text-muted")}>
                <Money>{line.amount}</Money>
              </dd>
              <dd className={cn("numeral", styles.ledgerPct, tone ? directionText(tone) : "text-muted")}>
                {formatPercent(line.pct, locale)}
              </dd>
            </div>
          );
        })}
      </dl>

      {/* DAĞILIM: tek yüzde yüzlük KALIN şerit (12 piksel — panelin
          kahraman çizimi, `.claude/rules/arayuz.md` → "Büyüklük kalın yatay
          şeritle"). Renk pay ailesinden, yön değil; dilimler soldan dolar
          (`bar-fill`, kademe `--step`). Lejant sarar, kaymaz. "Diğer"in
          kimleri kapsadığı lejantın altında düz künye: dokunmatik ekranda
          `title` ipucu açılmıyor. Tek sembollü portföyde şerit basılmaz
          (%100'lük tek dilim bir şey söylemiyor; satırdaki pay yeter). */}
      {model.slices.length > 1 && (
        <div className={styles.weights}>
          <span className={styles.label}>{L.portfolioWeights}</span>
          <span className={styles.stack} data-draw role="img" aria-label={model.slices.map((slice) => L.portfolioAria.replace("{symbol}", slice.symbol ?? L.portfolioOther).replace("{pct}", String(Math.round(slice.pct)))).join("; ")}>
            {model.slices.map((slice, index) => (
              <i
                key={slice.key}
                className={cn("bar-fill", styles.slice)}
                style={{ flexGrow: slice.pct, background: slice.symbol ? colorOf(index) : REST_TOKEN, "--i": index } as CSSProperties}
              />
            ))}
          </span>
          <ul className={styles.legend}>
            {model.slices.map((slice, index) => (
              <li key={slice.key}>
                <span className={styles.swatch} style={{ background: slice.symbol ? colorOf(index) : REST_TOKEN }} aria-hidden />
                <span className={styles.legendName}>{slice.symbol ?? L.portfolioOther}</span>
                <b className="numeral">{formatPercentPlain(slice.pct, locale, 0)}</b>
              </li>
            ))}
          </ul>
          {rest && <p className={styles.legendNote}>{L.portfolioOtherHint.replace("{symbols}", rest.members.join(", "))}</p>}
        </div>
      )}

      {/* POZİSYONLAR — tek ızgara, `subgrid`: kimlik · değer · bugün · toplam.
          Sütun başlığı bir kez ("Bugün" ve "Toplam" yüzdelerinin hangisi
          olduğu satırda tekrar yazılmıyor). Bugünkü değişimi hiçbir satırda
          kanıtlanamayan pakette sütun HİÇ basılmıyor ("–" duvarı yerine).
          Her satırın altında payı: 8 piksellik dolu çubuk, dağılım
          şeridindeki rengiyle (`value-lane`/`value-bar`). Taban üç satır,
          sekize kadar yedek `hidden` + `data-fill` (`FillColumn` kolon
          dibine göre açar). */}
      <div className={styles.positions} data-day={model.hasDay || undefined}>
        <div className={styles.colHead} aria-hidden>
          <span className={styles.colIdentity}>{L.portfolioColPosition}</span>
          <span>{L.portfolioColValue}</span>
          {model.hasDay && <span>{L.portfolioColDay}</span>}
          <span>{L.portfolioColTotal}</span>
        </div>
        <ul className={styles.rows}>
          {rows.map((holding, index) => {
            const sliceIndex = model.slices.findIndex((slice) => slice.symbol === holding.symbol);
            const color = sliceIndex >= 0 ? colorOf(sliceIndex) : REST_TOKEN;
            const name = names[holding.symbol]?.name;
            return (
              <li
                key={holding.symbol}
                className={styles.rowItem}
                hidden={index >= BASE_ROWS || undefined}
                data-fill={index >= BASE_ROWS || undefined}
              >
                <Link
                  href={`/hisse/${holding.symbol}`}
                  prefetch={false}
                  className={styles.row}
                >
                  <LogoTile symbol={holding.symbol} logoUrl={names[holding.symbol]?.logoUrl} size="md" className={styles.logo} />
                  <span className={styles.identity}>
                    <span className={cn("numeral", styles.symbol)}>{holding.symbol}</span>
                    {name && <span className={styles.name}>{name}</span>}
                  </span>
                  <span className={cn("numeral", styles.value)}>
                    <Money>{usd(holding.valueUsd, false, 0)}</Money>
                  </span>
                  {model.hasDay && (
                    <span
                      className={cn("numeral", styles.pct, holding.dayPct === null ? "text-muted" : directionText(directionOf(holding.dayPct)))}
                    >
                      {formatPercent(holding.dayPct, locale, 1)}
                    </span>
                  )}
                  <span
                    className={cn("numeral", styles.pct, styles.pctTotal, holding.pnlPct === null ? "text-muted" : directionText(directionOf(holding.pnlPct)))}
                  >
                    {formatPercent(holding.pnlPct, locale, 1)}
                  </span>
                  <span className={cn("value-lane", styles.share)} data-draw role="img" aria-label={L.portfolioRowAria.replace("{symbol}", holding.symbol).replace("{pct}", formatPercentPlain(holding.weight, locale, 1))}>
                    <i
                      className="value-bar bar-fill"
                      data-end="end"
                      style={{ left: 0, width: `${Math.max(holding.weight, 1.5)}%`, "--bar-tone": color, animationDelay: `calc(${Math.min(index, 9)} * var(--step, 40ms))` } as CSSProperties}
                    />
                  </span>
                  <span className={cn("numeral", styles.shareText)} aria-hidden>
                    {formatPercentPlain(holding.weight, locale, holding.weight >= 10 ? 0 : 1)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* KÜNYE: veri katmanında ZATEN olan iki okuma, tek satırlık ikonlu
          cümle (`.claude/rules/arayuz.md` → ekran düzeni 6; uyarı hap yığını
          değil ikonlu satır). Bugünü en çok kim taşıdı (yalnız kanıtlı
          seans) ve yoğunlaşma (/portfoy/analiz'in aynı hesabı,
          `concentrationOf`); yoğunlaşma cümlesi risk okumasına bağlanır. */}
      {(model.mover || model.concentration || totals.partial) && (
        <div className={styles.notes}>
          {model.mover && (
            <p className={styles.note}>
              <Lightning size={14} weight="duotone" aria-hidden className={styles.noteIcon} />
              <span>
                {L.portfolioMover.replace("{symbol}", model.mover.symbol)}
                {": "}
                <b className={cn("numeral", directionText(directionOf(model.mover.dayUsd)))}>
                  <Money>{usd(model.mover.dayUsd, true)}</Money>
                  {model.mover.dayPct !== null && <> · {formatPercent(model.mover.dayPct, locale, 1)}</>}
                </b>
              </span>
            </p>
          )}
          {model.concentration && (
            <p className={styles.note}>
              <ChartPieSlice size={14} weight="duotone" aria-hidden className={styles.noteIcon} />
              <span>
                {L.portfolioConcentration
                  .replace("{symbol}", model.concentration.symbol)
                  .replace("{pct}", formatPercentPlain(model.concentration.weight, locale, 0))
                  .replace("{count}", String(model.holdings.length))
                  .replace("{effective}", formatMeasure(model.concentration.effective, locale, 1))}
              </span>
            </p>
          )}
          {totals.partial && <p className={styles.note}>{L.portfolioPartial}</p>}
        </div>
      )}

      <div className={styles.foot}>
        {quotes ? (
          <DataStamp labels={t.data} source={quotes.source} at={quotes.fetchedAt} stale={quotes.stale} locale={locale} />
        ) : (
          <span />
        )}
        <Link href="/portfoy/analiz" prefetch={false} className={styles.footLink}>
          {L.portfolioRiskLink}
          <ArrowRight size={13} weight="bold" aria-hidden />
        </Link>
      </div>
    </Panel>
  );
}
