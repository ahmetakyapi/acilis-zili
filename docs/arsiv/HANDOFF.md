# Açılış Zili — Tasarım Devir Dokümanı

Bu doküman `acilis-zili-gece.dc.html` ve `acilis-zili-gunduz.dc.html`
mockup'larını Next.js + Tailwind koduna çevirmek için yazıldı.

> **Kaynak:** claude.ai/design projesi "Opening Bell UI Mockups"
> (`2f125c15-0edc-40f8-86fe-edf14e31ce6c`), DesignSync MCP ile indirildi.
> Mockup dosyaları `.dc.html` biçimindedir; tarayıcıda açmak için Claude
> Design'ın `support.js` runtime'ı gerekir — o dosya ürün kodu değildir ve
> repoya alınmadı.

> **Uygulama notu (bu repoda):** aşağıdaki §2/§3 tokenları birebir uygulandı.
> Sapmalar ve gerekçeleri için bu dosyanın sonundaki "Uygulamada sapmalar"
> bölümüne bak.

---

## 1. Tasarım dili — tek cümlede

**Sakin, modern bir takip uygulaması.** Zeminden beyaz/lacivert saydamlıkla ayrılan
yumuşak köşeli yüzeyler, tek bir hairline çizgi, gölge yok. Hiyerarşi yüzey +
tipografi ağırlığıyla kuruluyor. Renk sadece üç şey söylüyor: yukarı, aşağı,
etkileşim.

---

## 2. Renk tokenları

Aynı değişken adları iki temada da geçerli — sadece değerler değişiyor.

### Gece

```css
--bg:    #070d16;
--srf:   rgb(255 255 255 / 0.035);
--srf2:  rgb(255 255 255 / 0.06);
--line:  rgb(255 255 255 / 0.08);
--line2: rgb(255 255 255 / 0.14);
--bar:   rgb(255 255 255 / 0.20);
--tx:    #eaf1f8;
--dim:   #94a7ba;
--faint: #8497a9;   /* 11px'de AA — daha soluk yapma */
--acc:   #35b8ff;
--up:    #3ddc97;
--dn:    #ff5c7a;
/* accent üzeri metin: #06121f */
/* kart dolgusu (bilanço kartları): rgb(255 255 255 / 0.045) */
/* logo gradienti: linear-gradient(140deg,#4fc3ff,#1a63c4) */
```

Sayfa zemini:
```css
background:
  radial-gradient(90% 55% at 18% -8%, #12263c 0%, rgb(18 38 60 / 0) 60%),
  var(--bg);
```

### Gündüz

```css
--bg:    #f7f9fb;
--srf:   rgb(16 32 52 / 0.028);
--srf2:  rgb(16 32 52 / 0.07);
--line:  rgb(16 32 52 / 0.10);
--line2: rgb(16 32 52 / 0.17);
--bar:   rgb(16 32 52 / 0.16);
--tx:    #101c2b;
--dim:   #54677c;
--faint: #75879a;
--acc:   #0d74c4;   /* açık zeminde bir basamak koyu */
--up:    #0f8f63;
--dn:    #ce2044;
/* accent üzeri metin: #ffffff */
/* kart dolgusu: #ffffff (solid) */
/* logo gradienti: linear-gradient(140deg,#2a9bea,#0d5cb6) */
```

Sayfa zemini:
```css
background:
  radial-gradient(90% 55% at 18% -8%, #ffffff 0%, rgb(255 255 255 / 0) 62%),
  var(--bg);
```

**Kurallar**
- `--bar` grafik çubukları için ayrı bir token — `--srf2` kullanırsan gece
  temasında çubuklar görünmez oluyor (1.35:1). Bu bir hata düzeltmesiydi, koru.
- Yön rengi tek başına anlam taşımasın: `▲ / ▼` işareti daima var.
- Gece temasında neon/glow **yok**; gündüzde de yok. İki tema simetrik.

---

## 3. Tipografi

Tek aile: **Archivo** (400 / 500 / 600 / 700). `next/font/google`.

| Rol | Boyut | Ağırlık | Not |
|---|---|---|---|
| Geri sayım (hero) | 66px | 700 | `tracking-[-0.05em]` |
| Sayfa başlığı H1 | 34–36px | 700 | `tracking-[-0.03em]` |
| Bölüm başlığı H2 | 22–28px | 700 | |
| Kart başlığı | 13.5px | 700 | |
| Gövde | 14–15px / 23–25px | 400–500 | rengi `dim` |
| Küçük başlık / kicker | 10.5–11px | 700 | `uppercase tracking-[.1em]`, rengi `faint` |
| Fiyat / sayı | 13–40px | 700 | **`tnum` zorunlu** |
| Kaynak damgası | 11–11.5px | 400 | rengi `faint` |

