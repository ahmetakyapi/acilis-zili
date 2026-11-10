import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { StoryCast, type CastMember } from "@/components/stories/StoryVisual";
import { StorySignature } from "@/components/stories/StorySignature";
import type { SignatureBlock } from "@/lib/story-signature";
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
 * KAPAK: SOLDA AD, SAĞ ÜSTTE SÜZGEÇ (18 Ekim, sahibinin isteği: "Paylaş'ı
 * buradan kaldır, şirket süzgecini sağ üste al, burayı daha derli toplu
 * yap; görsel bir ayrıntı eklenebilirse iyi olur").
 *
 * - PAYLAŞ YOK. Dizin sayfasının paylaşılacak bir içeriği yok — paylaşılan
 *   şey yazının kendisi ve her yazının kendi Paylaş'ı var. Kapağın köşesinde
 *   süzgeçle yer kavgası yapıyor, çipleri ikinci bir satıra itiyordu.
 * - SÜZGEÇ BAŞLIK SATIRINDA, TEK SATIR. Çipler eskiden kapağın sağ altında
 *   iki satıra sarıyordu; sağ üstte boşluk, sol altta boşluk, kapak 1440'ta
 *   üç satır yüksekliğindeydi. Şimdi "Şirkete Göre" etiketi ve çipler
 *   başlıkla aynı hatta, tek satır; sığmazsa şerit KAYAR (sarmaz) ve
 *   `ScrollEdges` sağ kenarı soldurur — kaydırma saklanmaz (CLAUDE.md).
 *   Dar ekranda (< 1024) şerit açıklamanın altına iner, yine tek satır.
 * - MERCEK İMİ. Başlığın solunda `lens` mürekkep sahnesi: satırların
 *   üstünde gezen büyüteç, bir satırın altını pirinçle çiziyor — bölümün
 *   adının kendisi. Renk temadan (`--text-strong`, `--brass`; mavi yok),
 *   bir kez oynuyor, hareketi azaltana son kare. Telefonda (< 640) basılmaz:
 *   320'de başlığın yanında yer yok ve kapağı uzatmaktan başka iş görmez.
 *
 * Ölçümler `MercekIndex.module.css` → KAPAK.
 */
export function MercekMasthead({
  title,
  description,
  mark,
  filters,
}: {
  title: string;
  description: string;
  /** Başlığın solundaki süs (mürekkep sahnesi); `aria-hidden` kendinde. */
  mark?: ReactNode;
  filters?: ReactNode;
}) {
  return (
    <header
      className={cn("page-masthead", styles.masthead)}
      data-embedded="false"
      data-has-filters={filters ? "true" : "false"}
    >
      {mark && <div className={styles.mastMark}>{mark}</div>}
      <div className={cn("page-heading-copy", styles.mastTitle)}>
        <h1>{title}</h1>
      </div>
      <p className={styles.mastDesc}>{description}</p>
      {filters && <div className={styles.mastFilters}>{filters}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------
   MANŞET
   ------------------------------------------------------------------------- */

/** Kartın imza minyatürü ve (yalnız `grafik` imzası için) kapanış serisi. */
export type ArchiveSignature = { block: SignatureBlock; series?: readonly number[] | null };

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
 *
 * KAPAK YAZININ KENDİ SAYILARIYLA KAPANIYOR (10 Kasım 2026, sahibinin
 * isteği: "mercek ve temaları da böyle ele alalım"). Kapak üç bölge: solda
 * metin, sağda kadro, ikisinin altında boydan boya yazının imza bloğu
 * (`sayilar` karoları, çubuk, öncesi-sonrası, akış, grafik) — bir dergi
 * kapağının alt bandı gibi. Kapak bir duyuru değil, yazının özeti gibi
 * okunuyor. İlk denemede blok metin sütununun içindeydi: sütun 628 piksele
 * uzadı (1440), "Yazıyı Oku" ilk ekranın altına düştü ve yanındaki kadro
 * sütununda üstte ve altta 130'ar piksel boş gömük zemin kaldı; şeritte
 * iki sütun kendi boyunda kalıyor.
 *
 * KÜNYE BAŞLIĞIN HEMEN ALTINDA (tarih, okuma süresi, şirket sayısı). Önce
 * eylemle aynı satırda, kartın dibindeydi: başlıktan ~250 piksel uzakta ve
 * mavi butonun gölgesinde. Üst künye yok (`.claude/rules/arayuz.md` → Ekran
 * Düzeni); başlığa ait bilgi başlığın altına iner.
 *
 * Kadrosu olmayan yazıda (şirketsiz makro yazı) gömük sütun boş kalmıyor:
 * imza bloğu oraya geçiyor, kart yine iki tonlu.
 */
export function LeadStory({
  story,
  cast,
  signature,
  locale,
  t,
}: {
  story: StoryIndexRow;
  cast: CastMember[];
  /** Yazının imza bloğu; yoksa kapak başlık + giriş + kadro. */
  signature?: ArchiveSignature | null;
  locale: Locale;
  t: Dictionary;
}) {
  const total = story.symbols?.length ?? 0;
  const figure = signature ? (
    <StorySignature block={signature.block} series={signature.series} locale={story.locale} scale="cover" />
  ) : null;
  const hasCast = cast.length > 0;

  return (
    <Link
      href={`/mercek/${story.slug}`}
      prefetch
      className={styles.lead}
      data-motion-reveal
    >
      <section className={styles.leadCard} data-has-aside={hasCast || Boolean(figure)}>
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
          <p className={cn("numeral", styles.leadMeta)}>
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
          </p>
          <p className={styles.leadDek} lang={story.locale}>
            {story.dek}
          </p>

          <div className={styles.leadFoot}>
            <span className={styles.leadCta}>
              {t.stories.readStory}
              <ArrowRight weight="bold" size={14} aria-hidden />
            </span>
          </div>
        </div>

        {hasCast ? (
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
        ) : (
          figure && (
            <div className={styles.leadAside} data-figure="">
              {figure}
            </div>
          )
        )}
        {/* Kadro varken imza çizimi kartın dibinde, iki sütunun altında
            boydan boya bir şerit; dar ekranda girişle kadronun arasına
            giriyor (`order`, MercekIndex.module.css → `.leadBand`). */}
        {figure && hasCast && <div className={styles.leadBand}>{figure}</div>}
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
 * AYIN RİTMİ — ay başlığının yanındaki gün şeridi (10 Kasım 2026).
 *
 * Ayın her günü bir tik; yazı olan gün yükseliyor (bir yazı 10, iki 14,
 * üç ve fazlası 18 piksel). "Mercek her gün değil, olay olduğunda yazılır"
 * cümlesi sayfanın dibindeki künyede duruyordu; şerit aynı şeyi veriyle
 * söylüyor ve ay başlığına, yanındaki "17 Yazı" sayısından fazlasını
 * katıyor: yazılar ayın hangi günlerine yığıldı. Kaynak yalnız `eventDate`
 * (kartların zaten bastığı tarih), yeni sorgu yok. Şerit EKRANDAKİ listeden
 * sayıyor (ay başlığındaki sayıyla aynı kural): "Daha Fazla Göster" yarım
 * ayı tamamladıkça dolar.
 *
 * Renk nötr mürekkep: yön ya da etkileşim söylemiyor (mavi/yeşil kuralı).
 * Hareket: dolu tikler tabandan yükselir, soldan sağa 12 ms arayla; ay
 * soldan sağa okunsun diye (`.claude/rules/hareket.md` kataloğunda dikey
 * tik karşılığı yok, keyframes modülde — `MercekIndex.module.css`).
 */
function MonthStrip({
  monthKey,
  stories,
  label,
}: {
  monthKey: string;
  stories: StoryIndexRow[];
  label: string;
}) {
  const [year, month] = monthKey.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const counts = new Map<number, number>();
  for (const story of stories) {
    const day = Number(story.eventDate.slice(8, 10));
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return (
    <span className={styles.strip} role="img" aria-label={label} data-draw="">
      {Array.from({ length: days }, (_, index) => {
        const count = counts.get(index + 1) ?? 0;
        return (
          <i
            key={index}
            data-n={Math.min(count, 3)}
            style={count ? ({ "--i": index } as CSSProperties) : undefined}
          />
        );
      })}
    </span>
  );
}

/**
 * Arşiv, AY AY. Yazılar bir OLAYI anlatıyor ve okuyucu arşivde "geçen ay ne
 * olmuştu" diye geziniyor; 24 kartlık düz ızgarada zaman hiçbir yerde
 * okunmuyordu, her kartın tarihini tek tek okumak gerekiyordu. Ay başlığı
 * (`h3`, yanında o aydaki yazı sayısı) ızgarayı zaman çizelgesine çeviriyor.
 * Gruplama EKRANDAKİ listeden: "Daha Fazla Göster" bir sonraki ayı ekliyor,
 * yarım kalan ay da kendi başlığının altında büyüyor.
 *
 * AYIN İLK YAZISI SATIR BOYU (10 Kasım 2026). 24 eş kart üç kolonda sekiz
 * eş satır kuruyordu: bir kart duvarı. Her ayın en yeni yazısı artık satırı
 * kaplayan yatay kart (metin solda, yazının imza çizimi sağda büyük);
 * kalanı üç kolonlu ızgara. Bilançolar'daki "günün en büyük şirketi geniş,
 * ötekiler ızgara" kalıbıyla aynı aile. Hangi kartın geniş olduğu burada
 * (`data-feature`), ayın SON tek kartınınki CSS'te (`nth-child`; kolon
 * sayısı kırılıma göre değişiyor).
 */
export function ArchiveMonths({
  rows,
  castOf,
  signatureOf,
  locale,
  t,
}: {
  rows: StoryIndexRow[];
  castOf: (story: StoryIndexRow) => CastMember[];
  /** Yoksa ya da yazının imzası yoksa kart bugünkü logo şeridini basar. */
  signatureOf?: (story: StoryIndexRow) => ArchiveSignature | null;
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
      {months.map((month) => {
        const label = monthLabel(month.key, locale);
        return (
          <section key={month.key} className={styles.month} aria-labelledby={`ay-${month.key}`}>
            <div className={styles.monthHead}>
              <h3 id={`ay-${month.key}`} className={styles.monthTitle}>
                {label}
              </h3>
              <MonthStrip
                monthKey={month.key}
                stories={month.stories}
                label={t.stories.monthStripLabel.replace("{month}", label)}
              />
              <span className={cn("numeral", styles.monthCount)}>
                {plural(
                  month.stories.length,
                  t.stories.symbolPanelCountOne,
                  t.stories.symbolPanelCountMany,
                ).replace("{count}", String(month.stories.length))}
              </span>
            </div>
            <div className={styles.grid} data-motion-stagger>
              {month.stories.map((story, index) => (
                <ArchiveCard
                  key={story.slug}
                  story={story}
                  cast={castOf(story)}
                  signature={signatureOf?.(story) ?? null}
                  feature={index === 0}
                  locale={locale}
                  t={t}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Kartın dibindeki kadroda yan yana duran logo; fazlası "+N". */
const FOOT_LOGOS = 3;

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
 * DİPTEKİ KADRO YAN YANA, ÜST ÜSTE DEĞİL (10 Kasım 2026). İmza şeridi
 * gelince kadro kartın dibine 22 piksellik karolarla, 6 piksel bindirilmiş
 * inmişti: canlıda dört-beş logo tek bir leke gibi okunuyordu (1440 ve
 * 390'da bakıldı; hangi şirket olduğu seçilmiyordu). Dipte artık üç logo
 * aralıklı (yazıda tam dört şirket varsa dördüncüsü de logo), fazlası
 * "+N". Bindirilmiş yığın yalnız imzasız kartın şeridinde (md karo) kaldı.
 *
 * Sağdaki rakam ilk şirketin olaydan bugüne getirisi; hesaplanamıyorsa
 * tarihli son kapanış (hafta sonu yazısına uydurma getiri yazılmaz).
 */
function ArchiveCard({
  story,
  cast,
  signature,
  feature,
  locale,
  t,
}: {
  story: StoryIndexRow;
  cast: CastMember[];
  signature: ArchiveSignature | null;
  /** Ayın ilk yazısı: ≥640'ta satır boyu yatay kart. */
  feature: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const total = story.symbols?.length ?? 0;
  /* Yazıda TAM beş şirket varken beşincisi "+1" yerine kendi logosuyla. */
  const shown = cast.slice(0, total === 5 ? 5 : 4);
  const rest = total - shown.length;
  const lead = shown[0];
  const tone = directionOf(lead?.sinceEvent ?? null);
  /* İMZA VARSA ŞERİT ONUN (24 Ekim). Şeridin görseli yazının kendi bloğu
     (gerekçe `lib/story-signature.ts`); logolar ve rakam kartın dibine,
     sembol satırının yerine iniyor — kadro kaybolmuyor, yalnız kartı
     tanıtan şey olmaktan çıkıyor. Minyatür çizilemiyorsa (grafik imzası
     ama seri yok) kart bugünkü düzende kalıyor. */
  const figure = signature ? (
    <StorySignature block={signature.block} series={signature.series} locale={story.locale} />
  ) : null;
  /* RAKAMIN KÜNYESİ HER KARTTA İKİ SATIR (10 Kasım 2026). Son kapanışta
     künye üç satırdı (sembol · Son Kapanış / fiyat / tarih), getiride iki;
     aynı sıradaki kartlarda "Oku" 8 piksel farklı hatta duruyordu (canlı
     1440: 1244 ve 1252). Tarih künyeye girdi ("SPY · 9 Kas Kapanışı"). */
  const reading =
    lead && (lead.sinceEvent !== null || lead.lastClose) ? (
      <span className={styles.reading}>
        <span className={styles.readingCaption}>
          {lead.symbol} ·{" "}
          {lead.sinceEvent !== null
            ? t.stories.sinceEvent
            : t.stories.closeOn.replace("{date}", formatEtDateCompact(lead.lastClose!.date, locale))}
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
      </span>
    ) : null;
  const stack = (
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
  );
  const footShown = cast.slice(0, total === FOOT_LOGOS + 1 ? FOOT_LOGOS + 1 : FOOT_LOGOS);
  const footRest = total - footShown.length;
  const row = (
    <span className={styles.footLogos}>
      {footShown.map((member) => (
        <LogoTile key={member.symbol} symbol={member.symbol} logoUrl={member.logoUrl} size="xs" card />
      ))}
      {footRest > 0 && <span className={cn("numeral", styles.footMore)}>+{footRest}</span>}
    </span>
  );

  return (
    <Link
      href={`/mercek/${story.slug}`}
      prefetch={false}
      className={styles.card}
      data-feature={feature ? "" : undefined}
    >
      <div className={styles.cardBody}>
        {/* h4: sayfa h1 → arşiv h2 → ay h3 → kart. `lang` şart — çevirisi
            olmayan yazı orijinal diliyle sesletilsin. */}
        {/* Kart başlığı düz mürekkep (31 Ekim): degrade manşette ve sayfa başlığında. */}
        <h4 className={styles.cardTitle} data-ink="plain" lang={story.locale}>
          <span className="ink-line">{story.title}</span>
        </h4>
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
        <p className={styles.cardDek} lang={story.locale}>
          {story.dek}
        </p>
      </div>

      {/* ÖNCE BAŞLIK (5 Kasım 2026, sahibinin isteği: "önce başlık gelmeli,
          vurgulu olan o"). Kartın tepesinde veri şeridi duruyordu ve göz
          manşetten önce bir çubuk grafiğe çarpıyordu. Sıra artık okuma
          sırası: manşet → künye (tarih, süre) → özet → yazının imza verisi
          → eylem. Şerit kenardan kenara bant değil, gövdenin içinde gömük
          bir kutu: başlığın altındaki ayrıntı gibi okunuyor. */}
      {figure ? (
        <div className={styles.cardBand} data-signature="">
          {figure}
        </div>
      ) : (
        shown.length > 0 && (
          <div className={styles.cardBand}>
            {stack}
            {reading}
          </div>
        )
      )}

      <div className={styles.cardFoot}>
        {figure && shown.length > 0 ? (
          <span className={styles.footCast}>
            {row}
            {reading}
          </span>
        ) : (
          <span className={cn("numeral", styles.cardSymbols)}>
            {shown.map((member) => member.symbol).join(" · ")}
          </span>
        )}
        <span className={styles.cardCta}>
          {t.guide.cardCta}
          <ArrowRight weight="bold" size={13} aria-hidden />
        </span>
      </div>
    </Link>
  );
}
