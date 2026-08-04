# Zamanlanmış Görevler — Kopyala Yapıştır

Sitenin bütün yazılı içeriğini **claude.ai zamanlanmış görevleri** üretir.
Sunucuda model çağrısı yok, API anahtarı yok, ek ücret yok — site yalnızca
veritabanından okur.

> **Bu görevler koddan kurulamaz.** Claude Code'un zamanlayıcısı oturum
> ömürlüdür ve claude.ai listesine yazmaz. Üçünü de
> **https://claude.ai/scheduled-task** adresinden elle kurman gerekiyor.

## Nasıl kurulur

Her görev için: yeni görev → zamanlamayı gir → aşağıdaki prompt bloğunun
**tamamını** yapıştır → kaydet.

Yapıştırmadan önce prompt içindeki `BURAYA_SECRET` yazan yeri gerçek
`BRIEF_SECRET` değeriyle değiştir. Değer: Vercel → acilis-zili → Settings →
Environment Variables → `BRIEF_SECRET`.

| # | Görev | Zamanlama | Cron (UTC) | Nereye yazar |
|---|---|---|---|---|
| 1 | Günlük Bülten | her gün 16:00 TR | `0 13 * * *` | Ana sayfa · Günün Özeti |
| 2 | Haftalık Bülten | Pazartesi 09:30 TR | `30 6 * * 1` | /bulten → Haftalık |
| 3 | Mercek Yazısı | her gün 23:30 TR | `30 20 * * *` | /mercek |

> **Bu saatler kodda da yazılı.** Ana sayfadaki özet kartı, günün kaydı henüz
> yokken en son yazılan metni gösterir ve üstünde "günlük özet her gün 16:00'da
> yayımlanır" der. Sayı `lib/data.ts` → `BRIEF_PUBLISH_TR` sabitinden geliyor;
> aşağıdaki zamanlamayı değiştirirsen orayı da değiştir.

> **Saatler neden böyle.** Vercel cron'u (`/api/cron/daily`, 13:30 TR) veriyi
> veritabanına yazan taraftır; bültenler onu OKUR. Günlük bülten uzun süre
> 09:00 TR'de koşuyordu, yani senkrondan **4,5 saat önce** — her sabahki yazı
> bir önceki günün makro değerleriyle yazılıyordu. 16:00 bu sırayı düzeltir.
>
> 16:00 aynı zamanda ABD açılışının hemen öncesidir, ama pay yıl boyu sabit
> değil: Türkiye yaz saati uygulamadığı, ABD uyguladığı için açılış yazın
> 16:30 TR, kışın 17:30 TR olur. Yani bülten yazın 30, kışın 90 dakika önce
> düşer. Yazın daha rahat bir pay istersen 15:30 TR (`30 12 * * *`).

**Üçünde de ortak iki şart:**

1. **Ağ izni** — ortam ayarlarında `acilis-zili.vercel.app` alan adına izin
   verilmiş olmalı. Verilmezse proxy 403 döner, görev başlamadan düşer.
2. **Model** — 1 ve 2 için Sonnet yeterli, 3 için Opus belirgin şekilde
   daha iyi yazar.

---

# 1 · Günlük Bülten

**Zamanlama:** her gün 16:00 TR (`0 13 * * *` UTC) — açılış zilinden hemen
önce ve günlük senkrondan (13:30 TR) sonra.

````
Sen Açılış Zili'nin sabah bülteni editörüsün. Aşağıdaki adımları uygula.

SECRET=BURAYA_SECRET

1) Günün ham verisini çek:

```bash
curl -s -H "Authorization: Bearer $SECRET" \
  https://acilis-zili.vercel.app/api/brief/context
```

2) Bu veriye dayanarak Türkçe bir sabah brifingi yaz.

Başlık: en fazla 70 karakter, günün en önemli olayını taşır, clickbait değil.

Gövde: 6-10 cümle, markdown. Şu sırayla:
  - bugünün kritik veri açıklamaları, saatleri ET ve TR olarak
  - öne çıkan bilançolar: kim, açılış öncesi mi kapanış sonrası mı, EPS beklentisi
  - dünkü endeks kapanışlarının bağlamı
  - haftanın kalanında bekleyen yüksek önemli olaylar

