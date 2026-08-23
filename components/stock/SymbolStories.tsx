import { StoryCard } from "@/components/stories/StoryCard";
import {
  sinceEventReturn,
  type CastMember,
} from "@/components/stories/StoryVisual";
import { PanelLink, Skeleton } from "@/components/ui/primitives";
import {
  countStoriesForSymbol,
  getStatus,
  getSymbolNames,
  type StoryIndexRow,
} from "@/lib/data";
import { getChartBarsMulti } from "@/lib/providers";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, plural } from "@/lib/utils";

/**
 * Bu şirket hakkında yazılmış mercek yazıları.
 *
 * NEDEN BURADA: mercek yazıları bir olayı anlatıyor ve o olayın öznesi
 * çoğunlukla tek bir şirket — ama okuyucu o yazıya ancak Mercek arşivine
 * gidip aramayı akıl ederse ulaşabiliyordu. Hisse sayfası ise okuyucunun
 * "bu şirkete ne oldu" diye baktığı yer; yazının tam olarak cevapladığı soru
 * bu. Bağlantı tersine zaten vardı (yazıdan hisseye), bu yönü eksikti.
 *
 * ARŞİVİN KARTI BURADA DA KULLANILIYOR. Blok üç düz metin satırıydı: kalın
 * başlık, iki satır giriş, soluk bir künye — 1400 piksel genişliğe yayılmış,
 * içinde tek bir görsel öğe olmayan gri bir metin adası. Aynı yazılar için
 * arşivde kurulmuş bir görsel dil zaten vardı (kadro şeridi + künye +
 * degrade başlık) ve o kart artık ortak bir bileşen (`StoryCard`), yani
 * ikinci bir kopya yazılmadı.
 *
 * PANEL KUTUSU YOK — çünkü kartın kendisi bir panel. Kutunun içine kutu
 * koymak aynı hairline'ı ve aynı 16 piksellik yarıçapı iki kez çizmek
 * demekti; projenin kural dili bunu "kart içinde ikinci kutu yok" diye
 * yazıyor. (İç içe yüzeylerin KONTRASTINDA bir sorun yok, o basamak
 * ölçülerek kuruldu — mesele geometrinin tekrarı.) Blok bunun yerine ana
 * sayfadaki haber bandının desenini izliyor: kutusuz başlık + alt kural
 * çizgisi + ızgara.
 */
