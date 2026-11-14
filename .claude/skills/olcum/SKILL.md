---
name: olcum
description: Görsel/yerleşim değişikliğini tarayıcıda SAYIYLA doğrular — sahte sağlayıcıyla gerçek sayfa ya da geçici önizleme rotası, ortak ölçüm betiği (rota × genişlik × tema tablosu), sabit saat. Bir panelin, kartın ya da sayfanın görünümünü değiştirdikten sonra, taşma ya da hiza şüphesinde ve "bitti" demeden önce kullan.
---

# Görsel Ölçüm

Kural: görsel değişiklik ekran görüntüsüyle değil sayıyla doğrulanır;
ölçüm karar yorumuna yazılır (`.claude/rules/arayuz.md` → Düzen).

## 1. Veri

Bulut oturumunda `.env.local` yoktur, veritabanı ve sağlayıcılar boştur.
İki yol var; ikisinde de uygulama koduna sahte dal konmaz.

**Gerçek sayfa, sahte sağlayıcı** (varsayılan: kolon dipleri, paneller
arası ritim, akışla gelen paneller, boş/eksik durumlar):

```bash
AUTH_TRUST_HOST=true AUTH_SECRET=mock ANTHROPIC_API_KEY=mock \
DATABASE_URL="postgres://u:p@ep-x.mockdb.test/db" \
FINNHUB_API_KEY=mock ALPACA_API_KEY_ID=mock ALPACA_API_SECRET_KEY=mock \
NODE_OPTIONS="--require $PWD/.claude/skills/olcum/sahte-saglayici.cjs" \
npx next start -p 3110        # ya da: npx next dev -p 31xx
```

