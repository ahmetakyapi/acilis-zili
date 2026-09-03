import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { CompareAdd } from "@/components/markets/CompareAdd";
import { LogoTile, Panel } from "@/components/ui/primitives";
import { seriesColorOf } from "@/lib/chart-series";
import { compareHref } from "@/lib/compare";
import { getSymbolNames } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";

/**
 * Karşılaştırmanın BOŞ EKRANI.
 *
 * Eski hâli tek bir panelin içinde ortalanmış iki satır yazı, bir arama
 * kutusu ve altında üç düz çipti. Ekran ürünün en görsel sayfasına açılan
 * kapı ama kendisi bir form gibi duruyordu: hazır setler yalnızca metindi
 * ("Yarı İletken · NVDA · AMD · AVGO · MU"), yani okuyucu bir seti seçmeden
 * önce ne alacağını göremiyordu.
 *
 * Üç şey değişti:
 *
 *   HAZIR SETLER KART OLDU. Her kart dört şirketin GERÇEK logosunu taşıyor —
 *   bu ekranın elindeki tek meşru görsel kaynağı o (`symbols.logo_url`,
 *   depoda "fotoğraf yok" kuralının belgeli istisnası). Logolar renk ve
 *   biçim getiriyor, üstelik uydurma bir şey göstermeden: ekranda tek bir
 *   sayı yok, çünkü seçim yapılmadan önce gösterilecek dürüst bir sayı da
 *   yok.
 *
 *   HER SETİN NİYE BİR ARADA OLDUĞU YAZIYOR. "Yarı İletken" başlığı setin
 *   ADINI söylüyordu ama sorusunu değil. Tek satırlık künye, kartı bir
 *   etiketten bir öneriye çeviriyor.
 *
 *   RENK ANAHTARI ÖNDEN VERİLİYOR. Logonun altındaki ince ray, o sembolün
 *   grafikte alacağı seri rengi. Okuyucu karşılaştırmaya girdiğinde renkler
 *   ona yabancı olmuyor.
 *
 * MALİYET: tek bir veritabanı sorgusu (`getSymbolNames`, on iki sembol, tek
 * `inArray`). Sağlayıcıya gidilmiyor — boş ekranda canlı fiyat göstermek
 * ekranı yavaşlatır ve seçim yapmaya yardımı olmaz.
 */

export type ComparePreset = {
  labelKey: keyof Dictionary["compare"];
  noteKey: keyof Dictionary["compare"];
  symbols: string[];
};

