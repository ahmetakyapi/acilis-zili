import type { CSSProperties, ReactNode } from "react";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { TimingChip } from "@/components/ui/primitives";
import type { TimingTone } from "@/components/ui/primitives";
import { daysBetweenEt } from "@/lib/market-hours";
import { cn, etDateParts, formatEtDateCompact, formatPercentPlain } from "@/lib/utils";
import css from "./CompanyEarnings.module.css";

/**
 * SIRADAKİ BİLANÇO ÇİZİMİ — `/bilancolar/[symbol]` (31 Ekim).
 *
 * NEDEN: panel tarihi düz metin, kalan günü ve iki beklentiyi üç gri
 * kutuda düz sayı olarak veriyordu; sahibinin sözü "çok eksik hissettiriyor,
 * çok daha görsel ve anlaşılır olmalı". Üç okuma artık çizimle:
 *
 *   · TAKVİM YAPRAĞI — /bilancolar/analizler "Yaklaşan Bilançolar"ın
 *     yaprağının büyük hâli: ay şeridi, gün, hafta günü. Saat duyurulmamış
 *     tarih TAHMİNİDİR (`when.estimated`): yaprağın kenarı kesik çizgi, şerit
 *     dolu değil soluk ve altında "Tahmini Tarih" yazılı — kesinmiş gibi
 *     basılmaz (CLAUDE.md "Veri Dürüstlüğü" 1).
 *   · ÇEYREK ÇİZGİSİ — son rapordan sıradakine geçen yol. Uçlarda iki
 *     tarih YAZILI, kalan gün büyük puntoyla yazılı; çizgi bu üç sayının
 *     kopyası (`aria-hidden` değil, tek cümleyle adlanıyor). Son rapor
 *     bilinmiyorsa çizgi HİÇ basılmaz: çeyreğin uzunluğunu uydurmak olurdu;
 *     rapor üç hafta içindeyse yerine kalan günleri sayan gün şeridi gelir.
 *   · BEKLENTİ + SON ÇEYREK — beklenti büyük, altında son çeyreğin
 *     gerçekleşeniyle yan yana iki çubuk (CompareScale dili: EPS işaretten
 *     renk alır, gelir büyüklüktür, yumuşak mavi). Son çeyrek yoksa çubuk
 *     yok, yalnız sayı.
 *
 * TEK KOMPOZİSYON (10 Kasım, görsel kalite turu). Üç okuma doğruydu ama
 * panelde dağınıktı. Canlı ekrandan (1440): ızgara `align-items: center` ve
 * sağdaki iki beklenti hücresi ~283 piksel olduğu için 127 piksellik yaprak
 * panelin ortasında yüzüyor, üstünde ~78 piksel boşluk kalıyordu; çeyrek
 * çizgisi yaprağın sağından başlıyor (x≈245), paragraf ve "Takvime Ekle" ise
 * ızgaranın ALTINDA sol kenardan (x≈81) — ayrı sol hatlar. Şimdi iki
 * sütun: solda "ne zaman" (yaprak + geri sayım, altında yaprağın sol
 * kenarından panelin sütun sonuna tek çeyrek çizgisi, altında açıklama ve
 * takvim düğmesi), sağda "ne bekleniyor" (iki hücre sütunu doldurur). İki
 * sütun aynı üst ve alt hatta; sol sütunun her öğesi aynı sol kenarda.
 * Kalan gün kahraman: 44 → 64 piksel, ilk ekranda bir kez yuvarlanır
 * (`RollingFigure`, CSS; sunucu son kareyi basar).
 * SONRA (önizleme, TR, açık/koyu): 1440'ta sol sütun 444–792, sağ sütun
 * 444–788 (üst hat aynı, dip farkı 4); sol sütunun bütün öğeleri x=81;
 * 1280'de 441–789 / 441–785. 1100'ün altında ve 390'da alt alta (390: sol
 * 634–1041, hücreler 1057–1340). Yatay taşma ve kutudan taşan 0.
 *
 * HÜCRE İÇERİĞİ KADAR (10 Kasım, ikinci tur). Sağ sütunun hücreleri sol
 * sütunun boyuna geriliyor, kıyas çubukları dibe itiliyordu: sayı ile
 * çubuklar arasında 42 piksel boş bant (1440; EPS hücresinde sayının dibi
 * 519, çubukların tepesi 561). Şimdi hücre içeriği kadar, sayı 26 → 32
 * piksel. SONRA (gerçek sayfa, sahte sağlayıcı, TR, açık): 1440'ta sol
 * sütun 444–788, sağ sütun 444–790 (dip farkı 2), sayı ile çubuklar arası
 * 8 piksel; 1280'de 441–785 / 441–787.
 *
 * TEK KAHRAMAN YÜZEY (14 Kasım, görsel tur). Panel sayfanın kahramanı
 * (`--radius-feature`). İki sorun kalmıştı (canlı, 1440): sağdaki iki
 * beklenti hücresi gri kutulardı ("kutu içinde kutu"), sol yarının altında
 * paragraf, "Takvime Ekle" düğmesi ve kaynak künyesi üç ayrı blok hâlinde
 * üç ayrı dipte duruyordu. Şimdi: beklenti hücreleri KUTUSUZ (sağ sütun
 * saç teliyle ayrılır, iki hücre arasında saç teli); sol sütun yaprak +
 * geri sayım, çeyrek çizgisi ve açıklama paragrafıyla biter; düğme ile
 * kaynak künyesi panelin dibinde TEK satır (künye solda, düğme sağda;
 * sayfa basar, `CompanyEarnings.module.css` → `.heroFoot`). Ölçüm orada.
 *
 * Beklenti çubukları artık hücrenin kendi kulvarında, SOLDAN (ScaleBar sağa
 * yaslı ve 128 piksel tavanlıydı: tablo sütunu için doğru, burada sayıyla
 * etiket arasında kısa bir çizgi kalıyordu). İki çubuk aynı ölçekte
 * (ikisinin büyüğü tam kulvar); başlığın yanında beklentinin son çeyreğe
 * göre farkı yazılı — çubukların söylediği şeyin sayısı. Fark yalnız iki
 * değer aynı işaretteyken ve son çeyrek sıfır değilken basılır (zarardan
 * kâra geçişte yüzde anlamsız).
 */

