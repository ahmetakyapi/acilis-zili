# Görsel ve Hareket İncelemesi · 26 Eylül 2026

Son değişiklikler (`bc597f9` tabanı), ortak hareket bileşenleri ve ekran
aileleri incelendi. Mevcut Archivo/Phosphor, şirket logoları ve mürekkep
sahneleri korunarak okunabilirlik ve hareket davranışı iyileştirildi.

## Uygulananlar

- **Isı haritası:** logoların altına sembol eklendi. Telefon ekranında şirketi
  anlamak için logoyu tanımak gerekmiyor. Yön renginin yoğunluğu opak panel
  üzerinde %22–40 aralığında; lejant aynı aralığı kullanıyor. Yüzdeler her
  iki temada okunuyor. Açılan künye kartına imleç taşındığında kart kapanmıyor.
  Açıklama, dokunmatik kullanım için de geçerli ve iki dilde güncellendi.
- **Izgara girişleri:** sıra her görsel satırda yeniden başlıyor; 28 ms
  aralıklarla, en fazla 240 ms gecikmeyle açılıyor. Dikey listeler kendi
  sıralarını sürdürüyor. İlk ekrandaki içeriğin hidrasyonda sabit kalması
  ve JavaScript olmadan görünür sunucu HTML'i korunuyor.
- **Hareket yaşam döngüsü:** biten animasyonlar takip haritasından çıkarılıyor.
  Klavyeyle odaklanan `Reveal` içeriği anında görünür oluyor.
- **Logo geçişleri:** kaydırma hareketinde, ekran boyutu veya hareket tercihi
  değiştiğinde uçuş iptal edilip gerçek logo gösteriliyor. Yeni bağlantı
  tıklaması önceki bekleyen uçuş kaydını temizliyor; yeni sekme ve indirme
  bağlantıları uçuş kaydı oluşturmuyor.
- **Mürekkep sahneleri:** işletim sisteminin hareket azaltma tercihi açık
  sayfada değişirse çizim durup son kareye oturuyor. Biten sahne yeniden
  başlatılmıyor; olay dinleyicisi bileşen kaldırılınca temizleniyor.

## Doğrulama

Chrome ile **32 adres × 390 / 768 / 1440 px = 96 kontrol**: son koşumların
tamamında belge düzeyinde yatay taşma ve yakalanan istemci istisnası yok.
Bu sayı ayrı ekran sayısı değildir; dil, yönlendirme ve erişim kontrolü
adreslerini de içerir.

Kapsam: ana sayfa, piyasalar (TR/EN), şirket dizini ve NVDA detayı,
bilanço takvimi/analiz listesi/takip girişi/NVDA raporu, teknik liste ve
NVDA planı, makro, ekonomik takvim, iki şirket karşılaştırması, haber
listesi ve haber detayı, Mercek listesi ve yazı, rehber listesi ve yazı,
günlük/haftalık bülten ve tarihli sayı, giriş/kayıt, menü, KVKK ve 404.
Karşılaştırma ve seçili uzun yazılar ayrıca koyu temada görüntülendi.

| Kontrol | Sonuç |
| --- | --- |
| Isı haritası yüzde metni, en düşük kontrast | Açık 8,37:1 · Koyu 5,80:1 |
| Mobil ızgaranın ilk üç satırı | Her satırda 0 / 28 / 56 / 84 / 112 ms |
| 768 px künye kartları, iki tema | İlk/ikinci/sondan ikinci/son karo ekran içinde |
| Açık sayfada hareket azaltma | Çizim sürerken tercih değiştirildi; kare sayacı durdu |
| Şirket dizininden detayına logo uçuşu | Kaydırmayla iptal sonrası uçan kopya yok, gerçek logo görünür |
| TypeScript, ESLint, üretim derlemesi | Başarılı |
| `git diff --check` | Başarılı |

Geliştirme sunucusundaki bazı navigasyon testleri tarayıcı protokol zaman
aşımına uğradı. Haber detayı, haftalık yönlendirme ve tarihli bülten üretim
derlemesi üzerinde yeniden açılıp üç genişlikte doğrulandı.

**Erişim sınırı:** favoriler ve ayarlar için girişe yönlendirme, yönetim için
yetkisiz 404 doğrulandı. Oturum içindeki kişisel listeler, profil seçicisi
ve yönetim editörleri kaynak kod düzeyinde incelendi; yetkili oturumla görsel
test yapılmadı. Canlı ortama dağıtım yapılmadı.

