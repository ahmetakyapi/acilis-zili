import { withLocale } from "@/lib/i18n/routing";
import styles from "@/components/today/TodayExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowRight, ArrowUpRight, ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import { GlyphTile } from "@/components/article/GlyphTile";
import { Panel, PanelLink, Skeleton, LogoTile } from "@/components/ui/primitives";
import { getStories, getStoryBySlug, getSymbolNames } from "@/lib/data";
import { logoSrc } from "@/lib/logos";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { formatEtDateLong, formatEtDateCompact } from "@/lib/utils";
import { StoryFigure, storyFigureOf } from "@/components/stories/StoryFigure";

/* ==========================================================================
   Mercek — ana sayfanın okuma girişi
   ========================================================================== */

/**
 * Son mercek yazıları — manşet + üç satır.
 *
 * NEDEN LİSTE DEĞİL MANŞET. Bu blok eskiden dört başlıktan ibaret bir
 * listeydi ve yanındaki analiz paneliyle aynı ağırlıktaydı; okuyucu
 * başlıklara bakıp geçiyordu çünkü hiçbiri ne anlattığını söylemiyordu. En
 * yeni yazı artık manşet: giriş cümlesi okunuyor, yazının kahramanı
 * şirketlerin logoları görünüyor, tarih ve okuma süresi künyede. Arkasındaki
 * üç satır arşivin devamı — onlar liste kalıyor, çünkü işleri "daha var"
 * demek.
 *
 * LOGOLAR /mercek İLE AYNI KAYNAKTAN. Yazıların fotoğrafı yok ve olmayacak;
 * elimizdeki tek gerçek görsel şirket logoları (`symbols.logo_url`). Blok
 * onları manşetin künyesinde kullanıyor, arşiv kartlarındaki şeridin
 * sıkıştırılmış hâli gibi.
 *
 * Yazı yoksa blok kaybolmuyor, keşif karolarına düşüyor: hiç içerik
 * yazılmamış bir sitede ana sayfanın okuma girişi büsbütün yok olmasın.
 */
/** Manşet kadrosunda en çok kaç logo — fazlası "+n" olarak sayılır. */
const STORY_CAST_MAX = 4;

