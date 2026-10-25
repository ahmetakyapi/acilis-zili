import { PageShare } from "@/components/article/PageShare";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { redirect } from "next/navigation";
import { GuideHint } from "@/components/article/GuideHint";
import { auth } from "@/auth";
import { EmptyState, Panel, Segment, SegmentItem } from "@/components/ui/primitives";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { EarningsActivity } from "@/components/earnings/EarningsActivity";
import { EarningsHorizon } from "@/components/earnings/horizon/EarningsHorizon";
import styles from "@/components/motion/DirectoryExperience.module.css";
import { cn } from "@/lib/utils";
import { EarningsCalendar } from "@/components/earnings/EarningsCalendar";
import { EarningsTabs } from "@/components/earnings/EarningsTabs";
import { RecentAnalysesStrip } from "@/components/earnings/RecentAnalysesStrip";
import {
  getAnalyses,
  getAnalysisBadges,
  getEarningsBetween,
  getHolidays,
  getSymbolNames,
  getUserSymbols,
} from "@/lib/data";
import { getVoteBoard } from "@/lib/earnings-vote-data";
import { currentWeekStart } from "@/lib/earnings-week";
import { getEarningsWeek } from "@/lib/earnings-week-data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n } from "@/lib/i18n";

import { pageMetadata } from "@/lib/page-meta";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. OG kartının kısa cümlesi ayrı duruyor (kartta). */
export const generateMetadata = pageMetadata({
  path: "/bilancolar",
  /* ARAMA NİYETİ (25 Ekim). Search Console'da sayfanın sorguları
     "bugün gelen bilançolar" (24 gösterim, sıra 56), "şirket bilançoları",
     "yeni açıklanan bilançolar"; başlık yalnız "Bilançolar" diyordu.
     Başlık ekranın gerçekten gösterdiğini söylüyor: bugünden başlayan
     haftalık takvim, açılış öncesi / kapanış sonrası penceresi ve
     beklentiler. Ekrandaki h1 değişmedi. */
  tr: {
    title: "Bilanço Takvimi: Bugün ve Bu Hafta Gelen Bilançolar",
    description:
      "ABD'de bugün ve bu hafta bilanço açıklayan şirketler: açılış öncesi mi kapanış sonrası mı, gelir ve hisse başına kâr beklentileriyle.",
  },
  en: {
    title: "Earnings Calendar: Who Reports Today and This Week",
    description:
      "US companies reporting earnings today and this week: before the open or after the close, with revenue and EPS estimates.",
  },
});

/**
 * Bilançolar · Takvim sekmesi.
 *
 * Ekranın kendisi mockup 4d'den beri değişmedi; katman mantığı artık
 * `components/earnings/EarningsCalendar.tsx` içinde ve takip sekmesiyle
 * paylaşılıyor. Buraya eklenen tek şey sekme çubuğu ve satırlara düşen
 * analiz rozetleri.
 */

/** Hafta/Ay segmenti — mockup'taki iki seçenek. */
const RANGES = {
  hafta: 6,
  ay: 29,
} as const;
type RangeKey = keyof typeof RANGES;

/** Takvimin üstündeki "son yazılan analizler" şeridinin çip sayısı. */
const RECENT_ANALYSES = 8;