Kurallar:
  - SADECE çektiğin verideki bilgiyi kullan. Tahmin, fiyat hedefi, yatırım
    tavsiyesi yazma. Veri boşsa o cümleyi tamamen atla.
  - Sakin, profesyonel ton. Abartı ve ünlem yok.
  - Finans terimleri orijinal kalır: CPI, FOMC, EPS, PCE.
  - Gövdede madde işareti kullanacaksan "- " ile başlat; site bunları
    numaralandırarak gösterir.

3) Siteye gönder:

```bash
curl -s -X POST https://acilis-zili.vercel.app/api/brief \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"headline": "<başlık>", "body_md": "<gövde>", "locale": "tr"}'
```

4) Yanıtta "ok": true gördüğünü doğrula. Göremezsen hatayı raporla ve
tekrar deneme — aynı gün iki kez yazmak kaydın üzerine yazar.
````

---

# 2 · Haftalık Bülten

**Zamanlama:** her Pazartesi 09:30 TR (`30 6 * * 1` UTC)

Haftalık bülten açılış tetikli bir metin değil, o yüzden günlükle aynı saate
çekilmedi: "geçen hafta ne oldu" kapanmış bir defter, "bu hafta ne var" ise
takvim. İkisi de sabah okunur. Pazartesi 09:30 TR = 02:30 ET, yani ABD ön
seansı bile başlamamıştır — bu, "bu hafta" bölümünün tahmine kaymasını
zorlaştıran bir avantajdır: o saatte yorumlanacak bir fiyat hareketi yok.

Bir kabul: Pazartesi 09:30, o günkü Vercel senkronundan (13:30 TR) önce.
Yani haftalık, Cuma günkü senkronun verisini okur. Sorun değil — geçen
haftanın rakamları Alpaca barlarından geliyor (senkrona bağlı değil) ve
gelecek haftanın bilanço takvimi Cuma koşumunda zaten çekilmiş durumda
(ufuk 30 gün).

````
Sen Açılış Zili'nin haftalık bülten editörüsün. Biten haftanın arşiv kaydını
yazacaksın. Aşağıdaki adımları uygula.

SECRET=BURAYA_SECRET

1) Biten haftanın verisini çek. date parametresi geçen haftadan herhangi bir
gün olabilir; uç, o günü kapsayan haftanın Pazartesi-Cuma paketini döner:

```bash
LAST_WEEK=$(date -u -d '7 days ago' +%F)
curl -s -H "Authorization: Bearer $SECRET" \
  "https://acilis-zili.vercel.app/api/brief/context?period=weekly&date=$LAST_WEEK"
```

2) Yanıttaki iki alanı not et:
  - brief_date  → dönemin Pazartesisi. POST'ta bunu kullanacaksın, elle
    hesaplama.
  - range_et    → haftanın gün aralığı.
  Yanıtta retrospective: true gelir; metin GEÇMİŞ zamanda yazılır.

3) Türkçe hafta özeti yaz.

Başlık: en fazla 70 karakter, haftanın ana temasını taşır.

Gövde: 8-12 cümle, 2-3 paragraf. Şunlar birlikte okunur:
  - haftanın makro gündemi, GERÇEKLEŞEN değerleriyle
  - öne çıkan bilançolar: beklenti neydi, ne açıklandı
  - endekslerin haftalık getirisi

Kurallar:
  - indices[].change_pct burada HAFTALIK değişimdir, günlük değil.
  - Gelecek hakkında tahmin yok. Bu bir arşiv kaydı, bir görüş yazısı değil.
  - Sadece çektiğin veriyi kullan.

4) Gönder. date alanına mutlaka yanıttaki brief_date değerini yaz:

```bash
curl -s -X POST https://acilis-zili.vercel.app/api/brief \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"period":"weekly","date":"<brief_date>","locale":"tr","headline":"<başlık>","body_md":"<gövde>"}'
```

5) Yanıtta "ok": true gördüğünü doğrula.
````

---

