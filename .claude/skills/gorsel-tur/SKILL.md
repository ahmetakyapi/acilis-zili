---
name: gorsel-tur
description: Bir ya da birkaç ekranı tasarımcı gözüyle baştan sona elden geçirir — canlı siteyi dilimli ekran görüntüsüyle okur, ekran başına bulgu listesi çıkarır, ekranları paralel `ekran-tasarimcisi` ajanlarına dağıtır, birleşik hâli yeniden ölçer. Kullanıcı "görsel kaliteyi artır", "ekranı iyileştir", "tasarımı elden geçir", "Awwwards gibi olsun" dediğinde ve büyük bir görsel işe başlamadan önce kullan.
---

# Görsel Tur

Çıta ve görsel dil: `.claude/rules/arayuz.md` → Görsel Dil; hareket:
`.claude/rules/hareket.md`. Tek ekranlık küçük düzeltme tur değildir:
doğrudan `olcum`.

## 1. Önce Bak (kod okumadan)

Bulut oturumunda yerel sayfalar veri basmaz; ekranın gerçek hâli canlı
sitededir. Dilimli çek ve dilimleri TEK TEK oku (Read):

```bash
NODE_PATH=$(npm root -g) node .claude/skills/gorsel-tur/cek.mjs \
  https://aciliszili.com <scratchpad>/once ana=/ piyasalar=/piyasalar hisse=/hisse/NVDA
```

Betik yalnız okur; 1440 ve 390, iki tema, 1800 piksellik dilimler
(`GENISLIKLER`, `TEMALAR`, `DILIM` ortam değişkenleri). Günün saati sonucu
değiştirir: açılış öncesi, seans içi ve kapalı piyasa ayrı boş durumlardır;
hangisinde baktığını bulgu listesine yaz.

## 2. Bulgu Listesi (ekran başına)