- Kök öğede `font-feature-settings:'tnum' 1` ve `letter-spacing:-0.006em`.
- Bilanço kartlarındaki sayılar mono: `ui-monospace, 'SF Mono', Menlo, monospace`.

---

## 4. İkonlar

**Phosphor, duotone ağırlık.** `@phosphor-icons/react`. `fill` daima
`currentColor`. Server Component'lerde `@phosphor-icons/react/dist/ssr`
girişini kullan — kök giriş context'e dayanır ve `'use client'` şartı koyar.

| Rol | Phosphor adı |
|---|---|
| Arama (masthead, ⌘K, mobil) | `magnifying-glass` |
| Tema anahtarı | `sun` / `moon` |
| Mobil geri | `caret-left` |
| Sekme: Bugün · hatırlatıcı | `bell` |
| Sekme: Takvim | `calendar-blank` |
| Sekme: Piyasa | `trend-up` |
| Sekme: Bilanço | `file-text` |
| Sekme: Favoriler · listeye ekle | `heart` |
| Açılır liste oku | `caret-down` |

Boyutlar: sekme çubuğu 21px, masthead 15–16px, satır içi 13–15px.

---

## 5. Tekrar eden bileşenler

### `<Masthead>` — her masaüstü sayfanın üstü
Logo (27px, 9px radius, gradient kare + beyaz zil) → yatay nav (aktif olan
`srf2` dolgulu 8px radius pill) → sağda ⌘K arama alanı (248px) + tema düğmesi
+ TR/EN segmenti + accent "Giriş yap". Altında `border-bottom: 1px solid line`.

### `<BottomTabBar>` — mobil, 5 sekme
**Bugün · Takvim · Piyasa · Bilanço · Favoriler**
- Şirketler dizini mobilde sekme değil — üstteki aramadan erişiliyor.
  Mobilde 503 satırlık dizini kimse kaydırmaz.
- Makro ve Haberler, Bugün akışının altında bölüm + kendi tam sayfası.
- İkon 21px, dokunma hedefi min 64px genişlik.

### `<DayRail>` — "Bugünün akışı" (masaüstü)
04:00–20:00 oransal mutlak katman, yükseklik 112px.
- Zemin 6px yuvarlak şerit; ana seans `acc` %28 opaklıkla dolu
- Olay noktaları: normal 12px içi boş daire, yüksek etkili 16px dolu `dn`,
  takipteki 16px dolu `acc`
- "Şu an" çizgisi 3px `acc`
- **AÇILIŞ / KAPANIŞ başlıkları eksenin ALTINDA (top:56px), olay alt etiketleri
  74px'de** — bu ayrım çakışma düzeltmesiydi, aynı bandı paylaştırma
- Konum: `left: (dakika - 240) / 960 * 100%`
- Mobilde dikey timeline'a dönüşür (saat 48px + nokta rayı 20px + içerik)

### `<EarningsDay>` — bilanço günü grubu
1. **Gün başlığı**: `19px/700` tarih + `12.5px` mono şirket sayısı + bugüne
   `BUGÜN` çipi
2. **Hero satırları** (gün içinde piyasa değeri en büyük 2 şirket): tam genişlik,
   14px radius, solda 44px logo kutusu, sembol + zamanlama çipi + şirket adı,
   sağda gelir beklentisi (19px mono) + EPS beklentisi
3. **Mini kart ızgarası** (kalanlar): 184px sabit genişlik, `flex-wrap`,
   32px logo kutusu + zamanlama çipi üstte, altta gelir/EPS satırı
4. **"Diğer açıklayanlar (221)"** açılır satırı
- Zamanlama çipi: açılış öncesi `up` tinti, kapanış sonrası `acc` tinti (hero) /
  `srf2` (mini)
- Logo kutusu şimdilik sembolün ilk 2 harfi; gerçek logo geldiğinde aynı kutuya oturur

### `<IndexCard>` / `<Sparkline>`
14px radius kart: ad + ticker → 25–30px fiyat → değişim → 40–62px SVG sparkline
(`polyline`, yükselişte `up`, düşüşte `dn`, altında %8–9 opaklıkta `polygon` dolgu).
Mobilde 112px kartlar, yatay `overflow-x:auto` şerit.

