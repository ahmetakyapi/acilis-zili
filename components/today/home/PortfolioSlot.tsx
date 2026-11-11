import type { CSSProperties } from "react";
import { ArrowRight, CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { SentimentPulse } from "@/components/markets/SentimentPulse";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Money } from "@/components/portfolio/Money";
import { ClaudeBrief } from "@/components/portfolio/ClaudeBrief";
import { getAdmin } from "@/lib/admin";
import { PrivacyToggle } from "@/components/portfolio/PrivacyToggle";
import { ButtonLink, ChangePill, DataStamp, LogoTile, Panel, PanelLink } from "@/components/ui/primitives";
import { formatLira } from "@/lib/fx";
import type { Dictionary, Locale } from "@/lib/i18n";
import { panelModel } from "@/lib/portfolio-panel";
import { loadPortfolio, loadPortfolioSnapshot, type PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import { getPrivacy } from "@/lib/privacy-server";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain, formatPrice, plural } from "@/lib/utils";
import styles from "./PortfolioSlot.module.css";

/** Sunucunun bastığı en çok pozisyon satırı; TABANDAN sonrası `hidden` + `data-fill`. */
const MAX_ROWS = 8;
/** Pay ailesi — /portfoy'un halkasıyla AYNI tonlar (`--share-1..4`, `--share-rest`):
 *  okur MU'yu iki ekranda aynı renkte görür. Yön anlamı taşımaz. */
const SHARE_TOKENS = ["var(--share-1)", "var(--share-2)", "var(--share-3)", "var(--share-4)"] as const;
/** JS kapalıyken ve dar ekranda görünen satır sayısı: dağılım şeridinde
 *  ADIYLA renklenen dilim sayısı kadar (10 Kasım, sahibinin isteği: "4 tane
 *  hissemizi de yazalım"). Üçtü; şerit ve lejant dört isim sayarken liste
 *  dördüncüyü (MRVL %7) göstermiyordu. Beşinci ve sonrası lejantta "Diğer". */
