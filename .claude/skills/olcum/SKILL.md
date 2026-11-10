---
name: olcum
description: Görsel/yerleşim değişikliğini tarayıcıda SAYIYLA doğrular — sahte veriyle geçici önizleme rotası, Playwright ölçüm betiği, 390/1440 ve iki tema. Bir panelin, kartın ya da sayfanın görünümünü değiştirdikten sonra, taşma ya da hiza şüphesinde ve "bitti" demeden önce kullan.
---

# Görsel Ölçüm

Kural: görsel değişiklik ekran görüntüsüyle değil sayıyla doğrulanır;
ölçüm karar yorumuna yazılır (`.claude/rules/arayuz.md` → Düzen).

## 1. Veri

Bulut oturumunda `.env.local` yoktur, veritabanı ve sağlayıcılar boştur.
Sayfanın kendisini açmak yerine bileşeni sahte veriyle basan geçici rota
kur. Veri yükleyici ile çizimi ayrı tut (örnek: `StoriesSpotlight` →
`StoriesSpotlightView`, `WorldStrip` → `WorldStripView`): saf görünüm
bileşeni sahte veriyle ölçülebilir.

```
app/(app)/tmp-onizleme-<konu>/page.tsx   # İŞ BİTİNCE SİL
```

"Önce" hâli için canlı siteye bak: bulut oturumu https://aciliszili.com'a
erişir; `.claude/skills/gorsel-tur/cek.mjs` rota × genişlik × temayı
dilimli çeker (yalnız okur). Sahte veriyi oradaki gerçek değerlere benzet:
uzun ad, eksik alan, negatif, sıfır (10 Kasım: yalnız "güzel" veriyle
ölçülen kart canlıda "0,00 $" dev başlığı bastı).

### Gerçek Sayfa, Sahte Sağlayıcı

Bileşen değil SAYFANIN bütünü ölçülecekse (kolon dipleri, paneller arası
ritim, akışla gelen paneller) geçici rota yetmez. Sağlayıcıları sahteleyen
betikle gerçek rotayı gerçek yükleyicileriyle aç:

```bash
ANTHROPIC_API_KEY=mock DATABASE_URL="postgres://u:p@ep-x.mockdb.test/db" \
FINNHUB_API_KEY=mock ALPACA_API_KEY_ID=mock ALPACA_API_SECRET_KEY=mock \
NODE_OPTIONS="--require $PWD/.claude/skills/olcum/sahte-saglayici.cjs" \
npx next start -p 3110        # ya da: npx next dev -p 31xx
```

Kapatırken yalnız KENDİ portunun süreç ağacını öldür
(`pkill -f "next (dev|start) -p <port>"` ve onun `next-server` çocuğu);
çıplak `pkill -f next-server` öteki ajanların sunucusunu da kapatır. Port
doluysa eski derlemenin sunucusu kalmıştır ve ölçüm hata sayfasını çeker
(`boy=900` görürsen şüphelen; 10 Kasım). Betik dış adresleri engeller
(günlükte `[mock-fetch] engellendi`), canlı veritabanına ulaşılamaz. İçerik
tabloları (bülten, mercek, analiz, takvim, haber, makro) ve Hazine/Cboe/FRED
10 Kasım canlısına benzer satırlarla dolu; eksik sorguyu
`MOCK_SQL_LOG=<dosya>` ile bul ve betiğe ekle, uygulama koduna sahte dal
koyma.

Paralel ajanlar aynı dizinde `next dev` koşturamaz (`.next/dev` kilidi):
her ajan kendi worktree'sinde ve kendi portunda (`npx next dev -p 31xx`).

## 2. Ölçüm Betiği

`.tmp-<konu>.mjs` (gitignore'da). Playwright yüklü, kurulum YAPMA:

```js
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)("playwright");
```

`NODE_PATH=$(npm root -g) node .tmp-<konu>.mjs` ile koş. Her genişlik ×
tema için:

- `reducedMotion: "reduce"` ile aç (başsız Chrome çalışan CSS animasyonunu
  başa sarılmış karede yakalar); animasyonu `getAnimations()` ile say.
- Tema: `document.documentElement.dataset.theme = "light" | "dark"`.
- Ölç: `document.documentElement.scrollWidth - innerWidth` (yatay taşma 0),
  kutusundan taşan öğe (çocuğun `getBoundingClientRect` sınırları ebeveyn
  kutusunun dışında), `scrollWidth > clientWidth` kırpılan metin
  (`sr-only` ve bilinçli `text-overflow: ellipsis` hariç), yan yana
  ölçülerin dip/taban hizası, kolon dipleri (son çocuğun dibi).
- Genişlikler: en az 390 ve 1440; panel kırılımları varsa 768/1024/1280,
  ilk ekran sorusu varsa yükseklik de (1440×900, 1280×800, 390×844).

## 3. Temizlik — atlama

1. Geçici rotayı sil.
2. `rm -rf .next` — silinen rotanın tipi `.next/dev/types` altında kalır ve
   sonraki `npm run build` "route not found" ile düşer (8 Kasım'da üç ajan
   aynı tuzağa düştü).
3. `npm run build && npm run check`.

## 4. Kendi Görüntüne Bak

Sayılar temizken ekran yine kötü durabilir (ölü boşluk, zayıf hiyerarşi
taşma değildir). Son hâli dilimli çek, Read ile oku ve bir tasarımcı gibi
eleştir (`gorsel-tur` § 2 sınıfları); beğenmediğini düzeltip yeniden ölç.
Tam sayfa görüntüde boş logo karosu tembel yüklemedir: önce sayfayı
kaydır (`cek.mjs` yapar).

## 5. Kayıt

Ölçülen sayıları (önce → sonra) değişen kuralın kod içi karar yorumuna yaz:
genişlik, tema, piksel. "Sığıyor gibi duruyor" doğrulama değildir.