/** Gün şeridinin üst sınırı — üç hafta (gerekçe `ticks`). */
const MAX_TICK_DAYS = 21;

type NextReportLabels = {
  daysLeft: string;
  today: string;
  daysValue: string;
  estimatedDate: string;
  lastReport: string;
  reportDay: string;
  cycleAria: string;
  epsEstimate: string;
  revenueEstimate: string;
  lastQuarter: string;
  estimateLabel: string;
  /** "Son Çeyreğe Göre" — beklentinin son çeyreğe göre farkının künyesi. */
  vsLastQuarter: string;
};

type Figure = {
  /** Beklenti — biçimlenmiş ve ham. */
  estimate: { text: string; value: number };
  /** Son çeyreğin gerçekleşeni; yoksa çubuk basılmaz. */
  last: { text: string; value: number } | null;
};

export function NextReport({
  date,
  previousDate,
  today,
  daysLeft,
  estimated,
  timing,
  clockLine,
  eps,
  revenue,
  locale,
  labels,
  children,
}: {
  /** Sol sütunun dibi: açıklama paragrafı ve takvim düğmesi (sayfa verir). */
  children?: ReactNode;
  date: string;
  previousDate: string | null;
  today: string;
  daysLeft: number;
  estimated: boolean;
  timing: { label: string; tone: TimingTone } | null;
  clockLine: string | null;
  eps: Figure | null;
  revenue: Figure | null;
  locale: string;
  labels: NextReportLabels;
}) {
  const parts = etDateParts(date, locale);
  const anchor = new Date(`${date}T12:00:00Z`);
  const tag = locale === "tr" ? "tr-TR" : "en-US";
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: "UTC" }).format(anchor);
  const year = new Intl.DateTimeFormat(tag, { year: "numeric", timeZone: "UTC" }).format(anchor);

  /* Çizgi: son rapordan bugüne geçen günün, iki rapor arasındaki güne oranı
     (ET takvim günü, `daysBetweenEt` — kalan gün de aynı fonksiyondan). */
  const span = previousDate ? daysBetweenEt(previousDate, date) : 0;
  const elapsed = previousDate ? daysBetweenEt(previousDate, today) : 0;
  const cycle = previousDate && span > 0 ? Math.min(1, Math.max(0, elapsed / span)) : null;
  /* Gün şeridinin çentik sayısı: bugün + kalan günler. Üç haftadan uzunsa
     çentikler okunmayacak kadar sıklaşıyor; o zaman şerit yok. */
  const ticks = daysLeft >= 1 && daysLeft <= MAX_TICK_DAYS ? daysLeft + 1 : 0;

  const countText = daysLeft <= 0 ? labels.today : labels.daysValue.replace("{n}", String(daysLeft));

  /* Kıyas çubuğu yoksa (son çeyrek bilinmiyor) hücreler iki satırlık kısa
     kutular: sağ sütuna gerilince içleri boş kalıyordu (ölçüldü: 175
     piksellik hücrede tek sayı). O durumda iki sütun kurulmuyordu.
     10 Kasım (ikinci tur): hücreler artık içeriği kadar, bu durumda da sağ
     sütunda durur; öznitelik kıyassız hâli adlandırmak için kalıyor
     (`CompanyEarnings.module.css` → "HÜCRE İÇERİĞİ KADAR"). */
  const plain = !(eps?.last || revenue?.last);

  return (
    <div className={css.next} data-plain={plain || undefined} data-solo={!(eps || revenue) || undefined}>
      <div className={css.when}>
        <div className={css.whenTop}>
          <div className={css.leafCol}>
            <div className={css.leaf} data-estimated={estimated || undefined} data-today={daysLeft <= 0 || undefined}>
              <span className={css.leafBand}>
                {parts.month} {year}
              </span>
              <b className={cn("numeral", css.leafDay)}>{parts.day}</b>
              <span className={css.leafWeekday}>{weekday}</span>
            </div>
            {estimated && <span className={css.leafNote}>{labels.estimatedDate}</span>}
          </div>

          <div className={css.countHead}>
            <p className={css.countLabel}>{labels.daysLeft}</p>
            <p className={cn("figure", css.countValue)}>
              {daysLeft > 0 ? <RollingFigure value={countText} /> : countText}
            </p>
            {(timing || clockLine) && (
              <div className={css.windowRow}>
                {timing && <TimingChip tone={timing.tone}>{timing.label}</TimingChip>}
                {clockLine && <span className="figure text-small text-body">{clockLine}</span>}
              </div>
            )}
          </div>
        </div>

        {/* GÜN ŞERİDİ — son rapor bilinmiyorsa (takvimde geçmiş satır yok,
            ör. AAPL 31 Ekim) çeyrek çizgisi çizilemez; yakın raporda kalan
            günler tek tek sayılıyor: bir çentik bir gün, ilk çentik bugün,
            son çentik bilanço günü. Çentik sayısı yazılı sayının kendisi. */}
        {cycle === null && ticks > 0 && (
          <div
            className={css.cycle}
            role="img"
            aria-label={`${labels.daysLeft}: ${labels.daysValue.replace("{n}", String(daysLeft))}`}
          >
            <span className={css.dayTicks}>
              {Array.from({ length: ticks }, (_, index) => (
                <i
                  key={index}
                  data-at={index === 0 ? "today" : index === ticks - 1 ? "end" : undefined}
                  data-estimated={(index === ticks - 1 && estimated) || undefined}
                  style={{ "--i": index } as CSSProperties}
                />
              ))}
            </span>
            <span className={css.cycleEnds}>
              <span>
                <span className={css.cycleEndLabel}>{labels.today}</span>
                <span className="figure">{formatEtDateCompact(today, locale)}</span>
              </span>
              <span>
                <span className={css.cycleEndLabel}>{labels.reportDay}</span>
                <span className="figure">{formatEtDateCompact(date, locale)}</span>
              </span>
            </span>
          </div>
        )}

        {cycle !== null && previousDate && (
          <CycleLine
            previousDate={previousDate}
            date={date}
            today={today}
            estimated={estimated}
            locale={locale}
            labels={labels}
          />
        )}

        {children}
      </div>

      {(eps || revenue) && (
        <dl className={css.expect}>
          {[
            eps ? { key: "eps", title: labels.epsEstimate, figure: eps, tone: "signal" as const } : null,
            revenue ? { key: "revenue", title: labels.revenueEstimate, figure: revenue, tone: "neutral" as const } : null,
          ].map(
            (cell) =>
              cell && (
                <ExpectCell
                  key={cell.key}
                  title={cell.title}
                  primary={cell.figure.estimate}
                  compare={cell.figure.last}
                  rowLabels={{ primary: labels.estimateLabel, compare: labels.lastQuarter }}
                  changeLabel={labels.vsLastQuarter}
                  tone={cell.tone}
                  locale={locale}
                />
              ),
          )}
        </dl>
      )}
    </div>
  );
}

