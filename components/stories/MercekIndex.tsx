import type { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { StoryCast, type CastMember } from "@/components/stories/StoryVisual";
import { LogoTile } from "@/components/ui/primitives";
import type { StoryIndexRow } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateCompact,
  formatEtDateLong,
  formatPercent,
  formatPrice,
  plural,
} from "@/lib/utils";
import styles from "./MercekIndex.module.css";

/**
 * Mercek dizininin yüzeyleri — kapak, manşet ve ay ay arşiv.
 *
 * NEDEN AYRI DOSYA (18 Ekim, sahibinin isteği: "göz alıcı, premium, gerçekten
 * iyi bir hâle getir; Paylaş saçma bir yerde duruyor"). Sayfa ortak
 * `SectionMasthead` + `StoryCard` ile çiziliyordu; ikisi de başka ekranlarla
 * paylaşılıyor (kart hisse sayfasındaki mercek bloğunda da var), yani
 * dizine özgü bir düzen onları değiştirerek kurulamazdı. Buradaki her şey
 * yalnız /mercek'e ait; sayfa dosyası veri toplamakla kalıyor.
 */

/* -------------------------------------------------------------------------
   KAPAK
   ------------------------------------------------------------------------- */

/**
 * PAYLAŞ KAPAĞIN SAĞ ÜST KÖŞESİNDE. Ortak kapakta düğme başlık satırının
 * (`.page-title-row`) sağ ucuna yaslanıyordu; ama o satır kapağın SOL
 * kolonu, yani "Paylaş" 1440 pikselde kapağın tam ortasında, başlıkla çip
 * kümesinin arasında boşlukta asılı duruyordu (sahibinin ekran görüntüsü).
 * Burada düğme ızgaranın kendi hücresinde: geniş ekranda kapağın sağ üst
 * köşesi, çiplerin hemen üstü — sayfanın genel eylemi, sayfanın köşesinde.
 * Dar ekranda aynı hücre başlık satırının sağına düşüyor (ikon, 44 px).
 *
 * Ölçüldü (18 Ekim, örnek veriyle, başsız Chrome, hareket azaltılmış):
 * düğmenin sağ kenarı kapağın sağ kenarından 1440'ta 25, 390'da 19 piksel
 * içeride (kapağın iç boşluğu); dikey merkezi h1'in merkezinden 1440'ta 7,
 * 390'da 4 piksel aşağıda. Yatay taşma 1440/390/320'de 0.
 */
