# Açılış Zili / Opening Bell

ABD borsaları için günlük takip platformu: **zil çalmadan önce bugünü gör.**

Ekonomik takvim (CPI, FOMC, istihdam), bilanço tarihleri, piyasa haberleri,
makro göstergeler ve kişisel takip listeleri — hepsi saatleriyle tek ekranda.
TR/EN arayüz, açık/koyu tema, tam mobil uyum.

## Teknoloji

| Katman | Seçim |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Stil | Tailwind CSS v4 — tokenlar `app/globals.css` `@theme` bloğunda |
| Tema | Custom `data-theme` + anti-FOUC script (`next-themes` yok) |
| Grafik | TradingView lightweight-charts v5 |
| DB | Neon PostgreSQL + Drizzle ORM |
| Auth | next-auth v5 (Credentials + bcrypt, JWT) |
| Veri | Alpaca (fiyat/grafik) · Finnhub (profil/haber/bilanço) · FRED (makro) |
| Özet | Claude (`claude-opus-5`) — anahtar yoksa kural tabanlı üretim |

## Kurulum

```bash
npm install
cp .env.example .env.local   # değerleri doldur — aşağıya bak
npm run db:migrate            # şemayı Neon'a uygula
npm run db:seed               # takvim + tatil + sembol tohumları
npm run dev
```

### API anahtarları (hepsi ücretsiz)

| Değişken | Nereden |
|---|---|
| `DATABASE_URL` | [neon.tech](https://neon.tech) → yeni proje → connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `ALPACA_API_KEY_ID` + `ALPACA_API_SECRET_KEY` | [alpaca.markets](https://alpaca.markets) → hesap → API Keys (paper yeterli) |
| `FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io) → Get free API key |
| `FRED_API_KEY` | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | opsiyonel — günlük özeti Claude yazsın istiyorsan |

Anahtarlar olmadan da uygulama açılır; veri kartları "veri alınamadı" gösterir,
sayfa çökmez. Anahtarları doğrulamak için: `http://localhost:3000/api/debug/providers`

## Veri akışı

- **Fiyat/grafik** — istek anında Alpaca'dan, seans durumuna göre TTL
  (`lib/market-hours.ts`), Neon'a "son bilinen değer" olarak yazılır.
  Sağlayıcı düşerse önbellekten `güncel olmayabilir` damgasıyla gösterilir.
- **Takvim/haber/makro/özet** — günde bir Vercel Cron (`/api/cron/daily`,
  hafta içi 10:30 UTC) senkronlar. FOMC/CPI/NFP tarihleri resmî
  takvimlerden tohumlanır (`db/seed/economic-events.ts`), gerçekleşen
  değerler FRED'den işlenir.
- **Uydurma veri yok** — veri yoksa kart boş durur; her kartın altında
  `kaynak · saat` damgası vardır.

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
2. Environment Variables: `.env.example` içindeki tüm değişkenler +
   `NEXT_PUBLIC_SITE_URL` (üretim adresi).
3. `vercel.json` cron'u otomatik kaydeder; Vercel, `CRON_SECRET`'ı
   `Authorization: Bearer` başlığıyla gönderir.
4. İlk deploy sonrası bir kez: `npm run db:migrate && npm run db:seed`
   (lokalden, üretim `DATABASE_URL` ile).

## Dizin yapısı

```
app/(app)/           # sayfalar — Bugün, takvim, bilançolar, hisse/[symbol]…
app/api/             # chart, search, cron, auth
components/          # brand, layout, today (DayRail), stock, ui
lib/                 # market-hours, providers/, i18n/, schema, db, brief
db/seed/             # FOMC/CPI takvimi, tatiller, semboller
drizzle/             # migration'lar — elle düzenlenmez
```

## Bilinen sınırlar

- Fiyatlar Alpaca **IEX** beslemesinden gelir (gerçek zamanlı, konsolide
  banttan birkaç sent sapabilir) — ekranda damgalanır. SIP gerekirse
  `lib/providers/alpaca.ts` içinde `DEFAULT_FEED = "sip"` yeterli.
- Endeksler ETF üzerinden izlenir (QQQ/SPY/DIA/IWM) ve bu arayüzde belirtilir.
- Finnhub ücretsiz katmanında ekonomik takvim ucu yoktur; takvim resmî
  kaynaklardan tohumlanır + FRED ile doğrulanır.