export async function SymbolStories({
  rows,
  symbol,
  locale,
  t,
}: {
  /** Sayfa tarafından ÖNCEDEN çekilmiş satırlar — gerekçesi aşağıda. */
  rows: StoryIndexRow[];
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  if (rows.length === 0) return null;

  const status = await getStatus();
  const kadroSembolleri = [...new Set(rows.flatMap((row) => row.symbols ?? []))];

  /* Bar YALNIZCA sayfanın sembolü için çekiliyor. Şeridin sağındaki rakam
     `cast[0]`ın getirisi ve aşağıda kadronun başına hep bu sembol konuyor,
     yani başka bir şirketin barını çekmek boşuna istek olurdu. Sağlayıcı
     Alpaca — hisse sayfasının asıl darboğazı olan Finnhub kotasına
     dokunmuyor. */
  const [meta, bars, toplam] = await Promise.all([
    getSymbolNames(kadroSembolleri),
    getChartBarsMulti([symbol], "1Y", status),
    countStoriesForSymbol(symbol),
  ]);

  /* KADRONUN BAŞINDA SAYFANIN ŞİRKETİ — arşivden ayrılan tek nokta ve
     bilinçli. Arşivde şerit yazının kendi sıralamasını izliyor; burada
     okuyucunun sorduğu soru "bu olaydan beri BU hisse ne yaptı" ve şeridin
     sağındaki rakam kadronun ilk sembolüne ait. Şeridin ilk logosu bir
     "yazının öznesi budur" iddiası taşımıyor: rakamın altında hangi sembole
     ait olduğu adıyla yazılı, başlık ve giriş de gerçeği söylemeye devam
     ediyor. */
  const kadroOf = (story: StoryIndexRow): CastMember[] =>
    [symbol, ...(story.symbols ?? []).filter((item) => item !== symbol)]
      .slice(0, 4)
      .map((item) => ({
        symbol: item,
        name: meta[item]?.name ?? null,
        logoUrl: meta[item]?.logoUrl ?? null,
        sinceEvent:
          item === symbol
            ? sinceEventReturn(bars[symbol], story.eventDate)
            : null,
      }));

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line pb-3">
        <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
          {t.stories.symbolPanelTitle}
        </h2>
        {/* SAYAÇ VE BAĞLANTI YALNIZCA GÖSTERİLENDEN FAZLASI VARSA. Yazısı
            olan 68 sembolün 42'sinde tek yazı var, 54'ünde üç ya da daha az:
            koşulsuz bir "Tüm Yazılar" bağlantısı okuyucuyu aynı üç karta
            geri götürüyordu. Bağlantı arşivi bu sembole SÜZÜYOR (filtre
            arşivde zaten var ve URL'de yaşıyor); filtresiz `/mercek`e
            gidiyordu ve NVDA sayfasından çıkan okuyucu kırk altı yazılık
            listeye düşüp aradığını yeniden aramak zorunda kalıyordu. */}
        {toplam > rows.length && (
          <span className="flex shrink-0 items-center gap-3">
            <span className="plate hidden whitespace-nowrap text-nano sm:inline">
              {plural(
                toplam,
                t.stories.symbolPanelCountOne,
                t.stories.symbolPanelCountMany,
              ).replace("{count}", String(toplam))}
            </span>
            <PanelLink
              href={`/mercek?sembol=${symbol}`}
              className="whitespace-nowrap"
            >
              {t.stories.symbolPanelAll}
            </PanelLink>
          </span>
        )}
      </div>
      <ul className={cn("mt-4 grid gap-4", izgaraSinifi(rows.length))}>
        {rows.map((story) => (
          /* `grid`: hücre satır boyuna geriliyor ama içindeki bağlantı ancak
             kap da bir ızgara ise o boya uzuyor — kartların alt kenarı böyle
             hizalı kalıyor. */
          <li key={story.slug} className="grid min-w-0">
            <StoryCard
              story={story}
              cast={kadroOf(story)}
              locale={locale}
              t={t}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Izgara davranışı KART SAYISINA bağlı — bilanço takvimindeki mini kart
 * ızgarasıyla aynı kural ve aynı gerekçe.
 *
 * Üç kart varsa sütunlar artan yeri paylaşır ve bant dolar. Bir ya da iki
 * kart varsa `1fr` felaket olur: kart 1400 pikselin tamamına yayılıp "kart"
 * olmaktan çıkar. Bu, seyrek görülen bir uç durum değil — yazısı olan 68
 * sembolün 42'sinde tek yazı var.
 */
function izgaraSinifi(count: number) {
  return count >= 3
    ? "sm:grid-cols-2 xl:grid-cols-3"
    : "sm:grid-cols-[repeat(auto-fit,minmax(18rem,26rem))] sm:justify-start";
}

/**
 * Yer tutucu — YÜKSEKLİKLE DEĞİL YAPIYLA eşleşiyor.
 *
 * Blok `fallback={null}` ile akıyordu ve doğru gerekçesi vardı: 806 sembolün
 * yalnızca 68'inde yazı var, hiç gelmeyecek bir blok için yer ayırmak yanlış
 * olurdu. Ama kartlara geçince bloğun boyu mobilde ~840 piksele çıktı ve o
 * boy geç gelip altındaki her şeyi ittiği için hisse sayfasının mobil CLS'i
 * ölçüldü: NVDA 0,266 · SNDK 0,139 · MU 0,120.
 *
 * Çözüm ikisini birden koruyor: "yazı var mı" sorusu sayfada, akıştan ÖNCE
 * yanıtlanıyor (yerel bir veritabanı okuması) ve yalnızca yazı VARSA bu
 * iskelet basılıyor. Yazısı olmayan sembolde hâlâ hiçbir şey yok.
 */
export function SymbolStoriesSkeleton({ count }: { count: number }) {
  return (
    <section className="min-w-0">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <div className={cn("mt-4 grid gap-4", izgaraSinifi(count))}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-[264px] w-full rounded-(--radius-xl)" />
        ))}
      </div>
    </section>
  );
}
