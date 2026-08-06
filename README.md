# Açılış Zili / Opening Bell

ABD borsaları için günlük takip platformu: **zil çalmadan önce bugünü gör.**

Ekonomik takvim (CPI, FOMC, istihdam), bilanço tarihleri, piyasa haberleri,
makro göstergeler ve kişisel takip listeleri — hepsi saatleriyle tek ekranda.
Üstüne her gün yazılan bir bülten ve olay bazlı uzun yazılar. TR/EN arayüz,
açık/koyu tema, tam mobil uyum.

Türkçe okuyan biri için saatler **Türkiye saatiyle** yazılır, New York saati
künyede durur; İngilizceye geçince sıra tersine döner.

## Teknoloji

| Katman | Seçim |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Stil | Tailwind CSS v4 — tokenlar `app/globals.css` `@theme inline` bloğunda |
| Tema | Custom `data-theme` + çerez (`next-themes` yok) |
| Grafik | TradingView lightweight-charts v5 |
| DB | Neon PostgreSQL + Drizzle ORM |
| Auth | next-auth v5 (Credentials + bcrypt, JWT) |
| Veri | Alpaca (fiyat/grafik) · Finnhub (profil/haber/bilanço) · FRED (makro) · TCMB (kur) |
| İçerik | claude.ai zamanlanmış görevleri → korumalı API uçları (sunucuda model çağrısı yok) |

## Kurulum

```bash
npm install
cp .env.example .env.local   # değerleri doldur — aşağıya bak
npm run db:migrate           # şemayı Neon'a uygula
npm run db:seed              # takvim + tatil + sembol tohumları
npm run dev
```

### Ortam değişkenleri

