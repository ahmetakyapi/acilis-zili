# Açılış Zili — Claude Code notları

Kararların gerekçesi kod içi yorumlarda yaşıyor ve oralar birer karar
kaydıdır, silme. Bu dosya yalnızca **her oturumda bilmen gerekenleri** taşır.

## Hızlı komutlar

```
npm run dev         # geliştirme (3000 doluysa 3001'e düşer)
npm run typecheck   # tsc --noEmit  ·  `npx tsc` ÇALIŞMAZ
npm run lint
npm run build       # route tipleri bozulursa önce `rm -rf .next`
npm run db:generate # şema değişti → YENİ migration dosyası, eskiyi düzenleme
npm run db:migrate  # migration'ları uygula
npm run db:seed     # takvim kapsamı azaldığında uyarı basar
```

**Temiz bir kopyada önce `npm run build` çalıştır.** `PageProps` ve
`RouteContext` tipleri Next 16 tarafından `.next/types` altına üretiliyor ve
ikisi de gitignore'da. Build almadan `npm run typecheck` çalıştırırsan
"Cannot find name 'PageProps'" diye onlarca hata alırsın — kodda bir sorun
olduğu için değil, tipler henüz üretilmediği için.

## Yazım kuralı: Title Case

Vurgu taşıyan her metin **Title Case** yazılır. Kapsam:

- Sayfa başlıkları, bölüm ve panel başlıkları, kart başlıkları
- Buton ve bağlantı metinleri ("Tümünü Gör", "Hesabımı Sil", "Tekrar Dene")
- Kategori, filtre, sekme ve rozet etiketleri
- Tablo başlık satırları ve etiket görevi gören ilk sütun hücreleri
- Rehber ve mercek yazılarındaki `##` / `###` başlıkları
- Kısa vurgulu ifadeler ("Yatırım Tavsiyesi Değildir")

Title Case OLMAYAN yerler — bunlar cümledir, başlık değil:

- Paragraflar, açıklama satırları, kart altı ipuçları
- Boş durum ve hata **mesajları** (başlıkları Title Case, gövdeleri değil)
- Ölçü altındaki mikro künyeler ("olaydan bugüne", "bilanço", "son 1 ay")

Türkçe Title Case: bağlaç ve edatlar (ve, ile, için, de/da, mi) küçük kalır,
başta gelirse büyür. "Faiz, Tahvil ve Getiri Eğrisi" · "Ne Kadar, Ne Zaman"
`title()` / `capitalize` KULLANMA — `i → I` üretir, `İ` değil; küçültürken de
`toLocaleLowerCase("tr-TR")` kullan.

## Görsel dili

**Fotoğraf yok.** Yazıların görseli, metinden çizilen `:::` bloklarıdır: model
yalnızca satırları yazar, çizimi site yapar. Telif riski yok, hiçbir yerde
görsel barındırmak gerekmiyor, her temada tutarlı. Şema bir kez `image_url`
alanı aldı (migration 0004) ve hemen geri alındı (0005) — gerekçesi
`lib/schema.ts` yorumunda.

Blok ailesi `components/article/ArticleBody.tsx` içinde:
`sayilar` · `bar` · `pay` · `akis` · `oncesi` · `zaman` · `grafik`, artı dört
metin kutusu `ornek` · `dikkat` · `ozet` · `tanim`. Sözdizimi ve yazım
kuralları `docs/claude-rutinler.md` § 3'te; rutin prompt'u oradan kopyalanıyor,
yeni blok eklersen orayı da güncelle.

**Görselin etrafında çerçeve yok.** Kenarlık ve iç dolgu, resmi kutunun
ortasında duran ayrı bir nesne gibi gösteriyor; görsel kutunun kendisi olmalı
(`overflow-hidden` + kendi köşe yarıçapı, `object-contain`/`object-cover`).
Kenarlık yalnızca görsel OLMAYAN yer tutucularda kalır. Elimizdeki tek gerçek
görsel kaynağı şirket logoları (`symbols.logo_url`, Finnhub): mercek kapakları
ve haber künyeleri ondan besleniyor.

