# Film Kimliği — Açılış Zili Videoları

Açılış Zili için yapılan her **video** (tanıtım, reklam, sosyal medya kesiti,
yaz saati açıklaması, lansman) `cinecode` skill'iyle üretilir; bu belge o
kitin üretim kartına markanın gerekçesini verir. cinecode "varsayılan font ve
palet yok, kartta gerekçesi olsun" der: gerekçe burası. Mod (Hızlı/Film),
kapılar ve teslim kitin kendi kuralıdır, burada tekrar edilmez.

| Ne yapıyorsun | Kit | Nerede |
|---|---|---|
| Sitenin içinde oynayan sahne (boş durum, bekleme, kahraman zili) | `motion-film` | `lib/ink/scenes.ts` → `INK_SCENES`, CLAUDE.md § Mürekkep Sahneleri |
| MP4/GIF olarak teslim edilen film | `cinecode` | Bu belge; film klasörü DEPONUN DIŞINDA (`~/Filmler/<ad>`) |
| Var olan bir sayfa içi sahnenin videosu | `motion-film` `film-video.mjs` | Sahne kodu zaten var, yeniden çizilmez |

Kurulum ve iş bölümü dev-starter'da: `machine/bootstrap.sh` → `CINECODE_REF`,
`machine/skills/motion-film/SKILL.md` § 1b.

## 1. Kartın LOOK Satırı: Renk

Renkler `app/globals.css`ten; aşağıdaki değerler 7 Kasım 2026 okuması. Film
kurulmadan önce oradan yeniden oku: token değiştiyse film token'ı izler.

| Rol | Açık film | Koyu film | Token |
|---|---|---|---|
| Zemin | `#f7f9fb` | `#08101a` | `--page-bg` |
| Ana mürekkep (çizgi, yazı) | `#101c2b` | `#e4ecf4` | `--text-strong` |
| İkincil yazı | `#54677c` | `#98abbd` | `--text-body` |
| Marka mavisi (etkileşim, kahraman) | `#0d74c4` | `#3cb7fb` | `--primary` |
| Display degradesi | `#0a2140 → #0e4a8f → #2493dd` | `#edf3f9 → #b6e2ff → #3cb7fb` | `--display-stop-*` |
| Marka karosu (iki temada aynı) | `#5cc4ff → #1f86e0 → #0b3f86` | aynı | `--mark-stop-*` |
| Tek vurgu: pirinç (zilin metali, mühür) | `#8c7200` | `#dcc057` | `--brass` |
| Yön (yalnız gerçek yükseliş/düşüş) | `#0c7350` / `#c01a3d` | `#40d699` / `#fa6680` | `--up` / `--down` |

- **Renk anlam taşır:** mavi zil ve etkileşim, yeşil/kırmızı YALNIZ bir fiyatın
  yönü. Süs için yeşil ok, kırmızı mum çizilmez.
- **Degrade üç yerde:** kısa display başlık, marka karosu, bekleme filmi
  sahnesi (CLAUDE.md § Görsel Dil). Gövde yazısı ve veri düz renk.
- **Yasak (kartın BANNED satırına aynen):** cam, blur, ışıma (glow), bloom,
  neon, lacivert uzay + parçacık, gökkuşağı degrade, borsa klişesi (boğa/ayı,
  akan yeşil rakam yağmuru, dolar yağmuru), deniz feneri ve fener.

## 2. Yazı

- **Tek aile: Schibsted Grotesk** (değişken 400–900, SIL OFL, Google Fonts);
  `LICENSES.csv`e satırı girer. Mono yalnız sembolde (`NVDA`, `SPY`).
- Türkçe imler korunur: `İ Ş Ğ Ü Ö Ç` telefon boyunda okunmalı. Büyük harf
  `toLocaleUpperCase("tr-TR")`; `capitalize` yok.
