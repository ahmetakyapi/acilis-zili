import { Suspense } from "react";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { GuideHint } from "@/components/article/GuideHint";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { Panel, LogoTile } from "@/components/ui/primitives";
import type { UpcomingRow } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, formatEtDateCompact } from "@/lib/utils";

/** Kapanış şeridi — aynı sektörden yaklaşan bilançolar ve rehber. */
export function ReportClosing({
  locale,
  t,
  peers,
  bottomCards,
}: {
  locale: Locale;
  t: Dictionary;
  peers: UpcomingRow[];
  bottomCards: number;
}) {
  return (
    <>
      {/* ---- Kapanış şeridi ----
          Rakip takvimi ve rehber bağlantıları yapışkan yan kolondaydı; o
          kolon içeriğin genişliğini kısıyordu. İkisi de "okudun, şimdi ne
          var" sorusuna ait — metnin sonunda yan yana duruyorlar.

          Izgara SABİT değil, BASILAN kart sayısına göre kuruluyor: rakip
          takvimi yalnızca aynı sektörden yaklaşan bilanço varsa çıkıyor ve
          sabit ızgarada boş kalan göz sayfayı "bir şey yüklenemedi" gibi
          bitiriyordu. */}
      <div
        className={cn(
          /* Yan yana kartlar aynı hizada biter — `items-start` yok. İkisi de
             liste kartı, içlerinde sabit yükseklikli bir çizim olmadığı için
             gerilme boşluğu doğrudan kartın altına gidiyor. */
          "grid gap-4",
          /* EŞİT İKİ YARI (24 Eylül). 360 piksellik referans sütunu ile
             kalan genişlik düzeninde rehber kartları yan yana SATIR
             düzeninde basılıyordu ve kartın içeriği 111 piksel yukarıda
             bitiyordu (1440; 1024'te 82). Rakip listesi varken rehber
             kartları ALT ALTA (`stack`) — ikisi aynı boyda biter.
             `bottomCards === 3` koşulu hiç doğru olamıyordu (sayı 1 ya
             da 2), yani yığma dalı hiç çalışmamıştı. */
          bottomCards === 2 && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        )}
      >
        {peers.length > 0 && (
          <Panel className="px-4 py-4 sm:px-5">
            <h2 className="mb-3 flex items-center gap-2.5 text-title font-bold text-strong">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-wash text-primary-ink"
              >
                <CalendarBlank weight="duotone" size={15} />
              </span>
              {t.analysis.upcomingEarnings}
            </h2>
            <div className="flex flex-col">
              {peers.map((peer) => (
                /* Satır bir <a> DEĞİL, yüzeyi kaplayan bir <a> TAŞIYAN kutu:
                   takvim düğmesi kendi bağlantısını taşıyor ve iç içe
                   bağlantı geçersiz HTML. Görünüm birebir aynı kalıyor. */
                <div
                  key={peer.id}
                  /* Vurgu, sitedeki diğer listelerle aynı: satırın tamamı
                     panel kenarına kadar boyanıyor. `opacity-75` satırı
                     soldurup geri çekiyordu — tıklanabilir bir satırın
                     tersi. Negatif margin, dolguyu panelin kenarına
                     taşıyor. */
                  className="relative -mx-4 flex items-center gap-2.5 border-b border-line-soft px-4 py-2.5 transition-colors last:border-b-0 hover:bg-primary-tint sm:-mx-5 sm:px-5"
                >
                  <Link
                    href={`/hisse/${peer.symbol}`}
                    prefetch={false}
                    aria-label={peer.symbol}
                    className="absolute inset-0"
                    /* Şirket kartı: satırı kaplayan bağlantı imlecin altındaki
                       öğe, kart onda açılıyor. */
                    data-cc={peer.symbol}
                  />
                  {/* Logo, satırı bir sembol listesi olmaktan çıkarıp
                      sayfanın geri kalanıyla aynı dile sokuyor (mercek
                      künyeleri ve analiz tablosu da logodan besleniyor). */}
                  <LogoTile symbol={peer.symbol} logoUrl={peer.logoUrl} size="xs" />
                  <span className="shrink-0 text-small font-bold text-strong">
                    {peer.symbol}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-body">
                    {peer.name ?? ""}
                  </span>
                  <span className="numeral shrink-0 text-tiny text-muted">
                    {formatEtDateCompact(peer.reportDate, locale)}
                  </span>
                  <AddToCalendar
                    symbol={peer.symbol}
                    date={peer.reportDate}
                    label={t.earnings.addToCalendar}
                    compact
                    className="-mr-1.5"
                  />
                </div>
              ))}
            </div>
            <Suspense fallback={null}>
              <CompanyCards symbols={peers.map((peer) => peer.symbol)} />
            </Suspense>
          </Panel>
        )}

        <GuideHint
          label={t.guide.contextLabel}
          locale={locale}
          slugs={["bilanco", "degerleme"]}
          layout={peers.length > 0 ? "stack" : "row"}
        />
      </div>
    </>
  );
}