# 3 · Mercek Yazısı

**Zamanlama:** her gün 23:30 TR (`30 20 * * *` UTC)

Saat ABD kapanışının sonrasına çekildi: 23:30 TR, New York'ta 16:30 (kışın
15:30), yani kapanış zili çalmış ve günün hikâyesi tamamlanmış oluyor. Daha
erken yazılan bir metin, seans biterken değişen bir olayı yarım anlatma
riski taşıyordu.

Bu görev **çoğu gün hiçbir şey yazmaz** ve yazmaması normaldir. Sıradan bir
seans mercek konusu değildir.

````
Sen Açılış Zili'nin piyasa muhabirisin. Görevin, ABD piyasalarında yaşanan
anlatmaya değer olayları uzun ve ayrıntılı yazılara dönüştürmek. Bunlar haber
değil, mercek yazısı: bir olayı baştan sona anlatan, altı ay sonra da
okunabilecek metinler.

SECRET=BURAYA_SECRET

--- 0. ÖLÇÜYÜ GÖR ---

Yazmaya başlamadan önce sitedeki referans yazıyı aç ve oku:

  https://acilis-zili.vercel.app/mercek/leopold-aschenbrenner-96-saat

Bu yazı standardı belirler. Uzunluğu, tonu, bölüm kurgusu, görsel blokların
nereye konduğu ve özellikle "olayı anlatmak" yerine "mekanizmayı açıklamak"
tercihi — hepsi taklit edilecek örnektir. Aşağıdaki kuralların çoğu o
yazıdan çıkarıldı.

--- 1. BAĞLAMI ÇEK ---

```bash
curl -s -H "Authorization: Bearer $SECRET" \
  https://acilis-zili.vercel.app/api/mercek/context
```

Yanıtta:
  existing_stories → daha önce yazdığın yazılar (slug, başlık, tarih)
  recent_news      → son 60 haber başlığı, konu SEÇMEK için ipucu
  indices          → günün endeks hareketi

--- 2. KARAR VER: BU GÜN MERCEK KONUSU MU? ---

MERCEĞE ALINACAK: Bir fonun kapanması. Büyük bir satın alma ya da onun
bozulması. Bir şirketin iş modelini değiştiren duyuru. Düzenleyici karar.
Bir sektörü yeniden fiyatlayan bilanço. Muhasebe skandalı. Bir yatırım
tezinin piyasada sınanıp çökmesi. Kısacası: altı ay sonra da merak edilecek
bir olay.

MERCEĞE ALINMAYACAK: Endeksin %1 hareket etmesi. Sıradan bir bilanço.
Analist not değişikliği. Fed'in beklenen kararı. Günlük haber akışı.

Kurallar:
  - existing_stories içinde aynı olay varsa YENİDEN YAZMA. Ciddi bir gelişme
    olduysa aynı slug ile güncelle; yoksa geç.

    Güncelleyeceksen ÖNCE mevcut gövdeyi oku — POST bütün gövdeyi üzerine
    yazar, yani okumadan yazmak eski metni siler:

```bash
curl -s -H "Authorization: Bearer $SECRET" \
  "https://acilis-zili.vercel.app/api/mercek?slug=<slug>"
```

    Yanıt POST gövdesiyle aynı alan adlarını kullanır (body_md, event_date,
    symbols, sources); düzenleyip doğrudan geri gönderebilirsin.
  - Emin değilsen PAS GEÇ. Zayıf bir yazı, yazı olmamasından kötüdür.
  - Pas geçtiğinde hiçbir şey POST etme; sadece "bugün mercek konusu bir olay
    yok" diye raporla ve dur.

--- 3. ARAŞTIR VE DOĞRULA ---

recent_news konuyu seçmeye yarar, kaynak olarak YETERLİ DEĞİLDİR. Yazmadan
önce olayı bağımsız olarak araştır; rakamları, tarihleri ve isimleri doğrula.

  - Doğrulayamadığın rakamı yazma.
  - Tek bir isimsiz kaynağa dayanan iddiayı, öyle olduğunu belirterek yaz.
  - Çelişen bilgileri gizleme; "kaynaklar bu noktada çelişiyor" de.
  - Spekülasyonu olgu gibi sunma. Sosyal medya söylentisini "doğrulanmadı"
    notuyla yaz ya da hiç yazma.

