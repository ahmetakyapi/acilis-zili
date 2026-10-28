import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { SkyScene } from "@/components/day-poster/SkyScene";
import { posterName, posterShortName, posterStoryOf, posterStoryText } from "@/components/day-poster/story";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Skeleton } from "@/components/ui/primitives";
import { POSTER_ANCHOR, bellEnergy } from "@/lib/day-poster";
import { getDayPoster, getLatestPosterDate, getPosterSkyline } from "@/lib/day-poster-data";
import type { SkyModeName } from "@/lib/day-skyline";
import type { Dictionary, Locale } from "@/lib/i18n";
import { logoSrc } from "@/lib/logos";
import type { MarketStatus } from "@/lib/market-hours";
import { cn, directionOf, directionText, formatPercent, tieFigures } from "@/lib/utils";
import { BellEnergySource } from "../BellEnergySource";
import { tileFeedsBell } from "../day-tile";
import { SessionAgeTag, sessionIsLiveElsewhere } from "./SessionAgeTag";
import styles from "./SkylineStrip.module.css";

/**
 * SON SEANSIN SİLUETİ — ana sayfada tam genişlik şerit (25 Ekim).
 *
 * BUGÜNÜN ARDINA İNDİ (28 Ekim; sahibinin iPhone ekranı, seans açıkken
 * 22:29 TR: "sanki bugünün işlemi gibi anlaşılıyor, ana sayfa önce bugünü
 * anlatmalı"). Kahramanın hemen altındaydı, yani ilk ekranda dünün seansı
 * duruyordu. Şimdi telefonda Günün Hareketleri'nin ardında, teknik
 * görünümün üstünde; masaüstünde iki kolonun altında, haberlerin üstünde
 * (sıra page.tsx ve TodayExperience.module.css). Başlığın altında göreli
 * gün künyesi ("Dünkü Seans", `SessionAgeTag`), seans açıkken bir cümle.
 *
 * KAHRAMANDAN ÇIKTI (25 Ekim sabahı): son seans kahramanın içinde gri bir
 * karoydu; sahibi "kötü gözüküyor" dedi, kendi paneline Günün Posteri'nin
 * siluetinin alçak hâli olarak indi.
 *
 * ŞEHİR TABLOSU (25 Ekim akşamı, "Silüet" turu). Sahibi: "Burası daha iyi
 * durmalı ve daha iyi hissettirmeli; logolar, şirketler daha görünür ve
 * anlaşılır olmalı. Çok sanatsal, Awwwards'taki ödüllü siteler gibi;
 * sınırları zorla." Şerit 200 pikselden ~280'e çıktı ve posterle AYNI
 * sahneyi kullanıyor (`SkyScene`, gerekçeler orada): günün tonunda gök,
 * ufkun altında su ve yükselen binaların yansıması, büyük binalarda
 * pencere ritmi, çatılarda 28–32 piksellik logo karosu + sembol + yüzde
 * (en büyük on iki şirket ve günün üçer ucu; telefonda en büyük altı ve
 * birer uç), etiketli binaya gelince ipucu, mahalle adına gelince mahalle.
 * Şeritte YALNIZ ETİKETLİ binalar etkileşimli (25 Ekim, "Silüet: etiket"
 * turu): etiketsiz binanın ayrıntısı posterde, tıklaması posteri açıyor.
 *
 * BAĞLANTI ARTIK PANEL DEĞİL. Panelin tamamı tek bir bağlantıydı; binalar
 * etkileşimli olunca iç içe etkileşim (bağlantı içinde odaklanabilir sahne)
 * erişilebilirliği bozardı. Posterin yolu başlıkta iki kez (ad ve "Posteri
 * Aç", 44 piksel); sahnede etiketli binaya tıklamak o şirketi, boşluğa ya
 * da etiketsiz binaya tıklamak posteri açıyor (fare kolaylığı; asıl yol
 * başlıktaki bağlantı).
 *
 * BAŞLIK SADELEŞTİ. Tek satırda altı künye vardı (tarih, endeks, yükselen,
 * düşen, cümle, bağlantı). Şimdi solda ad ve tarih; sağda Nasdaq 100'ün
 * yüzdesi büyük puntoyla ve yükselen/düşen oranı kulvar şeridinde (renk
 * yalnız yön).
 *
 * KOMPAKT (25 Ekim gece; sahibi: "Burası bir tık daha kompakt ve daha az
 * yer kaplayabilir"). Panel 1440'ta 447 piksel tutuyordu: başlık 45, ayrı
 * satırda günün cümlesi, sahne 321. Şimdi ad, tarih ve günün cümlesi AYNI
 * satırda (hairline'larla ayrılmış; dar kapta cümle alta iner), Nasdaq 100
 * yüzdesi tek satırda; sahne alçaldı (`SKY_MODES` strip*: `half`, logo),
 * mahalle tabelaları sıkıştı. Ölçüler `SkyScene.module.css` ve
 * `lib/day-skyline.ts`te.
 *
 * TELEFON (25 Ekim, "Silüet: mobil" turu; sahibinin iPhone ekranları:
 * "Mobilde buralar daha iyi olmalı"). 390'da panel 626 piksel tutuyordu:
 * iki sırada etiketler ikinci kata ve ufkun çok altına iniyordu (Apple'ın
 * bağı ~55 piksel), seçili binanın kartı alt sıranın üstüne açılıyordu,
 * mahalle adları üç satıra kırılıyordu. Şimdi üç kısa sıra (her sıra
 * kendi boyunda), çip etiket tek katta, kart sahnenin altında, tabela tek
 * satır kısa adla (`signs`; kurallar `lib/day-skyline.ts` ve
 * `SkyScene.tsx`): 390'da 626 → 543 piksel, 360'ta 596 → 533 (TR, 23
 * Ekim). 360'ta başlığın kulvar sayıları panelin dışına taşıyordu; endeks
 * adı yüzdenin üstüne çıktı.
 *
 * TELEFON 2 (27 Ekim, "Silüet: mobil 2"; sahibinin 26 Ekim iPhone ekranı:
 * "iç içe çok kötü duruyor"). Çip etiketler binaların üstüne biniyordu ve
 * orta sıra 21 piksel boyundaydı. Telefonda sahne artık yalnız silüet (öne
 * çıkanların binasında numara rozeti), iki sıra, her sıra en az ~85
 * piksel; şirketler sahnenin altında "Öne Çıkanlar" ızgarasında (8 çip,
 * gerekçe `SkyScene.tsx`). Panel 390'da 528 → 731 piksel (TR, 26 Ekim):
 * ızgara ~200 piksel ekliyor, karşılığında sahnede hiçbir yazı üst üste
 * binmiyor. Masaüstü ve tablet aynen.
 *
 * HER SEANSTA en yeni TAMAMLANMIŞ seans (`getLatestPosterDate`); künye
 * tarihi söylüyor ("23 Ekim Kapanışı"), seans sürerken bile hangi günü
 * anlattığı belli (CLAUDE.md "Veri dürüstlüğü" 4). Zilin şiddeti yalnız
 * bitmiş seansın kendi şeridinden (`tileFeedsBell`, gerekçe day-tile.ts).
 *
 * VERİ DÜRÜSTLÜĞÜ: kaynak Günün Posteri (`getDayPoster`), posterle aynı
 * çağrı; şeritteki "33 Yükseldi" ile posterdeki aynı sayı. Poster yoksa
 * (veri eksik, sağlayıcı düştü) şerit hiç basılmıyor.
 *
 * Kendi Suspense sınırında (page.tsx); yer tutucu şeridin ölçüsünü
 * ayırıyor (`SkylineStripSkeleton`), sayfa kaymıyor.
 */

