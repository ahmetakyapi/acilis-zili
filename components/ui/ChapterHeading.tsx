import { cn } from "@/lib/utils";

/**
 * Bölüm (chapter) başlığı — uzun sayfaları bölen tek başlık kalıbı.
 *
 * NEDEN VAR: hisse ve bilanço sayfaları aynı işi iki ayrı elle yazıyordu
 * (`SectionHeading` / `.chapterHeading`) ve ikisi de başlığın sağına 30
 * piksellik bir `ArrowDownRight` koyuyordu: bağlantı gibi duran ama hiçbir
 * yere götürmeyen bir süs. Hisse sayfası ayrıca her başlığın altına yaklaşık
 * sekiz yüz sayfada birebir aynı olan genel bir cümle basıyordu ("Fiyatın
 * ötesinde…"); o cümle bilgi taşımıyordu.
 *
 * Kurallar:
 * - Başlık, bölüme atlayan sekmenin etiketiyle AYNI sözlük anahtarından
 *   okunur. Sekme "Anahtar Metrikler" derken bölüm "Değerleme ve
 *   Beklentiler" diye açılıyordu; okuyucu tıkladığı yeri başka bir adla
 *   buluyordu.
 * - Sıra numarası yok ("01 · …"): tasarım becerisinin §9.F maddesi ve
 *   /teknik'te 23 Eylül'de kaldırılan "01" karosu ("sıra bildirmeyen bir
 *   süs") aynı kararı veriyor.
 * - İkon yok.
 * - `dek` isteğe bağlı TEK SATIRLIK bir VERİ cümlesi ("F/K 28,95 ·
 *   Analistlerin %94'ü Al Yönünde"); genel bir tanıtım cümlesi değil.
 *
 * Ölçü globals.css → `.chapter-heading`. Kısa tek satırlık bir manşet
 * olduğu için genel `main h2` mürekkebini alır (tema istisnası).
 * `data-motion-reveal`: `MotionExperience` içindeyse ekranın altından bir
 * kez belirir; ilk ekrandaysa kımıldamaz.
 */
export function ChapterHeading({
  title,
  dek,
  id,
  className,
}: {
  title: string;
  dek?: React.ReactNode;
  /** Başlığın kendi kimliği — `aria-labelledby` için. Çapa bölüme verilir. */
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("chapter-heading", className)} data-motion-reveal>
      <h2 id={id}>{title}</h2>
      {dek && <p>{dek}</p>}
    </div>
  );
}
