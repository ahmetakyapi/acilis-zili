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
import { StoryFigure, storyFigureOf, type StoryFigureBlock } from "@/components/stories/StoryFigure";

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
/** Arşivde her zaman görünen satır; fazlası doldurucunun yedeği (aşağıda). */
const ARCHIVE_BASE = 2;

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
  const castMeta = await getSymbolNames([
    ...leadCastSymbols(lead),
    ...rest.flatMap((story) => (story.symbols ?? []).slice(0, 2)),
  ]);

  return (
    <StoriesSpotlightView
      stories={stories}
      figure={figure}
      figureLocale={full?.locale ?? locale}
      castMeta={castMeta}
      locale={locale}
      t={t}
    />
  );
}

type SpotlightStory = Awaited<ReturnType<typeof getStories>>[number];
type SpotlightCastMeta = Awaited<ReturnType<typeof getSymbolNames>>;

/* Tek artan sembol "+1" çipi değil, kendisi: çip bir karo kadar yer
   kaplıyor (44 piksel), beşinci karo kadroyu büyütmüyor (28 Eylül). */
function leadCastSymbols(lead: SpotlightStory): string[] {
  const leadCount = lead.symbols?.length ?? 0;
  return (lead.symbols ?? []).slice(0, leadCount === STORY_CAST_MAX + 1 ? leadCount : STORY_CAST_MAX);
}

/**
 * Bloğun görünümü — veri yükleyiciden ayrı, saf (8 Kasım). Yükleyici
 * yazıları, manşetin gövde bloğunu ve sembol künyelerini soruyor; bu
 * bileşen yalnız çiziyor. Ayrım, bloğun veritabanı olmadan sahte veriyle
 * ölçülebilmesi için (yerleşim kararları ölçümle verilir — CLAUDE.md).
 */