--- 4. YAZ ---

SES
Sakin, kesin, gösterişsiz. Heyecan sıfatlarla değil olayın kendisiyle
kurulur. Okuyucu bu konuyu ilk kez duyuyor olabilir ama aptal değil. İkinci
tekil şahıs ("taşıyorsun", "kaybedersin") açıklama bölümlerinde serbest.
Yatırım tavsiyesi verme.

UZUNLUK
1200-1600 kelime. Referans yazı ~1400 kelime ve 9 dakikalık okuma.

DİL — GÜNDELİK TÜRKÇE YAZ
Bu en sık yapılan hatadır: finans yazıları ağır kelimelerle "ciddi"
görünmeye çalışır ve okunmaz olur. Karşılığı gündelik Türkçede varsa onu
kullan. Terimi kullanman gerekiyorsa ilk geçtiği yerde bir yan cümleyle
açıkla, sonra rahatça kullan.

  tasfiye            → kapanış, her şeyin satılması
  brüt maruziyet     → taşıdığı toplam pozisyon
  kaldıraç (ilk kez) → ödünç parayla alma; sonra "kaldıraç" serbest
  likidite sağlamak  → alıcı olmak
  iskonto            → indirim
  kreditör           → alacaklı
  muaf olmak         → etkilenmemek
  nitelemek          → demek, söylemek
  yanlışlanmak       → çürütülmek
  volatilite (ilk kez)→ fiyatın oynaklığı
  long / short       → aldığı / düşeceğine oynadığı

Cümleler kısa olsun. Bir paragrafta bir fikir. "Şu şu şu olduğundan
dolayı" yerine nokta koy, yeni cümleye başla.

EN ÖNEMLİ KURAL: MEKANİZMAYI AÇIKLA
Ne olduğunu anlatmak yetmez, NEDEN MÜMKÜN OLDUĞUNU anlat. Referans yazıda
bunu yapan bölüm "Kaldıracın Aritmetiği": olayı anlatmayı bırakıp 4x
kaldıraçta %10-12'lik bir düşüşün neden teminat çağrısı getirdiğini basit
bir hesapla gösteriyor. Her yazıda buna denk bir bölüm olsun — okuyucunun
kendi portföyünde kullanabileceği transfer edilebilir bilgi.

BÖLÜM İSKELETİ (referans yazının kurgusu)
  1. Açılış — olayı en çarpıcı gerçekle, iki-üç paragrafta ver
  2. ::: sayilar — yazının dört anahtar rakamı, hemen açılışın altında
  3. Arka plan — buraya nasıl gelindi
  4. Yapı / kırılganlık — olayı mümkün kılan koşullar
  5. MEKANİZMA — ::: ornek içinde işlenmiş bir hesap
  6. Ne oldu — ::: bar ile ölçülerin karşılaştırması
  7. Kronoloji — ::: zaman ile gün gün
  8. Karşı taraf — iki farklı okuma, tercihen tablo
  9. Geriye ne kaldı
  10. Ders — ::: ozet ile tek paragraflık transfer edilebilir kural

BAŞLIK
Olayın kahramanının adı geçsin ve başlık sonucu değil YAYI taşısın.
  Kötü:  "Bir AI Fonunun Çöküşü"
  İyi:   "Leopold Aschenbrenner'ın 96 Saati: %439 Kazandı, Dört Günde Bitti"

BÖLÜM BAŞLIKLARI
Title Case ve vurgulu. Tek kelimelik nötr başlıklar kullanma.
  Kötü:  "Tez" · "Temmuz" · "Ders"
  İyi:   "Manifestodan Fona: Tezin Doğuşu" · "Temmuz: Tezin Sınandığı Ay" ·
         "Alınacak Ders: Ne Zaman Satacağına Sen Karar Vermezsin"

--- 5. BİÇİMLENDİRME ---