## 27 Eylül · Şirket Kimliği ve Kompakt Piyasalar

Bu bölüm, yukarıdaki ilk incelemenin ısı haritası tasarımını günceller.

### Şirket Detayı

- Logo geniş ekranda 88 px; şirket adı 30–42 px, tek renk ve güçlü ağırlık.
  Sembol/ sektör ikincil; fiyat kimliğin altındaki ayrı satırda.
- Telefonlarda logo ve başlık kademeli küçülür; uzun adlar kırılabilir.
  Kaynak logo yüklenemezse aynı ölçüde sembol/fon simgesi gösterilir.
- Logo, başlık ve ayırıcı kısa giriş hareketleri kullanır. Hareket azaltma
  tercihinde bu hareketler devre dışı; logo uçuş kopyasında giriş yinelenmez.
- NVDA, MSFT, BRK.B ve SPY: 320/390/768/1024/1440 px ölçümlerinde taşma yok.
  Koyu tema, eksik logo ve şirket dizininden detayına geçiş ayrıca kontrol edildi.

### Piyasalar

- Endeks kimliği ve fon kotasyonu sekme şeridine taşındı; yükselenlerin
  payı aynı şeridin sağında. Harita panelin tüm genişliğini kullanıyor.
- 30 şirket: geniş ekranda 15×2, tablette 10×3, telefonda 5×6.
  Sembol, logo ve yüzde birlikte gösteriliyor.
- Renk ölçeği yön başına dört basamaklı: mutlak değişim <%0,5, <%1,5,
  <%3 ve ≥%3. Sıfır nötr. Lejant da aynı renkleri ve eşikleri kullanıyor.
  Açık temanın en koyu hücrelerinde beyaz yazı, koyu temada açık yazı var.
- Künye kartı fiyat/değişim/piyasa değerine ek olarak mevcut veriden hacim
  ve gün içi aralık gösteriyor; eksik değerler uydurulmuyor. Klavye odağı
  kartı açıyor, bağlantının erişilebilir açıklaması da ayrıntıları içeriyor.
- Geniş ekranda artan/düşen beşlileri yatay özetler: bütün şirketler aynı
  satırda. Dar ekranlarda okunaklı dikey liste korunuyor. Dow katkı bilgisi
  ve karşılaştırma bağlantıları korunuyor.
- 1440 px ölçümünde harita yaklaşık 405→270 px, hareket bölümü başlangıcı
  979→806 px. Görüntü alanı yüksekliğine göre sayfa kaydırması hâlâ gerekebilir;
  beşli özetlerin kendi içinde kaydırma yok.

Son üretim derlemesindeki doğrulama: üç endeks × iki tema × yedi genişlik
(320/390/640/768/1024/1280/1440), toplam **42 görünüm**; belge taşması ve
istemci istisnası yok. İki temada 640/768/1280/1440 genişliklerinde 30
karonun tamamının açılan kartları ekran içinde. Renk ölçeğinin tüm
basamaklarında en düşük metin kontrastı açık **5,86:1**, koyu **5,14:1**.
İngilizce görünüm, logo uçuşunun temizlenmesi, 88 px hedefe oturması,
engellenmiş logo kaynağında sembol görünümü ve hareket azaltma yeniden
kontrol edildi. TypeScript, ESLint, üretim derlemesi ve diff boşluk
kontrolü başarılı.

### Seçim Şeridi · Son Düzen

`148f032` sonrasında kullanıcı geri bildirimiyle üç endeks seçeneği,
seçilen fonun kotasyonu ve yükselenlerin payı geniş ekranda tek satıra alındı.
Bileşen tablosu oku kaldırıldı. Fon sembolü renkli etiket, fiyat 24 px,
değişim 14 px; üst endeks kartlarındaki yüzdeler de 14 px ve yön tonlu
zemin üzerinde. Telefonda seçenekler aynı satırda, kotasyon hemen altında.
Yeni harita/özet yapısıyla eşleşmeyen yükleme iskeleti de uyarlandı.

