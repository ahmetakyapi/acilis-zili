import { PageShare } from "@/components/article/PageShare";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  ArrowsLeftRight,
  Broadcast,
  Calculator,
  Code,
  Database,
  Gift,
  GithubLogo,
  Monitor,
  Prohibit,
  Robot,
  SealCheck,
  ShieldCheck,
  UserCheck,
} from "@phosphor-icons/react/dist/ssr";
import { FlowReveal } from "@/components/about/FlowReveal";
import styles from "@/components/about/About.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { HeroAccent } from "@/components/motion/HeroAccent";
import { MotionExperience, ScrollProgress, SectionNav } from "@/components/motion/PremiumMotion";
import { EmbedSnippet } from "@/components/seo/EmbedSnippet";
import { BreadcrumbJsonLd, REPO_URL } from "@/components/seo/JsonLd";
import { Panel, PanelHeader, buttonClass } from "@/components/ui/primitives";
import { getHolidays, getStatus } from "@/lib/data";
import { EMBED_ROUTES, EMBED_THEME_PARAM } from "@/lib/embed";
import { getI18n } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { SESSION_BOUNDS, closeMinutesFor } from "@/lib/market-hours";
import { pageMetadata } from "@/lib/page-meta";
import { clockOf, sessionWindows, timePair, type SessionWindow } from "@/lib/session-clock";
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
/** İlkelerin simgeleri — sıra `about.principles` ile aynı. */
const PRINCIPLE_ICONS = [Prohibit, Gift, Code, SealCheck] as const;
/** Yazı akışının simgeleri — sıra `about.contentSteps` ile aynı. */
const CONTENT_ICONS = [Calculator, Robot, ShieldCheck, UserCheck] as const;

/** Günün dakikası; seans şeridi bunun yüzdesiyle çiziliyor. */
const DAY_MINUTES = 24 * 60;
/** Şeridin altındaki saat çentikleri (dakika). */
const CLOCK_TICKS = [0, 6, 12, 18, 24].map((hour) => hour * 60);
/** Şeridin sağ ucu: `clockOf` 24:00'ı 00:00'a sarıyor. */
const DAY_END_LABEL = "24:00";

/** Bölüm gövdesinin iç payı — PanelHeader'ın yatay payıyla aynı hat. */
const BODY = "flex flex-col gap-4 px-4 pb-5 sm:px-5 sm:pb-6";
/** Okuma genişliği: gövde metni satırı ~70 karakterde kırılsın. */
const PROSE = "max-w-[68ch] text-base leading-relaxed text-body";

