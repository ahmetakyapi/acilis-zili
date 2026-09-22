# İstek ve Görsel Tutarlılık Kontrolü — 21 Eylül 2026

Başlangıç: `9e1c3b6`. Son Claude değişiklikleri ve bunların üzerine gelen dört arayüz commit'i incelendi. Tekrarlanan kullanıcı mesajları aşağıda ortak maddelere birleştirildi. Bu kayıt 22 Eylül'de gelen yedi yeni tasarım isteğinden **önceki** doğrulamadır; yeni yönlendirmeler ayrıca uygulanacaktır.

| İstek | Kontrol Sonucu ve Kanıt |
| --- | --- |
| Header sade, Teknik Analiz erişilebilir, boşluk dengeli | Beş ana bağlantı ve Daha Fazla korunuyor. Kullanılmayan orta boşluk bağlantılara dağıtıldı; arama 240px. 69px yükseklik korundu. |
| Header mavi gradient | Tema renklerinden mavi geçiş uygulandı. TR/EN, açık/koyu, 320–1920px ve %150 yazıyla 44 yerleşim başarılı. |
| Teknik liste kapağı aynı hatta bitsin | Görünen son çocukların 1440px'teki 41,3px farkı 0px; 1024px'te de 0px. Yalnız dış kutu ölçülmedi. |
| Teknik detay kapağı aynı hatta bitsin | MU'da gerçek metin bitişi sağ özetten 46px yukarıdaydı. Görüş ve açıklama birlikte alt hatta bağlandı; karşı tarafta kısa göstergeler de aynı hattı kullanıyor. |
| Sayfa başlıkları ortak başlangıç | Piyasalar, Şirketler, Teknik Analiz, Makro, Takvim, Bilançolar, Mercek ve Rehber kapakları masaüstünde y=93px; H1 y=144px. Mobil H1 y=129px. Detaylarda kırıntı, makalelerde yayın künyesi bulunması bilinçli farklılıktır. |
| Mobil Akış → Özet → Dünya → Hareketler | Son sürümde Dünya 5. sıraya düşmüştü. Akıştan sonraki sıra Özet, Dünya Piyasaları, Günün Hareketleri olarak düzeltildi. |
| Bilançolar ve analizler mobilde aşağıda, İngilizce haberler en altta | Bilanço/analiz bölümleri alt sırada; haberler kaynak künyesinden önce son içerik. 96 sayaç/yerleşim senaryosunda kontrol edildi. |
| Ana sayfa kapağı kompakt; saat görünür; sıfır gün gizli | TR/NY saatleri ve tarih mevcut. Gün sınırları, saniye ilerlemesi, azaltılmış hareket ve JavaScript kapalı saat doğrulandı. |
| Bugünün Akışı üst boşluğu ve okunabilirliği | Üst boşluk masaüstünde 14px, mobilde 12px. Olay listesi, seçili olay ve açıklanmış/beklenen veri ayrı; sıfır sonuç boş veri sayılmıyor. |
| Piyasalar başlığında kompakt endeksler | Üç küçük fiyat/grafik kartı başlıkla aynı yüzeyde; genişlik ve taşma kontrolü geçti. |
| Tahvil/VIX kompakt ve aynı hizada | İki panel aynı satırda bitiyor, endeks seçimlerinden önce. **22 Eylül yeni talebi bu sıralamayı değiştiriyor.** |
| Seçimler sayfa yenilenmesi gibi görünmesin | 8 sayfa × 2 dil × 2 genişlik: 32 geciktirilmiş filtre geçişi başarılı. İçerik yüksekliği korunuyor; iskelet ve marka zili görünüyor, bitince temizleniyor. |
| Şirketler ilk 10; büyük seçili NVDA alanı kalksın | On doğrudan şirket bağlantısı, kısa piyasa değerleri ve sıra numaraları var. Büyük seçili şirket paneli yok. |
| Şirket dizininde veri ve tekilleştirme | İlk 60 satırda 60 ayrı sembol; BRK.B tek, BRK.A tekrarı yok. AAPL/AMZN/AVGO/BRK.B fiyat, değişim, hafta ve hacim hücreleri dolu. Sembol/önbellek testleri geçti. |
| Bilanço kapağı ve detayları | Takvimde gerçek şirket, tarih/seans, gelir/EPS beklentileri ve iki ek şirket var. Güncel ADBE analizi mobil/masaüstünde tarandı. |
| Makro, Takvim, Rehber bütünlüğü | Ortak kapak, tipografi, yüzey ve kontrol dili mevcut; TR açık/EN koyu dahil 320/390/1440px tarandı. |
| Mercek detay tabsız, geniş ve grafik içersin | Okuma akışı ve kaynaklar tek sayfada. Grafik içeren Kospi yazısında gerçek MU tuvali mobil/masaüstünde çiziliyor; 3A seçimi veri getiriyor. |
| Mercek mobil ve arşiv kartları | Başlık/özet/künye ayrımı, numaralı önceki yazılar mevcut. Karttaki tek yüzde ilgili sembolle etiketli. TR/EN bağlantıları doğrulandı. |
| Mercek getirisi yoksa son kapanış | Tamamlanan son günlük kapanış ve tarih kullanılıyor. Hafta sonu, erken kapanış, 15 dakika gecikme, geçersiz/eksik veri testleri geçti. Gün içi mumu kapanış diye sunmuyor. |
| Şirket grafiği büyüsün, alt boşluk kalksın | SNDK/AAPL'da sol grafik ve sağ profil yığınının alt kenar farkı <1px. Grafik türü/aralık değişimi belge gezinmesi yapmıyor; açıklama açıldığında hiza korunuyor. |
| Şirket bölüm menüsü ilk ekranı kaplamasın | Genel görünümün altında, kaydırmada erişilebilir. |
| Değerleme/beklenti kartları eşit ve anlamlı | İkili satırlarda alt kenar farkı <1px; metrik, ortalama, analist dağılımı ve katılım göstergeleri ayrı anlamlı görseller. |
| Teknik fiyat haritası ve göstergeler | Ortak fiyat sağ kenarı farkı <1px; kesilen/çakışan satır yok. Altı gösterge kendine özgü gerçek veri görselini koruyor. |
| Planın Okuması altındaki boşluk | Trend/momentum/hacim özeti mevcut; fiyat ve gösterge fotoğrafının bağlamı korunuyor. |
| Animasyonlar ve erişilebilirlik | Menü/arama/hesap odak dönüşü, klavye, marka animasyonu ve azaltılmış hareket doğrulandı. Dört detay sayfasında kaydırma sonrası görünmez kalan panel yok. |
| Oturum açık sayfalar | Yeni test hesabıyla Favoriler, Ayarlar ve Takip Edilen Bilançolar: 9 yerleşim + hesap menüsü. Test hesabı uygulamanın doğrulamalı silme formuyla kaldırıldı; tekrar giriş reddedildi. |