/**
 * ÇEYREK ÇİZGİSİ — son rapordan sıradakine geçen yol (gerekçe dosya
 * başında). Ayrı bileşen (14 Kasım): yeni açıklanmış raporun yüzeyi de
 * (`LastReport`) aynı çizgiyi çizer; orada nokta çizginin başındadır.
 */
export function CycleLine({
  previousDate,
  date,
  today,
  estimated,
  locale,
  labels,
}: {
  previousDate: string;
  date: string;
  today: string;
  estimated: boolean;
  locale: string;
  labels: Pick<NextReportLabels, "lastReport" | "reportDay" | "cycleAria">;
}) {
  const span = daysBetweenEt(previousDate, date);
  const elapsed = daysBetweenEt(previousDate, today);
  const daysLeft = daysBetweenEt(today, date);
  const cycle = span > 0 ? Math.min(1, Math.max(0, elapsed / span)) : 0;
  return (
    <div
      className={css.cycle}
      role="img"
      aria-label={labels.cycleAria
        .replace("{elapsed}", String(Math.max(0, elapsed)))
        .replace("{left}", String(Math.max(0, daysLeft)))}
    >
      {/* ÇİZİM YÜKLEMEDE OYNAR (10 Kasım, tutarlılık denetimi). Bu öğeler
          `data-motion-draw` taşıyordu; `PremiumMotion.module.css`in
          `.experience [data-motion-draw] { animation:none }` kuralı
          modülün çizimini eziyor, panel ilk ekranda olduğu için JS de
          oynatmıyordu: canlıda çeyrek çizgisi ve beklenti şeritleri
          HİÇ çizilmiyordu (`getAnimations()` 0). Öznitelik kalktı;
          dolgu ortak `.bar-fill` (globals.css, hareket kataloğu),
          kopya `ce-draw` silindi. Nokta modülde kaldı: ortak
          `.spark-dot` `.experience` içinde koşulsuz kapalı
          (PremiumMotion.module.css; ölçüldü, `animation-name: none`). */}
      <span className={css.cycleLane}>
        <span
          className={cn(css.cycleFill, "bar-fill")}
          style={{ width: `${cycle * 100}%`, transformOrigin: "left center" }}
        />
        <span className={css.cycleStart} />
        <span className={css.cycleNow} style={{ "--at": cycle } as CSSProperties} />
        <span className={css.cycleEnd} data-estimated={estimated || undefined} />
      </span>
      <span className={css.cycleEnds}>
        <span>
          <span className={css.cycleEndLabel}>{labels.lastReport}</span>
          <span className="figure">{formatEtDateCompact(previousDate, locale)}</span>
        </span>
        <span>
          <span className={css.cycleEndLabel}>{labels.reportDay}</span>
          <span className="figure">{formatEtDateCompact(date, locale)}</span>
        </span>
      </span>
    </div>
  );
}

