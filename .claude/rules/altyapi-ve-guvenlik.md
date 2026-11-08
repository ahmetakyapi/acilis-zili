---
paths:
  - "deploy/**"
  - ".github/**"
  - "drizzle/**"
  - "lib/schema.ts"
  - "lib/db.ts"
  - "lib/email*.ts"
  - "lib/notify-emails.ts"
  - "lib/push.ts"
  - "public/sw.js"
  - "proxy.ts"
  - "next.config.ts"
  - "auth.ts"
  - "app/api/cron/**"
  - "app/gomulu/**"
  - "lib/preview.ts"
---

<!-- Yol kapsamlı kural: eşleşen bir dosya okunduğunda/düzenlendiğinde yüklenir. Kaynak: kök CLAUDE.md'den taşındı (8 Kasım 2026); kural metni aynen korundu. -->

## Altyapı ve Güvenlik

- **Depo herkese açık.** Gerçek sırlar (`BRIEF_SECRET`, `CRON_SECRET`, …)
  asla commit'lenmez; doldurulmuş promptlar `docs/*.local.md` (gitignore'da).
- **Migration'lar deploy'da UYGULANMAZ.** Üretim adresi yalnız sunucuda;
  uygulama yolu GitHub Actions → "Migrate DB" (`migrate.yml`, elle
  tetiklenir, `deploy/remote-migrate.sh`): önce `check` (salt okunur,
  bekleyenleri adıyla basar), sonra `apply`. Kod migration'dan önce yayına
  inebilir: yeni özellik mümkünse var olan tabloya (özellikle `users`) sütun
  eklemez, kendi tablosunu açar ve tablo yokken sessizce düşer
  (`lib/avatar-data.ts`). Migration'ı unutmak da sessiz hatadır (0042 bir gün
  bekledi, 29 Ekim):
  - **Yalnız ekleyen** migration (`CREATE TABLE/INDEX`, varsayılanlı ya da
    boş geçilebilir `ADD COLUMN`): push'tan sonra deploy bitince Claude
    `check` → `apply` koşar ve `docs/ROUTEMAP.md`'deki sayıyı günceller.
  - **Veri değiştiren/silen** (`DROP`, `RENAME`, tip değişikliği, `NOT NULL`
    ekleme, `UPDATE`): uygulamadan önce sahibine sor.
- **`/gomulu/*` her yerden çerçevelenebilen TEK yol**; geri kalanı
  `X-Frame-Options: DENY` + `frame-ancestors 'none'` (`next.config.ts`).
  Tek dar istisna yönetimin cihaz önizlemesi: `?onizleme=1` yalnız AYNI
  KÖKE (`'self'`) açılır, yönetici değilse `proxy.ts` parametreyi düşürür,
  `/admin` ve `/api` hiç gevşemez (tehdit modeli `lib/preview.ts`).
- **GitHub iş akışları:** push'ta `deploy` (kapı) ve `smoke` (kapı değil);
  zamanlanmış `links`; elle `migrate`, `sync-app-env`, `sync-analysis-key`,
  `verify-analysis`, `test-mail`. Sunucuya dokunanlar `deploy-vps`
  sırasında bekler (`deploy.yml`, `concurrency`).
- **Zamanlanmış işler** `deploy/cron-install.sh`'te (`update.sh` her sürümde
  çalıştırır) — yeni iş oraya; uçları `app/api/cron/*`, `CRON_SECRET` ile.
- **Bildirim Web Push** (`lib/push.ts`, `public/sw.js`,
  `app/api/cron/alarmlar`, VAPID). Service worker yalnız bildirim taşır:
  `fetch` dinleyicisi/önbellek YOK (bayat fiyat = veri dürüstlüğü 2). Kayıt
  yalnız Ayarlar'daki düğmeyle.
- **Şifre değişince açık oturumlar düşer** (`auth.ts`: JWT'de parola özetinin
  parmak izi, beş dakikalık süreç önbelleği). Şifre YAZAN her yeni yol
  `forgetPasswordFingerprint(userId)` çağırır; çağırmazsa çalınmış oturum beş
  dakika daha yaşar.
- **E-posta** (`lib/email.ts`, Resend, SDK'sız):
  - Şifre sıfırlama: anahtar yoksa "Şifremi Unuttum" basılmaz; her adrese
    aynı yanıt, gönderim `after` ile; satırda bağlantının SHA-256 özeti.
  - Bildirim postası TEK KAPIDAN: `sendNotificationEmail`
    (`lib/email-notify.ts`) — tercih, çift onaylı adres (`confirmedEmail`;
    yalnız alarm — pazar özeti bütün üyelere varsayılan açık ve onaysız,
    `enrollWeeklyDefault`), günlük bütçe (`EMAIL_DAILY_BUDGET`, varsayılan
    80; Resend ücretsiz katmanı günde 100) ve `dedupeKey`. Kendi başına
    `sendEmail` çağıran bildirim yolu açma.
  - Yeni posta türü = KVKK metni + şablon (`lib/notify-emails.ts`) +
    `emailNotify` sözlüğü + çıkış kapsamı.
- **Tek `eslint-disable` istisnası:** `components/news/NewsImage.tsx`'teki iki
  `@next/next/no-img-element`. `next/image` her haber CDN'i için
  `remotePatterns` ister; tek kapsayıcı yol `hostname: "**"` ve o,
  `/_next/image`'ı herkese açık görsel proxy'sine çevirir. Yeni bir
  `eslint-disable` bu kadar sağlam gerekçe ister.
