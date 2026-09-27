import { Panel, PanelLink } from "@/components/ui/primitives";
import { getMacroRows } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import {
  cn,
  formatPercentPlain,
  formatPeriodLabel,
  formatPrice,
  NO_VALUE,
  unitLabel,
} from "@/lib/utils";

/* DÖRT SERİ AÇIKÇA SEÇİLİYOR — bir dönem `rows.slice(0, 4)` yazıyordu ve
   `getMacroRows` satırları SLUG'A GÖRE ALFABETİK döndürüyor. Yani panelin
   künyesi "dört ana seri" derken ekrana çıkanlar tesadüfen alfabenin ilk
   dördüydü: core-cpi, core-pce, cpi, fed-funds. Dördün üçü enflasyon ölçüsü,
   ikisi (TÜFE ve Çekirdek TÜFE) 2×2 ızgarada yan yana duran neredeyse aynı
   sayı, ve iş gücü tarafı ana sayfada HİÇ görünmüyordu — oysa aynı sayfanın
   gün şeridi istihdam raporunu yüksek etkili olay diye basıyor.

   Sıralama bir sunum niyeti taşımıyor; taşıdığını sanmak da seri listesine
   yeni bir slug eklendiği gün paneli sessizce değiştirirdi. Seçim artık
   editoryal: enflasyondan bir ölçü, fiyat tercihinden bir ölçü, iş gücünden
   bir ölçü, politikadan bir ölçü. Kalıp TODAY_YIELDS ile aynı. */
const MACRO_HOME_SLUGS = [
  "cpi",
  "core-pce",
  "unemployment",
  "fed-funds",
] as const;

/**
 * Makro özeti — dört ana seri, 23px sayı ve yön oklu önceki değer.
 *
 * Ok rengi yalnızca YÖN söyler, yorum yapmaz: düşüş kırmızı, yükseliş accent
 * mavi. Yeşil kasten kullanılmıyor — enflasyonun düşmesi iyi, istihdamın
 * düşmesi kötüdür; hisse tarafındaki yeşil/kırmızı sözlüğü buraya taşınırsa
 * okuyucuya "bu iyi haber" demiş oluruz. Etiket metni nötr gri kalır.
 */
export async function MacroSummary({ locale, t }: { locale: Locale; t: Dictionary }) {
  const rows = await getMacroRows();
  if (rows.length === 0) return null;

  /* Listede olmayan bir slug sessizce atlanır; tohumlama eksikse panel
     üç ölçüyle çıkar, boş bir hücre basmaz. */
  const shown = MACRO_HOME_SLUGS.map((slug) =>
    rows.find((row) => row.slug === slug),
  ).filter((row) => row !== undefined);
  if (shown.length === 0) return null;
  /* HİÇBİRİNİN DEĞERİ YOKSA PANEL HİÇ BASILMIYOR. Satırlar veritabanında
     tohumla açılıyor ve değerleri FRED senkronu dolduruyor; senkron hiç
     koşmamışsa dört başlık, dört tire ve dört "Veri yok" satırı 208 piksel
     yer kaplıyor (390'da ölçüldü) ve tek söylediği şey hiçbir şey
     bilmediğimiz. Aynı kural tahvil kartında zaten var (`YieldCard`,
     `values.every(...)`): bir ölçü panelinin boş hâli, boş bir ölçü paneli
     değil, hiç panel olmamasıdır. Tek tek boş kalan satır duruyor — orada
     "bilinmiyor" bir bilgi, çünkü yanındaki satırda bir sayı var. */
  if (shown.every((row) => row.latestValue === null)) return null;

  return (
    <Panel className="px-4 py-4 sm:px-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        {/* Tam boy başlık — yan kolonun tamamı gibi (26 Eylül'e kadar plaka). Gerekçe PanelHeader'da;
            bu panel kendi başlığını elden yazıyor (ölçü ızgarası bir
            `PanelHeader` düzeni değil), o yüzden sınıf burada tekrarlanıyor. */}
        <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
          {t.today.macroSummary}
        </h2>
        <PanelLink href="/makro">{t.common.showAll}</PanelLink>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {shown.map((row) => {
          const latest = row.latestValue;
          const prev = row.prevValue;
          const delta =
            latest !== null && prev !== null ? latest - prev : null;
          /* Yüzde işaretinin yeri DİLE bağlı: Türkçede sayıdan önce (%2,57),
             İngilizcede sonra (2.57%). Burada dize sonuna elle "%" ekleniyordu
             ve panel iki dilde de "2,57%" basıyordu — sitenin geri kalanı
             `formatPercentPlain` ile doğru yazarken bu panel kuralı
             çiğniyordu (bkz. lib/utils.ts → withPercent). */
          const isPct = row.unit === "%";
          /* Yüzde OLMAYAN seri (istihdam, bin kişi) `digits: 0` ister.
             `formatPrice`in varsayılanı 2 ve /makro aynı seriyi 0 ile
             yazıyor: seçim düzeltilip `payrolls` panele girdiği anda bu
             panel "147,00", /makro "147" diyecekti. Aynı sayının iki ekranda
             farklı görünmesi bu depoda bir kez düzeltilmiş bir hata.

             BİRİM DE YAZILIYOR — aynı hatanın ikinci yarısıydı. Basamak
             sayısı hizalanmıştı ama birim düşüyordu: PAYEMS burada ve
             /makro'da birimsiz "-23", ekonomik takvimde ise "-23 bin"
             görünüyordu. Etiket kararı lib/utils.ts → `unitLabel`. */
          const birim = unitLabel(row.unit, locale);
          const show = (value: number) =>
            isPct
              ? formatPercentPlain(value, locale, 2)
              : `${formatPrice(value, locale, { digits: 0 })} ${birim}`.trimEnd();
          return (
            <div key={row.seriesId}>
              <p className="truncate text-tiny text-muted">
                {locale === "tr" ? row.titleTr : row.titleEn}
              </p>
              <p className="tote mt-0.5 text-title">
                {latest !== null ? show(latest) : NO_VALUE}
              </p>
              {/* DÖNEM KÜNYESİ. Sayı 23 puntoyla basılıyor ama hangi aya ait
                  olduğu yazmıyordu; TÜFE ve istihdam haftalar geriden
                  yayımlanır ve okuyucu bunu bugünün verisi sanıyordu. Makro
                  ekranı aynı sayının yanına bu künyeyi zaten koyuyor. */}
              {row.periodLabel && (
                <p className="text-tiny text-muted">
                  {formatPeriodLabel(row.periodLabel, locale)}
                </p>
              )}
              <p className="numeral text-tiny text-muted">
                {delta === null ? (
                  t.common.noData
                ) : delta === 0 ? (
                  t.macro.unchanged
                ) : (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        "font-semibold",
                        delta > 0 ? "text-primary" : "text-down",
                      )}
                    >
                      {delta > 0 ? "▲" : "▼"}
                    </span>{" "}
                    {t.macro.previous} {show(prev!)}
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
