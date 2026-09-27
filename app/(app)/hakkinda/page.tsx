import {
  ArrowRight,
  ArrowSquareOut,
  Broadcast,
  Database,
  GithubLogo,
  ShieldCheck,
  ArrowsLeftRight,
} from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress, SectionNav } from "@/components/motion/PremiumMotion";
import { EmbedSnippet } from "@/components/seo/EmbedSnippet";
import { BreadcrumbJsonLd, REPO_URL } from "@/components/seo/JsonLd";
import { PageHeader, Panel, PanelHeader, buttonClass } from "@/components/ui/primitives";
import { getHolidays, getStatus } from "@/lib/data";
import { EMBED_ROUTES, EMBED_THEME_PARAM } from "@/lib/embed";
import { getI18n } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { SESSION_BOUNDS, closeMinutesFor } from "@/lib/market-hours";
import { pageMetadata } from "@/lib/page-meta";
import { clockOf, timePair } from "@/lib/session-clock";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/hakkinda",
  tr: {
    title: "Hakkında ve Metodoloji",
    description:
      "Açılış Zili'ni kim yapıyor, veriler nereden geliyor, yazılar nasıl üretiliyor ve neden ücretsiz. Sitenin çalışma biçiminin açık anlatımı.",
  },
  en: {
    title: "About and Methodology",
    description:
      "Who runs Opening Bell, where the data comes from, how the writing is produced and why it is free. A plain account of how the site works.",
  },
});

const OWNER_URL = "https://ahmetakyapi.com";

/**
 * Gömme kodlarının önerilen çerçeve yüksekliği (piksel). Ölçüldü (28 Eylül,
 * belge yüksekliği, 320/380/480 genişlik): geri sayım 225/218/236; bilanço
 * listesi altı satırla TR 483, EN 320 pikselde 519 (künye satırı ikiye
 * kırılıyor). Tavan en uzun ölçü artı birkaç piksel; kısa kalırsa çerçevenin
 * içinde kaydırma çubuğu çıkıyordu.
 */
const EMBED_HEIGHT = { countdown: 240, earnings: 524 } as const;

/** Üç katmanın simgeleri — sıra `about.layers` ile aynı. */
const LAYER_ICONS = [Broadcast, ArrowsLeftRight, Database] as const;

/** Bölüm gövdesinin iç payı — PanelHeader'ın yatay payıyla aynı hat. */
const BODY = "flex flex-col gap-4 px-4 pb-5 sm:px-5 sm:pb-6";
/** Okuma genişliği: gövde metni satırı ~70 karakterde kırılsın. */
const PROSE = "max-w-[68ch] text-base leading-relaxed text-body";

/**
 * Hakkında ve Metodoloji — sitenin güven sayfası.
 *
 * NEDEN VAR. Site her gün yapay zekâ ile yazılmış metin ve sağlayıcıdan
 * gelen sayı yayımlıyor; okuyucunun "bunu kim yapıyor, bu sayı nereden
 * geliyor, bu yazıyı kim yazdı" sorusunun cevabı README'de ve kod
 * yorumlarındaydı, yani okuyucunun göremeyeceği yerlerde. Arama motorları
 * da (E-E-A-T) aynı soruyu soruyor ve cevabı bir sayfada arıyor.
 *
 * Yazarlık DÜRÜST: metinleri Claude rutinleri yazıyor, sayıları site
 * hesaplıyor, sahibi düzeltiyor. Makale künyelerindeki yazar da bu yüzden
 * bir kişi değil kuruluş (components/seo/JsonLd.tsx).
 *
 * DÜZEN sitenin ekran sırası: başlık, bölüm dizini, paneller; uyarı
 * (Yatırım Tavsiyesi Değildir) en sonda, kendi panelinde. Görsel YOK:
 * sitenin kuralı fotoğrafsız; üç katman bir akış olarak çiziliyor ve
 * "Sitene Ekle" bölümü gerçek parçaları önizleme olarak gösteriyor.
 */
