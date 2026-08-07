# Bilanço Karnesi — PNG Üretim Promptu

Bilanço analizinin **paylaşılabilir tek sayfalık görseli**. Site bu görseli
üretmez, yalnızca gösterir: analiz kaydındaki `card_image_url` alanı doluysa
detay sayfasının sağ kolonunda önizleme + "PNG İndir" kartı çıkar, boşsa kart
hiç basılmaz.

## Görsel nereye konur

**Veritabanına.** PNG, analiz gövdesiyle birlikte `card_image_base64` alanında
gönderilir; sunucu `earnings_analysis_cards` tablosuna yazar ve adresi kendisi
üretir: `/karne/<sembol>/<donem>/<dil>.png`

```bash
B64=$(base64 -i karne.png | tr -d '\n')
# POST gövdesine: "card_image_base64": "$B64",
#                 "card_image_width": 1654, "card_image_height": 2339
```

Sınır **3,4 MB base64** (~2,5 MB PNG). Vercel'in istek gövdesi tavanı 4,5 MB
ve base64 ham boyutun ~4/3'ü; A4 2x bir karne tipik olarak 0,5–1,5 MB.

Dil başına ayrı görsel: karne metin içeriyor ("Genel Görüş", "Piyasa
Beklentisi"), Türkçesiyle İngilizcesi aynı dosya değil. İki POST, iki görsel.

Görsel neden depoda değil de veritabanında: rutin bulutta koşuyor ve depoya
commit atamıyor. Elle koymak her analiz için manuel bir adım demekti; hattın
tamamı tek POST'ta bitmeli. Elle konmuş bir dosyayı göstermek de mümkün —
`public/karne/…` altına koyup `card_image_url` alanını vermek yeterli.

Karne bir ZORUNLULUK DEĞİL. Analiz sayfası görselsiz de eksiksiz çalışır;
kart yalnızca görsel varsa basılır.

---

## PROMPT

{ŞİRKET} ({SEMBOL}, {BORSA}) şirketinin {DÖNEM} bilançosu için **tek
sayfalık, A4 dikey, PNG'ye uygun bir "Bilanço Karnesi" görseli** üret. Tüm
veriler şirketin resmi bilanço bülteninden ve kazanç çağrısından alınacak —
güncel ve gerçek olacak, uydurma veri yok. Analist tahminleri görselde ve
yazıda her zaman **"Piyasa Beklentisi"** olarak adlandırılır; "konsensüs"
kelimesini KULLANMA. Dil: Türkçe; virgüllü ondalık, "milyar $" / "Mr $".

### Görsel kimlik (Açılış Zili — açık tema)

- Zemin `#f7f9fb` üzerine tepeden beyaz radyal ışıma; kart zeminleri
  `rgba(16,32,52,.028)`, kenarlıklar `rgba(16,32,52,.10)`, köşe 12–16px
- Metin: koyu lacivert `#101c2b`; ikincil `#54677c`; soluk `#75879a`
- Vurgu: mavi `#0d74c4` (nötr/bilgi), yeşil `#0f8f63` (pozitif), kırmızı
  `#ce2044` (negatif). Açık mavi degrade şerit: `rgba(13,116,196,.13) → .02`
- Rakamlarda `font-feature-settings:'tnum'`
- Ton: premium, ferah, veri yoğun ama okunabilir. Emoji yok, süs yok.

> Bu değerler sitenin açık tema tokenlarının birebir kopyası
> (`app/globals.css` → `:root[data-theme="light"]`). Tema değişirse burası da
> değişmeli.

### Sayfa düzeni (yukarıdan aşağıya)

1. **Başlık bandı** — Solda şirketin gerçek logosu, **beyaz zeminli ince
   kenarlıklı bir çip içinde** (`background:#fff; border:1px solid
   rgba(16,32,52,.10); border-radius:9px; padding:8px 14px`, `<img>` yüksekliği
   ~14px). Çıplak logo kullanma. Yanında `SEMBOL · BORSA` rozeti ve sektör
   tanımı. Altında iki rozet: koyu lacivert zeminde "{DÖNEM} Bilançosu ·
   {TARİH}" ve açık mavi "Sonraki Bilanço: {DÖNEM+1} · ~{AY}". Sağda üç
   satırlık dikey blok: "Kapanış Fiyatı · {TARİH}" etiketi, fiyat (23px/800) +
   tepki rozeti, altında piyasa değeri ve 1 yıllık getiri.
   **Doğrulama:** bandın toplam genişliği A4 içerik genişliğini (≈726px)
   aşmamalı.
2. **Genel görüş şeridi** — Solda 0–100 skor halkası (SVG, renk karara göre) +
   "Genel Görüş" etiketi ve altında büyük **AL / TUT / SAT**; etiket ve karar
   yatayda ortalanmış tek sütun. Ortada 2–3 cümlelik özet: çeyreğin ana
   hikâyesi + hisse tepkisinin nedeni. Sağda ortalama analist hedefi ve
   yükseliş potansiyeli.
3. **6 metrik kartı (3×2)** — Gelir, düzeltilmiş hisse başı kâr, brüt marj,
   net kâr, yıllık gelir, geri alım/temettü. Her kartta soluk etiket → büyük
   değer (19px/800) → renkli tek satır bağlam ("▲ Yıllık %372 · Beklenti
   Üstü"). Hiçbir metin satır atlamayacak (`white-space:nowrap`).
4. **İki grafik yan yana** — Solda çeyreklik gelir bar grafiği (son 5 çeyrek
   dolu mavi + gelecek çeyrek öngörüsü kesikli çerçeveli), altında 3 mini
   metrik. Sağda gelecek çeyrek şirket öngörüsü kartı (lejant: "▎ Şirket
   Aralığı · ● Piyasa Beklentisi"): gelir / hisse başı kâr / brüt marj için
   yatay aralık barları, her satırın altında "Piyasa Beklentisi X · Uyumlu ✓ /
   Aralığın Üstünde ▼" değerlendirmesi.
5. **CEO mesajı şeridi** — Solda isim + unvan, ortada çağrıdan *gerçek* alıntı
   (italik, Türkçe çevirisi), sağda vurgulanan 2–3 konu mavi hap rozetlerde.
6. **Üçlü değerlendirme** — Yeşil **Güçlü Yönler**, kırmızı **Riskler**, mavi
   **Beklenen Gelişmeler** ("Katalizörler" KULLANMA). Her birinde 01/02/03
   numaralı, tek cümlelik 3 madde, `text-wrap:pretty`.
7. **Alt bilgi** — "Açılış Zili · Bilanço Karnesi · Yatırım Tavsiyesi Değildir"
   + veri kaynakları.

### Yazım kuralları

- Başlıklar, kart etiketleri, rozet metinleri VE kartların altındaki renkli
  bağlam satırları **Title Case**: "Genel Görüş", "▲ Yıllık %372 · Beklenti
  Üstü". `text-transform:uppercase` KULLANMA. Yalnızca uzun paragraflar (özet,
  alıntı, madde cümleleri) normal cümle yazımında kalır.
- Kart etiketlerinde kısaltma yerine açık ifade: "Düz. EPS" değil "Hisse Başı
  Kâr (Düzeltilmiş)"; "FY26 gelir" değil "Yıllık Gelir (FY26)".
- Kısaltma değil günlük Türkçe: "y/y" → "yıllık", "y.önce" → "geçen yıl",
  "+%14 sürpriz" → "beklentinin %14 üzerinde".
- Her sayının yanında tek bakışta anlaşılan bir kıyas olsun.

### Teknik kurallar

- Tek A4 sayfa, stiller satır içi, sayfa `display:flex;flex-direction:column`
  ve bloklar `gap:12px`; grafik satırı `flex:1`, alt bilgi `margin-top:auto`
- Grafik SVG'leri `viewBox` ile ölçeklenir ve `max-height` sınırı alır
- Skor halkasındaki sayı SVG `<text>` DEĞİL, üstüne bindirilmiş HTML katmanı
  (font yüklenme sorununa karşı) — sitedeki `ScoreRing` de aynı nedenle böyle
- **Zorunlu son kontrol:** bitirmeden önce sayfanın tam ekran görüntüsünü al ve
  doğrula: (1) hiçbir metin kesilmiyor, (2) logo net ve orantılı, (3) başlık
  bandı tek hizada, (4) grafikler dikeyde dengeli, (5) tüm başlıklar Title
  Case. Sorun varsa düzelt ve tekrar kontrol et.
- Çıktı: 2x çözünürlüklü PNG

### Teslim

1. **PNG** — 2x çözünürlük, A4 dikey
2. Analiz POST gövdesine `card_image_base64` olarak eklenir; site adresi
   kendisi üretir (bkz. `docs/claude-rutinler.md` § 4)