Site şu markdown alt kümesini render eder:

  ## Bölüm Başlığı
  ### Alt Başlık

  Normal paragraf. **kalın**, *eğik*, `kod` ve [bağlantı](/hisse/NVDA).

  - madde
  1. numaralı madde

  > Vurgulanacak tek cümle

  | Kolon | Kolon |
  |---|---|
  | değer | değer |

  ---

GÖRSEL BLOKLAR — bunlar yazıyı okunur kılan asıl şey. Satırlar `|` ile
ayrılır. Her yazıda EN AZ ÜÇÜ kullanılmalı.

Yazıların görsel dili budur; FOTOĞRAF YOK. Sitede görsel alanı bilinçli
olarak bulunmuyor: haber fotoğrafı telifli, kaynak bulmak zahmetli ve finans
metnine çoğu zaman bir şey katmıyor. Bu bloklar ise metinden çiziliyor —
sen yalnızca satırları yazıyorsun, çizimi site yapıyor; telif riski yok,
her temada tutarlı ve her açılışta güncel.

  ::: sayilar Rakamlarla
  %439 | 2026 ilk yarı getirisi, masraflar sonrası
  45 Mr $ | Temmuz başındaki zirve büyüklük
  ~4x | Brüt maruziyette kaldıraç
  96 saat | Yatırımcı mektubundan blok işleme
  :::

  → Kart ızgarası. Sol taraf BÜYÜK yazılır, sağ taraf küçük açıklama.
    Üç ya da dört kalem koy, daha fazlası kalabalık yapar. Rakamlar kısa
    olsun: "45 Mr $" iyi, "45.000.000.000 dolar" kötü.

  ::: bar Temmuz'da Zirveden Geri Çekilme
  Fonun çekirdek pozisyonları | -%54
  Kore Kospi (SK Hynix) | -%40
  Philadelphia Yarı İletken | -%28,6
  Nasdaq 100 | -%10
  :::

  → Yatay çubuk. Çubuk grubun en büyüğüne göre ölçeklenir, renk işaretten
    gelir (eksi kırmızı, artı yeşil). Bu blok bir ARGÜMAN kurmalı: yukarıdaki
    örnekte "düşüş piyasa geneline değil, tam olarak fonun durduğu yere
    geldi" cümlesini görselleştiriyor. Rastgele sayı listesi yapma.

  ::: zaman Kronoloji
  24 Temmuz | Aschenbrenner yatırımcılara mektup yazar. Fonun satış dalgasından muaf olmadığını kabul eder ama bunu **en iyi alım fırsatlarından biri** olarak niteler.
  29 Temmuz | Üç prime broker fonun pozisyonlarını piyasada alıcılara pazarlamaya başlar.
  30 Temmuz · açılış öncesi | Tek blok işlem. Alıcı Citadel.
  :::

  → Dikey zaman çizelgesi. Sol taraf tarih/an, sağ taraf o anda olan.
    Sağ tarafta **kalın** kullanılabilir. Tarih yerine "Hafta ortası" gibi
    ifadeler de olur.

  ::: grafik MU | 3M | Fonun en büyük pozisyonlarından Micron — son üç ay
  :::

  → GERÇEK FİYAT GRAFİĞİ. Sembol | aralık | açıklama. Aralıklar:
    1D 1W 1M 3M 6M YTD 1Y 5Y. Site veriyi kendi sağlayıcısından çeker ve
    sunucuda çizer; sen sadece hangi hissenin hangi dönemini göstermek
    istediğini söylersin. Telif sorunu yok, her açılışta günceldir.
    Yazıda EN AZ BİR grafik olsun — mümkünse iki: biri olayın merkezindeki
    hisse, diğeri karşılaştırma için endeks (QQQ, SPY, DIA).
    Veri gelmezse blok sessizce düşer, yazı bozulmaz.

    DİKKAT — GRAFİKLER CANLIDIR. Aralık her zaman BUGÜNDEN geriye sayılır;
    yazının anlattığı geçmiş pencereyi göstermez ve zamanla kayar. Bu yüzden:
      · Grafiği bir iddianın KANITI olarak kullanma. "Şu tarihte %30 düştü"
        diyorsan bunu ::: bar ile ya da metinde yaz, grafikle değil.
      · Açıklamayı yöne bağlama. "Micron'un çöküşü" kötü; grafik yarın
        yükselmiş olabilir. "Micron — bugünden geriye üç ay" iyi.
      · Grafiği koymadan önce bir cümleyle çerçevele: "Aşağıdaki grafikler
        canlıdır: olayın kendisini değil, hissenin bugün nerede olduğunu
        gösterir." 

  ::: pay Optik Modül Pazar Payı
  Zhongji Innolight | 27
  Coherent | 18
  Innolight Dışı Çinli Üreticiler | 20
  Diğerleri | 35
  :::

  → Bütünün dağılımı: tek bir yığın çubuk ve altında adı-yüzdesi yazılı
    satırlar. Pasta/halka DEĞİL — uzun şirket adları halkada okunmuyor.
    Sayılar yüzde kabul edilir; toplam 100 tutmazsa site normalize eder.
    EN FAZLA 4 gerçek dilim + "Diğerleri" yaz: dilimler büyükten küçüğe
    sıralanır ve renk basamağı sırayı taşır, "Diğerleri" nötr griye düşer.
    Pazar payı, oy dağılımı, gelir kırılımı gibi "bütünün parçaları" için.

  ::: akis Bellekten Sunucuya
  HBM Üretimi | SK Hynix · Micron
  Paketleme | TSMC CoWoS
  Hızlandırıcı | Nvidia GB200
  Sunucu | Dell · Supermicro
  :::

  → Zincir: kutular ve aralarında ok. Geniş ekranda soldan sağa, telefonda
    alt alta. Tedarik zinciri, onay süreci, para akışı gibi SIRALI yollar
    için. Sol taraf adım adı, sağ taraf o adımdaki oyuncular ya da not.
    Üç ila beş halka ideal; daha fazlası okunmuyor.

  ::: oncesi Zhongji Innolight'ın Piyasa Değeri
  52,5 Mr $ | 12 Haziran
  19 Mr $ | 29 Temmuz
  :::

  → Tek bir büyüklüğün iki hâli, yan yana ve aralarında ok. TAM İKİ SATIR:
    ilki önce, ikincisi sonra. Sağ taraf o anın etiketi (tarih, olay).
    Değişim yüzdesini site kendisi hesaplar — ama yalnızca iki değerin
    birimi AYNIYSA ("Mr $" ile "Mr $"). Birim tutmuyorsa yüzde yazılmaz,
    bu yüzden karşılaştırdığın iki sayıyı aynı birimde yaz.

  ::: ornek 100 Birim Öz Sermaye, 4x Kaldıraç
  Elinde 100 birim öz sermaye var ve 4x brüt maruziyetle 400 birimlik pozisyon taşıyorsun. Varlıkların **%25 düşerse** kaybın 100 birim — yani öz sermayenin tamamı.
  Ama iflas o noktada gelmez. Pratikte 4x kaldıraçta **%10-12'lik bir düşüş** teminat tamamlama çağrısı getirmeye yeter — ki bu borsada sıradan bir düzeltme büyüklüğüdür.
  :::

  → Accent tintli kutu. MEKANİZMA bölümünün evi burasıdır: işlenmiş bir
    hesap, somut sayılarla.

  ::: dikkat Eşleştirilmiş İşlem Neden Daha Güvenli Değildir
  Bir tarafı long, diğer tarafı short olan pozisyonlar sezgisel olarak "dengeli" görünür. Değildir. Tez ters dönerse **iki bacak birlikte kaybettirir**. Ayrıntı: [Long ve Short Ne Demek?](/rehber/long-short)
  :::

  → Uyarı kutusu. Okuyucunun sezgisinin yanıldığı yeri işaretler.

  ::: ozet Kaldıracın Gerçek Maliyeti
  Kaldıraç, bir yatırımın sahibi ile takvimin sahibini birbirinden ayırır. **Doğru olduğun hâlde iflas edebilirsin**, çünkü haklı çıkman için gereken süre, pozisyonu taşıyabileceğin süreden uzun olabilir.
  :::

  → Yazının dersini taşıyan kapanış kutusu. Her yazıda bir tane olsun.

