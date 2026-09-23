import { Segment, SegmentItem } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Yazılar ekranının kendi sekmeleri — Mercek ve Bülten.
 *
 * SİTENİN SEGMENTİ, SAYFA BAŞLIĞININ DENETİMİ (23 Eylül denetimi). Burada
 * elle kurulmuş bir kutu vardı: kenarlıklı bir ray, içinde `bg-surface`
 * dolgulu seçili hap ve elle yazılmış bir gölge rengi. Seçili hap rayından
 * 1,05:1 (koyu 1,16:1) ayrışıyordu — "dolu" durum görünmüyor, seçimi
 * yalnızca yazı kalınlığı söylüyordu. Hap 40 piksel, sitenin segment ve
 * sekme ölçüsü 44. Ve kendi 50 piksellik bandında duruyordu, 1440'ta sağında
 * 845 piksel boşlukla. Şimdi sitenin `Segment`i: tam yuvarlak ray, seçili
 * öğe `bg-primary`, ve `PageHeader`ın `action` yuvasında — sitenin kendi
 * bülten arşivi Günlük | Haftalık'ı aynı yere koyuyor. Başlığın sağındaki
 * boşluk iş görüyor, ayrı bant ve altındaki aralık kalktı.
 *
 * İKİNCİ SEVİYE, İKİNCİ BİÇİM hâlâ geçerli: üst sekme çubuğu (`AdminTabs`)
 * altı çizgili; bu da çizgili olsaydı üst üste iki özdeş çubuk dururdu ve
 * hangisinin hangi seviyeye ait olduğu okunmazdı.
 *
 * `aria-current="page"`: iki öğe iki AYRI ADRES, aynı sayfanın süzgeci
 * değil — segmentin varsayılanı ("true") burada yanlış olurdu.
 *
 * SUNUCU BİLEŞENİ, `usePathname` DEĞİL. Hangi sekmenin etkin olduğunu rota
 * zaten biliyor ve iki liste sayfası da sunucuda çiziliyor; adres okumak
 * için istemciye inmek, tamamen sunucuda duran bir ekrana JavaScript
 * eklemek olurdu.
 *
 * SAYILAR ARŞİVİN BÜYÜKLÜĞÜ, listenin uzunluğu değil — listeler kırpılmış
 * ve süzgeçli, oradaki satır sayısı "kaç yazı var" sorusuna yanlış cevap
 * verirdi. Bülten sayısı FARKLI bülten (gün, dönem), dil satırı değil
 * (lib/admin-data.ts → `getWritingCounts`). Sayım OKUNAMADIYSA sayı hiç
 * çizilmiyor: "0" yazmak arşivi boş ilan etmek olurdu (`AdminResult`).
 *
 * EDİTÖRLERDE ÇİZİLMİYOR. Bir yazıyı düzenlerken tür değiştirmek diye bir
 * iş yok; oradaki gezinme "Yazılara Dön" bağlantısı ve o da kendi
 * sekmesine dönüyor (bülten editörü bülten listesine).
 */

type Sekme = "mercek" | "bulten";

/* Etiket tekil ve kısa: "Mercek Yazıları | Bültenler" 390 pikselde sayılarla
   birlikte rayı iki satıra zorlayacak kadar uzundu. Neyin listelendiğini
   panelin başlığı söylüyor ("Son 40 Yazı"). */
const SEKMELER = [
  { key: "mercek", href: "/admin/yazilar", label: "Mercek" },
  { key: "bulten", href: "/admin/yazilar/bulten", label: "Bülten" },
] as const;

export function YazilarTabs({
  active,
  counts,
}: {
  active: Sekme;
  /** `null`: sayım okunamadı — sayı yok, sıfır değil. */
  counts: { stories: number; briefs: number } | null;
}) {
  return (
    <nav aria-label="Yazı türleri" className="shrink-0">
      <Segment>
        {SEKMELER.map((sekme) => {
          const secili = sekme.key === active;
          const adet = counts
            ? sekme.key === "mercek"
              ? counts.stories
              : counts.briefs
            : null;
          return (
            <SegmentItem
              key={sekme.key}
              href={sekme.href}
              active={secili}
              current="page"
            >
              {sekme.label}
              {/* SAYI AYNI MÜREKKEPTE, İNCE AĞIRLIKTA. Seçili hapın üstünde
                  ayrı bir rozet zemini ya da saydamlaştırılmış bir renk,
                  12 piksellik rakamı okuma eşiğinin altına itiyordu; ayrım
                  ağırlıkla kuruluyor. Seçili olmayan öğede sayı bir ton
                  geride. */}
              {adet !== null && (
                <span
                  className={cn(
                    "numeral ml-1.5 font-normal",
                    !secili && "text-muted",
                  )}
                >
                  {adet.toLocaleString("tr-TR")}
                </span>
              )}
            </SegmentItem>
          );
        })}
      </Segment>
    </nav>
  );
}
