/**
 * ::: blok çiplerinin VERİSİ — editörlerin paylaştığı tek liste (15 Ekim).
 *
 * components/admin/StoryEditor.tsx içinde yaşıyordu; kullanıcı yazıları
 * editörü (components/community/PostEditor.tsx) aynı çipleri basınca liste
 * "beşinci tüketen" olacaktı ve iki kopya er geç ayrı düşerdi (`oncesi`
 * bloğunun bir dönem çipsiz kalması tam bu yüzdendi — StoryEditor'daki
 * karar kaydı). Düz modül, "use client" değil: veri her iki istemci
 *bileşenine de sorunsuz gider.
 *
 * YENİ BLOK = BEŞ YER kuralı (CLAUDE.md) değişmedi; bu liste o beş
 * yerden biri (eskiden StoryEditor'daki kopyaydı).
 *
 * SATIRLAR BELGEDEKİ SÖZDİZİMİYLE: örnekler "- " ile başlamaz, ayrıştırıcı
 * tireyi atmıyor (gerekçe StoryEditor'da ölçülmüş hâliyle duruyor).
 */
export const BLOKLAR = [
  {
    ad: "sayilar",
    etiket: "Sayılar",
    tr: "::: sayilar Rakamlarla\n4,2 Mr $ | Toplam tutar\n:::",
    en: "::: sayilar By the Numbers\n$4.2B | Total amount\n:::",
  },
  {
    ad: "bar",
    etiket: "Çubuk",
    tr: "::: bar Karşılaştırma\nEtiket | 58,4\n:::",
    en: "::: bar Comparison\nLabel | 58.4\n:::",
  },
  /* NÖTR KİP (25 Ekim) — `bar`ın bayrağı (`parse-blocks.ts` →
     `NEUTRAL_FLAG`): yön taşımayan büyüklükte (kesinti, gelir, değerleme)
     çubuk yeşil/kırmızı değil metin tonunda çizilir. */
  {
    ad: "bar-notr",
    etiket: "Nötr Çubuk",
    tr: "::: bar notr Büyüklük\nEtiket | 7,4 Mr $\nEtiket | 5,5 Mr $\n:::",
    en: "::: bar notr Size\nLabel | $7.4B\nLabel | $5.5B\n:::",
  },
  {
    ad: "pay",
    etiket: "Pay",
    tr: "::: pay Pazar Payı\nŞirket | 42\nDiğerleri | 58\n:::",
    en: "::: pay Market Share\nCompany | 42\nOthers | 58\n:::",
  },
  {
    ad: "akis",
    etiket: "Akış",
    tr: "::: akis Zincir\nAdım | Oyuncu\n:::",
    en: "::: akis Chain\nStep | Player\n:::",
  },
  {
    ad: "oncesi",
    etiket: "Önce ve Sonra",
    tr: "::: oncesi Piyasa Değeri\n52,5 Mr $ | 12 Haziran\n19 Mr $ | 29 Temmuz\n:::",
    en: "::: oncesi Market Value\n$52.5B | June 12\n$19B | July 29\n:::",
  },
  /* ADIM KİPİ (24 Ekim) — ayrı blok değil, `akis`/`oncesi`nin bayrağı
     (`parse-blocks.ts` → `STEP_FLAG`). Çip ayrı, çünkü yazar kipin
     sözdizimini ezberlemek zorunda kalmasın; `ad` React anahtarı olarak
     da kullanılıyor, tekil kalmalı. */
  {
    ad: "akis-adim",
    etiket: "Adım Adım Akış",
    tr: "::: akis adim Zincir\nAdım | Oyuncu\nSonraki Adım | Oyuncu\n:::",
    en: "::: akis adim Chain\nStep | Player\nNext Step | Player\n:::",
  },
  {
    ad: "oncesi-adim",
    etiket: "Adım Adım Önce ve Sonra",
    tr: "::: oncesi adim Piyasa Değeri\n52,5 Mr $ | 12 Haziran\n19 Mr $ | 29 Temmuz\n:::",
    en: "::: oncesi adim Market Value\n$52.5B | June 12\n$19B | July 29\n:::",
  },
  {
    ad: "zaman",
    etiket: "Kronoloji",
    tr: "::: zaman Kronoloji\n12 Ağustos | Olay\n:::",
    en: "::: zaman Timeline\nAugust 12 | Event\n:::",
  },
  {
    ad: "grafik",
    etiket: "Grafik",
    tr: "::: grafik NVDA | 3M | Nvidia, bugünden geriye üç ay\n:::",
    en: "::: grafik NVDA | 3M | Nvidia, three months back from today\n:::",
  },
  {
    ad: "ornek",
    etiket: "Örnek",
    tr: "::: ornek Hesap\n**Adım:** açıklama\n:::",
    en: "::: ornek Worked Example\n**Step:** explanation\n:::",
  },
  {
    ad: "dikkat",
    etiket: "Dikkat",
    tr: "::: dikkat Uyarı\nMetin\n:::",
    en: "::: dikkat Caution\nText\n:::",
  },
  {
    ad: "ozet",
    etiket: "Özet",
    tr: "::: ozet Ders\nMetin\n:::",
    en: "::: ozet Takeaway\nText\n:::",
  },
  {
    ad: "tanim",
    etiket: "Tanım",
    tr: "::: tanim Terim\n**Terim:** açıklama\n:::",
    en: "::: tanim Term\n**Term:** definition\n:::",
  },
] as const;

export type ArticleBlockChip = (typeof BLOKLAR)[number];