`.claude/skills/olcum/sahte-saglayici.cjs` Finnhub, Alpaca, Neon HTTP ve
Hazine/Cboe/FRED çağrılarını yanıtlar; bilinmeyen dış adres engellenir
(günlükte `[mock-fetch] engellendi`), canlı veritabanına ulaşılamaz.
Modüller `.claude/skills/olcum/sahte-saglayici/` altında: `piyasa.cjs`
(kotasyon, bar, şirket), `tablolar.cjs` (veritabanı satırları),
`teknik.cjs` (teknik yayınlar), `sorgu.cjs` (SELECT'in WHERE / ORDER BY /
LIMIT'ini uygular), `saat.cjs`, `ortak.cjs`. Tatiller, endeks üyeleri,
ekonomik takvim ve teknik takip listesi depodaki tohumdan okunur.

**Geçici önizleme rotası** (tek bileşenin uç verisi: çok uzun ad, sıfır,
negatif): veri yükleyici ile çizimi ayrı tut (`StoriesSpotlight` →
`StoriesSpotlightView`), saf görünümü sahte veriyle bas.

```
app/(app)/tmp-onizleme-<konu>/page.tsx   # İŞ BİTİNCE SİL (§ 4)
```

"Önce" hâli için canlıya bak: `.claude/skills/gorsel-tur/cek.mjs` rota ×
genişlik × temayı dilimli çeker (yalnız okur).

### Senaryolar: Durumu Sembol Seçer

Ortam değişkeni yok; tek sunucu bütün durumları taşır. Ölçeceğin durumun
sembolünü aç.

| Rota | Sembol → durum |
|---|---|
| `/hisse/…` | `NVDA` dolu sayfa · `ZETA` eksik verili küçük şirket (F/K yok, içeriden işlem, analiz ve bilanço yok, katalog dışı) · `BE` gün barı yok (boş grafik) · `SNDK` 60 seans · `SPY` fon |
| `/bilancolar/…` | `NVDA` haftanın salısı açıklıyor, iki analiz · `HD` son işlem günü açıkladı, aştı, sıradaki yok · `WMT` kaçırdı, sıradaki 95 gün, saat belirsiz · `TSN` takvimde hiç yok · `PDD` yalnız tahmini tarih · `RKLB` zarar eden |
| `/teknik-analiz/…` | `AMD` AL (bölge, stop, üç hedef; dün TUT'tan döndü) · `MU` AL, tek seviye · `TSLA` bölgeli TUT · `AAPL` bölgesiz TUT · `NVDA`, `INTC` SAT (plan yok) · `PLTR` yayını hiç yok · `MRVL` yayını bayat (panodan düşer) · `BE` fotoğraf boş · `SNDK` 100/200 günlük ortalama yok. Her sembolde 15 yayınlık geçmiş; `NVDA` ve `AMD`de EN metni var |
| `/sirketler?q=solventum` | `SOLV`, `VLTO`, `KVUE`: piyasa değeri yok ("–" satırı) |
| `/takvim`, `/takvim/fomc` | tohumdaki TÜFE/FOMC/istihdam + PCE + haftalık başvurular; geçmişte gerçekleşen değer, son başvuru satırı "bekleniyor", saatsiz Fed konuşması (+5 gün), çok uzun adlı olay (+12 gün) |
| `/bilancolar` | hafta sonuysa gelecek hafta, değilse bu hafta; günde 4–126 dolgu şirketi (canlıdaki yoğunluk) |

Senaryo eksikse ilgili modüle EKLE (tabloya da yaz). Eksik sorguyu
`MOCK_SQL_LOG=<dosya>` bulur: her sorgu, dönen satır sayısı ve tanınmayan
koşul (`[?]`) yazılır. Bilinmeyen tablo boş döner.

### Sabit Saat

`MOCK_NOW=<ISO an>` sunucu saatini o ana kaydırır (saat akar). Kotasyon
damgası, gün barı, teknik yayın slotu ve "bugün" ona göre kurulur.

| An (14 Kasım haftası) | `MOCK_NOW` |
|---|---|
| Seans içi (Cuma 13:00 ET) | `2026-11-13T18:00:00Z` |
| Açılış öncesi (Cuma 08:00 ET) | `2026-11-13T13:00:00Z` |
| Hafta sonu | `2026-11-14T15:00:00Z` |
| Yarım gün (27 Kasım, 13:00 kapanış) | `2026-11-27T19:00:00Z` |
| Tatil (Şükran Günü) | `2026-11-26T16:00:00Z` |

Tarayıcı saati gerçek kalırsa hydration hatası çıkar (React #418):
`olc.mjs`e AYNI `MOCK_NOW`ı ver, sayfa saatini sunucunun akmış anına
sabitler. Sunucu her açılışta veri önbelleğini (`unstable_cache`) siler;
saat değiştiyse `.next/dev`i de.

### Sunucu

Kapatırken yalnız KENDİ portunu kapat: `fuser -k <port>/tcp` (`next start`
`next-server` adıyla koşar; `pkill -f next-server` öteki ajanlarınkini de
kapatır). Paralel ajanlar aynı dizinde `next dev` koşturamaz (`.next/dev`
kilidi): her ajan kendi worktree'sinde ve kendi portunda.

## 2. Ortak Ölçüm: `olc.mjs`

Playwright yüklü, kurulum YAPMA.

```bash
NODE_PATH=$(npm root -g) node .claude/skills/olcum/olc.mjs \
  http://localhost:3110 ana=/ hisse=/hisse/NVDA teknik=/teknik-analiz/AMD --ayrinti
```

Rota × genişlik (`GENISLIKLER`, varsayılan 1440,1024,768,390,360) × tema
(`TEMALAR`) için tek tablo: HTTP kodu, sayfa boyu, yatay taşma, kutusundan
taşan öğe (↔ yatay, ↕ dikey), kırpılan metin, < 12 piksel metin (SVG
ayrı), < 44 piksel dokunma hedefi (≤ 480'de, `elementFromPoint` ile),
tablo kaplarının yatay kayması, `h1` sayısı, konsol hatası, `reducedMotion`
altında çalışan animasyon, hareket açıkken `getAnimations()` sayısı.
`--ayrinti` her ihlalin ilk beş öğesini seçici ve ölçüsüyle basar. Çıkış
kodu 1: HTTP 200 dışı, içeriksiz sayfa (`h1` yok) ya da yatay taşma.
Sütun tanımları ve ortam değişkenleri dosyanın başında.

Tablo GENEL sağlığı sorar. Ekrana özgü soru (iki ölçünün taban hizası,
kolon dibi = SON çocuğun dibi, kartlar arası boşluk) için geçici
`.tmp-<konu>.mjs` yine yazılır (gitignore'da): Playwright'ı
`createRequire(import.meta.url)("playwright")` ile al, `reducedMotion:
"reduce"` ile aç, temayı `az-theme` çerezi + `dataset.theme` ile kur,
kaydırmayı `behavior: "instant"` yap, HTTP kodunu ve `h1`i önce doğrula.

## 3. Kendi Görüntüne Bak, Sayıyı Kaydet

Sayılar temizken ekran yine kötü durabilir (ölü boşluk, zayıf hiyerarşi
taşma değildir). Son hâli dilimli çek (`cek.mjs`), Read ile oku ve bir
tasarımcı gibi eleştir (`gorsel-tur` § 2 sınıfları); beğenmediğini düzeltip
yeniden ölç. Ölçülen sayıları (önce → sonra; genişlik, tema, piksel)
değişen kuralın kod içi karar yorumuna yaz. "Sığıyor gibi duruyor"
doğrulama değildir.

## 4. Temizlik — atlama

1. Geçici rotayı ve `.tmp-*.mjs` betiğini sil.
2. `rm -rf .next` — silinen rotanın tipi `.next/dev/types` altında kalır ve
   sonraki `npm run build` "route not found" ile düşer (8 Kasım, üç ajan).
3. `npm run build && npm run check`.

## Dersler

- 10 Kasım: port doluysa eski derlemenin sunucusu kalmıştır, ölçüm hata
  sayfasını çeker. `olc.mjs` HTTP kodunu ve `h1`i denetler; elle betikte sen denetle.
- 10 Kasım: yalnız "güzel" veriyle ölçülen kart canlıda "0,00 $" dev başlığı
  bastı. Uç veriyi (uzun ad, eksik alan, negatif, sıfır) senaryo tablosundan seç.
- 14 Kasım: yedi ajan sahte sağlayıcının yedi yamalı kopyasını scratchpad'e
  yazdı; birleşik hâlde `/teknik-analiz/NVDA` 500 döndü. Ajan sahte veriye ek
  yaptıysa scratchpad'de BIRAKMAZ: yamayı raporda ortak dosya için verir.
- 14 Kasım: 500 dönen sayfa "boy=1095" diye temiz geçti; art arda açılan
  hisse sayfaları da 200 koduyla "Biraz Yavaşla" kota ekranını ölçtürdü
  (`lib/rate-limit.ts`, IP başına). `olc.mjs` ikisini de HATA sayar ve
  yerelde her gezinmeyi ayrı `x-forwarded-for` ile yapar.
- 14 Kasım: saat kaydırıp `next dev`i yeniden başlatan iki ajan bütün
  rotalarda 404 aldı, `rm -rf .next/dev` düzeltti. Yeniden üretilemedi
  (ileri, geri, saatsiz yeniden başlatmalar 200 döndü; neden bilinmiyor).
  Önlem: saat değişince `saat.cjs` `.next/dev`i siler; yine görürsen elle sil.
- 14 Kasım: `unstable_cache` yeniden başlatmada yaşar; boş tatil tablosu bir
  gün önbellekte kalıyordu. Sahte sağlayıcı her açılışta veri önbelleğini siler.
- 14 Kasım: `cek.mjs` istemci bileşenli (yoklayan, akışlı) önizlemede
  `networkidle` beklerken zaman aşımına düştü. Bekleme süreli ve hataya
  kapalı olmalı (`cek.mjs` ve `olc.mjs` öyle); ağın susmasını şart koşma.
- 14 Kasım: tam sayfa çekim (`fullPage`) görünümü yeniden boyutlandırır;
  `components/today/FillColumn.tsx` yeniden ölçer, dolgu satırları
  sıfırlanabilir, sayfa boyu oynar (ölçüldü: 7669 → 7674). Kolon dibini ve
  dolguyu çekimden ÖNCE ölç; görüntüdeki dolguya güvenme.
- Tam sayfa görüntüde boş logo karosu tembel yüklemedir: önce kaydır (betikler yapar).