## Doğrulama Kapsamı

- 26 rota × 3 genişlik başlangıç taraması: 78 yerleşim. Ardından TR/açık ve EN/koyu 156 yerleşim; tüm yanıtlar 200, kesilen H1 veya tarayıcı hatası yok.
- 7 odak rota × 5 genişlik × 2 dil × 2 tema: 140 yerleşimde fiyat sütunları, şirket kolonları, değerleme satırları, 10 şirket ve sembol etiketleri kontrol edildi.
- 44 header, 96 sayaç senaryosu; 32 filtre geçişi; 12 grafik/Mercek etkileşimi; 8 header etkileşimi; 4 grafik yükleme; 2 makale grafik kontrolü; 8 hareketli detay yerleşimi; 9 oturum açık yerleşim.
- 75 mevcut test başarılı. Üretim build, build sonrası typecheck, lint ve diff kontrolü temiz.
- Yerel kanıtlar: `/tmp/acilis-redesign/*-current.log`, `all-{before,after}.json`, `new-matrix.json`, `header-final2.log`, `cover-draft.log`, ekran görüntüleri. Geçici betikler ve hesap bilgileri depoya alınmadı.

Kontroller yerel üretim sunucusu ve Chrome ile yapıldı. Fiziksel iOS/Safari doğrulaması yapılmadı. Ana sayfanın bazı anlık ölçümlerinde belge genişliğinde 1px yuvarlama farkı var; görünür içerik taşması yok. Sağlayıcı verileri canlı olduğundan fiyatlar ve günlük içerik zamanla değişir. Görsel beğeni otomatik testin kanıtlayabileceği bir sonuç değildir; ölçümler ekran görüntülerinin incelenmesiyle birlikte değerlendirildi.
