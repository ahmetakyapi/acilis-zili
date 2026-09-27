import { Article, Scales } from "@phosphor-icons/react/dist/ssr";
import { Panel } from "@/components/ui/primitives";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { RichText } from "@/components/earnings/RichText";
import type { AutoLinker } from "@/lib/autolink";
import { ScrollStage, Reveal } from "@/components/motion/PremiumMotion";
import styles from "@/components/earnings/EarningsReport.module.css";
import type { Dictionary } from "@/lib/i18n";
import type { EarningsAnalysisRow } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { PanelHead } from "./PanelHead";

/** Okuma bölümü — özet ve detaylı değerlendirme; sayfa dosyasından taşındı. */
export function ReportReading({
  row,
  t,
  linker,
}: {
  row: EarningsAnalysisRow;
  t: Dictionary;
  /** Sayfanın tek bağlayıcısı — gerekçe `RichText`te. */
  linker: AutoLinker;
}) {
  return (
    <>
          {/* ---- Metin katmanı ----
              İkisi de sayfanın tam genişliğinde bir panelken metin `max-w`
              ile ~92 karaktere kısılıyordu: sol tarafta bir metin bloğu,
              sağ tarafta 400 piksellik boşluk. Sütunlaştırma iki sorunu
              birden çözüyor — genişlik gerçekten kullanılıyor ve satır boyu
              her kırılma noktasında okunur bandın içinde kalıyor (1300px'te
              üç sütun ≈ 58 karakter, tek sütunda 100'ün üstündeydi).

              Bloklar `break-inside-avoid`: bir paragrafın ortasından
              bölünüp iki sütuna yayılması, sayfayı gazete değil bozuk bir
              düzen gibi gösteriyordu. */}
          {/* Çapa kimliği dönüşümsüz dış kapta — gerekçe `ScrollStage`
              başında (sekmeden atlanınca bölüm çubuğun arkasına iniyordu). */}
          <ScrollStage id="report-reading"><section className={styles.readingSection}>
          <ChapterHeading title={t.analysis.chapterReading} />
          <Reveal>
          <Panel className={cn(styles.summaryPanel, "p-5 sm:p-6")}>
            {/* Okuma süresi künyesi kaldırıldı: metin zaten ekranda ve ne
                kadar sürdüğü, okunup okunmayacağına dair bir karar
                değiştirmiyordu — panelin sağ ucunda taşıdığı tek şey
                gürültüydü. */}
            <PanelHead icon={Article} title={t.analysis.summary} />
            {/* İlk paragraf GİRİŞ ölçüsünde: üç sütun eşit puntoda dizilince
                metin duvara dönüyor ve göz nereden başlayacağını yüzeyden
                okuyamıyordu. Bir kademe iri ve koyu bir giriş, sütunun
                başlangıcını işaretliyor — kalan paragraflar gövde ölçüsünde
                kalıyor, yani hiyerarşi bir kademe, iki değil. */}
            {/* GÖVDE KENDİ DİLİNİ SÖYLÜYOR — mercek sayfasındaki kuralın
                aynısı. Çevirisi olmayan analiz orijinal dilinde gösteriliyor
                (üstteki rozet bunu yazıyor) ama `lang` verilmediği için
                Türkçe paragraflar `<html lang="en">` altında kalıyordu:
                ekran okuyucu yanlış fonetikle okuyor, tarayıcının "çevir"
                önerisi devreye girmiyordu. Mercek düzeltilmiş, burası
                atlanmıştı. */}
            {/* GİRİŞ SOLDA, DESTEK SAĞDA (24 Eylül). Giriş 32em'de, kartın
                sol yarısında duruyordu ve sağında boşluk vardı; kalan
                paragraflar altında 15 puntoluk iki dar sütundaydı — kart
                "zayıf" okunuyordu (sahibinin geri bildirimi). Geniş ekranda
                artık iki sütunlu bir ızgara: solda iri giriş (kartın
                ~%55'i, satır ~60 harf), sağda kıl çizgiyle ayrılmış
                destekleyici paragraflar alt alta ve okunur puntoda. Kartın
                bütün genişliği kullanılıyor, satır boyu iki sütunda da
                okunur bantta. Dar ekranda alt alta. */}
            <div className={styles.summaryProse} lang={row.locale}>
              {row.summary.length > 0 && (
                <p className={cn(styles.summaryLead, "[text-wrap:pretty]")}>
                  <RichText text={row.summary[0]} linker={linker} />
                </p>
              )}
              {row.summary.length > 1 && (
                <div className={styles.summaryRest}>
                  {row.summary.slice(1).map((paragraph, index) => (
                    <p key={index} className="[text-wrap:pretty]">
                      <RichText text={paragraph} linker={linker} />
                    </p>
                  ))}
                </div>
              )}
            </div>
          </Panel>
          </Reveal>

          {row.analysis.length > 0 && (
            <Reveal>
            <Panel className={cn(styles.analysisPanel, "p-5 sm:p-6")}>
              {/* Sağ uçtaki "CLAUDE" künyesi fiilsiz bir addı ve başlıkla
                  yarışıyordu; ne yaptığını söyleyen hâli ("Claude ile
                  Hazırlandı") alt bilgideki uyarının yanında. */}
              <PanelHead icon={Scales} title={t.analysis.detailed} />
              {/* ---- Bölümler: ızgara, sütun AKIŞI değil ----
                  Bir süre çok sütunlu (multicol) dizildi ve okuma sırası
                  sütun sütun aşağı iniyordu: soldaki bölüm 1'i okuyup
                  ortadaki 2 ile 3'e, sonra sağdaki 4'e geçmek gerekiyordu.
                  Göz satır satır soldan sağa okumaya çalışınca bölümler
                  birbirinin üstüne biniyor gibi duruyordu — sıra numaraları
                  bile kurtarmıyordu.

                  Izgarada sıra beklenen yönde: soldan sağa, sonra alt satır.
                  Sütun sayısı genişlikle artıyor, böylece satır boyu her
                  kırılmada okunur bantta kalıyor (1300px'te üç sütun ≈ 52
                  karakter). Her hücrenin üstündeki hairline bölümleri
                  birbirinden ayırıyor ve aynı satırdakiler hizalı başlıyor. */}
              {/* ---- Sütun sayısı BÖLÜM SAYISINA göre ----
                  Sabit üç sütunda dört bölüm, son satıra tek başına düşen
                  bir bölüm ve yanında iki sütunluk bomboş bir alan
                  bırakıyordu: panelin altı yarım kalmış gibi duruyordu.
                  Kural artık TEK yerde, modülde (`.analysisGrid`): burada
                  duran üçlü, modülün sonundaki katmansız bir kuralca
                  eziliyordu ve beş bölümlü analizlerde beşinci bölüm yine
                  tek başına kalıyordu. */}
              <div className={styles.analysisGrid} lang={row.locale}>
                {/* Sıra numarası başlığın YANINDA değil ÜSTÜNDE: karo,
                    başlığın ilk satırını içeri itiyor ve iki satıra taşan
                    başlıklarda ikinci satır karonun altından başlayınca
                    blok sola doğru tırtıklı görünüyordu. Numara kendi
                    satırına çıkınca başlık tam genişlikte, sol kenar
                    hizalı — rehberdeki müfredat şeridiyle aynı dil. */}
                {row.analysis.map((section, index) => (
                  <section key={index} data-motion-reveal className={cn(styles.analysisItem, "border-t border-line")}>
                    <span
                      aria-hidden
                      className="numeral mb-1.5 block text-tiny font-bold tracking-[0.04em] text-primary"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mb-2 text-base font-bold leading-[20px] tracking-[-0.015em] text-strong [text-wrap:balance]">
                      {section.title}
                    </h3>
                    <p className="text-base leading-[22px] text-body [text-wrap:pretty]">
                      <RichText text={section.body} linker={linker} />
                    </p>
                  </section>
                ))}
              </div>
            </Panel>
            </Reveal>
          )}
          </section></ScrollStage>
    </>
  );
}