export default async function AboutPage() {
  const { locale, t } = await getI18n();
  const a = t.about;
  const [status, holidays] = await Promise.all([getStatus(), getHolidays()]);
  /* Saatler O GÜNÜN tarihiyle: sabit yazılsaydı ABD yaz saati geçişinde
     sayfa bir saat yanlış söylerdi (CLAUDE.md "Saat kuralı"). */
  const day = status.etDate;
  const open = timePair(day, clockOf(SESSION_BOUNDS.regularOpen), locale).primary;
  const close = timePair(day, clockOf(closeMinutesFor(day, holidays)), locale).primary;

  /* Önizleme GÖRECELİ adresle (aynı köken, her ortamda çalışır), kod
     MUTLAK adresle (başka sitede çalışacak). */
  const embeds = [
    { id: "countdown", name: a.embedCountdown, path: EMBED_ROUTES.countdown, height: EMBED_HEIGHT.countdown },
    { id: "earnings", name: a.embedEarnings, path: EMBED_ROUTES.earnings, height: EMBED_HEIGHT.earnings },
  ].map((embed) => ({
    ...embed,
    preview: withLocale(embed.path, locale),
    src: `${SITE_URL}${withLocale(embed.path, locale)}`,
  }));
  /* Kod `?tema=acik` ile yazılıyor: değer adreste görünür olsun ki gömen
     kişi onu `koyu` yapabileceğini koddan okusun (giriş cümlesi bunu
     söylüyor). `loading="lazy"` sayfanın aşağısındaki çerçeveyi erteler. */
  const snippet = (src: string, name: string, height: number) =>
    `<iframe src="${src}?${EMBED_THEME_PARAM}=acik" title="${name}" width="100%" height="${height}" style="border:0;max-width:480px" loading="lazy"></iframe>`;

  const sections = [
    { id: "kim", label: a.whoTitle },
    { id: "veri", label: a.dataTitle },
    { id: "yazilar", label: a.contentTitle },
    { id: "acik-kaynak", label: a.freeTitle },
    { id: "sitene-ekle", label: a.embedTitle },
  ];

  return (
    <MotionExperience className="mx-auto flex w-full max-w-[1040px] flex-col gap-5">
      <ScrollProgress />
      <BreadcrumbJsonLd locale={locale} items={[{ name: a.title, path: "/hakkinda" }]} />
      <PageHeader eyebrow={a.eyebrow} title={a.title} subtitle={a.intro} />
      <SectionNav items={sections} label={a.title} />

      {/* ---- Kim yapıyor ---- */}
      <Panel id="kim">
        <PanelHeader title={a.whoTitle} />
        <div className={BODY}>
          {a.whoBody.map((paragraph) => (
            <p key={paragraph} className={PROSE}>
              {paragraph}
            </p>
          ))}
          <div className="flex flex-wrap gap-2.5">
            <a
              href={OWNER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ variant: "ghost", size: "md" })}
            >
              {a.whoLink}
              <ArrowSquareOut aria-hidden size={15} />
            </a>
          </div>
        </div>
      </Panel>

      {/* ---- Veri ---- */}
      <Panel id="veri">
        <PanelHeader title={a.dataTitle} />
        <div className={BODY}>
          <p className={PROSE}>{a.dataIntro}</p>
          {/* Kaynak dizini: ad solda, ne verdiği sağda. Satır başına çizgi
              yok (tek hairline listenin üstünde); aralık grubu ayırıyor. */}
          <dl className="grid gap-x-8 gap-y-3 border-t border-line pt-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            {a.sources.map((source) => (
              <div key={source.name} className="contents">
                <dt className="font-semibold text-strong">{source.name}</dt>
                <dd className="-mt-2 text-small leading-relaxed text-body sm:mt-0 sm:text-base">
                  {source.what}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Üç katman: bir AKIŞ, üç eşit kart değil. Sıra anlam taşıyor ve
            oklar onu söylüyor; dar ekranda akış dikey. */}
        <div className={cn(BODY, "border-t border-line-soft pt-5")}>
          <h3 className="text-read font-bold text-strong">{a.layersTitle}</h3>
          <p className={PROSE}>{a.layersIntro}</p>
          <ol className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
            {a.layers.map((layer, index) => {
              const Icon = LAYER_ICONS[index] ?? Database;
              return (
                <li key={layer.title} className="contents">
                  {index > 0 && (
                    <ArrowRight
                      aria-hidden
                      size={18}
                      className="hidden self-center text-muted md:block"
                    />
                  )}
                  <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-sunken p-4">
                    <Icon aria-hidden size={22} weight="duotone" className="text-primary" />
                    <p className="font-semibold text-strong">{layer.title}</p>
                    <p className="text-small leading-relaxed text-body">{layer.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={cn(BODY, "border-t border-line-soft pt-5")}>
          <h3 className="text-read font-bold text-strong">{a.stampTitle}</h3>
          {a.stampBody.map((paragraph) => (
            <p key={paragraph} className={PROSE}>
              {paragraph}
            </p>
          ))}
          <h3 className="mt-2 text-read font-bold text-strong">{a.timeTitle}</h3>
          <p className={cn(PROSE, "numeral")}>
            {a.timeBody.replace("{open}", open).replace("{close}", close)}
          </p>
        </div>
      </Panel>

      {/* ---- İçerik üretimi ---- */}
      <Panel id="yazilar">
        <PanelHeader title={a.contentTitle} />
        <div className={BODY}>
          {a.contentBody.map((paragraph) => (
            <p key={paragraph} className={PROSE}>
              {paragraph}
            </p>
          ))}
          <div className="flex flex-col gap-2.5 border-t border-line-soft pt-4">
            <h3 className="text-read font-bold text-strong">{a.rhythmTitle}</h3>
            <ul className="flex flex-wrap gap-2">
              {a.rhythm.map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-line bg-surface-elevated px-3 py-1.5 text-small text-body"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      {/* ---- Ücretsiz, açık kaynak, gizlilik ---- */}
      <Panel id="acik-kaynak">
        <PanelHeader title={a.freeTitle} />
        <div className={BODY}>
          <p className={PROSE}>{a.freeBody}</p>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ variant: "ghost", size: "md" })}
            >
              <GithubLogo aria-hidden size={16} weight="fill" />
              {a.repoLink}
            </a>
            <a
              href={`${REPO_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ variant: "quiet", size: "md" })}
            >
              {a.issuesLink}
            </a>
          </div>
        </div>
        <div className={cn(BODY, "border-t border-line-soft pt-5")}>
          <h3 className="flex items-center gap-2 text-read font-bold text-strong">
            <ShieldCheck aria-hidden size={20} weight="duotone" className="text-primary" />
            {a.privacyTitle}
          </h3>
          <p className={PROSE}>{a.privacyBody}</p>
          <Link
            href="/kvkk"
            className="inline-flex min-h-11 w-fit items-center gap-1.5 font-semibold text-primary sm:min-h-8"
          >
            {a.privacyLink}
            <ArrowRight aria-hidden size={14} />
          </Link>
        </div>
      </Panel>

      {/* ---- Sitene ekle ----
          Önizlemeler GERÇEK parçalar, ekran görüntüsü değil: çerçevenin
          içinde gömen sitenin göreceği sayfanın kendisi çiziliyor. */}
      <Panel id="sitene-ekle">
        <PanelHeader title={a.embedTitle} />
        <div className={BODY}>
          <p className={PROSE}>{a.embedIntro}</p>
          <div className="grid gap-6 lg:grid-cols-2">
            {embeds.map((embed) => (
              <div key={embed.id} className="flex min-w-0 flex-col gap-3">
                <h3 className="text-read font-bold text-strong">{embed.name}</h3>
                <iframe
                  src={embed.preview}
                  title={a.embedPreviewLabel.replace("{name}", embed.name)}
                  height={embed.height}
                  loading="lazy"
                  className="w-full max-w-[480px] border-0"
                />
                <EmbedSnippet
                  code={snippet(embed.src, embed.name, embed.height)}
                  label={a.embedCodeLabel.replace("{name}", embed.name)}
                  copyLabel={a.embedCopy}
                  copiedLabel={a.embedCopied}
                />
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* ---- Uyarı: panelin içinde, kendi başlığıyla ---- */}
      <Panel>
        <PanelHeader title={a.disclaimerTitle} />
        <div className={BODY}>
          <p className={PROSE}>{a.disclaimerBody}</p>
        </div>
      </Panel>
    </MotionExperience>
  );
}