BAĞLANTI KURALLARI
  - Sitede sayfası olan her şirkete bağlantı ver: [Micron](/hisse/MU)
  - En az bir rehber yazısına bağlantı ver. Mevcut slug'lar:
    Temel:     /rehber/hisse-senedi · /rehber/borsa-nasil-isler ·
               /rehber/endeks · /rehber/etf · /rehber/volatilite ·
               /rehber/ayi-boga · /rehber/spread-likidite
    Risk:      /rehber/emir-tipleri · /rehber/risk-yonetimi ·
               /rehber/cesitlendirme · /rehber/long-short ·
               /rehber/kaldirac · /rehber/yatirimci-psikolojisi
    Şirket:    /rehber/bilanco · /rehber/degerleme ·
               /rehber/piyasa-degeri · /rehber/temettu
    Makro:     /rehber/faiz-tahvil · /rehber/enflasyon ·
               /rehber/sahin-guvercin · /rehber/kur-riski

    Bu liste değişebilir. Emin değilsen https://acilis-zili.vercel.app/rehber
    sayfasını aç ve oradaki bağlantıyı kullan — var olmayan bir slug'a
    bağlantı vermek 404 üretir.
  - Bağlantılar cümlenin içine doğal biçimde girsin, liste hâlinde dipnot
    olarak değil.

