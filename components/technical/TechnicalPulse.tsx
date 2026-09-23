import { ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import visuals from "@/components/motion/DirectoryVisuals.module.css";
import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictTextClass, type VerdictKey } from "@/lib/analysis";
import { companySector } from "@/lib/company-sector";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { MarketStatus } from "@/lib/market-hours";
import type { ProviderResult, Quote } from "@/lib/providers/types";
import { editionTime, livePriceLabel, slotLabel, stanceChangeLabel, technicalHref } from "@/lib/technical";
import type { TechnicalBoardEntry } from "@/lib/technical-data";
import { cn, formatEtDateCompact } from "@/lib/utils";
import { CompanyBalloon } from "./CompanyBalloon";
import { changeToneClass } from "./TechnicalCard";
import { PulseCompanyLink } from "./PulseCompanyLink";
import styles from "./Technical.module.css";

const VERDICTS: readonly VerdictKey[] = ["buy", "hold", "sell"];

/** Görüş süzgecinin radyo kimliği — başlıktaki satırlar `for` ile ona bağlanır. */
export function stanceFilterId(verdict: VerdictKey | "all"): string {
  return `technical-filter-${verdict}`;
}

/**
 * Başlığın görseli — takip listesinin görüşe göre dağılımı.
 *
 * Sayılar tek yerde: oran çubuğunda yazı yok, sayı satırın başında bir kez.
 * Eski yayın şeridinde "AL 5 · TUT 5 · SAT 2" hapları vardı ve hangi hissenin
 * hangi grupta olduğunu söylemiyordu; burada her satır o görüşteki hisselerin
 * logolarını taşıyor ve logo hissenin analizine götürüyor.
 *
 * Satırın görüş etiketi aşağıdaki süzgecin radyosuna bağlı bir `<label>`:
 * basınca liste o görüşe süzülüyor, JavaScript gerekmiyor.
 */
