---
name: denetim
description: Projeyi dört salt okunur denetimle tarar (güvenlik, performans, eksikler, SEO) ve bulguları önem sırasıyla düzeltmeye çevirir. Kullanıcı "projeyi tara", "eksikleri bul", "güvenlik açığı var mı", "performansa bak", "SEO iyileştir" dediğinde ve büyük bir yayından önce kullan.
---

# Denetim

Dört denetim birbirinden bağımsızdır ve SALT OKUNURDUR: paralel koşar,
derleme yapmaz, bulguyu rapora yazar. Düzeltme ayrı adımdır ve ana
oturumundur. Önce `on-kontrol` (kırmızı koşu ve bekleyen migration varken
denetim başlamaz).

## 1. Dağıt (dört salt okunur ajan, tek mesajda)

Her brifte ortak: Türkçe; kod değiştirme, commit atma, `npm ci`/`build`
koşturma; `.env*` ve `docs/*.local.md` okunmaz; kök `CLAUDE.md` ve ilgili
`.claude/rules/*.md` okutulur; **kod içi karar yorumu kayıttır, bilinçli
karar bulgu diye yazılmaz**; raporun tamamı scratchpad'de bir dosyaya,
yanıtta yalnız yol ve önem sırasına dizilmiş kısa liste.

| Denetim | Ajan | Kapsamın özü |
|---|---|---|
| Güvenlik | `general-purpose` | `app/api/**`, bütün `"use server"` eylemleri (kimlik, YETKİ/IDOR, girdi, hız sınırı), `auth.ts`, `proxy.ts`, `next.config.ts`, XSS (`dangerouslySetInnerHTML`, JSON-LD, `href`), SSRF/açık yönlendirme, ham `sql`, site içi Claude (enjeksiyon, bütçe atlatma), `deploy/` ve iş akışları, `npm audit --omit=dev`, depoda sır |
| Portföy verisi | `general-purpose` | Güvenlik raporunu okur, DOLAYLI sızıntıya iner: `unstable_cache` anahtarında `userId`, sahibe özel planın üyeye dönmesi, herkese açık profil (`lib/profile-showcase.ts`) ve RSC yükündeki fazla alan, günlük/hata tablosu/analitik, posta ve push alıcı eşleşmesi, hesap silme |
| Performans | `general-purpose` | Canlı ölçüm (Playwright; TTFB, FCP, LCP, CLS, JS/CSS bayt ve kapsama, uzun görev, boşta boyama sayısı) + kod (istemciye giden ağır içe aktarma, veri şelalesi, N+1, eksik indeks, sarılmamış `cache()`) |
| Eksikler | `general-purpose` | Canlı gezinti (rota × dil × 1440/390: 4xx/5xx, konsol, kırık bağlantı, dil karışması, Title Case, kontrast, dokunma hedefi), kod (testsiz riskli `lib/`, ölü dosya, sözlük farkı, bağımlılık), ürün eksiği (eldeki veriyle en değerli 10 öneri) |
| SEO | `searchfit-seo:seo-auditor:AGENT` | Sayfa türü başına künye, canonical/hreflang, JSON-LD, iç bağlantı; Türk yatırımcının GERÇEK aramaları ↔ sayfa eşleşmesi; `robots`, site haritası, yönlendirme zinciri; `llms.txt` |

İkinci kez koşarken bir öncekinin bulgularını brife yaz ("şunlar bulundu,
yeniden keşfetme; ötesine bak"); yoksa aynı liste geri gelir.

## 2. Düzelt (ana oturum)

- Önce bağımlılık yamaları (`npm audit` 0 olana dek), sonra önem sırasıyla.
- Her düzeltme kod içi karar yorumuyla (tarih, senaryo, ölçüm) ve `lib/`
  mantığıysa testiyle girer.
- Sahibine SORULANLAR sorulur, kendiliğinden yapılmaz: veri değiştiren
  migration, yeni üçüncü taraf hizmet, sahibinin kayıtlı bir kararını geri
  alan değişiklik (karar yorumunda "sahibinin isteği" yazıyorsa).
- Bir bulgu çerçeve sürümüyle kapanıyorsa (14 Kasım: `/en` yönlendirme
  döngüsü Next 16.4 ile gitti) kod yazmadan önce yükselt ve yerelde
  yeniden üret.
- Yeni sayfa/özellik isteyen bulgular (SEO cevap sayfaları, abonelik
  akışı) ayrı ajanlara gider: `ajan-dagitimi`.

## 3. Kapat

`rm -rf .next && npm run build && npm run check`, yerelde `npm run smoke`,
sonra `yayin`. Kullanıcıya tek tablo: bulgu · önem · yapılan · bilerek
bırakılan (nedeniyle) · senin teyit etmen gereken. Kalan işler
`docs/ROUTEMAP.md` → Açık İşler'e.

## 4. Ders

- 14 Kasım: dört denetim ve beş ekran ajanı aynı anda başladı; derleyenler
  belleği doldurdu. Denetimler derlemez ama Playwright açar: aynı anda en
  çok dört derleyen ajan (`ajan-dagitimi` § 5).
- 14 Kasım: güvenlik denetimi IDOR aradı ve bulmadı; asıl gizlilik açığı
  ikinci, dar turda çıktı (profil vitrini ağırlıkları HTML'de tam
  hassasiyetle; adet oranı geri hesaplanabiliyordu). "Yetki temiz" raporu
  "veri sızmıyor" demek değildir: hassas veri için ayrı, dolaylı yollara
  bakan bir tur koş.
- 14 Kasım: denetimin "yanlış" saydığı bir şey bilinçli karardı (Vercel
  Analytics içe aktarımı; yorumunda gerekçesi var). Silmeden önce yorumu oku.
- 14 Kasım: `/en` yönlendirme döngüsü "Next yükseltmesiyle kapandı" diye
  raporlandı; yerelde `next start` (localhost) ile ölçülmüştü, canlıda sürdü.
  Vekil arkasındaki davranış `next start -H 127.0.0.1` ve
  `X-Forwarded-Proto: https` başlığıyla yeniden üretilir; yayından sonra
  AYNI ölçüm canlıda yinelenmeden "kapandı" denmez.