Tasarımcı sırasıyla oku ve her bulguyu KONUM + ÖLÇÜYLE yaz ("sağ kartın
altında ~150 piksel boşluk"), sıfat değil:

1. **Ölü boşluk:** yan yana kartlardan kısa kalanın altı, sabit
   `min-height` taşıyan iskelet, yarım genişlik kullanan liste.
2. **Kırık görünen boş durum:** az veriyle çizilen grafik, logosuz karo,
   yüklenemeyen görselin gri kutusu, "–" dolu sütun.
3. **Yanlış büyüklük:** en büyük puntoda anlamsız değer ("0,00 $"),
   başlıktan büyük künye, bölümler arasında tutarsız başlık ölçeği.
4. **Hiza:** yan yana ölçüler aynı hatta mı, hap/sayı/etiket üçlüleri,
   çakışan etiketler.
5. **Yoğunluk ve ritim:** seyrek tablo (sütunlar arası boşluk, satır
   yüksekliği), panel araları, kolon dipleri.
6. **Renk:** anlam taşımayan dolgu (uyarı gibi okunan satır), mavi/yeşil
   kuralı.
7. **Tekrar:** aynı görselin sekiz kez basılması gibi bilgi taşımayan öğe.
8. **Metin ↔ görsel çelişkisi:** açıklamanın söylediğini çizim göstermiyor.
9. **Hareket:** veri çizimi görünüme girince çiziliyor mu, hover/basış
   tutarlı mı, ilk ekran gecikiyor mu.
10. **390:** dokunma hedefi, alt çubukla çakışma, kaydırma işareti.

Bulgu, sahibinin yerleşik bir kararıyla çelişiyorsa (kod içi karar yorumu,
kural dosyası) listeye "karar: dokunma" diye yaz; tur kararı geri almaz.

## 3. Dağıt

`ajan-dagitimi` skill'i; ekran başına bir `ekran-tasarimcisi` ajanı
(`.claude/agents/ekran-tasarimcisi.md` — ortak kurallar tanımında, brifte
yinelenmez). Brifte yalnız: ekran, kapsam dizinleri, dokunmayacağı
dizinler, port, "önce" görüntülerinin yolu ve bulgu listesi ("asgari
liste, tavan değil").

Ortak dosyalar (`app/globals.css`, `components/ui/primitives.tsx`,
`components/motion/`, `components/layout/`, `lib/motion.ts`) tur boyunca
ANA OTURUMUNDUR: ajan yama önerir, uygulamaz. Aynı ihtiyaç iki ajandan
gelirse ortak bileşene sen terfi ettirirsin (birleştirmeden sonra).

## 4. Birleştir ve Yeniden Bak

1. `ajan-dagitimi` § 3 ile yamaları al; "Ana Oturuma" notlarını uygula.
2. Ajanların bıraktığı tutarsızlığı ara: aynı işi gören iki yeni bileşen
   ya da iki `@keyframes`, farklı süre/gecikme, farklı boş durum dili.
   Tekilleştir (`.claude/rules/hareket.md` kataloğuna işle).
3. `gorsel-denetci` ajanı EKRANLAR ARASI farkı ölçer (kod değiştirmez):
   aynı role farklı ölçü (başlık, yarıçap, hap, şerit), hover dili,
   hareket envanteri (kopya keyframes, süre dağılımı, ekran dışında
   oynayıp biten çizim). Bulguları ekran ekran sahibine dağıt, ortak
   dosyadakini kendin düzelt; kırmızı bulgu kalmayana dek sürdür. Bu
   denetimi ekran ajanları ÇALIŞIRKEN başlat (canlıya bakar, çakışmaz);
   ilk turda sona bırakıldı ve ikinci bir tur gerekti.
4. `rm -rf .next && npm run build && npm run check`, sonra `yayin`.
5. Yayından sonra canlıyı § 1 ile YENİDEN çek, "önce" ile karşılaştır;
   kullanıcıya ekran başına ne değiştiğini ve neye dokunulmadığını yaz.

## 5. Ders

- 10 Kasım: tam sayfa görüntüde alt satırların logoları boştu; kusur
  değil, tembel yükleme. `cek.mjs` önce sayfayı gezer. Bulguya yazmadan
  önce yakın çekimle doğrula.
- 10 Kasım: iki ajan aynı kusuru (açılış öncesi boş endeks grafiği) ZIT
  dille çözdü: biri asıl seansı, öteki ön seansı gölgeledi. Aynı bileşen
  ailesi iki ekranda varsa brifte ortak dili ver ya da tek ajana ver;
  birleştirmede § 4.2'yi atlama.
- 10 Kasım: önizleme rotası yalnız değişen paneli gösterir; ana sayfanın
  bütünü (kolon dipleri, 390 kahraman) ölçülemeden döndü. Bütün sayfa
  `olcum` → "Gerçek Sayfa, Sahte Sağlayıcı" ile açılır; brife yaz.
- 10 Kasım: worktree ajanı HEAD'den değil `origin/main`den açıldı; brifteki
  "şu SHA değilse dur" üç ajanı da tereddüde düşürdü. Brifte SHA yerine
  "ağacı `origin/main` ile aynı olmalı (`git diff --quiet origin/main`)"
  yaz; ana oturumda yayınlanmamış commit varsa önce onu `main`e al.
- 10 Kasım: sahibinin iki itirazı aynı kökten geldi ("slop gibi durmasın",
  "boş günler kötü duruyor"): sabit ızgara veriye uymuyordu. Tekrarlı yapı
  (gün × pencere, kart ızgarası) tasarlarken brife UÇ DAĞILIMLARI yaz (boş,
  tek hücreye yığılmış, zirve) ve hepsinin önizlenmesini iste.
- 10 Kasım: kök `scroll-behavior: smooth` taşıyor; hızlı `scrollTo` döngüsü
  yarıda kesilir ve sayfanın altı hiç ekrana girmez (tembel logolar boş,
  `data-armed` çizimler "bekliyor" görünür; ikisi de kusur sanıldı). Ölçüm
  kaydırması `behavior: "instant"` ile (`cek.mjs` öyle yapar).
- 10 Kasım: altı tur masaüstünde eleştirildi, telefon en sona kaldı ve 28
  rotada 116 küçük metin + 404 küçük dokunma hedefi birikti. Her ekran
  turunun brifine 390 ve 360'ı SAYIMLA yaz (<12 px metin, <44 hedef;
  hedef `elementFromPoint` ile yoklanır, kutu ölçüsü sözde öğeyi görmez).
- 10 Kasım: sahibinin çizim tercihleri kuralda (`arayuz.md` → "Büyüklük
  kalın yatay şeritle", ortak tablo `BoardTable`, ortak çubuk `.value-bar`).
  Yeni ekranda önce onlara bak; nokta/çentik/eksen çözdüren çizim önerme.
- 14 Kasım: ortak brife "bölüm ve panel başlığı düz mürekkep" yazıldı; oysa
  başlık degradesi sahibinin 24 Eylül kararıydı (globals.css → "KART VE
  PANEL BAŞLIKLARI DA"). Üç ajan başlıkları düzleştirdi, iki ajan karar
  yorumunu görüp dokunmadı; birleştirmede hepsi geri alındı. Ortak brife
  kimlik yönü yazmadan önce o yönün dokunduğu token/kuralın karar yorumunu
  OKU (`grep -n "sahibinin" app/globals.css`); § 2'deki "tur kararı geri
  almaz" brifi yazan ana oturum için de geçerli.
- 14 Kasım: sahte sağlayıcının teknik analiz satırları `swingHighs` taşımıyor;
  birleşik hâlde `/teknik-analiz/NVDA` yerelde 500 döndü (canlı satırlarda
  alan var). Ajan kendi yamalı kopyasıyla ölçmüştü. Ajanın sahte veri eki
  scratchpad'de kalmasın: birleştirmede `.claude/skills/olcum/sahte-saglayici.cjs`e
  taşı, yoksa birleşik ölçüm o ekranı göremez.