export async function CompareEmpty({
  presets,
  t,
}: {
  presets: readonly ComparePreset[];
  t: Dictionary;
}) {
  const names = await getSymbolNames(presets.flatMap((preset) => preset.symbols));

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Kendi setini kur ----
          Arama kutusu ekranın ORTASINDA ve açık başlıyor: boş ekranda
          yapılacak başka bir şey yok. Eski metin okuyucuyu bir hisse
          sayfasına yolluyordu, oysa ekleme yolu bu ekranın içinde.

          GENİŞ EKRANDA BANT, DAR EKRANDA KAHRAMAN. Ortalanmış hâli 1280
          pikselde 350 piksellik boş bir kutuydu: içinde bir başlık, bir
          cümle ve 384 piksellik bir kutu, geri kalanı hava. Yatay düzende
          başlık solda, kutu sağda — aynı içerik, ölü alan yok. Telefonda
          yan yana koyacak yer olmadığı için dikey ve ortalı kalıyor. */}
      <Panel>
        <div className="flex flex-col items-center gap-3 px-5 py-8 text-center sm:px-8 lg:flex-row lg:justify-between lg:gap-10 lg:py-7 lg:text-left">
          <div className="flex flex-col items-center gap-2 lg:items-start">
            {/* Sayfa başlığı ürünün ADINI veriyor ("Karşılaştır"); buradaki
                başlık okuyucudan ne beklendiğini söylüyor. İkisi tekrar
                değil, biri ad biri yönerge. */}
            <h2 className="display-ink w-fit text-heading font-bold tracking-[-0.02em]">
              {t.compare.empty}
            </h2>
            <p className="max-w-md text-read leading-relaxed text-body">
              {t.compare.emptyHint}
            </p>
          </div>
          <div className="mt-1 w-full max-w-sm shrink-0 lg:mt-0 lg:w-80">
            <CompareAdd
              symbols={[]}
              rangeParam={null}
              defaultOpen
              wide
              labels={{
                add: t.compare.addSymbol,
                placeholder: t.compare.addPlaceholder,
                cancel: t.common.cancel,
                noResults: t.stock.notFound,
                searching: t.common.loading,
                searchFailed: t.common.error,
              }}
            />
          </div>
        </div>
      </Panel>

      {/* ---- Hazır setler ---- */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="plate text-nano tracking-[0.09em]">
            {t.compare.presets}
          </h2>
          <p className="text-tiny text-muted">{t.compare.presetsHint}</p>
        </div>

        {/* Dört kart: telefonda tek sütun, tablette iki, geniş ekranda dört.
            Üç kartken ara kırılım yoktu — iki sütunda üçüncü kart yalnız
            kalıp ızgarayı tırtıklı bitiriyordu. Dörtte o sorun yok, iki
            sütun tam oturuyor. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {presets.map((preset) => (
            <Link
              key={preset.labelKey}
              href={compareHref(preset.symbols)}
              className="group flex flex-col gap-4 rounded-(--radius-lg) border border-line bg-surface p-4 transition-colors hover:border-primary-faint hover:bg-primary-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
            >
              <div className="flex items-start gap-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold leading-tight text-strong">
                    {t.compare[preset.labelKey]}
                  </p>
                  <p className="mt-1.5 text-tiny leading-relaxed text-muted">
                    {t.compare[preset.noteKey]}
                  </p>
                </div>
                <ArrowRight
                  aria-hidden
                  weight="bold"
                  size={13}
                  className="mt-1 shrink-0 text-muted transition-colors group-hover:text-primary"
                />
              </div>

              {/* Logolar dört eşit sütunda. Kart içinde ikinci bir kutu yok:
                  ayrım tek hairline ve bir ton basamağı.

                  LOGOSU OLMAYAN SEMBOL KENDİ ADINI TAŞIYOR. `LogoTile`ın
                  yedeği sembolün ilk iki harfini basıyor ve bu, altında zaten
                  tam sembolün yazdığı bir kartta kırık görünüyordu: endeks
                  fonları setinin dördü de logosuz ve kart "SP · QQ · DI · IW"
                  diyordu — sağlayıcı ETF'lere logo vermiyor, eksik olan veri
                  değil, gösterim biçimiydi. Etiket o durumda tekrar
                  edilmiyor; künye rayla birlikte alt hizada kalsın diye
                  yükseklik sabit. */}
              <ul className="grid grid-cols-4 gap-2 border-t border-line-soft pt-3.5">
                {preset.symbols.map((symbol) => {
                  const logoUrl = names[symbol]?.logoUrl;
                  return (
                    <li
                      key={symbol}
                      className="flex min-h-[62px] min-w-0 flex-col items-center justify-between gap-1.5"
                    >
                      {logoUrl ? (
                        <>
                          <LogoTile
                            symbol={symbol}
                            logoUrl={logoUrl}
                            size="md"
                          />
                          <span className="numeral w-full truncate text-center text-nano font-bold text-strong">
                            {symbol}
                          </span>
                        </>
                      ) : (
                        <span className="numeral flex h-8 w-full items-center justify-center rounded-(--radius-sm) bg-primary-wash px-1 text-tiny font-bold tracking-[-0.02em] text-primary-ink">
                          {symbol}
                        </span>
                      )}
                      {/* Grafikte alacağı seri rengi — anahtar önden
                          veriliyor. Eşleme gerçek ekranla AYNI fonksiyondan
                          (`seriesColorOf`); indise bakan bir kopya, ileride
                          sıralama değişirse önizlemeyi sessizce yalancı
                          yapardı. */}
                      <span
                        aria-hidden
                        className="h-[3px] w-4 shrink-0 rounded-full"
                        style={{
                          background: seriesColorOf(preset.symbols, symbol),
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Nasıl okunur ----
          Üç cümle, üç kutu DEĞİL: tek panel, hairline'la bölünmüş üç sütun.
          Ekranın en altında duruyor çünkü seçim yapmaya hazır olan okuyucu
          buraya hiç bakmadan yukarıdan çıkıyor. */}
      <section className="flex flex-col gap-3">
        <h2 className="plate text-nano tracking-[0.09em]">
          {t.compare.howTitle}
        </h2>
        <Panel>
          <div className="grid divide-y divide-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {(
              [
                [t.compare.howScale, t.compare.howScaleText],
                [t.compare.howRange, t.compare.howRangeText],
                [t.compare.howGroups, t.compare.howGroupsText],
              ] as const
            ).map(([title, text]) => (
              <div
                key={title}
                className="flex flex-col gap-1.5 px-4 py-4 sm:px-5"
              >
                <p className="text-base font-bold leading-tight text-strong">
                  {title}
                </p>
                <p className="text-tiny leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