export function MercekMasthead({
  title,
  description,
  share,
  filters,
}: {
  title: string;
  description: string;
  share: ReactNode;
  filters?: ReactNode;
}) {
  return (
    <header
      className={cn("page-masthead", styles.masthead)}
      data-embedded="false"
      data-has-filters={filters ? "true" : "false"}
    >
      <div className={cn("page-heading-copy", styles.mastTitle)}>
        <h1>{title}</h1>
      </div>
      <div className={styles.mastShare}>{share}</div>
      <p className={styles.mastDesc}>{description}</p>
      {filters && <div className={styles.mastFilters}>{filters}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------
   MANŞET
   ------------------------------------------------------------------------- */

/**
 * Manşet — arşivin en yeni yazısı.
 *
 * İKİ TON, TEK KART. Solda okunacak metin kartın kendi yüzeyinde, sağda
 * yazının kadrosu bir ton gömük (`--surface-sunken`) zeminde. Önce ikisi de
 * aynı yüzeydeydi ve kadro tablosu kartın içinde ikinci bir kart gibi
 * yüzüyordu; şimdi kart ikiye bölünmüş bir sayfa gibi okunuyor — metin ve
 * metnin piyasadaki karşılığı. Derinlik tonla, gölge yok.
 *
 * Başlık sitenin manşet puntosunun bir basamak üstünde (42'ye kadar) çünkü
 * bu ekranın kahramanı o; `max-width: 24ch` iki-üç satıra kırıyor, satır
 * satır degrade (`data-ink="lines"`) ikinci satırı başka tonda başlatmıyor.
 * Künye (tarih, okuma süresi, şirket sayısı) başlığın ALTINDA, eylemle aynı
 * satırda — üst künye yok (CLAUDE.md, ekran düzeni).
 */
export function LeadStory({
  story,
  cast,
  locale,
  t,
}: {
  story: StoryIndexRow;
  cast: CastMember[];
  locale: Locale;
  t: Dictionary;
}) {
  const total = story.symbols?.length ?? 0;

  return (
    <Link
      href={`/mercek/${story.slug}`}
      prefetch
      className={styles.lead}
      data-motion-reveal
    >
      <section className={styles.leadCard} data-has-cast={cast.length > 0}>
        <div className={styles.leadCopy}>
          {/* Yazı bu dile henüz çevrilmediyse orijinal gösterilir ve dili
              rozetle söylenir; rozet yalnızca o durumda basılıyor. */}
          {story.locale !== locale && (
            <span className="plate mb-4 self-start text-nano">
              {story.locale.toUpperCase()}
            </span>
          )}
          <h2 className={styles.leadTitle} data-ink="lines" lang={story.locale}>
            <span className="ink-line">{story.title}</span>
          </h2>
          <p className={styles.leadDek} lang={story.locale}>
            {story.dek}
          </p>

          <div className={styles.leadFoot}>
            <span className={styles.leadCta}>
              {t.stories.readStory}
              <ArrowRight weight="bold" size={14} aria-hidden />
            </span>
            <span className={cn("numeral", styles.leadMeta)}>
              <span className={styles.metaStrong}>
                {formatEtDateLong(story.eventDate, locale)}
              </span>
              {story.readMinutes && (
                <>
                  <span aria-hidden className={styles.metaDot}>·</span>
                  <span>
                    {story.readMinutes} {t.stories.readMinutes}
                  </span>
                </>
              )}
              {total > 0 && (
                <>
                  <span aria-hidden className={styles.metaDot}>·</span>
                  <span>
                    {plural(total, t.stories.companyCountOne, t.stories.companyCountMany).replace(
                      "{count}",
                      String(total),
                    )}
                  </span>
                </>
              )}
            </span>
          </div>
        </div>

        {cast.length > 0 && (
          <div className={styles.leadAside}>
            <StoryCast
              cast={cast}
              total={total}
              title={t.stories.relatedSymbols}
              sinceLabel={t.stories.sinceEvent}
              closeLabel={t.stories.lastClose}
              closeOnLabel={t.stories.closeOn}
              moreLabel={plural(
                Math.max(0, total - cast.length),
                t.stories.moreCompaniesOne,
                t.stories.moreCompaniesMany,
              )}
              locale={locale}
            />
          </div>
        )}
      </section>
    </Link>
  );
}

/* -------------------------------------------------------------------------
   ARŞİV
   ------------------------------------------------------------------------- */

/** "2026-10" → "Ekim 2026" / "October 2026". */
function monthLabel(key: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}-15T12:00:00Z`));
}

/**
 * Arşiv, AY AY. Yazılar bir OLAYI anlatıyor ve okuyucu arşivde "geçen ay ne
 * olmuştu" diye geziniyor; 24 kartlık düz ızgarada zaman hiçbir yerde
 * okunmuyordu, her kartın tarihini tek tek okumak gerekiyordu. Ay başlığı
 * (`h3`, yanında o aydaki yazı sayısı) ızgarayı zaman çizelgesine çeviriyor.
 * Gruplama EKRANDAKİ listeden: "Daha Fazla Göster" bir sonraki ayı ekliyor,
 * yarım kalan ay da kendi başlığının altında büyüyor.
 */
export function ArchiveMonths({
  rows,
  castOf,
  locale,
  t,
}: {
  rows: StoryIndexRow[];
  castOf: (story: StoryIndexRow) => CastMember[];
  locale: Locale;
  t: Dictionary;
}) {
  const months: { key: string; stories: StoryIndexRow[] }[] = [];
  for (const story of rows) {
    const key = story.eventDate.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.key === key) last.stories.push(story);
    else months.push({ key, stories: [story] });
  }

  return (
    <div className={styles.archive}>
      {months.map((month) => (
        <section key={month.key} className={styles.month} aria-labelledby={`ay-${month.key}`}>
          <div className={styles.monthHead}>
            <h3 id={`ay-${month.key}`} className={styles.monthTitle}>
              {monthLabel(month.key, locale)}
            </h3>
            <span className={cn("numeral", styles.monthCount)}>
              {plural(
                month.stories.length,
                t.stories.symbolPanelCountOne,
                t.stories.symbolPanelCountMany,
              ).replace("{count}", String(month.stories.length))}
            </span>
          </div>
          <div className={styles.grid} data-motion-stagger>
            {month.stories.map((story) => (
              <ArchiveCard
                key={story.slug}
                story={story}
                cast={castOf(story)}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Arşiv kartı — kadro şeridi, künye, başlık, giriş, eylem.
 *
 * ŞERİT GÖMÜK TONDA, DEGRADESİZ. Ortak karttaki (`StoryBrands`) şerit
 * mavi bir degrade taşıyordu; degrade yalnız üç yerde (CLAUDE.md, görsel
 * dil) ve veri şeridi onlardan biri değil. Burada şerit `--surface-sunken`:
 * kartın başlığı gibi değil, kartın zemini gibi okunuyor.
 *
 * LOGOLAR ÜST ÜSTE. Dört logo yan yana 34'er pikselle şeridin yarısını
 * alıyordu; 8 piksel bindirilmiş yığın aynı kadroyu 112 pikselde söylüyor
 * ve sağdaki rakama yer açıyor. Her karo kartın yüzey renginde 2 piksellik
 * bir halka taşıyor (gölge değil, ayraç) — üstteki logo alttakini kesiyor
 * gibi değil, önünde duruyor gibi görünsün diye.
 *
 * Sağdaki rakam ilk şirketin olaydan bugüne getirisi; hesaplanamıyorsa
 * tarihli son kapanış (hafta sonu yazısına uydurma getiri yazılmaz).
 */
function ArchiveCard({
  story,
  cast,
  locale,
  t,
}: {
  story: StoryIndexRow;
  cast: CastMember[];
  locale: Locale;
  t: Dictionary;
}) {
  const total = story.symbols?.length ?? 0;
  /* Yazıda TAM beş şirket varken beşincisi "+1" yerine kendi logosuyla. */
  const shown = cast.slice(0, total === 5 ? 5 : 4);
  const rest = total - shown.length;
  const lead = shown[0];
  const tone = directionOf(lead?.sinceEvent ?? null);

  return (
    <Link href={`/mercek/${story.slug}`} prefetch={false} className={styles.card}>
      {shown.length > 0 && (
        <div className={styles.cardBand}>
          <span className={styles.stack}>
            {shown.map((member) => (
              <span key={member.symbol} className={styles.stackItem}>
                <LogoTile symbol={member.symbol} logoUrl={member.logoUrl} size="md" card />
              </span>
            ))}
            {rest > 0 && (
              <span className={cn("numeral", styles.stackItem, styles.stackMore)}>
                +{rest}
              </span>
            )}
          </span>

          {lead && (lead.sinceEvent !== null || lead.lastClose) && (
            <span className={styles.reading}>
              <span className={styles.readingCaption}>
                {lead.symbol} ·{" "}
                {lead.sinceEvent !== null ? t.stories.sinceEvent : t.stories.lastClose}
              </span>
              <span
                className={cn(
                  "numeral",
                  styles.readingValue,
                  lead.sinceEvent !== null ? directionText(tone) : "text-strong",
                )}
              >
                {lead.sinceEvent !== null
                  ? formatPercent(lead.sinceEvent, locale)
                  : formatPrice(lead.lastClose?.price, locale, { currency: true })}
              </span>
              {lead.sinceEvent === null && lead.lastClose && (
                <span className={styles.readingCaption}>
                  {formatEtDateCompact(lead.lastClose.date, locale)}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      <div className={styles.cardBody}>
        <p className={cn("numeral", styles.cardMeta)}>
          <span className={styles.metaStrong}>
            {formatEtDateLong(story.eventDate, locale)}
          </span>
          {story.readMinutes && (
            <>
              <span aria-hidden className={styles.metaDot}>·</span>
              <span>
                {story.readMinutes} {t.stories.readMinutes}
              </span>
            </>
          )}
          {story.locale !== locale && (
            <span className="plate ml-auto text-nano">{story.locale.toUpperCase()}</span>
          )}
        </p>
        {/* h4: sayfa h1 → arşiv h2 → ay h3 → kart. `lang` şart — çevirisi
            olmayan yazı orijinal diliyle sesletilsin. */}
        <h4 className={styles.cardTitle} data-ink="lines" lang={story.locale}>
          <span className="ink-line">{story.title}</span>
        </h4>
        <p className={styles.cardDek} lang={story.locale}>
          {story.dek}
        </p>
      </div>

      <div className={styles.cardFoot}>
        <span className={cn("numeral", styles.cardSymbols)}>
          {shown.map((member) => member.symbol).join(" · ")}
        </span>
        <span className={styles.cardCta}>
          {t.guide.cardCta}
          <ArrowRight weight="bold" size={13} aria-hidden />
        </span>
      </div>
    </Link>
  );
}