export async function StoriesSpotlight({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const stories = await getStories(locale, 4);

  if (stories.length === 0) return <ReadingDoors t={t} />;

  const [lead, ...rest] = stories;

  /* GÖRSEL YAZININ KENDİNDEN GELİYOR — gerekçesi StoryFigure'da. Manşetin
     gövdesi bunun için ayrıca okunuyor: liste sorgusu `body_md` taşımıyor
     (kırk satırlık arşivin tamamını gövdeleriyle çekmek için sebep yok),
     yalnızca manşet için tek satırlık ikinci bir sorgu atılıyor. */
  const full = await getStoryBySlug(lead.slug, locale);
  const figure = storyFigureOf(full?.bodyMd, full?.locale ?? locale);

  /* LOGOLAR ARTIK GERÇEKTEN BASILIYOR (26 Eylül). Yukarıdaki not manşette
     logoların göründüğünü söylüyordu ama kod yalnızca metin basıyordu;
     blok "çok düz yazı" gibi okunuyordu (ekran görüntüsüyle bildirildi).
     Manşetin kadrosu en çok dört logo, satırlar ilk iki sembolün logosunu
     taşıyor. Adlar ve adresler tek sorguda: manşet ve satırların
     sembolleri birleşik bir listeyle soruluyor. */
  const leadSymbols = (lead.symbols ?? []).slice(0, STORY_CAST_MAX);
  const castMeta = await getSymbolNames([
    ...leadSymbols,
    ...rest.flatMap((story) => (story.symbols ?? []).slice(0, 2)),
  ]);
  /* KAROYU YALNIZCA LOGOSU OLAN ALIR (26 Eylül). Yazının kahramanı çoğu
     zaman bir fon (SPY, USO) ve fonların logosu yok: karo sembolün ilk iki
     harfine düşüyordu ("SP", "US") ve manşetin en görünür yeri iki soluk
     harf kutusuydu. Karo artık yalnızca gerçek bir logo varsa basılıyor;
     sembollerin hepsi yanındaki künye satırında yazılı kalıyor. */
  const leadCast = leadSymbols.filter((symbol) => logoSrc(symbol, castMeta[symbol]?.logoUrl));
  const leadMore = (lead.symbols?.length ?? 0) - leadSymbols.length;

  return (
    <section className={styles.storySpotlight}>
      {/* Başlık şeridi panel başlıklarıyla aynı ölçüde: bloğu ayıran şey
          başlığın boyu değil, altındaki manşet ve eğri. Cesaret TEK yerde
          harcanıyor.
          Başlık öteki panel başlıkları gibi sıkı degradede (24 Eylül,
          sahibinin isteği: bütün başlıklar aynı mavi tonda). */}
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <h2 className="text-read font-bold text-strong">
          {t.today.latestStories}
        </h2>
        <PanelLink href="/mercek">{t.common.showAll}</PanelLink>
      </div>

      <Link
        href={withLocale(`/mercek/${lead.slug}`, locale)}
        prefetch={false}
        className={`${styles.storyLead} group block border-t border-primary-faint px-4 py-5 transition-colors hover:bg-primary-tint sm:px-5`}
      >
        {/* MOBİLDE ÖNCE MANŞET, SONRA GÖRSEL.
            Bir süre tersiydi (`flex-col-reverse`): telefonda önce blok
            görülsün, ölçü kartlarıyla dolu ekranda duraklatan şey o olsun
            diye. Ekranda karşılığı başka çıktı — okuyucu bir kutu dolusu
            rakamla karşılaşıp neyin rakamı olduğunu ancak altındaki başlığı
            okuyunca anlıyordu; blok başlığın İLLÜSTRASYONU, tersi değil.
            DOM sırası zaten metin önceydi, yani ekran okuyucu için de
            değişen bir şey yok. Geniş ekranda metin solda, blok sağda:
            manşet dar kolonda üç satıra kırılıyor, geniş kolonda bir
            bakışta okunuyor. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-7">
          <div className="min-w-0 flex-1">
            {/* KADRO: yazının kahramanı şirketler, logolarıyla. Karolar üst
                üste biniyor ve blok görünüme girince sırayla iniyor
                (`data-motion-stagger`); üzerine gelince aralanıyorlar.
                Tek şirketse yanında adı yazıyor, birden çoksa semboller. */}
            {leadSymbols.length > 0 && (
              <div className={styles.storyCast}>
                {/* Logosu olan yoksa (yalnız fonlar) künyenin başında bir
                    piyasa ikonu: satır yalnız kalmasın, karo dili sürsün. */}
                {leadCast.length === 0 && (
                  <span aria-hidden className={styles.storyCastFund}>
                    <ChartLineUp size={22} weight="duotone" />
                  </span>
                )}
                {leadCast.length > 0 && <span className={styles.storyCastLogos} data-motion-stagger>
                  {leadCast.map((symbol) => (
                    <LogoTile
                      key={symbol}
                      symbol={symbol}
                      logoUrl={castMeta[symbol]?.logoUrl}
                      size="lg"
                      className={styles.storyCastTile}
                    />
                  ))}
                  {leadMore > 0 && (
                    <span className={`numeral ${styles.storyCastMore}`}>+{leadMore}</span>
                  )}
                </span>}
                <span className="min-w-0">
                  <span className="numeral block truncate text-small font-bold tracking-[0.02em] text-strong">
                    {leadSymbols.join(" · ")}
                  </span>
                  {leadSymbols.length === 1 && castMeta[leadSymbols[0]]?.name && (
                    <span className="block truncate text-tiny text-muted">
                      {castMeta[leadSymbols[0]].name}
                    </span>
                  )}
                </span>
              </div>
            )}
            <p className="numeral flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-tiny text-muted">
              <span className="text-base font-semibold text-body">
                {formatEtDateLong(lead.eventDate, locale)}
              </span>
              {lead.readMinutes ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {lead.readMinutes} {t.stories.readMinutes}
                  </span>
                </>
              ) : null}
              {/* Çevirisi olmayan yazı orijinal diliyle listeleniyor; rozet
                  bunu tıklamadan önce söylüyor — /mercek ile aynı kural. */}
              {lead.locale !== locale && (
                <span className="plate ml-1 text-nano">
                  {lead.locale.toUpperCase()}
                </span>
              )}
            </p>

            {/* MANŞET SAYFANIN İKİNCİ EN BÜYÜK METNİ. Blok bir süre 19
                puntoyla yazıldı ve çevresindeki panel başlıklarından
                ayrışmıyordu: aynı ağırlıkta bir kutu daha gibi duruyordu.
                Ölçü farkı, bloğun "burada okunacak bir şey var" demesinin en
                ucuz ve en sessiz yolu.
                MAVİ DEGRADE, SATIR SATIR (24 Eylül): bir dönem düz
                mürekkepteydi çünkü degrade kutu boyunca yayılıp ikinci
                satırı başka tonda başlatıyordu; `data-ink="lines"` her
                satıra kendi degradesini veriyor (globals.css). */}
            <h3 data-ink="lines" className="mt-2.5 text-heading font-bold leading-[1.14] tracking-[-0.03em] text-strong sm:text-subdisplay">
              <span className="ink-line">{lead.title}</span>
            </h3>
            <p className="mt-3 line-clamp-3 max-w-[62ch] text-base leading-[21px] text-body sm:text-read sm:leading-[24px]">
              {lead.dek}
            </p>

            <p className="mt-4 inline-flex items-center gap-1.5 border-t border-primary-faint pt-3.5 text-small font-semibold text-primary">
              {t.guide.cardCta}
              <ArrowRight
                weight="bold"
                size={12}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </p>
          </div>

          {figure && (
            <StoryFigure
              block={figure}
              locale={full?.locale ?? locale}
              className={`${styles.storyFigure} lg:w-[292px] lg:shrink-0`}
            />
          )}
        </div>
      </Link>

      {rest.length > 0 && (
        <ul className="border-t border-primary-faint bg-surface-solid" data-motion-stagger>
          {rest.map((story, index) => (
            <li
              key={story.slug}
              className="border-t border-line-soft first:border-t-0"
            >
              <Link
                href={withLocale(`/mercek/${story.slug}`, locale)}
                prefetch={false}
                className={styles.storyRow}
              >
                {/* Numara yerine yazının şirketi: ilk sembolün logosu,
                    ikinci sembol varsa köşesine binen küçük karo. Sembolü
                    olmayan yazı (makro, politika) sıra numarasını korur. */}
                {story.symbols && story.symbols.length > 0 && logoSrc(story.symbols[0], castMeta[story.symbols[0]]?.logoUrl) ? (
                  <span className={styles.storyRowLogo} aria-hidden>
                    <LogoTile
                      symbol={story.symbols[0]}
                      logoUrl={castMeta[story.symbols[0]]?.logoUrl}
                      size="md"
                    />
                    {story.symbols[1] && logoSrc(story.symbols[1], castMeta[story.symbols[1]]?.logoUrl) && (
                      <LogoTile
                        symbol={story.symbols[1]}
                        logoUrl={castMeta[story.symbols[1]]?.logoUrl}
                        size="xs"
                        className={styles.storyRowLogoSecond}
                      />
                    )}
                  </span>
                ) : (
                  <span className={styles.storyNumber} aria-hidden>{String(index + 2).padStart(2, "0")}</span>
                )}
                <div className={styles.storyRowCopy}>
                  <h4 lang={story.locale}>{story.title}</h4>
                  {story.dek && <p lang={story.locale}>{story.dek}</p>}
                </div>
                {/* Semboller başlığın yanında bir künye olarak kalır. Mobilde
                    açıklama tam genişliği kullanır; künye alt satıra geçer. */}
                <div className={styles.storyRowMeta}>
                  <span className="numeral">{formatEtDateCompact(story.eventDate, locale)}</span>
                  {story.symbols && story.symbols.length > 0 && <span>{story.symbols.slice(0, 2).join(" · ")}</span>}
                  {story.locale !== locale && <span>{story.locale.toUpperCase()}</span>}
                  <ArrowUpRight size={15} aria-hidden />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Keşif karoları — yalnızca hiç yazı yokken.
 *
 * Sitenin ilk günlerindeki hâl: arşiv boşken ana sayfada okuma girişinin
 * büsbütün kaybolmaması için Mercek bloğunun yerine geçiyor.
 */
function ReadingDoors({ t }: { t: Dictionary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        { href: "/mercek", glyph: "◎", title: t.stories.title, hint: t.stories.subtitle },
        { href: "/rehber", glyph: "?", title: t.guide.title, hint: t.guide.subtitle },
      ].map((entry) => (
        <Link key={entry.href} href={entry.href}>
          <Panel className="panel-hover flex h-full items-start gap-3.5 p-4 sm:p-5">
            <GlyphTile glyph={entry.glyph} size={44} />
            <span className="min-w-0">
              <span className="display-ink display-ink-tight block w-fit text-read font-bold">
                {entry.title}
              </span>
              <span className="mt-1 block text-small leading-[19px] text-body">
                {entry.hint}
              </span>
            </span>
          </Panel>
        </Link>
      ))}
    </div>
  );
}

/**
 * Mercek manşetinin yer tutucusu.
 *
 * Bu blok bir liste paneli değil: başlık şeridi, altında manşet + eğri
 * ikilisi (mobilde alt alta, `lg`den itibaren yan yana) ve en altta üç
 * satırlık kuyruk. Bu yüzden `PanelSkeleton` yerine kendi düzenini taklit
 * ediyor — yükseklik yazılmıyor, aynı sarma kurallarından doğuyor.
 * Ölçüldü: gerçek blok mobilde 699, geniş ekranda 442 piksel; eskiden ikisi
 * için de 256 piksel ayrılıyordu.
 */
export function SpotlightSkeleton() {
  return (
    <section className="overflow-hidden rounded-xl border border-primary-faint bg-(--premium-surface)">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <div className="border-t border-primary-faint px-4 py-5 sm:px-5">
        <div className="flex flex-col-reverse gap-5 lg:flex-row lg:items-start lg:gap-7">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2.5 h-7 w-full" />
            <Skeleton className="mt-2 h-7 w-4/5" />
            <Skeleton className="mt-3 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-11/12" />
            <Skeleton className="mt-2 h-3.5 w-2/3" />
            <Skeleton className="mt-4 h-3 w-28" />
          </div>
          <Skeleton className="h-[168px] w-full rounded-lg lg:w-[292px] lg:shrink-0" />
        </div>
      </div>
      <div className="border-t border-primary-faint bg-surface-solid">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-t border-line-soft px-4 py-3.5 first:border-t-0 sm:px-5"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