export function TechnicalPulse({
  board,
  pending = [],
  meta,
  t,
  locale,
  quotes,
  variant = "directory",
}: {
  board: readonly TechnicalBoardEntry[];
  /**
   * Takip listesinde olup henüz yayını olmayan semboller.
   *
   * DAĞILIM TAKİP LİSTESİNİN TAMAMINI ANLATIR. Sayı bir süre yalnızca
   * yayımlanmış satırları sayıyordu ve listeye yeni eklenen sembol ilk
   * yayına kadar ekranda hiç görünmüyordu: on beş hisse takip edilirken
   * başlık "12 Hisse" diyordu ve eksik üçü hiçbir yerde yazmıyordu
   * (ölçüldü, 19 Eylül canlı). Bekleyenler kendi satırında duruyor;
   * böylece dört satırın toplamı listenin kendisi kadar.
   */
  pending?: readonly string[];
  meta: Record<string, SymbolMeta>;
  t: Dictionary;
  locale: Locale;
  /**
   * Balonun canlı fiyatı — SAYFANIN KENDİ kotasyon paketi. Yeni bir tur
   * açılmıyor: /teknik kartların paketini, ana sayfa hareket panelinin
   * paketini veriyor. Pakette olmayan sembol (ya da paket düşmüşse hepsi)
   * fotoğraftaki fiyata ve "Analiz Anında" etiketine düşüyor. Etiket
   * kartla aynı fonksiyondan (`livePriceLabel`): paket bayatsa ya da
   * sembolün işlemi seans gününe ait değilse "Şu An" asla yazılmıyor.
   */
  quotes?: { pack: ProviderResult<Record<string, Quote>>; status: MarketStatus };
  /** `directory`: liste sayfasının başlık görseli — kendi başlığı var ve
      görüş etiketi süzgecin radyosuna bağlı. `panel`: ana sayfa paneli —
      başlığı panelin kendisi taşıyor, süzgeç yok, etiket düz metin. */
  variant?: "directory" | "panel";
}) {
  const filterable = variant === "directory";
  const groups = VERDICTS.map((verdict) => ({
    verdict,
    rows: board.filter(({ row }) => verdictOf(row.stance) === verdict),
  }));
  /* Bekleyenler bir GÖRÜŞ değil, bir eksik: kendi satırında ve nötr
     tonda duruyor, oran çubuğunda da renksiz bir dilim olarak. */
  const total = board.length + pending.length;
  /* ÇİP YALNIZCA YENİ GÖRÜŞÜ YAZIYOR. Etiket "Tuta Döndü" / "Ala Döndü"
     idi ve şeridin kendi başlığı zaten "Görüşü Değişenler": "döndü" sözcüğü
     aynı şeyi ikinci kez söylüyor, üstelik çipi iki kat uzatıyordu. Sembolün
     yanında tek başına AL/TUT/SAT hem daha kısa hem panonun geri kalanıyla
     aynı dil — dağılım satırları da aynı üç kelimeyi kullanıyor. Değiştiği
     bilgisi şeridin başlığından, yeni görüş çipten okunuyor.

     `stanceChangeLabel` HÂLÂ ÇAĞRILIYOR: bir sembolün burada görünüp
     görünmeyeceğine o karar veriyor (önceki görüş yoksa ya da aynıysa null). */
  const changes = board.flatMap(({ row, previousStance }) => {
    const verdict = verdictOf(row.stance);
    const changed = stanceChangeLabel(verdict, previousStance, t);
    return changed
      ? [{ symbol: row.symbol, verdict, label: verdictLabel(verdict, t), full: changed }]
      : [];
  });

  /* Balonun ortak kurgusu — yayımlanmış ve bekleyen logolar aynı balonu
     açıyor, yalnızca hap, yedek fiyat ve alt künye ayrı. Canlı fiyat
     varsa o (etiketi `livePriceLabel`dan: "Şu An" / "Son Fiyat"), yoksa
     fotoğraftaki fiyat "Analiz Anında" etiketiyle. */
  const balloon = (
    symbol: string,
    verdict: VerdictKey | "pending",
    fallback: { price: number | null; changePct: number | null; foot: string },
  ) => {
    const company = meta[symbol];
    const pack = quotes?.pack;
    const quote = pack?.ok ? pack.data[symbol] : undefined;
    const liveLabel = quotes && quote ? livePriceLabel(quote, quotes.pack, quotes.status, t) : null;
    return (
      <CompanyBalloon
        symbol={symbol}
        name={company?.name ?? null}
        logoUrl={company?.logoUrl ?? null}
        verdict={verdict}
        sector={companySector(symbol, company?.industry, locale)}
        marketCap={company?.marketCap ?? null}
        currency={company?.currency ?? null}
        price={quote && liveLabel ? quote.price : fallback.price}
        changePct={quote && liveLabel ? quote.changePct : fallback.changePct}
        priceLabel={liveLabel ?? t.technical.atAnalysis}
        foot={fallback.foot}
        locale={locale}
        t={t}
      />
    );
  };

  return (
    <section
      className={styles.pulse}
      data-variant={variant}
      aria-labelledby={filterable ? "technical-distribution" : undefined}
      aria-label={filterable ? undefined : t.technical.distribution}
    >
      {filterable && (
        <div className={visuals.visualHeader}>
          <h2 id="technical-distribution">{t.technical.distribution}</h2>
          <span className="flex items-center gap-2 text-tiny font-semibold text-muted">
            {t.technical.stockCount.replace("{n}", String(total))}
            {/* Telefonda logo satırları gizli (CSS, `.pulseRows`); bekleyen
                sayısı o satırda yazıyordu ve kaybolmasın diye buraya iniyor.
                Masaüstünde satır duruyor, künye tekrar etmiyor. */}
            {pending.length > 0 && (
              <span className={styles.pulsePendingCount}>
                · {t.technical.pendingCount.replace("{n}", String(pending.length))}
              </span>
            )}
            <ChartLineUp size={17} aria-hidden />
          </span>
        </div>
      )}

      {/* HAREKET VERİYİ ÇİZİYOR, SÜSLEMİYOR. Dilimler soldan kendi oranlarına
          uzuyor, satırlar ve logolar sırayla iniyor; ortak hareket sisteminin
          (`MotionExperience`) kancaları, azaltılmış harekette hepsi yerinde. */}
      {filterable && total > 0 && <div className={styles.pulseDial} aria-hidden="true">
        <svg viewBox="0 0 160 160" fill="none">
          <circle cx="80" cy="80" r="53" className={styles.pulseDialGuide} />
          {[...groups.map((group) => ({ verdict: group.verdict, count: group.rows.length })), { verdict: "pending", count: pending.length }]
            .flatMap((group) => Array.from({ length: group.count }, () => group.verdict))
            .map((verdict, index) => {
              const angle = (index / total * 360 - 90) * Math.PI / 180;
              const end = ((index + .72) / total * 360 - 90) * Math.PI / 180;
              return <path key={index} data-verdict={verdict} data-motion-draw="arc" pathLength="1"
                d={`M${80 + 66 * Math.cos(angle)},${80 + 66 * Math.sin(angle)} A66,66 0 0 1 ${80 + 66 * Math.cos(end)},${80 + 66 * Math.sin(end)}`} />;
            })}
          <circle cx="80" cy="80" r="42" className={styles.pulseDialCore} />
        </svg>
        <span><strong>{total}</strong><small>{t.technical.trackedLabel}</small></span>
      </div>}
      <div className={styles.pulseBar} aria-hidden data-motion-stagger>
        {groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <span key={group.verdict} data-verdict={group.verdict} data-motion-draw="line" style={{ flexGrow: group.rows.length }} />
          ))}
        {pending.length > 0 && (
          <span data-verdict="pending" data-motion-draw="line" style={{ flexGrow: pending.length }} />
        )}
      </div>

      <div className={styles.pulseRows} data-motion-stagger>
        {groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <div key={group.verdict} className={styles.pulseRow}>
              {filterable ? (
                <label htmlFor={stanceFilterId(group.verdict)} className={cn(styles.pulseStance, verdictTextClass(group.verdict))}>
                  {verdictLabel(group.verdict, t)}
                  <b>{group.rows.length}</b>
                </label>
              ) : (
                <span className={cn(styles.pulseStance, styles.pulseStanceStatic, verdictTextClass(group.verdict))}>
                  {verdictLabel(group.verdict, t)}
                  <b>{group.rows.length}</b>
                </span>
              )}
              {/* BALON BURADA, KARTTA DEĞİL. Kimlik balonu 22 Eylül'e kadar
                  /teknik kartlarının başlığında açılıyordu; kart kimliği zaten
                  gösteriyor ve balon aynı bilgiyi ikinci kez veriyordu. Logo
                  ise yalnızca bir resim — okuyucu dağılımda bir hisseyi
                  ararken adı, sektörü ve fiyatı burada istiyor.

                  FİYAT SAYFANIN PAKETİNDEN (`quotes`). Balon bir süre
                  fotoğraftaki fiyatı yazıyordu: /teknik 1440'ta balon
                  "Analiz Anında 1.081,31 $", hemen altındaki MU kartı
                  "Şu An 1.081,58 $" diyordu — aynı ekranda aynı hissenin iki
                  fiyatı, iki kaynaktan. */}
              <div className={styles.pulseLogos} data-motion-stagger>
                {group.rows.map(({ row }) => {
                  const company = meta[row.symbol];
                  return (
                    <PulseCompanyLink
                      key={row.symbol}
                      href={technicalHref(row.symbol)}
                      className={styles.pulseLogo}
                      label={`${row.symbol} · ${company?.name ?? row.symbol} · ${verdictLabel(group.verdict, t)}`}
                      summary={balloon(row.symbol, group.verdict, {
                        price: row.snapshot.price,
                        changePct: row.snapshot.changePct,
                        foot: `${formatEtDateCompact(row.sessionDate, locale)} · ${slotLabel(row.slot, t)} · ${editionTime(row.sessionDate, row.slot, locale)}`,
                      })}
                    >
                      <LogoTile symbol={row.symbol} logoUrl={company?.logoUrl ?? null} size="sm" />
                    </PulseCompanyLink>
                  );
                })}
              </div>
            </div>
          ))}
        {pending.length > 0 && (
          <div className={styles.pulseRow}>
            <span className={cn(styles.pulseStance, styles.pulseStanceStatic, styles.pulseStancePending)}>
              {t.technical.pendingLabel}
              <b>{pending.length}</b>
            </span>
            <div className={styles.pulseLogos} data-motion-stagger>
              {/* Bekleyenin balonu da aynı: kimlik, sektör, varsa canlı fiyat.
                  Görüş hapı nötr ("Bekliyor"), damga yerine bir cümle —
                  yayını olmayan bir hisse için tarih uydurulmuyor. Yerel
                  `title=` kalktı: özel balonun yanında tarayıcının kendi
                  ipucu da açılıp ikisi üst üste biniyordu. */}
              {pending.map((symbol) => (
                <PulseCompanyLink
                  key={symbol}
                  href={technicalHref(symbol)}
                  className={cn(styles.pulseLogo, styles.pulseLogoPending)}
                  label={`${symbol} · ${meta[symbol]?.name ?? symbol} · ${t.technical.pendingLabel}`}
                  summary={balloon(symbol, "pending", {
                    price: null,
                    changePct: null,
                    foot: t.technical.pulseAwaiting,
                  })}
                >
                  <LogoTile symbol={symbol} logoUrl={meta[symbol]?.logoUrl ?? null} size="sm" />
                </PulseCompanyLink>
              ))}
            </div>
          </div>
        )}
      </div>

      {changes.length > 0 && (
        <div className={styles.pulseChanges}>
          <span>{t.technical.changesLabel}</span>
          {changes.map((change) => (
            <Link
              key={change.symbol}
              href={technicalHref(change.symbol)}
              prefetch={false}
              className={styles.pulseChange}
            >
              {/* Tam cümle ("Tuta Döndü") çipten kalktı ama kaybolmadı:
                  ekran okuyucuya duruyor. Yerel `title=` ipucu 22 Eylül'de
                  kalktı — dağılımın özel balonuyla aynı ekranda ikinci,
                  biçimsiz bir ipucu dili açıyordu. */}
              <LogoTile symbol={change.symbol} logoUrl={meta[change.symbol]?.logoUrl ?? null} size="xs" />
              {change.symbol}
              <span className={changeToneClass(change.verdict)}>{change.label}</span>
              <span className="sr-only">{change.full}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