Üretim derlemesinde üç endeks, iki tema, Türkçe/İngilizce ve yedi genişlik
ile 42 görünüm kontrol edildi: taşma, seçenek/kotasyon çakışması ve istemci
istisnası yok. Üst kart yüzdelerinin hesaplanan fontu genişte 14 px,
telefonda 12 px. Yükleme görünümü ayrıca JavaScript kapalı Chrome'da
incelendi. TypeScript, ESLint, üretim derlemesi ve diff kontrolü başarılı.

### Bilanço Detayı · Bütünleşik Değerlendirme

Kullanıcı geri bildirimiyle genel görüş, analist hedefi, bilanço günü
kapanışı, fiyat merdiveni ve oranlar tek yüzeyde birleştirildi. Masaüstünde
ortak kenarlar ve tek yatay ayraç; telefonda hedef/kapanış/ölçüler aynı
çerçevenin içinde sıralanıyor. Oranların tarih ve hesaplama dayanakları
korundu. Son kapanış fiyatı 1440 px ekranda 49 px, telefonda 36 px.

COST, NVDA, ASTS ve İngilizce SNOW raporları; açık/koyu temada,
320/390/768/1024/1200/1440 px genişliklerinde 48 görünüm: yatay taşma ve
istemci istisnası yok. Uzun açıklama, olumsuz oranlar ve farklı ölçü
sayıları aynı düzenle kontrol edildi. TypeScript, ESLint ve üretim derlemesi
başarılı. Genel görüşün mobil aç/kapat davranışı korunuyor.

### Mobil Alan Kullanımı ve Şirket Araması

Piyasalar ısı haritası 375–639 px ekranlarda 6×5; daha dar telefonlarda
5×6 kalıyor. 390 px ölçümünde 456→379 px, yaklaşık 77 px kazanç.
375 px'de karo eni en az 47 px; sembol/yüzde metinleri korunuyor.

Şirket araması telefonda 16 px yazı, 40 px giriş/düğme ve 44 px dokunma
alanı kullanıyor. Klavye eylemi arama; otomatik büyük harf ve yazım denetimi
kapalı. Lider kartlarında odak/basılı yüzey tonları ve piyasa değerini de
okuyan erişilebilir ad eklendi. Büyüklük çubukları gerçek doğrusal oranı
kullanıyor. Arama gönderimi ve klavye odağı Chrome'da doğrulandı.

Son kontrolde 10 genişlik × iki dil × iki tema = 40 görünüm: yatay taşma,
sembol/yüzde alanı ihlali ve istemci istisnası yok. 320 ve 375 px'de yazıyı
küçültmeden karo dolgusu ayarlandı. TypeScript, ESLint, üretim derlemesi ve
`git diff --check` başarılı.

### Piyasalar · Görsel Hiyerarşi ve Etkileşim

Mevcut marka ve veri yoğunluğu korunarak açılış başlığı, endeks fiyatları,
seçili kartın vurgu çizgisi ve yön etiketleri güçlendirildi. Tasarım yönü:
koruyarak iyileştirme; çeşitlilik 5, hareket 4, yoğunluk 7. Yeni hareketler
kısa durum geçişleriyle sınırlı; azaltılmış hareket tercihinde kapalı.

Isı haritası ve yükselen/düşen listelerine tutarlı simgeler; liste başlıklarına
daha net tipografik hiyerarşi eklendi. Bileşen tablosunda hafif alternatif
satır tonları, klavye odağı ve daha okunaklı fiyat/değişim değerleri kullanıldı.
Tablo başlığındaki dolar birimi ve erişilebilir tablo açıklaması netleştirildi.

Isı haritasının bilgi kartı, yeterli üst boşluk yoksa aşağı açılıyor; Escape
ile kapanıyor ve yeniden girişte açılabiliyor. Gün içi aralık göstergesi
yalnızca fiyat geçerli düşük/yüksek aralığındaysa çiziliyor. Sunucuda oluşan
30 karoyu tek istemci sarmalayıcısı yönetiyor; veri ve sıralama mantığı korundu.

Üretim derlemesinde üç endeks × iki tema × sekiz genişlik
(320/375/390/640/768/1024/1200/1440 px) = 48 görünüm: yatay taşma veya
istemci istisnası yok. İngilizce görünüm, bilgi kartının aşağı açılması,
Escape, yeniden giriş, klavye odağı ve artan fiyat sıralaması ayrıca
doğrulandı. Açık/koyu masaüstü ve mobil ekran görüntüleri incelendi.
TypeScript, ESLint, üretim derlemesi ve diff kontrolü başarılı.
