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

**Son güncelleme:** 2026-11-08
**Durum:** 🟢 CANLI — https://aciliszili.com

---

## Canlıda ne var

Sayılar 8 Kasım'da kaynaktan sayıldı; yeniden saymak için:
`find app -name page.tsx | wc -l` · `find app/api -name route.ts | wc -l` ·
`grep -c "pgTable(" lib/schema.ts` · `ls drizzle/*.sql | wc -l` ·
`grep -cE "^[A-Z][A-Z0-9_]+=" .env.example`. Üretimdeki migration durumu:
GitHub Actions → "Migrate DB" iş akışı, `check` modu (salt okunur).

| | |
|---|---|
| Sayfa rotası | 87 `page.tsx` (13'ü `/admin`; açık sayfalar `/en` önekiyle ikinci bir adreste daha) |
| API ucu | 55 `route.ts` `app/api` altında (+8 `app/` içinde: paylaşım görselleri ve RSS) |
| Veritabanı tablosu | 55 · 43 migration (0000–0042; üretimde hepsi uygulandı, 29 Ekim) |
| Sağlayıcı | Alpaca · Finnhub · FRED · TCMB · TCMB EVDS (isteğe bağlı) · SEC EDGAR (13F, Form 4) · OpenFIGI · House Clerk · Federal Reserve · Kalshi · Cboe · ABD Hazinesi · ARK / Global X ETF dosyaları · GİB (`lib/providers/`) |
| Ortam değişkeni | 38 (`.env.example`) |
| Zamanlanmış iş | 9 uç `app/api/cron/*`: günlük senkron, alarmlar, bilanço hatırlatması, haberler + çeviri, pazar özeti postası, Telegram, olasılıklar, risk, Günün Grafiği yedeği. Saatleri tek yerde: `deploy/cron-install.sh` |
| claude.ai rutini | 8 adet, elle kurulu: 6 içerik (günlük, haftalık, Mercek, bilanço, teknik, Günün Grafiği) + Görev Kontrolü + Haftalık Kalite Denetimi. Canlı kopya, cron ve model `docs/claude-rutinler.md`te; sayım `list_triggers` (`recurring: true`) |
| Rutin kuralları | `content/kurallar/{ortak,mercek,bilanco,gunluk,haftalik}.md`, `/api/kurallar` ile her koşuda okunur — değişiklik yeniden yapıştırma istemez |

**Tohumlanan veri:** 23 NYSE tatili (üçü yarım gün) · CPI/FOMC/istihdam yayın
takvimi · 81 temel sembol · 635 endeks üyesi (S&P 500 + Nasdaq 100 + Dow,
GICS sektörleriyle).

**Depo herkese açık.** `BRIEF_SECRET` ve `CRON_SECRET` asla commit'lenmez;
gerçek değerlerin bulunduğu `docs/rutinler.local.md` gitignore'da.

---

## Açık işler

Sıra öncelikli değil, hepsinin bilinçli olarak beklediği yerler.

- [x] **Migration 0040–0042 üretimde uygulandı:** `probability_snapshots`,
      risk masası tabloları, `puzzle_players` + `puzzle_runs` (0042, 29 Ekim
      "Migrate DB" iş akışıyla; öncesinde oyun sıralaması canlıda sessizce
      kapalıydı).
- [x] **Migration 0037–0039 üretimde uygulandı (24 Ekim):** `telegram_posts`,
      `earnings_votes`, `daily_charts`. Üçü de yalnız yeni tablo; kod tablo
      yokken sessizce düşüyor.
- [x] **Günün Grafiği rutini claude.ai'de kurulu (24 Ekim):** "Açılış Zili ·
      Günün Grafiği", `CRON_TZ=Europe/Istanbul 15 9 * * 2-6`, Opus, öteki
      rutinlerle aynı ortam ve anahtar kalıbı (`/tmp/.azh`); prompt
      `docs/claude-rutinler.md` § 7. İlk koşu 27 Ekim Salı 09:15 TR.
- [x] **Görev Kontrolü (eski adıyla Koşu Bekçisi, 25 Ekim'de yeniden
      adlandırıldı) Günün Grafiği'ni de izliyor** (düşerse yeniden çalıştırır).
- [x] **Mercek'e arama ve yapay zekâ görünürlüğü kuralları (8 Kasım):**
      `content/kurallar/mercek.md` → "Aramada ve Yapay Zekâ Cevaplarında
      Bulunmak". Rutin kuralları her koşuda `/api/kurallar` ile okuyor;
      claude.ai'de yapıştırma gerekmedi.
- [x] **`docs/claude-rutinler.md` canlıyla eşitlendi (8 Kasım).** Sekiz
      rutinin prompt'u `list_triggers`ten anahtarı `BURAYA_SECRET` yer
      tutucusuyla değiştirilerek taşındı; § 3 (Mercek) ve § 4 (Bilanço)
      artık canlının kopyası, Görev Kontrolü (§ 8) ve Haftalık Kalite
      Denetimi (§ 9) ilk kez belgede. Yaz Saati Nöbetçisi canlıda yok
      (`CRON_TZ` taşıyan cron'larla gereksizleşti), § 6 emekli.
- [ ] **Bing Webmaster Tools'a site eklenmeli — sahibi (8 Kasım).** IndexNow
      bildirimleri canlı (`lib/indexnow.ts`); Bing'in "AI Performance"
      raporu Copilot atıflarını yalnız doğrulanmış sitede gösteriyor.
      Search Console'dan içe aktarma en kısa yol.
- [ ] **Gösterim almayan şablon sayfaları — karar sahibinde (8 Kasım).**
      Site haritası her şirketi iki dilde basıyor (`app/sitemap.ts`);
      kaynak yazı çok sayıda gösterimsiz şablon sayfasını risk sayıyor.
      Search Console → Sayfalar/Performans verisiyle 3 ayda hiç gösterim
      almayan hisse sayfaları belirlenip haritadan çıkarılması ya da
      `noindex` değerlendirilecek; veri olmadan dokunulmadı.
- [ ] **Günün Grafiği kapanıştan sonraya alınmalı — sahibi claude.ai'de
      (8 Kasım).** Uç artık günü kapanış + 20 dk'da (16:20 NY) tamamlanmış
      sayıyor. Canlı cron hâlâ `CRON_TZ=Europe/Istanbul 15 9 * * 2-6`
      (8 Kasım `list_triggers`); hedef `CRON_TZ=America/New_York 25 16 * * 1-5`.
      Üç değişiklik: (1) "Açılış Zili · Günün Grafiği" cron'u hedefe;
      (2) aynı rutinin prompt'una `docs/claude-rutinler.md` § 7'deki
      `auto_locales` satırı eklenir (bölümdeki blok canlının kopyası,
      eklenecek satır üstteki açık iş notunda); (3) Görev Kontrolü prompt'unda Günün
      Grafiği'nin beklenen cron'u (1)'deki olur ve kullanım limitindeki tek
      yeniden çalıştırma öncelik listesine Bilanço'dan hemen sonra girer.
      Kök neden: 7 Kasım cumartesi koşusu kullanım limitiyle düştü, bekçi
      yalnız Bilanço'yu yeniden çalıştırdı, cumanın grafiği yazılmadı.
      Sitenin yedeği (`/api/cron/grafik`) ilk dağıtımdan sonraki 11:45 UTC
      koşusunda 6 Kasım'ı şablonla doldurur; yorumlu hâli için rutini
      `date: 2026-11-06` ile bir kez elle çalıştırmak yeter.
- [ ] **Telegram kanalı kurulmadı.** BotFather'da bot aç, kanala yönetici
      yap; `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` (isteğe bağlı
      `TELEGRAM_CHANNEL_ID_EN`) ve `NEXT_PUBLIC_TELEGRAM_URL` GitHub
      ortamına ve sunucuya (Sync App Env). Değişkenler yokken gönderici uyur,
      sitede kanal bağlantısı basılmaz. Crontab satırı `deploy/cron-install.sh`
      ile ikinci dağıtımda iner.
- [ ] **Mercek arşivinde ~38 yazı (iki dilde ~76 `bar` bloğu) yön taşımayan
      büyüklüğü yeşil çiziyor.** 24 Ekim'den beri `::: bar notr` kipi var;
      bu bloklara bayrak panelden ya da bir kerelik rutinle eklenmeli.
- [x] **Geliştirme kipindeki "unique key … AppShell" uyarısı giderildi (25
      Ekim):** kök kabuğa verilen `ticker` Suspense öğesi RSC yükü büyüyünce
      ayrı parçaya çıkıp geç çözülüyordu; `key="ticker"` ile kapandı.
- [ ] **Sayfa içi `notFound()` yanıtları sunucuda boş HTML.** Next 16
      kabuğu istemcide kuruyor; stil kapısı (`globals.css` sonu) stilsiz
      kareyi gizliyor ama arama motoru 404 gövdesini boş görüyor. Çerçeve
      düzeyinde çözüm bekliyor.

- [x] **Migration 0035 (`notifications`) üretimde uygulanmalı.** Bildirim
      kutusu. Tablo yokken zil sıfır sayar, /bildirimler "şu an açılamıyor"
      der, push yine gider (`lib/notifications.ts`). Uygulandı (15 Ekim).
- [x] **Migration 0034 (`user_posts`) üretimde uygulanmalı.** Topluluk
      yazıları. Tablo yokken /topluluk boş akış, /yazilarim "şu an
      açılamıyor", moderasyon kuyruğu "tablo okunamadı" der
      (`lib/user-post-data.ts`). Üretim `DATABASE_URL`iyle `npm run db:migrate`.
- [x] **Migration 0033 (`percent_alerts`, `notification_prefs`) üretimde
      uygulanmalı.** Yüzde alarmları ve bilanço hatırlatması. Tablo yokken
      zil levhasında yüzde sekmesi ve Ayarlar'daki hatırlatma anahtarı hiç
      basılmaz, tarama ve cron sessizce atlar (`lib/percent-alerts.ts`,
      `lib/notification-prefs.ts`). Üretim `DATABASE_URL`iyle
      `npm run db:migrate`; crontab satırını (`cron-bilanco.sh`) bu sürümün
      update.sh'ı İKİNCİ dağıtımda ekler (cron-alerts kuralı).
- [x] **Migration 0032 (`user_profiles`) üretimde uygulanmalı.** Herkese açık
      profil (varsayılan gizli). Tablo yokken `/u/[kullanici]` 404 verir ve
      Ayarlar'daki Herkese Açık Profil paneli "şu an kaydedilemiyor" der
      (`lib/profile-data.ts`, `app/actions/profile.ts`). Üretim
      `DATABASE_URL`iyle `npm run db:migrate`.

- [x] **Ünlü yatırımcılar (migration 0021).** Beş tablo: `investor_filings`,
      `investor_holdings`, `cusip_tickers`, `congress_filings`,
      `congress_trades`. Üretimde uygulandı (29 Ekim itibarıyla 0000–0042
      hepsi); doldurma günlük cron'da.
- [ ] **`OPENFIGI_API_KEY` isteğe bağlı.** Anahtarsız cron koşum başına 40
      CUSIP çözüyor; 13F sezonunda Bridgewater'ın yüzlerce yeni pozisyonunun
      logosu birkaç günde geliyor (o arada ad yazılıyor). Anahtar bunu tek
      koşuma indirir.
- [x] **ARK günlük ETF işlemleri (migration 0022, `ark_holdings`).** Cathie
      Wood sayfasında 13F'in üstünde "ARK'ın Son İşlemleri": altı ETF'nin
      günlük dosyası, iki günün farkı, pay yaratma/iade etkisi ayıklanmış
      (`lib/ark-view.ts`). Kayıt 28 Eylül'de başladı; ilk karşılaştırma bir
      sonraki işlem gününün dosyasıyla geliyor.

- [x] **Migration 0028 (`push_subscriptions`)** üretimde (29 Ekim itibarıyla
      0000–0042 hepsi). VAPID anahtarı yoksa Ayarlar'daki Bildirimler paneli
      basılır ama "bu sunucuda kapalı" der; anahtarlar GitHub Secrets'tan
      "Sync App Env" ile `/etc/acilis-zili.env`e aktarılabilir
      (`deploy/sync-app-env.sh`). Tarama satırı `deploy/cron-install.sh`te.
- [x] **Migration 0029 (`password_resets`)** üretimde (29 Ekim itibarıyla
      0000–0042 hepsi). E-posta anahtarı (`RESEND_API_KEY` + `EMAIL_FROM`,
      ya da `BREVO_API_KEY`) yokken "Şifremi Unuttum" basılmaz, bildirim
      postası gitmez; anahtar "Sync App Env" ile aktarılır. Bildirim postası
      (alarm, pazar özeti) tek kapıdan: `lib/email-notify.ts`. Gönderimi
      denemek için Actions → "Deneme Postası" (`test-mail.yml`).
- [x] **Migration 0027 (`portfolio_sales`)** — portföy satışları ve gerçekleşen
      kâr/zarar. Tablo yokken Sat düğmeleri ve Gerçekleşen paneli basılmıyor
      (`lib/portfolio-sales-data.ts` → `available`).
- [x] **Migration 0026 (`price_alerts`) üretimde uygulanmalı.** Fiyat
      alarmları kendi tablosunda; tablo yokken hisse sayfasındaki zil
      düğmesi ve favorilerdeki alarm paneli HİÇ basılmıyor (kurulamayacak
      bir düğme göstermemek için — `lib/price-alerts.ts` → `available`).
      Üretim `DATABASE_URL`iyle `npm run db:migrate`.
- [x] **Migration 0020** (`symbol_metrics`, `portfolio_positions`,
      `earnings_analysis_extras`, `app_errors`) üretimde (29 Ekim itibarıyla
      0000–0042 hepsi).
- [ ] **`npm run db:seed` canlı deploy'dan SONRA koşturulmalı.** Beş yeni
      makro serisi (`ICSA`, `RSAFS`, `M2SL`, `SAHMREALTIME`, `T10Y3M`)
      `macro_series`e tohumla giriyor; değerleri sonra cron dolduruyor.
- [ ] **`EVDS_API_KEY` alınınca seri kodları ilk çağrıda doğrulanmalı.**
      TÜFE `TP.TUKFIY2025.GENEL`, Yİ-ÜFE `TP.TUFE1YI.T1`
      (`lib/providers/evds.ts`). Kodlar belgelerden doğrulandı ama gerçek
      bir anahtarla hiç çağrılmadı. Anahtar yokken Reel TL kapalı, vergi
      hesaplayıcısı Yİ-ÜFE'yi okuyucudan istiyor.
- [x] **Bilanço rutini `takeaways`, `segments`, `segments_source` ve `kpis`
      alanlarını gönderiyor** — canlı prompt'ta var (8 Kasım eşitlemesi,
      `docs/claude-rutinler.md` § 4).
- [x] **Mercek rutininde kaynak kuralı var** (yayıncının kendi adresi,
      açılıp 200 görülmeyen adres eklenmez) — canlı prompt'un 4. adımında, 8 Kasım
      eşitlemesinde görüldü.
- [x] **Rutin belgesi canlı prompt'larla eşit** (8 Kasım). Yeniden eşitleme
      yolu ve anahtar denetimi `docs/claude-rutinler.md` → "Bu Dosya Canlının
      Kopyasıdır".
- [ ] **`/api/health` bir uptime izleyicisine bağlanmalı** (UptimeRobot,
      Better Stack). İki kural: kod 200 değilse "site düştü", gövde
      `degraded` içeriyorsa "içerik gecikti".
- [ ] **Duman testinin yazma akışı hiç koşturulmadı.** Birim testleri
      (`tests/`, deploy kapısında) ve duman testi (`npm run smoke`, GitHub Actions
      `smoke.yml`) var (README → Doğrulama). Açık kalan: kayıt → giriş →
      favori → hesap silme akışı `SMOKE_ALLOW_WRITES=1` ile gerçek bir
      veritabanına karşı bir kez bile koşmadı.
- [x] **Teknik analiz rutini claude.ai'de kurulu** — tek görev, günde üç
      koşu (`docs/claude-rutinler.md` § 5). `/teknik` canlıda dolu.
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
- **Emtia spot değil fon üzerinden.** Ücretsiz sağlayıcılarımızın hiçbirinde
  canlı emtia spotu yok; FRED'in EIA serisi günlerce geriden geliyor (Brent
  kartı bu yüzden kaldırıldı). Piyasalar'daki Emtia paneli borsada işlem
  gören fonları (GLD, SLV, USO, UNG, CPER, DBA, IBIT, ETHA) fon fiyatı
  olarak gösteriyor ve künyesinde spottan ayrışabileceğini yazıyor.