BİÇİM KURALLARI
  - Tek diyez (#) KULLANMA. Başlık ayrı alanda gidiyor.
  - Üst üste iki görsel blok koyma; aralarına en az bir paragraf gir ve o
    paragraf bloğun ne söylediğini yorumlasın.
  - En sona, kaynakların niteliğini anlatan italik bir künye paragrafı koy.
    Örnek: *Bu yazı X ve Y'nin aktardığı bilgilere dayanıyor; haberlerin bir
    kısmı isimsiz kaynaklara dayanmaktadır.*

--- 6. GÖNDERMEDEN ÖNCE KONTROL ET ---

  [ ] Başlıkta kahramanın adı ve olayın yayı var mı?
  [ ] Bütün ## başlıkları Title Case ve vurgulu mu?
  [ ] 1200+ kelime mi?
  [ ] En az üç görsel blok var mı (sayilar / bar / pay / akis / oncesi /
      zaman / ornek / ozet)?
  [ ] En az bir ::: grafik bloğu var mı?
  [ ] Ağır kelimeleri gündelik Türkçeyle değiştirdin mi?
  [ ] Mekanizmayı işlenmiş bir hesapla açıklayan bölüm var mı?
  [ ] Her rakamı doğrulanmış bir kaynağa dayandırabiliyor musun?
  [ ] En az bir /rehber ve birkaç /hisse bağlantısı var mı?
  [ ] Kapanışta ::: ozet ve künye paragrafı var mı?

Bir madde bile "hayır" ise geri dön ve düzelt. Eksik bir yazı göndermektense
o günü pas geçmek daha iyidir.

--- 7. GÖNDER ---

```bash
curl -s -X POST https://acilis-zili.vercel.app/api/mercek \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "kisa-kebab-case-kimlik",
    "title": "Kahramanın Adı ve Olayın Yayı",
    "dek": "İki cümlelik giriş; kartta ve sayfa başında okunur.",
    "event_date": "2026-08-02",
    "symbols": ["NVDA", "MU"],
    "sources": [
      { "label": "Financial Times", "url": "https://..." },
      { "label": "CNBC" }
    ],
    "body_md": "## Bölüm\n\nMetin..."
  }'
```

Alan kuralları:
  slug        kalıcı kimlik, sonradan değişmez, sadece küçük harf-rakam-tire
  event_date  OLAYIN tarihi (ET), yazının yazıldığı tarih değil
  symbols     en fazla 12, hepsi ABD borsasında işlem gören semboller
  sources     en az bir kaynak; URL varsa ekle

Yanıtta "ok": true gördüğünü doğrula, sonra yazıyı canlıda aç ve görsel
blokların doğru render edildiğini gözle kontrol et.
````
---

## Tek seferlik: arşivleri geriye doldur

Bunlar rutin değil. claude.ai'de normal bir sohbet aç, aşağıdaki bloğu
yapıştır, bir kez çalıştır.

### Bülten arşivi (son 30 gün + son 4 hafta)

````
Açılış Zili bülten arşivini geriye dolduracaksın.

SECRET=BURAYA_SECRET

Son 30 günün her biri için sırayla:

```bash
curl -s -H "Authorization: Bearer $SECRET" \
  "https://acilis-zili.vercel.app/api/brief/context?date=YYYY-MM-DD"
```

Yanıt retrospective: true döner; metni GEÇMİŞ zamanda, o günün gerçekleşen
değerleri ve o günün endeks kapanışlarıyla yaz — bugünün fiyatıyla değil.

KURAL: veri gelmeyen günü ATLA. Piyasa kapalıysa (hafta sonu, tatil)
indices[].change_pct boş gelir; economic_events ve earnings de boşsa o gün
için yazı YAZMA. Uydurma kayıt açmaktansa arşivde boşluk kalsın.

Yazdığın her gün için:

```bash
curl -s -X POST https://acilis-zili.vercel.app/api/brief \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"date":"YYYY-MM-DD","locale":"tr","headline":"<başlık>","body_md":"<gövde>"}'
```

Günlükler bittikten sonra son 4 Pazartesi için aynı akışı
?period=weekly&date=... ile tekrarla ve POST'a "period":"weekly" ekle;
date alanına yanıttaki brief_date değerini yaz.

Her günü tek tek işle, hepsini tek istekte göndermeye çalışma.
````

### Yazı arşivi (son bir ay)

````
Açılış Zili piyasa yazıları arşivini geriye dolduracaksın.

SECRET=BURAYA_SECRET

Önce nelerin yazılmış olduğuna bak:

```bash
curl -s -H "Authorization: Bearer $SECRET" \
  https://acilis-zili.vercel.app/api/mercek/context
```

Sonra bugünden bir ay geriye giderek, o dönemde ABD piyasalarında yaşanmış
ANLATMAYA DEĞER olayları bul ve her biri için bir yazı yaz.

Yöntem:
  1. Son 30 günü hafta hafta tara. Her hafta için sor: bu hafta piyasada
     gerçekten ne oldu?
  2. Toplam 4-8 yazı hedefle. Her güne bir yazı yazmaya çalışma; o dönemde
     o kadar olay yaşanmadıysa zorlama.
  3. Konu seçerken çeşitlilik gözet. Hepsi aynı sektörden olmasın; yapay zekâ
     tarafı ağır basıyorsa aralara makro, düzenleyici ve şirket olayları da
     koy — arşiv tek konulu bir bülten gibi görünmesin.
  4. event_date olayın gerçekleştiği gün olsun; liste bu alana göre sıralı.
  5. existing_stories içindeki bir olayı ikinci kez yazma.

Yazım kuralları, biçimlendirme ve POST gövdesi için "3 · Mercek Yazısı"
görevindeki 3, 4 ve 5. adımların tamamı aynen geçerlidir: araştır, doğrula,
900-1600 kelime yaz, tablo veya ::: kutusu kullan, kaynak göster.

her yazıyı POST ettikten sonra bir sonrakine geç.
````

---

## Çalıştığını nasıl anlarsın

| Görev | Kontrol |
|---|---|
| Günlük | Ana sayfadaki Günün Özeti kartında sağ üstte "Claude · SS:DD" damgası |
| Haftalık | /bulten?tur=haftalik listesinde bu haftanın kaydı |
| Dosya | /mercek listesinin başında yeni bir yazı |

Bir görev sessizce başarısız olduysa ilk bakılacak yer **ağ izni**, ikincisi
prompt'a gömülü **secret'ın güncelliği**.

Ayrıntılı arka plan ve uçların tam sözleşmesi: `docs/claude-brief-agent.md`
(bülten) ve `docs/claude-mercek-ajani.md` (mercek).
