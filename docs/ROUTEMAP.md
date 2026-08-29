# Proje durumu — Açılış Zili

> **Bu belge bir rota listesi değil, bir DURUM kaydıdır.** Rotaların tamamı,
> ne yaptıkları ve mimari kararlar `README.md` içinde. Burada yalnızca
> zamanla değişen şey duruyor: neyin canlı olduğu, neyin yarım kaldığı,
> neyin bilinçli olarak yapılmadığı.
>
> Dosyanın adı geçmişten kalma; bir dönem rota listesi tutuyordu ve **tam da
> bu yüzden güncelliğini yitirdi** — 2026-08-01'de donmuş bir tabloda on üç
> rota eksikti ve okuyan onu güncel sanıyordu. İki yerde tutulan bir liste er geç
> birbirinden ayrı düşer. Rota tablosu artık yalnızca README'de.

**Son güncelleme:** 2026-08-26
**Durum:** 🟢 CANLI — https://acilis-zili.vercel.app

---

## Canlıda ne var

| | |
|---|---|
| Sayfa rotası | 29 (`/en` önekiyle ikinci bir adreste daha) |
| API ucu | 14 |
| Veritabanı tablosu | 15 · 15 migration |
| Sağlayıcı | Alpaca · Finnhub · FRED · TCMB |
| Ortam değişkeni | 12 (`.env.example`) |
| Cron | `/api/cron/daily` — hafta içi 10:30 UTC (13:30 TR) |
| İçerik rutini | 4 adet, claude.ai üzerinde elle kurulu |

**Tohumlanan veri:** 23 NYSE tatili (üçü yarım gün) · CPI/FOMC/istihdam yayın
takvimi · 81 temel sembol · 635 endeks üyesi (S&P 500 + Nasdaq 100 + Dow,
GICS sektörleriyle).

**Depo herkese açık.** `BRIEF_SECRET` ve `CRON_SECRET` asla commit'lenmez;
gerçek değerlerin bulunduğu `docs/rutinler.local.md` gitignore'da.

---

## Açık işler

Sıra öncelikli değil, hepsinin bilinçli olarak beklediği yerler.

- [ ] **Otomatik test yok.** Doğrulama typecheck + lint + build ve elle
      koşturulan tarayıcı taramalarıyla yapılıyor (README → Doğrulama). En
      çok değeri olan ilk adım muhtemelen `lib/market-hours.ts` ve
      `lib/compare.ts` gibi saf yardımcıların birim testi olurdu.
- [ ] **Kayıt → giriş → favori akışının canlıda kullanıcı testi.**
- [ ] (İsteğe bağlı) Neon şifresi + Finnhub anahtarı rotasyonu.

---

## Bilinçli olarak yapılmayanlar

Bunlar eksik değil, **karar**. Yeniden gündeme gelirse gerekçesiyle birlikte
gelsin.

- **Tam CSP yok.** Next'in satır içi önyükleme script'i ve satır içi stilleri
  `unsafe-inline` gerektiriyor; o da CSP'nin XSS'e karşı faydasının büyük
  kısmını götürüyor. Nonce tabanlı doğru bir CSP ayrı bir iş, yarım hâli
  yanlış bir güvenlik hissi verir. `frame-ancestors`, `nosniff`, HSTS ve
  `Permissions-Policy` yerinde (`next.config.ts`).
- **`cacheComponents` kapalı.** Ürün auth ve canlı veri ağırlıklı; klasik
  fetch-revalidate daha öngörülebilir.
- **`loading.tsx` yok.** Bulunduğu segmentte bir Suspense sınırı açıyor ve
  Next yanıtı oraya kadar hemen akıtıyor — durum kodu da o an yazılıyor.
  Sonuç: `notFound()` çağıran her dinamik rota 404 ekranını basıp **HTTP 200**
  dönüyordu. Sayfaların yavaş parçaları zaten kendi Suspense adalarında.
- **Emtia metriği yok.** Ücretsiz sağlayıcılarımızın hiçbirinde canlı emtia
  spotu yok; FRED'in EIA serisi günlerce geriden geliyor.
- **Mercek yazılarında kapak görseli alanı yok.** Şema bir kez `image_url`
  aldı ve hemen geri alındı; görsel dili metinden çizilen `:::` blokları.
- **Yönetim yetkisi ortam değişkeninde değil veritabanında**, ve yetkisiz
  istek 404 görüyor — "yetkiniz yok" demek panelin varlığını ele verirdi.

---

## Bakım ritmi

| Ne | Ne zaman | Nasıl |
|---|---|---|
| Tatil takvimi | yılda bir | `db/seed/holidays.ts` elle güncellenir, NYSE resmî takviminden |
| FOMC takvimi | yılda bir | `db/seed/economic-events.ts` — Fed toplantı tarihleri elle |
| Endeks bileşimi | çeyrekte bir | `scripts/sync-indices.ts` |
| Şirket profilleri | kendiliğinden | cron turu + sayfa isteği |
| İçerik rutinleri | değişince | `docs/claude-rutinler.md`, claude.ai arayüzünden |

---

## Belgeler

| Dosya | Ne için |
|---|---|
| `README.md` | Ürünün tamamı: rotalar, mimari, veri modeli, kurulum, sınırlar |
| `CLAUDE.md` | Kod üzerinde çalışırken bilinmesi gerekenler — kurallar ve tuzaklar |
| `docs/claude-rutinler.md` | İçerik rutinlerinin prompt'ları ve `:::` blok sözdizimi |
| `docs/claude-brief-agent.md` | Bülten ajanının ayrıntılı yönergesi |
| `docs/claude-mercek-ajani.md` | Mercek ajanının kısa yönergesi |
| `docs/design/` | Tasarım notları |
| bu dosya | Durum: canlıda ne var, ne bekliyor, ne bilinçli olarak yok |