- **Tek tek analist notları yok.** Finnhub'ın `/stock/upgrade-downgrade`
  ve `/stock/price-target` uçları ücretsiz katmanda 403. Elimizde aylık
  dağılım var; Analist Dağılımı Değişimi onun farkını gösteriyor ve hangi
  kurumun ne yaptığını söylemiyor. Olmayan bir kaynaktan not uydurulmuyor
  (`lib/analyst-trend.ts`). Ortalama hedef fiyat sağlayıcıdan değil, günlük
  bülten rutininin kaynağıyla yazdığı kayıttan (`/api/hedef`,
  `lib/analyst-targets.ts`).
- **`/sektor/*` sayfaları yok.** İçerik `/sirketler?sektor=` ile birebir
  aynı olurdu; ikinci bir adres aynı listeyi iki kez dizinletmekten başka
  bir şey eklemiyor.
- **Bilançolarda `Event` ve `FAQPage` yapısal verisi yok.** Google'ın
  etkinlik yönergesi katılım olmayan tarihleri dışlıyor, SSS zengin sonucu
  yalnızca devlet ve sağlık sitelerine gösteriliyor ve sayfada görünen bir
  soru-cevap bloğu da yok. Gerekçe `components/seo/JsonLd.tsx`te.
- **Mercek yazılarında kapak görseli alanı yok.** Şema bir kez `image_url`
  aldı ve hemen geri alındı; görsel dili metinden çizilen `:::` blokları.