/** "16:30" → 990. */
function minutesOf(clock: string): number {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

type Segment = { key: string; left: number; width: number };

/**
 * Bir pencereyi şeritte yüzdelere çevirir. Gece yarısını aşan pencere
 * (Türkiye saatiyle kapanış sonrası 23:00'ten 03:00'e) iki parçaya bölünür.
 */
function segmentsOf(key: string, from: string, to: string): Segment[] {
  const start = minutesOf(from);
  const end = minutesOf(to);
  const pct = (minutes: number) => (minutes / DAY_MINUTES) * 100;
  if (end > start) return [{ key, left: pct(start), width: pct(end - start) }];
  return [
    { key, left: pct(start), width: pct(DAY_MINUTES - start) },
    { key: `${key}-wrap`, left: 0, width: pct(end) },
  ];
}

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
 * ANLATIM ÇİZİMLE (28 Eylül). Sayfa beş metin panelinden ibaretti ve
 * güvenin asıl kanıtı (sayının hangi kapılardan geçtiği, yazının kimin
 * elinden geçtiği) paragrafların içinde kayboluyordu. Şimdi:
 *
 *   - Kapağın sağında sitenin var olma nedeni, ölçülmüş olarak: bugünün
 *     tarihiyle hesaplanmış seans saatleri ve günün 24 saatine yerleşmiş
 *     seans pencereleri. Sabit bir süs değil; ABD yaz saatiyle kayıyor.
 *   - İlkeler iri tipografiyle, kimlik bölümünün hemen ardından.
 *   - Veri ve yazı üretimi ADIM ADIM açılan akışlar (`FlowReveal`): kaynak →
 *     üç kapı → ekrandaki damga; site hesaplar → rutin yazar → yazma katmanı
 *     denetler → sahip düzeltir.
 *
 * Çapalar (#kim, #veri, #yazilar, #acik-kaynak, #sitene-ekle) aynı kaldı;
 * yalnızca sıra değişti: ilkeler veriden önce, çünkü okuyucunun ilk sorusu
 * "bu site bana bir şey satıyor mu".
 */
export default async function AboutPage() {
  const { locale, t } = await getI18n();
  const a = t.about;
  const [status, holidays] = await Promise.all([getStatus(), getHolidays()]);
  /* Saatler O GÜNÜN tarihiyle: sabit yazılsaydı ABD yaz saati geçişinde
     sayfa bir saat yanlış söylerdi (CLAUDE.md "Saat kuralı"). */
  const day = status.etDate;
  const closeMinutes = closeMinutesFor(day, holidays);
  const open = timePair(day, clockOf(SESSION_BOUNDS.regularOpen), locale);
  const close = timePair(day, clockOf(closeMinutes), locale);
  /* Şerit okuyucunun BİRİNCİL saatiyle: pencere dizesi "16:30–23:00". */
  const windowLabel = { pre: a.clockPre, regular: a.clockRegular, after: a.clockAfter } as const;
  const windows = sessionWindows(day, locale, closeMinutes).filter(
    (window): window is SessionWindow & { key: keyof typeof windowLabel } => window.key !== "overnight",
  );
  const segments = windows.flatMap((window) => {
    const [from, to] = window.primary.split(/[–-]/);
    return segmentsOf(window.key, from, to).map((segment) => ({ ...segment, kind: window.key }));
  });

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
    { id: "acik-kaynak", label: a.freeTitle },
    { id: "veri", label: a.dataTitle },
    { id: "yazilar", label: a.contentTitle },
    { id: "sitene-ekle", label: a.embedTitle },
  ];
  const [whoLede, ...whoRest] = a.whoBody;

  return (
    <MotionExperience className={cn("mx-auto flex w-full max-w-[1040px] flex-col gap-5", styles.about)}>
      <ScrollProgress />
      <BreadcrumbJsonLd locale={locale} items={[{ name: a.title, path: "/hakkinda" }]} />

      <header className={`${styles.hero} page-frame`}>
        <HeroAccent />
        <div className={`${styles.heroCopy} page-heading-copy`}>
          <div className="page-title-row">
            <h1 className="display-ink">{a.title}</h1>
            <div className="page-title-actions"><PageShare compactOnMobile align="right" path="/hakkinda" title={a.title} locale={locale} t={t} /></div>
          </div>
          <p>{a.intro}</p>
        </div>
        {/* SEANS SAATİ KAPAKTA. Sitenin var olma nedeni New York saatini
            Türkiye saatine doğru çevirmek; kapağın görseli o çevirinin
            bugünkü sonucu. Pencereler `sessionWindows`tan, yarım günde
            kapanış erkene çekiliyor. */}
        <figure className={styles.clock}>
          <figcaption className={styles.clockHead}>
            <span>{a.clockTitle}</span>
            <span>{a.clockZone}</span>
          </figcaption>
          <dl className={styles.clockTimes}>
            {[
              { label: a.clockOpen, pair: open },
              { label: a.clockClose, pair: close },
            ].map(({ label, pair }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="numeral">{pair.primary}</dd>
                <dd className={`${styles.clockSecondary} numeral`}>
                  {pair.secondary} {a.clockSecondaryZone}
                </dd>
              </div>
            ))}
          </dl>
          <div className={styles.track} role="img" aria-label={a.clockAria}>
            {segments.map((segment, index) => (
              <span
                key={segment.key}
                data-kind={segment.kind}
                style={{ left: `${segment.left}%`, width: `${segment.width}%`, "--i": index } as CSSProperties}
              />
            ))}
          </div>
          <div aria-hidden className={`${styles.ticks} numeral`}>
            {CLOCK_TICKS.map((tick) => (
              <span key={tick} style={{ left: `${(tick / DAY_MINUTES) * 100}%` }}>
                {tick === DAY_MINUTES ? DAY_END_LABEL : clockOf(tick)}
              </span>
            ))}
          </div>
          <ul className={styles.legend}>
            {windows.map((window) => (
              <li key={window.key} data-kind={window.key}>
                {windowLabel[window.key]}
              </li>
            ))}
          </ul>
        </figure>
      </header>

      <SectionNav items={sections} label={a.title} />

      {/* ---- Kim yapıyor ---- */}
      <Panel id="kim">
        <PanelHeader title={a.whoTitle} />
        <div className={BODY}>
          <p className={styles.lede}>{whoLede}</p>
          {whoRest.map((paragraph) => (
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

      {/* ---- İlkeler (çapa tarihten: #acik-kaynak) ----
          Dört söz iri puntoyla, ızgarada; kutu değil, hairline. Kaynak kodu
          ve hata bildirimi hemen altında: "açık kaynak" sözünün kanıtı. */}
      <Panel id="acik-kaynak">
        <PanelHeader title={a.freeTitle} />
        <ol className={styles.principles} data-motion-stagger>
          {a.principles.map((principle, index) => {
            const Icon = PRINCIPLE_ICONS[index] ?? SealCheck;
            return (
              <li key={principle.title}>
                <Icon aria-hidden size={24} weight="duotone" />
                <h3>{principle.title}</h3>
                <p>{principle.body}</p>
              </li>
            );
          })}
        </ol>
        <div className={cn(BODY, "pt-5")}>
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

      {/* ---- Veri ----
          Akış: kaynaklar → üç kapı → ekrandaki damga. Bir sayının yolu,
          sırasıyla; dar ekranda dikey. Adımlar `--step` sırasıyla açılıyor. */}
      <Panel id="veri">
        <PanelHeader title={a.dataTitle} />
        <div className={BODY}>
          <p className={PROSE}>{a.dataIntro}</p>
        </div>
        <FlowReveal className={styles.dataFlow}>
          <section className={styles.stage} data-step style={{ "--step": 0 } as CSSProperties}>
            <h3 className={styles.stageTitle}>
              <Broadcast aria-hidden size={18} weight="duotone" />
              {a.flowSources}
            </h3>
            <ul className={styles.sources}>
              {a.sources.map((source) => (
                <li key={source.name}>
                  <strong>{source.name}</strong>
                  {/* IEX'in gösterim koşulu bağlantı istiyor (api-exhibit-a). */}
                  {"href" in source && source.href ? (
                    <a href={source.href} target="_blank" rel="noopener noreferrer">{source.what}</a>
                  ) : (
                    <span>{source.what}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <span aria-hidden className={styles.connector} data-connector style={{ "--step": 1 } as CSSProperties} />
          <section className={styles.stage} data-step style={{ "--step": 1.4 } as CSSProperties}>
            <h3 className={styles.stageTitle}>
              <ArrowsLeftRight aria-hidden size={18} weight="duotone" />
              {a.layersTitle}
            </h3>
            <p className={styles.stageIntro}>{a.layersIntro}</p>
            <ol className={styles.gates}>
              {a.layers.map((layer, index) => {
                const Icon = LAYER_ICONS[index] ?? Database;
                return (
                  <li key={layer.title} data-step style={{ "--step": 1.8 + index * 0.55 } as CSSProperties}>
                    {index > 0 && <span className={styles.fallback}>{a.flowFallback}</span>}
                    <div className={styles.gate}>
                      <Icon aria-hidden size={20} weight="duotone" />
                      <span>
                        <strong>{layer.title}</strong>
                        <span>{layer.body}</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
          <span aria-hidden className={styles.connector} data-connector style={{ "--step": 3.6 } as CSSProperties} />
          <section className={styles.stage} data-step style={{ "--step": 4 } as CSSProperties}>
            <h3 className={styles.stageTitle}>
              <Monitor aria-hidden size={18} weight="duotone" />
              {a.flowScreen}
            </h3>
            {/* Damganın ANATOMİSİ, sahte bir ekran görüntüsü değil: kaynak
                gerçek (fiyatlar Alpaca'dan), gecikme gerçek; saat bir yuva
                olarak çiziliyor, uydurma bir saat yazılmıyor. */}
            <div className={styles.stamp}>
              <span>{a.stampSource}</span>
              <span>{a.stampDelay}</span>
              <span data-slot>{a.stampTime}</span>
            </div>
            <span className={styles.stale}>{a.stampStale}</span>
            <p className={styles.stageIntro}>{a.stampCaption}</p>
          </section>
        </FlowReveal>

        <div className={cn(BODY, "border-t border-line-soft pt-5")}>
          <h3 className="text-read font-bold text-strong">{a.stampTitle}</h3>
          {a.stampBody.map((paragraph) => (
            <p key={paragraph} className={PROSE}>
              {paragraph}
            </p>
          ))}
          <h3 className="mt-2 text-read font-bold text-strong">{a.timeTitle}</h3>
          <p className={PROSE}>{a.timeBody}</p>
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
        </div>
        <FlowReveal className={styles.contentFlowWrap}>
          <ol className={styles.contentFlow}>
            {a.contentSteps.map((step, index) => {
              const Icon = CONTENT_ICONS[index] ?? UserCheck;
              return (
                <li key={step.title} data-step style={{ "--step": index * 1.1 } as CSSProperties}>
                  {/* Çizgi SONRAKİ adıma uzanıyor: kendi simgesinin
                      kenarından komşunun simgesine (geniş ekranda sağa,
                      telefonda aşağı). */}
                  {index < a.contentSteps.length - 1 && (
                    <span
                      aria-hidden
                      className={styles.stepConnector}
                      data-connector
                      style={{ "--step": index * 1.1 + 0.6 } as CSSProperties}
                    />
                  )}
                  <span aria-hidden className={styles.stepIcon}>
                    <Icon size={22} weight="duotone" />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              );
            })}
          </ol>
        </FlowReveal>
        <div className={cn(BODY, "border-t border-line-soft pt-5")}>
          <h3 className="text-read font-bold text-strong">{a.rhythmTitle}</h3>
          <dl className={styles.rhythm} data-motion-stagger>
            {a.rhythm.map((item) => (
              <div key={item.what}>
                <dt>{item.when}</dt>
                <dd>{item.what}</dd>
              </div>
            ))}
          </dl>
          <p className={PROSE}>{a.contentNote}</p>
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
                <div className={styles.preview}>
                  <iframe
                    src={embed.preview}
                    title={a.embedPreviewLabel.replace("{name}", embed.name)}
                    height={embed.height}
                    loading="lazy"
                    className="w-full max-w-[480px] border-0"
                  />
                </div>
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