## Saat kuralı: TR önce

Kaynakların tamamı New York saatiyle yayın yapıyor ama okuyucu Türkiye'de.
`lib/session-clock.ts` tek kaynak: TR dilinde birincil saat İstanbul, ikincil
New York; EN'de sıra tersine döner. Fark ABD yaz saatiyle kaydığı için hiçbir
yere sabit saat yazılmaz, o günün tarihiyle hesaplanır (açılış yazın 16:30,
kışın 17:30 TR). Seansın kendi saati `lib/market-hours.ts`'te kalır — ET↔UTC
dönüşümünün tamamı orada, başka yerde manuel saat aritmetiği yapılmaz.

## Veri dürüstlüğü

Üçü de birer hata düzeltmesinden geldi; yenisini yazarken bunları koru:

1. **Uydurma kesinlik yok.** Sağlayıcı dakika vermiyorsa saat `~` ile yazılır
   ve hangi pencere olduğu adıyla söylenir (bilanço satırları: "~23:00 ·
   kapanış sonrası").
2. **Bayat veriyi büyük puntoyla gösterme.** Brent kartı FRED'in EIA spot
   serisinden geliyordu ve o seri günlerce geriden yayımlanıyor; ekranda bir
   haftalık eski fiyat duruyordu. Küçük puntoda tarih yazmak bunu kurtarmaz —
   metrik kaldırıldı.
3. **Aynı sayı iki yerde duruyorsa aynı kaynaktan gelmeli.** Hisse başlığı
   anlık kotasyonu, grafik son dakika barının kapanışını yazıyordu; ikisi
   tanımı gereği farklı sayılar ve yan yana durunca hata gibi okunuyor.

## Bilinmesi gerekenler

- **Depo herkese açık.** `BRIEF_SECRET` ve `CRON_SECRET` asla commit'lenmez.
  Gerçek değerlerin bulunduğu `docs/rutinler.local.md` `*.local.md` deseniyle
  gitignore'da; commit öncesi staged diff'i secret'a karşı tara.
- **Tailwind v4** — `tailwind.config.ts` yok, tokenlar `app/globals.css`
  içindeki `@theme inline` bloğunda. Hardcoded renk yasak.
- **Tema** next-themes değil, `data-theme` + `az-theme` çerezi.
- **Arayüz metni** sözlükte: `lib/i18n/dictionaries/{tr,en}.ts`. `en`, `tr`
  tipinden türüyor — `tr`'ye anahtar eklersen `en` derlenmez, ikisini birlikte
  güncelle.
- **Rehber yazıları** depoda (`content/guide.ts`), **mercek yazıları**
  veritabanında (`stories` tablosu). `/api/mercek` POST ile yazılır, aynı uç
  `?slug=` ile gövdeyi geri okur — rutin güncelleme yaparken onu kullanıyor.
- **Sayfa içi filtre ve sıralama bağlantıları `scroll={false}` ister.** App
  Router her gezinmede en üste kaydırıyor; tablonun ortasında sıralamayı
  değiştiren okuyucu sayfanın başına fırlıyordu.
- **Mobilde sabit katmanlar güvenli alanı kendi taşır** (`env(safe-area-inset-*)`).
  Sayfa `viewport-fit=cover` ile açılıyor: dolgu eklenmezse başlık çentiğin
  altında kalıyor.
- **Yatay taşma** düzenli kontrol edilir; puppeteer koşumu route × genişlik
  matrisini tarar (`.tmp-*.mjs` geçici dosyaları commit'lenmez).

## Yerelde çalışırken

`.env.local` içindeki bazı sağlayıcı anahtarları boş olabilir. O zaman ilgili
kartlar "veri alınamadı" gösterir ve **sayfa çökmez** — beklenen davranış bu.
Grafik ya da eğri eksikse önce anahtara bak (`/api/debug/providers`), koda
değil. `BRIEF_SECRET` yerelde boşsa korumalı uçlar geliştirmede açıktır
(`lib/api-auth.ts`); üretimde anahtar yoksa uç 503 döner, açık kalmaz.