- Cümle olmayan her yazı **Title Case** ("Açılış Zili Çaldı", "15 Dakika
  Gecikmeli"); bağlaçlar küçük ("Faiz ve Getiri").
- Degrade başlık harfleri ayrı taşınan kinetik yazıda saydam kalır (motion-film
  § 5): kinetik yazı düz `--text-strong`, degrade yalnız duran başlıkta.

## 3. Kahraman: Zil

- Kahraman **tören zilidir** (askı, omuzlu kubbe, açılan etek, ağız çubuğu,
  kopuk tokmak). Logo olarak geometri `components/brand/BellMark.tsx`
  sabitlerinden (`BELL_*`); oyuncu olarak fırça zili `lib/ink/scenes.ts`
  (iki nokta göz, gülümseme). Yeni bir zil çizilmez.
- **İmza hamlesi:** zil çalar. Halka dalgası tokmaktan yayılır, ses vuruşla
  aynı karede (`heroTap`, `ringing` sahneleri referans). Son, açılışla
  kafiyelenir: film zilin sesiyle açılıyorsa marka karosuna oturan zille biter.
- **Mürekkep dili:** `lib/ink/engine.ts` (`brush`, `blot`, `splatter`, tohumlu
  `rng`) film HTML'ine kopyalanabilir; elle yapılmış kenar, kâğıt dokusu,
  boil. Kopyalanan dosya filmde kalır, siteye geri taşınmaz.

## 4. Hareket

- Eğri `cubic-bezier(0.22, 1, 0.36, 1)` (`--ease-brand`, `lib/motion.ts` →
  `EASE_BRAND`). Hedefini aşan yay YALNIZ tek küçük öğede (zil kolu, tokmak,
  onay işareti); yazı, kart ve kamera aşmaz.
- Kamera ağır ve az: yaklaşma, taşıma, sabit kadrajda nefes. Sarsıntı yok.
- Hareketi azaltan izleyici için sitede kullanılacak her filmin bir duran
  kapak karesi (poster) olur.

## 5. Veri Dürüstlüğü Filmde de Geçerli

CLAUDE.md § Veri Dürüstlüğü ve § Site İçi Claude'un videodaki karşılığı:

1. **Uydurma piyasa sayısı yok.** Ekrandaki fiyat, yüzde, endeks ya gerçek ve
   tarihli bir okumadır (künyesi kadrajda: "6 Kasım 2026 Kapanışı") ya da
   açıkça temsilidir ve sembol taşımaz. "NVDA %4,2" yazan sahte bir pano yok.
2. **Tavsiye yok.** "Al", "kaçırma", "kazandırır" gibi yön veren satır filme
   girmez (SPK: yatırım danışmanlığı). Filmin sonunda "Yatırım Tavsiyesi
   Değildir" künyesi küçük ama okunur.
3. **Saat TR önce, sabit saat yazılmaz.** Açılış yazın 16:30, kışın 17:30 TR;
   film tek bir mevsimi gösteriyorsa onu adıyla söyler ("Kış Saatiyle 17:30").
4. Yazılar cinecode'un yazım denetiminden (`words_check.py`, tire yasağı)
   ve okuma süresinden geçer.

## 6. Ses

- İmza sesi zil: tek, temiz bir tören zili vuruşu; çan değil, bildirim
  "ding"i değil. Kodla üretilecekse `motion-film/assets/film-sound.ts` → çan
  tarifi başlangıç noktası; kayıt seçilecekse açık lisanslı ve kulakla seçilir.
- Müzik her zaman kullanıcının seçimi (cinecode kuralı). Borsa haberi
  kalıbı (gerilim davulu, "breaking news" sesi) yok.
- Seslendirme varsa Türkçe, sakin; ham TTS değil (cinecode `sound.md` § 4b).

## 7. Biçimler ve Teslim

| Kullanım | Biçim | Süre |
|---|---|---|
| YouTube, site tanıtımı | 16:9, 1920 × 1080 | 30–90 sn |
| Reels, Shorts, TikTok | 9:16, 1080 × 1920; altyazı ve logo güvenli alanda | 10–30 sn |
| X, LinkedIn | 1:1, 1080 × 1080 | 15–30 sn |

- Film klasörü depoya girmez (depo herkese açık, film klasörü taslak ve
  ses kaynağı taşır). Sitede kullanılacak son MP4 sıkıştırılır, yalnız o
  dosya ve kapak karesi projeye gelir; kendiliğinden SESLİ oynamaz.
- Künye (müzik, ses, font lisansları) cinecode'un yazdığı
  `<başlık>-credits.txt`ten videonun açıklamasına girer, filmin üstüne değil.

## 8. Başlangıç Fikirleri

Kart yazılmadan önce kullanıcıya seçenek olarak sunulabilir; hiçbiri karar değildir.

- **"Zil Çalıyor" (9:16, 15 sn, Hızlı mod):** İstanbul'da akşamüstü, telefon
  ekranında geri sayım sıfıra iner, zil çalar, halka dalgası ekranı açar,
  marka karosu oturur. Sitenin geri sayım → zil anının filmi.
- **"Saatler Kayınca" (16:9, 45 sn, Hızlı mod):** ABD yaz saati geçişinde
  açılışın 16:30'dan 17:30'a kaydığını iki saat kadranıyla anlatan açıklayıcı;
  `lib/session-clock.ts` mantığı, sayı uydurmadan.
- **Tanıtım (16:9, 60–90 sn, Film modu):** Türk yatırımcının bir günü, ABD
  seansı Türkiye saatiyle; sitenin bölümleri (bülten, bilanço takvimi, teknik)
  mürekkep çizimiyle, ekran görüntüsü taklidi olmadan.
