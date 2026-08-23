import { redirect } from "next/navigation";
import { GuideHint } from "@/components/article/GuideHint";
import { auth } from "@/auth";
import { EmptyState, PageHeader, Panel, Segment, SegmentItem } from "@/components/ui/primitives";
import { EarningsCalendar } from "@/components/earnings/EarningsCalendar";
import { EarningsTabs } from "@/components/earnings/EarningsTabs";
import { RecentAnalysesStrip } from "@/components/earnings/RecentAnalysesStrip";
import {
  getAnalysisBadges,
  getEarningsBetween,
  getSymbolNames,
  getUserSymbols,
} from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n } from "@/lib/i18n";
import { formatEtDateCompact } from "@/lib/utils";

import { pageMetadata } from "@/lib/page-meta";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const generateMetadata = pageMetadata({
  path: "/bilancolar",
  tr: {
    title: "Bilançolar",
    description:
      "Şirketlerin finansal sonuç tarihleri ve okunmuş çeyrek analizleri.",
  },
  en: {
    title: "Earnings",
    description:
      "When companies report, plus written analyses of the quarters we read.",
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
     olmadığı için iki ardışık Neon turu doğrudan ilk bayta biniyordu. */
  const rangeEnd = addEtDays(today, RANGES[range]);
  const [rows, userSymbols] = await Promise.all([
    getEarningsBetween(today, rangeEnd),
    session?.user?.id ? getUserSymbols(session.user.id) : Promise.resolve([]),
  ]);

  const symbolList = [...new Set(rows.map((r) => r.symbol))];
  const [meta, badges] = await Promise.all([
    getSymbolNames(symbolList),
    getAnalysisBadges(symbolList, locale, { from: today, to: rangeEnd }),
  ]);

  const rangeHref = (key: RangeKey) =>
    key === "ay" ? "/bilancolar?aralik=ay" : "/bilancolar";

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={t.earnings.title}
        subtitle={t.earnings.subtitleLong}
        action={
          /* Anahtarın ALTINDA kapsadığı gerçek aralık. "Hafta" ve "Ay" birer
             söz; sayfanın gösterdiği pencere `bugün → bugün + 6|29`.
             Üçüncü günün başlığına inen okuyucu listenin nerede biteceğini
             sona kadar kaydırarak öğreniyordu. İki tarih de hesaplanmış
             değişkenlerde duruyor, uydurma yok. */
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <Segment>
              {(["hafta", "ay"] as const).map((key) => (
                <SegmentItem
                  key={key}
                  href={rangeHref(key)}
                  active={range === key}
                >
                  {key === "hafta" ? t.earnings.rangeWeek : t.earnings.rangeMonth}
                </SegmentItem>
              ))}
            </Segment>
            <p className="figure text-tiny text-muted">
              {formatEtDateCompact(today, locale)} –{" "}
              {formatEtDateCompact(rangeEnd, locale)}
            </p>
          </div>
        }
      />

      <EarningsTabs active="calendar" t={t} className="-mt-2" />

      {/* Analizler geçmiş bilançolara ait, takvim ise ileriye bakıyor:
          son yazılanlar sekmeye tıklanmadan burada görünüyor. */}
      <RecentAnalysesStrip locale={locale} t={t} />

      {rows.length === 0 ? (
        <Panel>
          <EmptyState title={t.earnings.empty} />
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
        />
      )}

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["bilanco", "degerleme"]}
        className="pt-1"
      />
    </div>
  );
}