- **Yönetim yetkisi ortam değişkeninde değil veritabanında**, ve yetkisiz
  istek 404 görüyor — "yetkiniz yok" demek panelin varlığını ele verirdi.
- **Panelden YENİ içerik üretilmiyor.** Yazılar ekranı (`/admin/yazilar`) var
  olan mercek yazısını ve bülteni düzeltiyor; yeni kayıt yazmak rutinlerin
  işi. İki giriş de aynı doğrulamadan ve aynı upsert'ten geçiyor
  (`lib/content-write.ts`) — ikinci bir yazma yolu açmak bir dönem bu işi
  tümüyle engelleyen gerekçenin kendisiydi.
- **Bilanço analizi panelden düzenlenmiyor.** Analiz serbest metin değil, on
  beş alanlı yapılandırılmış bir kayıt; bir metin kutusuna indirmek
  düzenlemek değil bozmak olurdu. Eksikleri İçerik ekranı listeliyor.
- **Masthead tek şerit ve "Daha Fazla".** Şeritte duran sekmeler ve taşma
  öncelikleri `components/layout/nav-items.ts` → `NAV_ITEMS` (`strip.rank`;
  8 Kasım'da Piyasalar, Bilançolar, Mercek, Teknik Analiz, Temalar,
  Şirketler); geri kalanı "Daha Fazla" panelinde (`more`). Ölçümler ve
  21 Eylül sadeleşmesinin gerekçesi aynı dosyada karar kaydı. Büyütülmüş
  yazıda sekmeler öncelik sırasıyla panele iniyor.