/**
 * Ölçü hücresi: büyük sayı + kıyasıyla yan yana iki şerit. İki kullanım:
 * sıradaki rapor (beklenti · son çeyrek) ve açıklanmış rapor (gerçekleşen ·
 * beklenti; `LastReport.tsx`, 14 Kasım). Etiketleri çağıran verir.
 */
export function ExpectCell({
  title,
  primary,
  compare,
  rowLabels,
  changeLabel,
  tone,
  locale,
}: {
  title: string;
  /** Hücrenin büyük sayısı ve üstteki şerit. */
  primary: { text: string; value: number };
  /** Kıyas; yoksa şerit basılmaz, yalnız sayı. */
  compare: { text: string; value: number } | null;
  rowLabels: { primary: string; compare: string };
  /** Farkın künyesi: "Son Çeyreğe Göre", "Beklentiye Göre". */
  changeLabel: string;
  tone: "signal" | "neutral";
  locale: string;
}) {
  const estimate = primary;
  const last = compare;
  const scale = last ? Math.max(Math.abs(estimate.value), Math.abs(last.value)) || 1 : 1;
  /* İşaretli ray yalnız iki değer sıfırın iki yanındaysa (zarardan kâra);
     ikisi de eksideyse uzunluk büyüklük, renk işaretten. */
  const signed = last !== null && Math.sign(estimate.value) * Math.sign(last.value) < 0;
  /* Büyük sayının kıyasa göre farkı — gerekçe dosya başında. */
  const change =
    last !== null && !signed && last.value !== 0 ? ((estimate.value - last.value) / Math.abs(last.value)) * 100 : null;
  const row = (label: string, item: { text: string; value: number }, strong: boolean) => {
    const ratio = Math.min(1, Math.abs(item.value) / scale);
    const negative = item.value < 0;
    return (
      <span className={css.expectRow} data-strong={strong || undefined}>
        <span className={css.expectRowLabel}>{label}</span>
        <span aria-hidden className={css.expectLane} data-signed={signed || undefined}>
          <span
            className={cn(css.expectFill, "bar-fill")}
            data-tone={tone === "signal" ? (negative ? "down" : "up") : "neutral"}
            style={
              signed
                ? {
                    left: negative ? `${50 - ratio * 50}%` : "50%",
                    width: `${ratio * 50}%`,
                    transformOrigin: negative ? "right center" : "left center",
                  }
                : { width: `${ratio * 100}%`, transformOrigin: "left center" }
            }
          />
        </span>
        <span className={cn("figure", css.expectRowValue)}>{item.text}</span>
      </span>
    );
  };
  return (
    <div className={css.expectCell}>
      <dt>
        <span>{title}</span>
        {change !== null && Math.abs(change) >= 0.05 && (
          <span className={css.expectChange} data-dir={change > 0 ? "up" : "down"}>
            <span className={css.expectChangeLabel}>{changeLabel}</span>
            <b className="figure">
              {change > 0 ? "▲" : "▼"} {formatPercentPlain(Math.abs(change), locale as "tr" | "en", 1)}
            </b>
          </span>
        )}
      </dt>
      <dd className={cn("figure", css.expectValue)}>{estimate.text}</dd>
      {last && (
        <dd className={css.expectBars}>
          {row(rowLabels.primary, estimate, true)}
          {row(rowLabels.compare, last, false)}
        </dd>
      )}
    </div>
  );
}
