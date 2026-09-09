# Arayüz Bütünlüğü İncelemesi — 9 Eylül 2026

Ana sayfa, piyasa dizinleri ve yazı detaylarında oluşturulan mavi geçişli tasarım dili, yardımcı sayfalara da uygulandı. Amaç veri yoğunluğunu korurken aynı role sahip başlıkların, yüzeylerin ve etkileşimlerin farklı sayfalarda aynı ağırlıkta görünmesi.

## Bulgular ve Uygulanan Değişiklikler

| Alan | Önce | Sonra |
| --- | --- | --- |
| Dizin ve yardımcı sayfa başlıkları | Aynı rol için masaüstünde 24–46px arasında farklı ölçekler | Ortak `--heading-page`: 28–40px; telefonda 28px |
| Haberler | Eşit ağırlıklı dar satırlar, görseli olmayan haberlerde boş görsel alanı | İlk haber öne çıkar; devamında masaüstünde iki sütun, mobilde tek sütun; gerçek görsel veya doğrulanmış şirket logosu varsa resim alanı |
| Bülten | Gövdenin tamamına yayılan mavi zemin, küçük yazı başlığı | Üstte sınırlı ışık geçişi, daha belirgin başlık, masaüstünde yapışkan arşiv; tam metin ve mobil arşiv şeridi korunur |
| Karşılaştırma ve Menü | Piyasa sayfalarından ayrışan yüzeyler ve sıkışık açıklamalar | Ortak kart malzemesi, daha okunur açıklamalar, odak ve hover geçişleri |
| Giriş / Kayıt | Sayfanın ana başlığı ürün tanıtımıydı; form başlığı ikincildi | Tek `h1` formun eylemini anlatır; mobilde form önce; görünür etiketler ve şifre göster/gizle kontrolü |
| Boş durumlar / 404 / hata | Büyük boşluklar, yer yer iç içe kartlar | Daha kompakt ortak geri dönüş yüzeyi, belirgin bağlantılar |
| Alt bilgi / KVKK / hesap sayfaları | Ortak premium yüzey dili eksikti | Tutarlı köşe, aralık, yüzey ve bağlantı davranışı; uzun hesap bilgileri sarar |

Ölçüm örnekleri (1440px / 390px): Haberler başlığı 32/24px → 40/28px; bülten yazı başlığı 24/19px → 32/24px. Giriş formunun başlığı mobilde 24px ikincil başlıktan 26px ana başlığa geçti; form başlığı y126 → y118. Önceki mobil ürün tanıtımı ana başlığı y555'teydi. Rapor başlıkları, şirket fiyatları ve finansal grafik okumaları kendi hiyerarşisini korur; tüm sayısal içerik tek bir boyuta zorlanmadı.

Ortak `Panel` temel katmanda premium yüzeyi ve 18px köşeyi kullanır. Öne çıkan yüzeyler 22px'tir. Sayfaya özgü renk/yerleşim kuralları temel katmanın üzerinde kalır. Haber, bülten, karşılaştırma, menü, kimlik ve yasal sayfalar mevcut `MotionExperience` katmanını kullanır; kaydırma ilerlemesi, sıralı belirme, hafif hover ve odak geçişleri aynı hareket diline bağlanır. Azaltılmış hareket tercihi gözetilir.

## Görünüm İncelemesinde Bulunan İşlevsel Sorunlar