function StoriesSpotlightView({
  stories,
  figure,
  figureLocale,
  castMeta,
  locale,
  t,
}: {
  stories: SpotlightStory[];
  figure: StoryFigureBlock | null;
  figureLocale: string;
  castMeta: SpotlightCastMeta;
  locale: Locale;
  t: Dictionary;
}) {
  const [lead, ...rest] = stories;
  const leadSymbols = leadCastSymbols(lead);
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
          sahibinin isteği: bütün başlıklar aynı mavi tonda).
          SINIF GERÇEKTEN PanelHeader'IN (6 Kasım): yorum degrade diyordu
          ama başlık 14 puntoda düz mürekkepteydi — sağ kolondaki "Dünya
          Piyasaları" 16 puntoda degradeyken bu blok bir basamak sönük
          kalıyordu. Ölçü ve dolgu artık `PanelHeader` (tone="title") ile
          birebir: 16 punto, sıkı degrade, `py-4`. */}
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 className="display-ink display-ink-tight w-fit text-lead font-bold tracking-[-0.015em]">
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
            {/* MANŞET SAYFANIN İKİNCİ EN BÜYÜK METNİ. Blok bir süre 19
                puntoyla yazıldı ve çevresindeki panel başlıklarından
                ayrışmıyordu: aynı ağırlıkta bir kutu daha gibi duruyordu.
                Ölçü farkı, bloğun "burada okunacak bir şey var" demesinin en
                ucuz ve en sessiz yolu.
                MAVİ DEGRADE, SATIR SATIR (24 Eylül): bir dönem düz
                mürekkepteydi çünkü degrade kutu boyunca yayılıp ikinci
                satırı başka tonda başlatıyordu; `data-ink="lines"` her
                satıra kendi degradesini veriyor (globals.css). */}
            <h3 data-ink="lines" className="text-heading font-bold leading-[1.14] tracking-[-0.03em] text-strong sm:text-subdisplay">
              <span className="ink-line">{lead.title}</span>
            </h3>
            <p className="numeral mt-2.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-tiny text-muted">
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
            <p className="mt-3 line-clamp-3 max-w-[62ch] text-base leading-[21px] text-body sm:text-read sm:leading-[24px]">
              {lead.dek}
            </p>

            {/* ÖNCE MANŞET (5 Kasım 2026, sahibinin isteği). Kadro manşetin
                üstündeydi ve göz başlıktan önce logolara çarpıyordu. Sıra
                Mercek kartlarıyla aynı: manşet → tarih → özet; kadro ve
                eylem en altta, aynı satırda (telefonda kadro üstte, hap
                altta). */}
            {/* KADRO VE EYLEM AYNI DİPTE (8 Kasım). Eylem 31 Ekim'den beri
                açık mavi bir haptı; sahibi: "çok saçma ve kötü durmuş" —
                kapsül kadronun karşısında, metnin altındaki boşlukta hiçbir
                şeye bağlı olmadan yüzüyordu. Bütün kart zaten bağlantı; ayrı
                buton yalnız "buradan okunur" demek için vardı. Şimdi kadro
                ve dolgusuz mavi "Yazıyı Oku" hairline'la ayrılmış tek dipte,
                aynı hatta; karta gelince ok ilerliyor. */}
            <div className={styles.storyLeadFoot}>
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
              <span className={styles.storyLeadAction}>
                {t.stories.readStory}
                <ArrowRight weight="bold" size={13} aria-hidden />
              </span>
            </div>
          </div>

          {figure && (
            <StoryFigure
              block={figure}
              locale={figureLocale}
              className={`${styles.storyFigure} lg:w-[292px] lg:shrink-0`}
            />
          )}
        </div>

      </Link>

      {rest.length > 0 && (
        /* TELEFONDA İKİ SATIR (28 Eylül). Blok 390'da 1.119, 360'ta 1.134
           piksel ölçüldü; manşet ve eğri kalıyor, üçüncü arşiv satırı
           telefonda (≤767) gizleniyor (`.storyArchive`). Kalanlara giden
           yol listenin DİBİNDE, yalnızca telefonda: başlıktaki "Tümünü
           Gör" iki ekran yukarıda kalıyor. Masaüstünde DOM ve görünüm
           aynı; blok ana kolonda ve kolon dengesi ondan etkilenmiyor
           (FillColumn yalnızca ≥1280'de çalışıyor — 10 Kasım gecesine dek
           ≥1024 —, ölçüldü).
           ÜÇÜNCÜ SATIR YEDEK (10 Kasım gecesi). Mercek artık sol kolonun
           alt parçasının sonunda ve sol kolon 1024'te (o gece iki kolonlu;
           düzen turundan beri 1024–1279 tablet düzeninde) sağdan uzun
           kalıyordu: kaydırmalı ızgarada fark sağ parçaların ARASINDA 84
           piksellik boşluk olarak açılıyordu (gerçek sayfa + sahte
           sağlayıcı; sağın yedekleri tükenmişti). Satır `hidden` +
           `data-fill`: geniş ekranda yer varsa doldurucu açıyor, yoksa
           kolon onsuz kısalıyor. JS kapalıyken iki satır, telefonla aynı. */
        <ul className={`${styles.storyArchive} border-t border-primary-faint bg-surface-solid`} data-motion-stagger>
          {rest.map((story, index) => (
            <li
              key={story.slug}
              className="border-t border-line-soft first:border-t-0"
              data-fill={index >= ARCHIVE_BASE ? "" : undefined}
              hidden={index >= ARCHIVE_BASE}
            >
              <Link
                href={withLocale(`/mercek/${story.slug}`, locale)}
                prefetch={false}
                className={styles.storyRow}
              >
                {/* Numara yerine yazının şirketi. Sembolü olmayan yazı
                    (makro, politika) sıra numarasını korur.
                    İKİ LOGO ALT ALTA, EŞİT BOYDA (8 Kasım). İkinci sembol
                    ilkinin köşesine binen 22 piksellik bir karoydu ve
                    birincinin üçte birini örtüyordu (ölçüldü: 40'lık ORCL
                    karosunun köşesine MSFT 14×15 piksel biniyordu) — sahibi:
                    "çok fazla iç içe girmesine gerek yok". Yan yana dizmek
                    sütunu iki karo genişliğine çıkarıp tek logolu ve
                    numaralı satırların başlığını sağa itiyordu; alt alta
                    dizince sütun her satırda tek karo genişliğinde kalıyor
                    ve bütün başlıklar aynı x'te başlıyor. Numara da aynı
                    ölçüde, gömük zeminli bir karo: logosuz satırın işareti
                    logolu satırınkiyle aynı kutuya oturuyor. */}
                {story.symbols && story.symbols.length > 0 && logoSrc(story.symbols[0], castMeta[story.symbols[0]]?.logoUrl) ? (
                  <span className={styles.storyRowLogo} aria-hidden>
                    {story.symbols.slice(0, 2)
                      .filter((symbol, at) => at === 0 || logoSrc(symbol, castMeta[symbol]?.logoUrl))
                      .map((symbol) => (
                        <LogoTile
                          key={symbol}
                          symbol={symbol}
                          logoUrl={castMeta[symbol]?.logoUrl}
                          size="lg"
                          className={styles.storyRowTile}
                        />
                      ))}
                  </span>
                ) : (
                  <span className={`numeral ${styles.storyNumber}`} aria-hidden>{String(index + 2).padStart(2, "0")}</span>
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
      {rest.length > ARCHIVE_BASE && (
        <Link
          href={withLocale("/mercek", locale)}
          prefetch={false}
          className={styles.storyAllLink}
        >
          {t.today.allStories}
          <ArrowRight weight="bold" size={13} aria-hidden />
        </Link>
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
            <Skeleton className="h-7 w-full" />
            <Skeleton className="mt-2 h-7 w-4/5" />
            <Skeleton className="mt-3 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-11/12" />
            <Skeleton className="mt-2 h-3.5 w-2/3" />
          </div>
          <Skeleton className="h-[208px] w-full rounded-lg lg:w-[292px] lg:shrink-0" />
        </div>
        {/* Künye ve eylem dibi — gerçek bloktaki gibi metnin ve rakamların
            altında (8 Kasım). */}
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-line-soft pt-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="border-t border-primary-faint bg-surface-solid">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            /* Telefonda gerçek blokla aynı: iki satır. */
            className={`flex items-center gap-3 border-t border-line-soft px-4 py-3.5 first:border-t-0 sm:px-5 ${i === 2 ? "max-md:hidden" : ""}`}
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