export default async function EarningsPage(props: PageProps<"/bilancolar">) {
  const search = await props.searchParams;
  const range: RangeKey = search.aralik === "ay" ? "ay" : "hafta";

  /* Favori filtresi artık kendi sekmesi. Eski bağlantılar (paylaşılmış URL,
     yer imi) ölmesin diye parametre oraya yönlendiriliyor. */
  if (search.f === "favoriler") {
    redirect(range === "ay" ? "/bilancolar/takip?aralik=ay" : "/bilancolar/takip");
  }

  const { locale, t } = await getI18n();
  const session = await auth();
  const today = todayEt();

  /* İki sorgu BİRBİRİNE BAĞLI DEĞİL ama sıralı bekleniyordu: takvim
     dönmeden takip listesi istenmiyordu ve sayfada Suspense sınırı da
     olmadığı için iki ardışık Neon turu doğrudan ilk bayta biniyordu.

     DÖRT OKUMA TEK TURDA (20 Ekim). Aynı zincir iki tur daha taşıyordu:
     rozetler takvimin sembol listesini bekliyordu (oysa aralık verilince
     sembol süzgeci gereksiz — `getAnalysisBadges` künyesi) ve şeridin
     `getAnalyses`i ancak sayfa gövdesi döndükten sonra başlıyordu (şerit
     kendi verisini çeken bir sunucu bileşeniydi). Neon'a her tur ~120 ms;
     kritik yol üç turdan bire indi. Adlar önbellekli tablodan, tek listeyle. */
  const rangeEnd = addEtDays(today, RANGES[range]);
  /* OY TAHTASI AYNI TURDA (24 Ekim). Okurun oyları ve dağılımlar takvimin
     satırlarını beklemiyor: oy satırı kendi rapor tarihini taşıyor, aralık
     yetiyor (`getVoteBoard`). Yalnız oturum açıkken; kartta oy düğmesi
     üyeye özel. Tablo yoksa `available: false` ve kartlar eski hâliyle. */
  const userId = session?.user?.id ?? null;
  /* UFKUN HAFTASI AYNI TURDA (25 Ekim). Haftalık sekmenin okuması
     (`getEarningsWeek`: takvim + tatiller, ardından adlar) kendi iki
     turunu bu dalda koşuyor; sayfanın kritik yolu (takvim → adlar) da iki
     tur, yani ufuk ilk baytı geciktirmiyor. Karne sağlayıcıdan ve
     beklenmiyor (`EarningsHorizon` → `loadHorizonKarne`). */
  const [rows, userSymbols, badges, recent, voteBoard, holidays, week] = await Promise.all([
    getEarningsBetween(today, rangeEnd),
    userId ? getUserSymbols(userId) : Promise.resolve([]),
    getAnalysisBadges(null, locale, { from: today, to: rangeEnd }),
    getAnalyses(locale, { limit: RECENT_ANALYSES }),
    userId ? getVoteBoard(userId, today, rangeEnd) : Promise.resolve(null),
    userId ? getHolidays() : Promise.resolve([]),
    getEarningsWeek(currentWeekStart(today), locale),
  ]);

  const meta = await getSymbolNames([
    ...rows.map((r) => r.symbol),
    ...recent.map((r) => r.symbol),
  ]);

  const rangeHref = (key: RangeKey) =>
    key === "ay" ? "/bilancolar?aralik=ay" : "/bilancolar";

  /* Aralık anahtarı İKİ YERDE ve aynı düğüm iki kez çiziliyor — markup
     kopyalanmıyor. Sayfanın altındaki gerekçe aşağıda. */
  const anahtar = (
    <Segment>
      {(["hafta", "ay"] as const).map((key) => (
        <SegmentItem key={key} href={rangeHref(key)} active={range === key}>
          {key === "hafta" ? t.earnings.rangeWeek : t.earnings.rangeMonth}
        </SegmentItem>
      ))}
    </Segment>
  );

  return (
    /* ≥1600'DE BÖLÜM ARALIĞI 16 (25 Ekim, doğrulama turu): gerekçe ve
       ölçüm aşağıdaki "SEKME ÇUBUĞU KAPAĞIN İÇİNDE" yorumunda. */
    <MotionExperience className={cn(styles.page, "min-[100rem]:[--page-section-gap:16px]")}>
      <ScrollProgress />
      {/* BAŞLIK BÖLÜMÜN ADI, SEKME GÖRÜNÜMÜN ADI. Burada "Bilanço Takvimi"
          yazıyordu ve hemen altındaki sekme çubuğunda "Takvim" duruyordu —
          aynı şey iki kez. Öteki iki sekmede ise başlık "Bilançolar" idi,
          yani okuyucu sekme değiştirdiğinde ekrandaki başlık değişiyor ama
          hangi görünümde olduğunu söylemiyordu. Üçü de artık bölüm adını
          taşıyor; alt başlık bu sekmenin ne gösterdiğini anlatmaya devam
          ediyor. */}
      <DirectoryHeader
        shareInTitle
        share={<PageShare compactOnMobile align="right" path="/bilancolar" title={t.analysis.title} locale={locale} t={t} />}
        title={t.analysis.title}
        description={t.earnings.subtitleLong}
        /* ANAHTAR BAŞLIĞIN SAĞ ÜSTÜNDE. Açıklamanın altında kendi satırında
           duruyordu; ekranın tek denetimi ve ekran düzeni kuralı onu üst
           künyenin sağına koyuyor. Telefonda başlık kartı 68 piksel
           kısalıyor. */
        control={anahtar}
        tabs={<EarningsTabs active="calendar" t={t} inHeader />}
      />

      {/* SEKME ÇUBUĞU KAPAĞIN İÇİNDE (25 Ekim, ikinci tur). Kapakla sekme
          kartı tek kompakt bantta birleşti (`DirectoryHeader` → `tabs`) ve
          ufuk sıkılaştı (gerekçe `EarningsHorizon.module.css` başında).
          Ölçüldü (TR/EN, açık/koyu): kapak + sekme 156 + 24 + 60 → 114
          piksellik bant; ufuk ızgarası 1280×800'de 457–1150 → 312–746,
          1440×900'de 460–1011 → 317–751 (iki pencere beş gün ilk ekranda);
          390'da ızgara 603 → 488. 1920×1080'de takvim listesinin üst kenarı
          y=1034 (ilk ekranın alt sınırı piyasa şeridiyle 1043).

          ≥1600 SIKILAŞTIRMASI (25 Ekim, doğrulama turu). 1920×1080'de ilk
          gün başlığı ("26 Ekim Pazartesi") TR 1048–1090, EN 1066–1108 —
          ilk ekranın dışında. Bölüm aralığı 24 → 16, analiz şeridi 74 → 62,
          okuma satırının karnesi iki sütun ve künye tek tavansız satır
          (`EarningsHorizon.module.css` sonu). Ölçüldü (TR/EN, açık/koyu):
          başlık 979–1021, 22 piksel payla ilk ekranda. 1440 ve 1280 aynı
          (şerit 971 / 966, ufuk tamamı ilk ekranda), 390 değişmedi.

          KART TURU (25 Ekim, üçüncü tur; gerekçe
          `EarningsHorizon.module.css` başında). Ufuk paneli (TR/EN,
          açık/koyu, üst–alt kenar): 1280×800'de 231–942 → 231–820 ve
          okuma şeridi 756–852 → 709–761 (ilk ekranın sınırı 763: şerit
          artık tam görünüyor); 1440×900'de 236–947 → 236–843, künye dahil
          tamamı ilk ekranda; 768'de 597 → 473; 390'da 976 → 729 (EN 764).
          Satırlar 155 / 155 / 68 → 143 / 143 / 49 (1280), 152 / 152 / 49
          (1440); yatay taşma 0, CLS 0.

          Önceki tur: SEKME ÇUBUĞU BAŞLIĞIN HEMEN ALTINDA. Kapak yoğunluk
          grafiğini ve öne çıkanları da taşıyordu: telefonda 735 piksel ve
          sekme çubuğu y=836'da, yani dört görünüm arasındaki geçiş ilk
          ekranda hiç görünmüyordu (1280'de 462). İkisi kapaktan çıkıp
          sekmenin altına, kendi `PanelHeader`lı panellerine indi; kapak
          yalnız başlık, tek denetim ve açıklama. Ölçüldü (TR, açık/koyu):
          390'da kapak 199, sekme 836 → 300; 1280'de sekme 462 → 265. */}

      {/* HAFTANIN BİLANÇO UFKU SEKMENİN ALTINDA (25 Ekim). Burada iki
          panel vardı: takvim yoğunluğu (gün başına bilanço sayısı) ve
          "Takvimde Öne Çıkanlar" (en büyük üç şirket). İkisi tek görselde:
          günler × pencere ızgarası, karo alanı piyasa değeri, gün başlığında
          günün tüm açıklayanlarının sayısı ve yoğunluk çizgisi (gerekçe
          `components/earnings/horizon/EarningsHorizon.tsx`). Kart listesi
          ve oylama ızgaranın altında, değişmeden. Sekme çubuğu yine
          başlığın hemen altında. */}
      <EarningsHorizon
        week={week}
        today={today}
        watchSet={new Set(userSymbols)}
        badges={badges}
        listedDays={new Set(rows.map((row) => row.reportDate))}
        locale={locale}
        t={t}
      />

      {/* AYLIK GÖRÜNÜMDE YOĞUNLUK ŞERİDİ KALIYOR. Ufuk bir iş haftası;
          "Ay" seçen okuyucunun sorusu dört haftanın hangisinin kalabalık
          olduğu ve o cevabı yalnız haftalara toplanmış yoğunluk grafiği
          veriyor. Haftalık görünümde ufkun gün başlıkları aynı sayıyı
          taşıdığı için orada basılmıyor. */}
      {range === "ay" && rows.length > 0 && (
        <EarningsActivity rows={rows} from={today} to={rangeEnd} locale={locale} t={t} />
      )}

      {/* HAFTALIK ARTIK KENDİ SEKMESİ (29 Eylül). Burada tek satırlık bir
          "Haftalık Takvim Görseli" bağlantısı vardı; haftalık sayfa o zaman
          sekme değil, takvimin paylaşılacak bir çıktısıydı. Sekme çubuğu
          artık aynı yere gidiyor ve bağlantı ikinci bir kapı olarak kalırdı:
          kaldırıldı, liste bir satır yukarı çıktı. */}
      {/* Analizler geçmiş bilançolara ait, takvim ise ileriye bakıyor:
          son yazılanlar sekmeye tıklanmadan burada görünüyor. */}
      <RecentAnalysesStrip rows={recent} meta={meta} t={t} />

      <QueryTransition label={t.common.loading}>
      {rows.length === 0 ? (
        <Panel>
          <EmptyState title={t.earnings.empty} scene="chart" />
        </Panel>
      ) : (
        <EarningsCalendar
          rows={rows}
          meta={meta}
          watchSet={new Set(userSymbols)}
          badges={badges}
          today={today}
          locale={locale}
          t={t}
          vote={voteBoard?.available ? { board: voteBoard, holidays, now: new Date() } : undefined}
        />
      )}

      </QueryTransition>

      {/* ARALIK ANAHTARI LİSTENİN ALTINDA DA. Haftalık listeyi sonuna kadar
          okuyan okuyucunun bir sonraki adımı aylık görünüm ama anahtar
          sayfanın en üstündeydi: devam etmek için ekranlarca yukarı
          kaydırmak gerekiyordu. Aynı düğüm burada da çiziliyor.

          Anahtar `scroll={false}` taşıyor (SegmentItem'ın kendi kararı), yani
          aralık değişince sayfa başa fırlamıyor: haftalık listenin sonundaki
          okuyucu aylık listede aşağı yukarı aynı tarihte kalıyor ve
          devamı altında açılıyor.

          Yalnızca liste DOLUYKEN çiziliyor — boş bir sayfada iki anahtar
          arasında sekiz piksel kalırdı. */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-4">
          <p className="text-small text-muted">
            {range === "hafta"
              ? t.earnings.endOfWeekList
              : t.earnings.endOfMonthList}
          </p>
          {anahtar}
        </div>
      )}

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["bilanco", "degerleme"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}