const BASE_ROWS = SHARE_TOKENS.length;
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
  /* Site sahibinde kartın altında danışmanın günlük özeti (11 Kasım). */
  const owner = snapshot ? (await getAdmin())?.userId === userId : false;
  if (snapshot) return <PortfolioSummary snapshot={snapshot} privacy={privacy} locale={locale} t={t} owner={owner} />;
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
  owner = false,
}: {
  snapshot: PortfolioSnapshot;
  privacy: boolean;
  locale: Locale;
  t: Dictionary;
  owner?: boolean;
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

  /* K/Z karoları: dolar ve lira, yan yana. */
  const tiles = [
    { key: "usd", label: L.portfolioPnlUsd, amount: usd(totals.pnlUsd, true, 0), pct: pnlUsdPct, tone: totals.pnlUsd as number | null },
    { key: "tl", label: L.portfolioPnlTl, amount: formatLira(totals.pnlTl, locale, 0, true), pct: pnlTlPct, tone: totals.pnlTl },
  ];
  const dayTone = showDay ? directionOf(day.changeUsd) : null;

  /* YENİDEN TASARIM (10 Kasım, ikinci tur — sahibinin itirazı: "bu çok
     kötü… gerçek bir designer gibi olsun"). Önceki kart bir TABLO gibi
     okunuyordu: üç satırlık ölçü defteri, renk lejantı, sütun başlıklı
     pozisyon ızgarası; her satırın altında aynı hairline, gözün duracağı
     tek bir an yoktu. Yeni kurgu üç katman:
       1. Kahraman: toplam değer ve HEMEN ALTINDA bugünün değişimi (yön
          renginde hap + tutar + seans). Ayrı "Bugün" satırı kalktı; kartın
          ilk okuması "ne kadar, bugün ne yaptı".
       2. İki tonlu karo: Dolar K/Z | Lira K/Z (`surface-sunken`, tonla
          derinlik). Tutarlar karonun içinde alt alta olduğu için 350'lik
          rayda da yan yana sığıyor — eski yapışma hatası (iki tutar aynı
          satırda) bu kurguda doğmuyor; tutar kuruşsuz.
       3. Dağılım şeridi + pozisyon karoları. Renk lejantı kalktı: şeridin
          rengi satırın kendi pay çubuğunda tekrar ediyor, eşleme orada.
          Sütun başlıkları kalktı: satırın sağında değer ve bugünün hapı,
          altında pay şeridi ve toplam K/Z ("Toplam" etiketiyle).
     Ölçüm (geçici önizleme, 9 pozisyon, iki tema): kart 358 pikselde
     (390'lık telefon) 845, 350'lik rayda 852 piksel boy; yatay taşma 0,
     kutudan taşan öğe 0, kırpılan metin 0 (adın bilinçli `ellipsis`i
     hariç; 358'de dört adın dördü tam, rayda kırpılıyor). */
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

      {/* GENİŞ KAP (10 Kasım, kart sol kolona geçti — page.tsx): ≥ 680
          piksellik kapta iki sütun, özet (değer, K/Z, dağılım) solda,
          pozisyonlar sağda; günün taraması altta tam genişlik. Dar kapta
          (ray, telefon) iki sarmal da alt alta akar. */}
      <div className={styles.body}>
      <div className={styles.summaryCol}>
      {/* KAHRAMAN: toplam değer panelin en büyük puntosu; bugünün değişimi
          altında, yalnız seansı KANITLANAN kotasyondan (kanıt yoksa satır
          hiç basılmaz). Lira karşılığı ve pozisyon sayısı en altta künye. */}
      <div className={styles.hero}>
        <span className={styles.label}>{L.portfolioValue}</span>
        <strong className={cn("numeral", styles.heroValue)}>
          <Money>{usd(totals.valueUsd)}</Money>
        </strong>
        {showDay && dayTone && (
          <p className={styles.heroDay}>
            <span className="sr-only">{L.portfolioToday}: </span>
            <ChangePill changePct={day.changePct} locale={locale} />
            <b className={cn("numeral", directionText(dayTone))}>
              <Money>{usd(day.changeUsd, true)}</Money>
            </b>
            <span className={styles.heroBasis}>
              {L.portfolioToday} · {basisLabel}
            </span>
          </p>
        )}
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

      <dl className={styles.tiles}>
        {tiles.map((tile) => {
          const tone = tile.tone === null ? null : directionOf(tile.tone);
          return (
            <div key={tile.key} className={styles.tile} data-tone={tone ?? undefined}>
              <dt className={styles.tileLabel}>{tile.label}</dt>
              <dd className={cn("numeral", styles.tileAmount, tone ? directionText(tone) : "text-muted")}>
                <Money>{tile.amount}</Money>
              </dd>
              <dd className={cn("numeral", styles.tilePct, tone ? directionText(tone) : "text-muted")}>
                {formatPercent(tile.pct, locale)}
              </dd>
            </div>
          );
        })}
      </dl>

      {/* DAĞILIM: tek yüzde yüzlük KALIN şerit (12 piksel — panelin
          çizimi, `.claude/rules/arayuz.md` → "Büyüklük kalın yatay
          şeritle"). Renk pay ailesinden, yön değil; dilimler soldan dolar
          (`bar-fill`, kademe `--step`). Lejant yok: her dilimin rengi
          aşağıdaki satırın pay çubuğunda. "Diğer"in kimleri kapsadığı
          şeridin altında düz künye (dokunmatikte `title` açılmıyor). Tek
          sembollü portföyde şerit basılmaz. */}
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
          {rest && (
            <p className={styles.legendNote}>
              <span className={styles.swatch} style={{ background: REST_TOKEN }} aria-hidden />
              {L.portfolioOtherHint.replace("{symbols}", rest.members.join(", "))}
              <b className="numeral">{formatPercentPlain(rest.pct, locale, 0)}</b>
            </p>
          )}
        </div>
      )}

      </div>

      <div className={styles.positionsCol}>
      {/* POZİSYONLAR — karo satırlar, sütun başlığı yok. Satırın sağında
          değer ve bugünün hapı (`ChangePill`, yalnız kanıtlı seans; yoksa
          hap basılmaz), altında pay çubuğu (8 piksel, şeritteki rengiyle —
          `value-lane`/`value-bar`), payın yüzdesi ve toplam K/Z. Taban dört
          satır (`BASE_ROWS`), sekize kadar yedek `hidden` + `data-fill`
          (`FillColumn` kolon dibine göre açar).
          SATIR BİR BAĞLANTI VE BUNU SÖYLÜYOR (10 Kasım, sahibinin sözü: "bir
          tıkla detaya gitme işi güzel"). Satır hisse sayfasına gidiyordu ama
          tek ipucu sembolün hover rengiydi; telefonda hiç yoktu. Şimdi her
          satır tonlu bir karo (`surface-sunken` hover'da `primary-tint`),
          sağ kenarında iç bağlantı oku (hover'da 3 piksel), basışta 0,992
          çöküyor. */}
      <ul className={styles.rows}>
        {rows.map((holding, index) => {
          const sliceIndex = model.slices.findIndex((slice) => slice.symbol === holding.symbol);
          const color = sliceIndex >= 0 ? colorOf(sliceIndex) : REST_TOKEN;
          const name = names[holding.symbol]?.name;
          const totalTone = holding.pnlPct === null ? null : directionOf(holding.pnlPct);
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
                style={{ "--row-tone": color } as CSSProperties}
              >
                <LogoTile symbol={holding.symbol} logoUrl={names[holding.symbol]?.logoUrl} size="md" className={styles.logo} />
                <span className={styles.identity}>
                  <span className={cn("numeral", styles.symbol)}>{holding.symbol}</span>
                  {name && <span className={styles.name}>{name}</span>}
                </span>
                <span className={styles.figures}>
                  <span className={cn("numeral", styles.value)}>
                    <Money>{usd(holding.valueUsd, false, 0)}</Money>
                  </span>
                  {model.hasDay && holding.dayPct !== null && (
                    <>
                      <span className="sr-only">{L.portfolioToday}: </span>
                      <ChangePill changePct={holding.dayPct} locale={locale} size="sm" />
                    </>
                  )}
                </span>
                <CaretRight size={14} weight="bold" aria-hidden className={styles.caret} />
                <span className={styles.shareLine}>
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
                </span>
                <span className={styles.total}>
                  <span className={styles.totalLabel}>{L.portfolioColTotal}</span>
                  <b className={cn("numeral", totalTone ? directionText(totalTone) : "text-muted")}>
                    {formatPercent(holding.pnlPct, locale, 1)}
                  </b>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
      </div>

      {/* CLAUDE · BUGÜN (11 Kasım). Burada üç ayrı kutu vardı — Günün
          Taraması (10 Kasım), Bilanço Masası'nın satırı ve sahibe
          Danışmanın Bugün (11 Kasım) — ve 1440'ta ~1.000 piksel tutuyordu;
          sahibi: "çok daha görsel, çok daha kompakt, animasyonlu, daha
          okunabilir". Tek bölüm: başlık + özet + tema hapları, pozisyon
          başına logolu karo (beş seanslık şerit, görüş hapı, kâr al / zarar
          kes), bilanço çipleri, bağlantılar. Gerekçe ve ölçüm
          components/portfolio/ClaudeBrief.tsx. Logolar sunucudan
          (`names`), istek yok. */}
      <ClaudeBrief
        locale={locale}
        owner={owner}
        logos={Object.fromEntries(Object.entries(names).map(([symbol, meta]) => [symbol, meta?.logoUrl ?? null]))}
        labels={{ brief: t.claudeBrief, scan: t.portfolioScan, desk: t.earningsDesk, advisor: t.portfolioAdvisor }}
      />

      {/* KÜNYE SADELEŞTİ (10 Kasım, sahibinin sorusu: "kartın altındaki
          bilgilere gerek var mı"). Burada iki ikonlu cümle vardı: "bugün
          portföyü en çok X oynattı" ve yoğunlaşma ("MU tek başına %47…").
          İkisi de kartta zaten okunuyordu — ilki pozisyonların "Bugün"
          sütununda, ikincisi dağılım şeridinde ve satırların pay
          çubuğunda; yoğunlaşmanın ayrıntısı alttaki risk okumasında.
          Yalnız eksik fiyat uyarısı kaldı: o başka yerde yazmıyor. Hesap
          `lib/portfolio-panel.ts`te duruyor (testli; /portfoy/analiz da
          aynısını okuyor). */}
      {totals.partial && (
        <div className={styles.notes}>
          <p className={styles.note}>{L.portfolioPartial}</p>
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