---

## Bakım ritmi

| Ne | Ne zaman | Nasıl |
|---|---|---|
| Tatil takvimi | yılda bir | `db/seed/holidays.ts` elle güncellenir, NYSE resmî takviminden |
| FOMC takvimi | yılda bir | `db/seed/economic-events.ts` — Fed toplantı tarihleri elle |
| Endeks bileşimi | çeyrekte bir | `scripts/sync-indices.ts` |
| Şirket profilleri | kendiliğinden | cron turu + sayfa isteği |
| Temalar ve karşılaştırma çiftleri | üyelik değişince | `content/themes.ts` ve `content/compare-pairs.ts` elle; endeks bileşiminden türemiyorlar |
| Vergi eşikleri | her yıl başında | `lib/tax.ts` → `TAX_YEARS`: gelir vergisi tarifesi ve temettü beyan sınırı (2026: 22.000 TL), yeni yılın satırı GİB rehberi ve tarife tebliğinden, kaynağıyla |
| Skor kartı metrikleri | kendiliğinden | cron koşum başına 15 sembol + sayfa isteği (`lib/symbol-metrics.ts`) |
| Hata kaydı | kendiliğinden | 30 günden eskisini günlük cron siler |
| İçerik rutinleri | değişince | prompt claude.ai arayüzünden, kopyası `docs/claude-rutinler.md`te (anahtarsız); ortak yazım kuralları `content/kurallar/*.md`, yapıştırma gerekmez |