- Haber sağlayıcısının akış etiketi her zaman haberin konusu değil: örneğin CRISPR yazısı NVDA akışından gelebiliyordu. Liste ve detayda görünen şirket etiketleri, mevcut `headlineMentions` kontrolüyle orijinal başlık/özet ve şirket adına göre süzülür. Bu bir metin eşleştirme yöntemidir; sağlayıcı kaydı değiştirilmez veya yeni şirket ilişkisi üretilmez.
- Mobil aramada Escape sonrasında odak kayboluyordu. Arama portalının sahibi ilk bağlanan masaüstü bileşeni; onun düğmesi mobilde gizli. Paylaşılan palet artık gerçek açıcı öğeyi saklar ve kapanınca odağı ona döndürür. Kısayolla açılırsa önceki odak, sonuca gidilirse mevcut sayfa geçiş davranışı korunur.
- Şifre göster/gizle düğmesi formu göndermeyen bir `button` kullanır; alanın değeri ve otomatik doldurma bilgisi korunur. Mobil alan yazısı 16px'e çıkarıldı. Kimlik doğrulama sunucu eylemleri değiştirilmedi.

## Doğrulama

- Yerel üretim sürümü, Chrome: 27 rota/durum × TR/EN × açık/koyu × 320/390/768/1024/1440px = **540 yerleşim**. Beklenen HTTP durumu, tek ve kesilmemiş ana başlık, yatay belge taşması, tarayıcı JavaScript hataları ve mobil ana sayfa öncelikleri kontrol edildi. Hata yok.
- Haber etiketi ve bülten zeminindeki son düzenlemelerden sonra Haberler, haber detayı ve Bülten için aynı dil/tema/genişlik matrisiyle **60 ek yerleşim** kontrol edildi. Hata yok.
- Etkileşim kontrolü: TR/EN giriş ve kayıt şifre düğmeleri (fare/klavye, değer korunması), yerel zorunlu alan doğrulaması, mobil form sırası ve alan boyutu; günlük/haftalık bülten geçişleri, haber detayına geçiş, karşılaştırma önerisinden gerçek tabloya geçiş, beş rotada animasyonlu kaydırma ve açık sayfada azaltılmış hareket tercihi.
- Mobil arama sonuçları, hesap menüsü, Escape ile kapanış ve masaüstünde anlık tema değişimi doğrulandı. Arama odak düzeltmesi ayrıca TR/EN × 390/1440px × normal/azaltılmış hareket ile **8 durumda**, hem düğme hem kısayol açılışı için geçti; JavaScript hatası yok.
- JavaScript kapalı kontroller yalnız görünür statik başlıklara ilişkindir. Akışla gelen Suspense içeriğinin JavaScript olmadan tamamlanması bu değişikliğin kapsamı değildir.
- `npm run lint`, `npm run typecheck`, `npm run build` ve `git diff --check` başarılı. Typecheck, `.next` tipleri yenilendiğinden build tamamlandıktan sonra çalıştırılır.

İncelenen rotalar: Ana Sayfa, Piyasalar, Şirketler, Makro, Takvim, Bilançolar, bilanço analiz listesi, bilanço takip misafir yönlendirmesi, gerçek bilanço detayı, NVDA şirket detayı, Mercek ve gerçek yazı detayı, Rehber ve yazı detayı, Haberler ve gerçek haber detayı, günlük/haftalık Bülten, boş/dolu Karşılaştırma, Menü, Giriş, Kayıt, KVKK ve üç eksik sayfa durumu.

Yerel kanıtlar: `/tmp/acilis-redesign/site-audit-before.json`, `site-consistency-qa.json`, `site-consistency-focused.json`, `site-interactions.json`, `site-navigation.json`, `search-focus-qa.json` ve `consistency-*` ekran görüntüleri. Geçici tarayıcı betikleri `.tmp-*.mjs` olarak tutulur, repoya eklenmez.

## Kapsam Sınırları

Ayarlar ve Favoriler'in oturum gerektiren içerikleri kaynak kodu ve derleme düzeyinde güncellendi; canlı hesapla uçtan uca test yapılmadı. Misafir yönlendirmeleri incelendi. Yönetim paneli için ayrı görsel yenileme veya yetkili tarayıcı denetimi yapılmadı. Fiziksel iOS/Safari testi yok; ölçümler Chrome'un farklı ekran genişliklerinde alındı. Yeni bağımlılık, örnek piyasa verisi veya uydurma görsel eklenmedi.