/** Şeridin dört düzeni — SkyScene.module.css'teki kap sorgularıyla. */
const STRIP_MODES = ["stripNarrow", "stripMedium", "stripWide", "stripXwide"] as const satisfies readonly SkyModeName[];
const PERCENT_DIGITS = 2;

/** "2026-10-23" → "23 Ekim" / "October 23" (künye; seans günü ET takvimi). */
const DAY_MONTH = {
  tr: new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" }),
  en: new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", timeZone: "UTC" }),
} as const;

export async function SkylineStrip({
  status,
  locale,
  t,
  nowMs,
}: {
  status: MarketStatus;
  locale: Locale;
  t: Dictionary;
  nowMs: number;
}) {
  const date = await getLatestPosterDate(status);
  const read = await getDayPoster(date);
  if (read.state !== "ok") return null;
  const poster = read.poster;
  const { stocks, districts, sized } = await getPosterSkyline(poster);
  if (stocks.length === 0) return null;
  const T = t.daySignature.strip;
  const S = t.daySignature.seal;
  const K = t.daySignature.skyline;
  const story = posterStoryText(poster, districts, locale, t);
  const tone = posterStoryOf(poster, districts).tone;
  const close = S.close.replace("{date}", DAY_MONTH[locale].format(new Date(`${poster.date}T12:00:00Z`)));
  const anchor = poster.indices.find((move) => move.symbol === POSTER_ANCHOR);
  const breadth = poster.breadth;
  const pct = (value: number) => formatPercent(value, locale, PERCENT_DIGITS);
  const logos = Object.fromEntries(
    stocks.flatMap((stock) => {
      const src = logoSrc(stock.symbol, null);
      return src ? [[stock.symbol, src] as const] : [];
    }),
  );
  const names = Object.fromEntries(districts.map((district) => [district.key, posterName(district.key, locale)]));
  const signs = Object.fromEntries(districts.map((district) => [district.key, posterShortName(district.key, locale)]));
  const posterHref = `/gun/${poster.date}`;
  /* Sahnenin ekran okuyucu adındaki sayılar künyedekiyle aynı kaynaktan
     (posterin genişliği); yoksa binalardan sayılıyor. */
  const adv = breadth?.advancing ?? stocks.filter((stock) => stock.change > 0).length;
  const dec = breadth?.declining ?? stocks.filter((stock) => stock.change < 0).length;

  return (
    <section className={cn("panel", styles.panel)} aria-labelledby="son-seans-silueti">
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <h2 id="son-seans-silueti" className={cn("text-read", styles.title)}>
            <Link href={posterHref} className={styles.titleLink}>
              {T.title}
            </Link>
          </h2>
          <p className={styles.close}>
            <SessionAgeTag dateEt={poster.date} locale={locale} t={t} nowMs={nowMs} />
            <span>{close}</span>
          </p>
          {sessionIsLiveElsewhere(status, poster.date) && <p className={styles.liveNote}>{t.sessionAge.liveNote}</p>}
          <p className={styles.story}>
            <span className={styles.storyTitle} data-tone={tone}>
              {story.title}
            </span>
            <span className={styles.storyDetail}>{tieFigures(story.detail)}</span>
          </p>
        </div>
        <div className={styles.figures}>
          {anchor && (
            <p className={styles.figure}>
              <span className={styles.figureLabel}>{posterName(POSTER_ANCHOR, locale)}</span>
              <span className={cn(styles.figureValue, directionText(directionOf(anchor.change)))}>{pct(anchor.change)}</span>
            </p>
          )}
          {breadth && (
            <div className={styles.breadth}>
              <span
                className={styles.lane}
                role="img"
                aria-label={S.stripLabel
                  .replace("{adv}", String(breadth.advancing))
                  .replace("{dec}", String(breadth.declining))
                  .replace("{flat}", String(breadth.unchanged))}
              >
                {breadth.advancing > 0 && <span className={styles.laneUp} style={{ flexGrow: breadth.advancing }} />}
                {breadth.unchanged > 0 && <span className={styles.laneFlat} style={{ flexGrow: breadth.unchanged }} />}
                {breadth.declining > 0 && <span className={styles.laneDown} style={{ flexGrow: breadth.declining }} />}
              </span>
              <span className={styles.counts} aria-hidden>
                <span className="text-up">{S.advancing.replace("{n}", String(breadth.advancing))}</span>
                <span className="text-down">{S.declining.replace("{n}", String(breadth.declining))}</span>
              </span>
            </div>
          )}
        </div>
        <Link href={posterHref} className={styles.open}>
          {T.open}
          <ArrowRight weight="bold" size={13} aria-hidden />
        </Link>
      </header>

      <SkyScene
        variant="strip"
        modes={STRIP_MODES}
        stocks={stocks}
        districts={districts}
        names={names}
        signs={signs}
        logos={logos}
        sized={sized}
        locale={locale}
        text={K}
        tone={tone}
        label={K.sceneLabel.replace("{adv}", String(adv)).replace("{dec}", String(dec))}
        emptyHref={posterHref}
      />
      {tileFeedsBell(status, poster.date) && <BellEnergySource value={bellEnergy(poster.breadth)} />}
    </section>
  );
}

/** Yer tutucu: şeridin ölçüsünü ayırıyor (başlık + cümle + sahne). */
export function SkylineStripSkeleton() {
  return (
    <section className={cn("panel", styles.panel)} aria-hidden>
      <span className={styles.skeleton}>
        <Skeleton className={styles.skeletonHead} />
        <Skeleton className={styles.skeletonScene} />
      </span>
    </section>
  );
}