| Değişken | Zorunlu | Nereden |
|---|---|---|
| `DATABASE_URL` | evet | [neon.tech](https://neon.tech) → yeni proje → connection string |
| `AUTH_SECRET` | evet | `openssl rand -base64 32` |
| `ALPACA_API_KEY_ID` + `ALPACA_API_SECRET_KEY` | fiyat için | [alpaca.markets](https://alpaca.markets) → API Keys (paper yeterli) |
| `FINNHUB_API_KEY` | profil/haber için | [finnhub.io](https://finnhub.io) → Get free API key |
| `FRED_API_KEY` | makro için | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) — 32 karakter, küçük harf |
| `CRON_SECRET` | üretimde | `openssl rand -hex 32` — Vercel Cron bunu `Bearer` ile gönderir |
| `BRIEF_SECRET` | içerik için | `openssl rand -hex 32` — bülten ve mercek uçlarının kapısı |
| `NEXT_PUBLIC_SITE_URL` | üretimde | yayın adresi (OG görselleri ve sitemap için) |
| `ANTHROPIC_API_KEY` | opsiyonel | haber başlığı çevirisi (DeepL yoksa) |
| `DEEPL_API_KEY` | opsiyonel | haber başlığı çevirisi (önce bu denenir) |

Anahtarlar olmadan da uygulama açılır; ilgili kartlar "veri alınamadı"
gösterir, sayfa çökmez. Doğrulamak için: `/api/debug/providers`

## İçerik nasıl üretiliyor

Sitenin **yazılı** içeriğini claude.ai zamanlanmış görevleri üretir; sunucuda
model çağrısı ve API anahtarı yoktur, site yalnızca veritabanından okur.

| Görev | Ne zaman | Nereye |
|---|---|---|
| Günlük bülten | her gün 16:00 TR | `POST /api/brief` → ana sayfa · Günün Özeti |
| Haftalık bülten | pazartesi 09:30 TR | `POST /api/brief` (`period: weekly`) → /bulten |
| Mercek yazısı | her gün 23:30 TR | `POST /api/mercek` → /mercek |

Üçü de `BRIEF_SECRET` ile korunuyor. Prompt'ların tamamı ve kurulum adımları
`docs/claude-rutinler.md` içinde — **görevler koddan kurulamaz**, claude.ai
arayüzünden elle kurulur. Saatler kodda da yazılı (`lib/data.ts` →
`BRIEF_PUBLISH_TR`): bugünün özeti henüz yoksa kart en son yazılanı gösterir
ve yenisinin ne zaman geleceğini söyler.

Yazıların görseli yok; görsel dili metinden çizilen `:::` bloklarıdır —
`sayilar`, `bar`, `pay` (yığın çubuk), `akis` (zincir), `oncesi` (iki hâl),
`zaman` (kronoloji), `grafik` (gerçek fiyat serisi) ve dört metin kutusu.
Model yalnızca satırları yazar, çizimi site yapar: telif riski yok, her temada
tutarlı, her açılışta güncel.

## Veri akışı

- **Fiyat/grafik** — istek anında Alpaca'dan; tazelik seansa göre değişir
  (`lib/market-hours.ts` → `quoteTtlSeconds`: seans içinde 15 sn, kapalıyken
  15 dk). Önbellek sunucuda paylaşımlıdır, yani sağlayıcıya giden istek
  ziyaretçi sayısıyla değil yalnızca bu süreyle artar. Son değer Neon'a
  yazılır; sağlayıcı düşerse `güncel olmayabilir` damgasıyla o gösterilir.
- **Takvim/haber/makro** — günde bir Vercel Cron (`/api/cron/daily`, hafta içi
  10:30 UTC = 13:30 TR). FOMC/CPI/NFP tarihleri resmî takvimlerden tohumlanır
  (`db/seed/economic-events.ts`), FRED'in yayın takviminden ileriye uzatılır,
  gerçekleşen değerler yine FRED'den işlenir.
- **Uydurma veri yok.** Veri yoksa kart boş durur; her kartın altında
  `kaynak · saat` damgası vardır. Sağlayıcı kesin saat vermiyorsa ekranda
  `~` ile yaklaşık olduğu söylenir.

## Komutlar

```bash
npm run dev          # geliştirme (Turbopack)
npm run build        # üretim derlemesi
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run db:generate  # şema değişikliği → yeni migration
npm run db:migrate   # migration'ları uygula
npm run db:seed      # idempotent tohum (kullanıcı verisine dokunmaz)
npm run db:studio    # Drizzle Studio
```

## Deploy (Vercel)

1. Repo'yu Vercel'e bağla.
2. Environment Variables: `.env.example` içindeki değişkenler +
   `NEXT_PUBLIC_SITE_URL`.
3. `vercel.json` cron'u otomatik kaydeder; Vercel `CRON_SECRET`'ı
   `Authorization: Bearer` başlığıyla gönderir.
4. İlk deploy sonrası bir kez: `npm run db:migrate && npm run db:seed`
   (lokalden, üretim `DATABASE_URL` ile).
5. claude.ai görevlerini kur (`docs/claude-rutinler.md`) — yoksa bülten ve
   mercek boş kalır.

## Dizin yapısı

```
app/(app)/           # sayfalar — Bugün, takvim, bilançolar, mercek, hisse/[symbol]…
app/api/             # chart, search, brief, mercek, cron, auth
components/
  article/           # ArticleBody — ::: blok ailesi burada render edilir
  layout/            # AppShell, ticker, arama paleti
  today/             # DayRail, BriefSwitch, geri sayım
  stories/           # mercek kapakları (logo + olaydan bugüne getiri)
  stock/ markets/ ui/
lib/
  market-hours.ts    # ET↔UTC, seans durumu, önbellek süreleri
  session-clock.ts   # dile göre birincil saat dilimi (TR/NY)
  providers/         # alpaca · finnhub · fred · tcmb
  i18n/              # tr + en sözlükleri
content/guide/       # rehber yazıları (depoda) — meta + tr + en
db/seed/             # FOMC/CPI takvimi, tatiller, semboller, endeksler
docs/                # rutin prompt'ları, tasarım notları, rota haritası
drizzle/             # migration'lar — elle düzenlenmez, yenisi eklenir
```

## Bilinen sınırlar

- Fiyatlar Alpaca **IEX** beslemesinden gelir (gerçek zamanlı, konsolide
  banttan birkaç sent sapabilir) — ekranda damgalanır. SIP gerekirse
  `lib/providers/alpaca.ts` içinde `DEFAULT_FEED = "sip"` yeterli.
- Endeksler ETF üzerinden izlenir (QQQ/SPY/DIA/IWM) ve bu arayüzde belirtilir.
- Finnhub ücretsiz katmanında ekonomik takvim ucu yoktur; takvim resmî
  kaynaklardan tohumlanır ve FRED ile doğrulanır.
- **Emtia yok.** Brent bir süre gösterildi ve kaldırıldı: FRED'in EIA spot
  serisi günlerce geriden yayımlanıyor, ücretsiz sağlayıcılarımızın hiçbirinde
  canlı emtia fiyatı yok. Bir haftalık eski fiyatı bugünmüş gibi göstermektense
  metriği kaldırmak doğru.
- Bilanço saatleri **yaklaşıktır**: sağlayıcı yalnızca pencereyi veriyor
  (açılış öncesi / kapanış sonrası), dakika vermiyor.

## Lisans ve sorumluluk

Kişisel bir proje; yatırım tavsiyesi değildir. Veriler üçüncü taraf
sağlayıcılardan gelir ve gecikmeli ya da hatalı olabilir.
