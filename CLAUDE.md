# Açılış Zili — Claude Code notları

Kurallar ve mimari kararlar `README.md` ile `docs/` altında; kod içi
yorumlar da bir karar kaydı olarak yazılıyor, silme.

## Hızlı komutlar

```
npm run dev         # geliştirme (3000 doluysa 3001'e düşer)
npm run typecheck   # tsc --noEmit  ·  `npx tsc` ÇALIŞMAZ
npm run lint
npm run build       # route tipleri bozulursa önce `rm -rf .next`
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
- Grafik ekseni ve ölçek etiketleri gibi teknik notlar

Türkçe Title Case: bağlaç ve edatlar (ve, ile, için, de/da, mi) küçük kalır,
başta gelirse büyür. "Faiz, Tahvil ve Getiri Eğrisi" · "Ne Kadar, Ne Zaman"

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
  veritabanında (`stories` tablosu, `/api/mercek` üzerinden yazılır).
- **Yatay taşma** düzenli olarak kontrol edilir; `.tmp-shot.mjs` benzeri bir
  puppeteer koşumu route × genişlik matrisini tarar.