### `<SummaryCard>` — Claude günün özeti
`linear-gradient(160deg, acc %13, acc %2)` + `1px solid acc %22` çerçeve.
Kicker "GÜNÜN ÖZETİ" + zaman damgası, 16px gövde, altında numaralı 3 madde.

---

## 6. Ekran envanteri

| id | Ekran | Rota |
|---|---|---|
| 4a | Bugün | `/` |
| 4c | Takvim | `/takvim` |
| 4d | Bilançolar (kart düzeni) | `/bilancolar` |
| 4e | Piyasalar | `/piyasalar` |
| 4f | Hisse detay | `/hisse/[symbol]` |
| 4g | Makro | `/makro` |
| 4h | Şirketler dizini + Haberler | `/sirketler`, `/haberler` |
| 4i | Favoriler (boş) + ⌘K paleti | `/favoriler` |
| 4j | Giriş | `/giris` |
| 4b | Mobil Bugün, Takvim | — |
| 4k | Mobil Bilanço, Hisse detay, Favoriler | — |
| 4l | Mobil Piyasalar, Makro, Haberler, Ara, Giriş | — |

Her id iki dosyada da aynı — `gece` ve `gunduz`.

---

## 7. Veri ilkeleri (mockup'ta kodlanmış)

- **Uydurma veri yok.** Veri gelmemişse `—` göster, kartı boş bırak, tahmin etme.
- Her veri bloğunun altında **kaynak + zaman damgası**:
  `Alpaca IEX · 09:11 ET`, `FRED · günlük senkron 10:30 UTC`, `Finnhub · 08:40 ET`
- Endeksler ETF üzerinden izleniyor (SPY/QQQ/DIA/IWM) — kullanıcıya söyle.
- Saatler daima çift: **ET birincil, TR parantez içinde** ikincil.
- Sayı biçimi Türkçe: ondalık virgül, binlik nokta (`743,62` · `3.412 $` · `94,12 Mr $`).
- Bilanço listesi gün içinde **piyasa değerine göre** sıralı — büyükler üstte.

---

## 8. Etkileşim durumları

- Hover: `acc` %8–10 tint zemin
- Basılı: `acc` bir basamak koyu
- Odak (klavye): `outline: 2px solid var(--acc); outline-offset: 2px`
  — tarayıcı varsayılan mavi halkası asla kalmasın
- Odaklı input: `1px solid acc %50` + `box-shadow: 0 0 0 3px acc %12`
- Devre dışı: `opacity: .45`

---

## 9. Mobil kırılım

**768px.** Ray ve tablolar mobilde **ayrı bileşen** render etsin — aynı
bileşeni responsive yapmaya çalışma, iki farklı düzen.

---

## 10. Uygulamada sapmalar

Mockup'a bilinçli olarak uyulmayan noktalar ve gerekçeleri:

1. **Tema sistemi.** HANDOFF `next-themes` + `html.dark` öneriyordu; proje
   çerez tabanlı `data-theme` kullanmaya devam ediyor (sunucuda basılıyor,
   FOUC yok, `az-locale` ile aynı mekanizma). Yalnızca token değerleri değişti.
2. **Varsayılan tema açık.** HANDOFF "gece varsayılan" diyor; ürünün mevcut
   kararı açık tema ve korundu.
3. **Oturum rozeti rengi.** Mockup "Seans öncesi" rozetini `dn` (kırmızı)
   çiziyor. Accent kullanıldı: fiyat verisinin yanında kırmızı rozet
   "piyasa düşüyor" diye okunuyor.
4. **Palet karartması.** Mockup gece temasında beyaz %34 scrim çiziyor, bu
   arka planı diyalogdan parlak yapıyor. Karartma yönü korundu.
5. **Günün özeti kartı.** Mockup'taki kart kısa, gerçek bülten uzun: ilk
   paragraf + 3 madde açık, gerisi `<details>` içinde.
6. **Giriş ekranı.** İki kolonlu bölünme uygulandı; "Google ile devam et",
   "Beni hatırla" ve "Parolamı unuttum" çizilmedi — hiçbiri kurulu değil.
7. **Bilanço hero sayısı.** Gelir beklentisi gösterilir; sağlayıcı vermezse
   piyasa değerine düşer ama **etiketi de değişir**.
8. **Grafik renkleri.** Yön rengi (yeşil/kırmızı, %0'da gri) yalnızca hisse ve
   endeks fiyat serilerinde. Makro göstergeleri accent maviyle çizilir —
   enflasyonun yükselmesi "iyi haber" demek değildir.