---

## Belgeler

| Dosya | Ne için |
|---|---|
| `README.md` | Ürünün tamamı: rotalar, mimari, veri modeli, kurulum, sınırlar |
| `CLAUDE.md` (`AGENTS.md` aynı dosya) | Kod üzerinde çalışırken bilinmesi gerekenler — kurallar ve tuzaklar |
| `docs/claude-rutinler.md` | claude.ai rutinlerinin canlı prompt kopyası (anahtarsız), cron ve modelleri |
| `content/kurallar/*.md` | Rutinlerin ortak ve göreve özgü yazım kuralları (`/api/kurallar`) |
| `docs/claude-analysis.md` | Kullanıcı isteğiyle Claude analizi: kurulum, kota, prompt, rapor ekranı |
| `docs/deploy-vps.md` | Sunucu kurulumu, otomatik deploy, disk koruması ve geri dönüş |
| `docs/film-kimligi.md` | Video ve kısa filmlerin kimliği (`cinecode`) |
| `docs/claude-brief-agent.md` · `docs/claude-mercek-ajani.md` | Yalnız yönlendirme: tek kaynak `docs/claude-rutinler.md` |
| `docs/arsiv/` | Tarihî tasarım devri ve denetim kayıtları — kural değil, güncel kural `CLAUDE.md` |
| bu dosya | Durum: canlıda ne var, ne bekliyor, ne bilinçli olarak yok |
