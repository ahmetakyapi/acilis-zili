import { ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import visuals from "@/components/motion/DirectoryVisuals.module.css";
import { cardKey } from "@/lib/company-card-key";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictPillClass, verdictTextClass, type VerdictKey } from "@/lib/analysis";
import type { CompanyCardExtra } from "@/lib/company-card";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { MarketStatus } from "@/lib/market-hours";
import type { ProviderResult, Quote } from "@/lib/providers/types";
import { editionTime, livePriceLabel, slotLabel, stanceChangeLabel, technicalHref } from "@/lib/technical";
import type { TechnicalBoardEntry } from "@/lib/technical-data";
import { cn, formatEtDateCompact, plural } from "@/lib/utils";
import { changeToneClass } from "./TechnicalCard";
import { PulseBar } from "./PulseBar";
import styles from "./Technical.module.css";

const VERDICTS: readonly VerdictKey[] = ["buy", "hold", "sell"];
/** Dağılımın kart anahtarı: görüş hapı ve yayın damgası taşıyan kart,
    aynı sayfadaki düz şirket kartından ayrı (`cardKey`). */
const CARD_SET = "pulse";

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
  const sharePercent = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { style: "percent", maximumFractionDigits: 0 });
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

  /* KARTIN ORTAK KURGUSU — yayımlanmış ve bekleyen logolar aynı şirket
     kartını açıyor (components/ui/CompanyCard.tsx), yalnızca hap, yedek
     fiyat ve alt künye ayrı. Canlı fiyat varsa o (etiketi
     `livePriceLabel`dan: "Şu An" / "Son Fiyat"), yoksa fotoğraftaki fiyat
     "Analiz Anında" etiketiyle.

     EYLEM DÜĞMESİ YOK, Trend/RSI çipleri de yok: bağlantı logonun kendisi,
     çipleri hemen alttaki kartlar zaten taşıyor. */
  const pack = quotes?.pack;
  const cardExtra = (
    symbol: string,
    verdict: VerdictKey | "pending",
    fallback: { price: number | null; changePct: number | null; foot: string },
  ): CompanyCardExtra => {
    const quote = pack?.ok ? pack.data[symbol] : undefined;
    const liveLabel = quotes && quote ? livePriceLabel(quote, quotes.pack, quotes.status, t) : null;
    return {
      badge: {
        text: verdict === "pending" ? t.technical.pendingLabel : verdictLabel(verdict, t),
        tone: verdict === "pending" ? "bg-surface-sunken text-muted" : verdictPillClass(verdict),
      },
      price:
        quote && liveLabel
          ? {
              value: quote.price,
              changePct: quote.changePct,
              change: quote.change,
              basis: liveLabel,
              live: liveLabel === t.technical.now || liveLabel === t.technical.nowRealtime,
            }
          : { value: fallback.price, changePct: fallback.changePct, basis: t.technical.atAnalysis },
      foot: fallback.foot,
    };
  };
  const cardExtras: Record<string, CompanyCardExtra> = Object.fromEntries([
    ...groups.flatMap((group) =>
      group.rows.map(({ row }) => [
        row.symbol,
        cardExtra(row.symbol, group.verdict, {
          price: row.snapshot.price,
          changePct: row.snapshot.changePct,
          foot: `${formatEtDateCompact(row.sessionDate, locale)} · ${slotLabel(row.slot, t)} · ${editionTime(row.sessionDate, row.slot, locale)}`,
        }),
      ]),
    ),
    ...pending.map((symbol) => [
      symbol,
      cardExtra(symbol, "pending", { price: null, changePct: null, foot: t.technical.pulseAwaiting }),
    ]),
  ]);

  return (
    <section
      className={styles.pulse}
      data-variant={variant}
      aria-labelledby={filterable ? "technical-distribution" : undefined}
      aria-label={filterable ? undefined : t.technical.distribution}
    >
      {filterable && (
        <div className={visuals.visualHeader}>
          {/* PUNTO SINIFI DEGRADEYİ SEÇİYOR (23 Eylül). Başlık 13 piksel ama
              puntosunu modül CSS'inden alıyordu; ortak kural (globals.css,
              `main h2:is(.text-base…)`) sınıfa baktığı için geniş degradeyle
              basılıyordu ve açık ucu beyazda 3,34:1'di. `text-base` aynı 13
              piksel: sıkı degradeyi alıyor. */}
          <h2 id="technical-distribution" className="text-base">{t.technical.distribution}</h2>
          <span className="flex items-center gap-2 text-tiny font-semibold text-muted">
            {plural(total, t.technical.stockCountOne, t.technical.stockCount).replace("{n}", String(total))}
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
      {total > 0 && <div className={styles.pulseDial} aria-hidden="true">
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
      {/* PANELDE HALKA + LEJANT (26 Eylül). Ana sayfa paneli yalnızca düz
          bir oran çubuğu ve logo satırları taşıyordu; "çok düz" bulundu
          (ekran görüntüsüyle bildirildi). Dizindeki halka panele de
          geliyor, yanında her görüşün sayısı ve payı. Sayı satırlarda
          ikinci kez yazılmıyor (CSS, `data-variant="panel"`). */}
      {/* TELEFONDA HALKA YERİNE BİR CÜMLE (29 Eylül, sahibinin isteği:
          "anlamsız, ne ifade ettiği belli değil"). 390'da halka ve lejant
          panelin üçte birini tutuyor ve altındaki logo satırlarının
          söylediğini — kaç hisse hangi görüşte — ikinci kez, açıklamasız
          söylüyordu: on beş dilimli bir halka, ortasında "15 Takipte",
          yanında "%47 / %53". Telefonda halka ve lejant gizli (CSS), sayı
          satır etiketine dönüyor ("AL 7") ve dağılımın NEYİN dağılımı
          olduğunu bu cümle söylüyor. Geniş ekranda halka yerinde. */}
      {!filterable && total > 0 && (
        <p className={styles.pulseNote}>{t.technical.distributionNote.replace("{n}", String(total))}</p>
      )}
      {!filterable && total > 0 && (
        <ul className={styles.pulseLegend} data-motion-stagger>
          {[
            ...groups.map((group) => ({ key: group.verdict, label: verdictLabel(group.verdict, t), count: group.rows.length })),
            { key: "pending" as const, label: t.technical.pendingLabel, count: pending.length },
          ]
            .filter((item) => item.count > 0)
            .map((item) => (
              <li key={item.key} data-verdict={item.key}>
                <span className={item.key === "pending" ? "text-muted" : verdictTextClass(item.key)}>{item.label}</span>
                <b className="numeral">{item.count}</b>
                <small className="numeral">{sharePercent.format(item.count / total)}</small>
              </li>
            ))}
        </ul>
      )}
      {/* ÇUBUK OKUNUYOR (30 Eylül): dilime gelince/dokununca görüş, sayı
          ve pay balonda. Gerekçe `PulseBar`. */}
      <PulseBar
        className={styles.pulseBar}
        slices={[
          ...groups.map((group) => ({ key: group.verdict, label: verdictLabel(group.verdict, t), count: group.rows.length })),
          { key: "pending", label: t.technical.pendingLabel, count: pending.length },
        ].map((slice) => ({
          ...slice,
          countLabel: plural(slice.count, t.technical.stockCountOne, t.technical.stockCount).replace("{n}", String(slice.count)),
          share: total > 0 ? sharePercent.format(slice.count / total) : "",
        }))}
      />

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
                    <Link
                      key={row.symbol}
                      href={technicalHref(row.symbol)}
                      prefetch={false}
                      className={styles.pulseLogo}
                      aria-label={`${row.symbol} · ${company?.name ?? row.symbol} · ${verdictLabel(group.verdict, t)}`}
                      data-cc={cardKey(row.symbol, CARD_SET)}
                    >
                      <LogoTile symbol={row.symbol} logoUrl={company?.logoUrl ?? null} size={filterable ? "md" : "sm"} />
                    </Link>
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
                <Link
                  key={symbol}
                  href={technicalHref(symbol)}
                  prefetch={false}
                  className={cn(styles.pulseLogo, styles.pulseLogoPending)}
                  aria-label={`${symbol} · ${meta[symbol]?.name ?? symbol} · ${t.technical.pendingLabel}`}
                  data-cc={cardKey(symbol, CARD_SET)}
                >
                  <LogoTile symbol={symbol} logoUrl={meta[symbol]?.logoUrl ?? null} size={filterable ? "md" : "sm"} />
                </Link>
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
              <LogoTile symbol={change.symbol} logoUrl={meta[change.symbol]?.logoUrl ?? null} size="xs" card={cardKey(change.symbol, CARD_SET)} />
              {change.symbol}
              <span className={changeToneClass(change.verdict)}>{change.label}</span>
              <span className="sr-only">{change.full}</span>
            </Link>
          ))}
        </div>
      )}
      {/* Kartların verisi — fiyat SAYFANIN paketinden (`quotes`), yeni tur yok. */}
      <CompanyCards
        symbols={Object.keys(cardExtras)}
        quotes={pack?.ok ? pack.data : null}
        stale={pack?.ok === true && Boolean(pack.stale)}
        names={meta}
        status={quotes?.status}
        set={CARD_SET}
        extras={cardExtras}
      />
    </section>
  );
}
