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

## 22 Eylül Ek İstekleri — Tamamlandı

Önce yukarıdaki tarama `3105097` ile kaydedildi; ardından yeni yedi istek uygulandı. Bu bölüm, önceki tahvil/VIX sırası tercihini günceller.

| Yeni İstek | Uygulama ve Doğrulama |
| --- | --- |
| AL altındaki metin ve işlem planı | Büyük ikinci manşet yerine etiketli, 16px bir görüş okuması ve ona bağlı kompakt görüş rozeti. Alım bölgesi/hedef/stop ayrı alanlarda; tam genişlikteki kırmızı-yeşil şerit yerine iki ortak başlangıçlı risk/getiri çubuğu. Oran, tutarlar, yüzdeler ve hesap başlangıcı korunuyor. SAT/bölgesiz TUT kendine ait seviye anlamlarını korur. |
| Soldaki fiyat haritası | Fiyat sıralı, doğal yüksekliğe sahip satırlar; aynı sağ kenarda fiyatlar; aynı ölçekte iki yönlü uzaklık çubukları. Seçili fiyat, alım bölgesi ve stop farklı yüzeylerle ayrılır. Alt boşluk kaldırıldı; satır aralığının fiyat mesafesi olmadığı açıkça belirtilir. Geçildi/kırıldı etiketleri ve seviye gerekçeleri korunur. |
| Şirketler kapağının boş solu | Gerçek dizin sayılarından en geniş üç sektör ve şirket sayısı/pay çubukları. Bağlantılar ilgili sektör filtresini açar. İlk on şirketin sağdaki düzeni ve küçük piyasa değerleri korunur; iki tarafın görünen son içeriği hizalı. |
| Piyasalar önce piyasanın durumunu göstersin | Sıra: başlık/endeks kartları → endeks seçimi → piyasa genişliği → günün artanları/düşenleri → tahvil/VIX → şirket tablosu. Bağlam göstergeleri Makro'ya taşınmadı; hisse hareketlerinin hemen altında erişilebilir. Yükleme iskeleti yeni sıraya uyarlandı. |
| Bilanço kapağının boş solu | Seçili hafta/ay için mevcut kayıtlardan günlük yoğunluk grafiği, toplam bilanço ve en yoğun gün. Tarih aralığı belirtilir; en yoğun gün bağlantısı takvimdeki gerçek güne gider. Piyasa beklentisi veya önem puanı uydurulmadı. |
| Teknik liste kapağı/logolar | Önceki sütun hizası korunuyor; dağılımdaki logolar 26 → 32px. Mobil dokunma alanı 44px. |
| Şirket grafiğindeki imleç okuması | Fiyat masaüstü 24 → 32px, mobil 28px; yüzde 16/15px. Tarih görünür kalır. Okuma satırına yer ayrıldığı için imleç gezdirirken grafiğin yeri ve yüksekliği değişmez. |

Son doğrulama: 10 görünüm × 5 genişlik × TR/EN × açık/koyu = **200 yerleşim**. Kesilen fiyat, yatay taşma, çakışan satır veya tarayıcı hatası yok; teknik kapak ve fiyat sütunu farkları **0px**. Şirket/bilanço/teknik liste kapaklarında görünen son içerikler aynı hatta; hisse grafik ve profil kolonları hizalı.

Ek olarak **6 grafik imleci kontrolü**, **12 grafik/Mercek etkileşimi**, **12 geciktirilmiş filtre geçişi** ve en yoğun bilanço gününe bağlantı kontrolü başarılı. 75 mevcut test, üretim build, build sonrası typecheck ve lint geçti. Yeni veri isteği, bağımlılık veya finansal hesap değişikliği yok. Yerel kanıtlar `/tmp/acilis-redesign/sep22-{matrix,hover,query,peak}.json` ve `sep22-final-*` ekran görüntülerinde. Fiziksel iOS/Safari testi bu kapsamda değil.

## 22 Eylül — Yeni Dalın Birleştirilmesi ve Kaydırma/Bilgi Kartı Düzeltmeleri

`798eb33` ile biten dokuz yeni commit, yerel `c9b4e8f` ile `26447e6` üzerinden
birleştirildi. `dev` dalının ek birleştirilmemiş commit'i yoktu. Tüm dizinde
şirket araması, sembol bazında fiyat tazeliği, bilanço raporu bağlantıları ve
editörde çeviri/sürüm korumaları korundu.

Bu bölüm önceki yerleşim kayıtlarını günceller:

- Şirketler kapağındaki üç sektör özeti, yeni dalın tüm dizinde çalışan
  araması ve kapak içindeki sektör süzgeciyle değiştirildi; aynı bilgiyi
  tekrarlayan üçüncü bir alan eklenmedi.
- Piyasalar: genişlik/hareketler → şirket tablosu → tahvil/VIX. Yeni dalda
  kalan ikinci tahvil/VIX çağrısı ve ona ait yükleme iskeleti kaldırıldı.
- Teknik detayın görüş rozeti kimlik satırında bir kez; kompakt gerekçe ve
  yeni seviye/risk okuması korunuyor. Seviye gerekçeleri harita panelinde.
- Bilançolarda hafta/ay başlık yanında, günlük yoğunluk ve en yoğun gün
  kapağın solunda; aynı toplamı ikinci kez basan özet kaldırıldı.
- Son dalın sade masthead tercihi korundu; önceki kayıttaki çok katmanlı
  mavi masthead artık güncel görünüm değildir.

Son istekler:

- Şirketler tablosunun sabit başlığı şeffaftı (`rgba(..., .043)`): 450/600/800
  piksel kaydırmada satır metni sütun adlarının arkasından görünüyordu.
  Başlık ve hücreler artık opak temel üzerinde hafif ton taşıyor. 69px üst
  menü hizası korunuyor. Diğer tablolar da kaydırılarak tarandı.
- Ana sayfanın teknik dağılımı daha belirgin satır ayraçları, ince oran
  çizgisi ve büyüyen logo hedefleri taşıyor. Logo üzerine gelince veya
  klavyeyle odaklanınca şirket adı, görüş, **Analiz Anında** fiyat, trend,
  RSI ve yayın tarih/saatini taşıyan küçük bilgi kartı açılıyor. Aynı
  etkileşim teknik liste kapağında da var. Yeni fiyat isteği yapılmıyor;
  tarihli analiz fotoğrafı canlı fiyat diye sunulmuyor. Escape kapatır,
  kaydırma/yeniden boyutlandırma balonu temizler; dokunma doğrudan analize
  gider. Balonun üzerine geçince içerik kaybolmaz.
- Birleşim taramasıyla bulunan 320px ONDS kimlik sıkışması ve 768px EN
  teknik kapak alt hizası düzeltildi. Sabit yükseklik veya metin kesme yok.

## 22 Eylül (Akşam) — Altı Ekran İsteği

Önce yarım kalan iş (dağılım logosunun bilgi kartı, şirketler tablosunun
opak başlığı, piyasalardaki çift tahvil/VIX) doğrulanıp aşağıdaki ilk
maddeyle birleştirildi. Her ekran önce ölçüldü, sonra bağımsız bir
gözden geçirmeden geçti; bulgular uygulandı.

| İstek | Uygulama ve Ölçüm |
| --- | --- |
| Dağılım logolarına büyük kartın bilgi balonu; büyük karttan hover kalksın | Balon (logo, ad, görüş, Sektör, Piyasa Değeri, fiyat, yayın künyesi) artık ana sayfa paneli ile /teknik kapağındaki logolarda. Aynı anda tek balon, ölçülen yükseklikle başlık ile alt şerit arasına yerleşiyor, imleci tutmuyor (eski ipucu 5–7 komşu logoyu örtüyordu). Fiyat sayfanın kendi kotasyon paketinden: MU balonda ve kartta aynı sayı (önce 1.081,31 / 1.081,58). Ana sayfada ek istek yok (`indexSnapshot` anahtarı). Büyük kartta balon, kalkma, gölge büyümesi ve imleci izleyen ışıma kalktı; hover yalnız kenarlık tonu. |
| Takvim: gereksiz boşluk ve tuhaf durumlar | Kapağın boş sağ yarısında Gün/Hafta/Ay ve altında "Sıradaki Yüksek Etkili Açıklama". Şerit: iş günü iki, hafta sonu bir birim; tire ve sahte seçili gün yok. Ay görünümü gizli kaydırma (1320'de 2876 piksel) yerine yedi sütunlu ızgara. Ajanda tek panel, boş günler tek sessiz satır, halka arzlar yan kolonda. Okuma hatası "açıklama yok" diye gösterilmiyor. |
| Mercek yazı gövdesi | Satır ölçüsü 126–144 karakterden ~69'a; 18 punto, koyu okuma mürekkebi (kontrast 5,51 → 10,99). Kapaktaki rakamlar gövdede ikinci kez basılmıyor. Masaüstünde yapışkan ray: numaralı içindekiler ve şirketler (olay günü yazıda son kapanış, sonrasında "Olaydan Bugüne"). Şekiller kartsız, kaynaklar numaralı. Rehber ve KVKK piksel olarak aynı. |
| Geri sayım kartları ve üstteki boşluk | Kutular ve iki nokta kalktı; rakam 59 → 92 punto (1024'te 44 → 76). Rozetin üstündeki 45–75 piksellik ve tarih satırının altındaki 46–57 piksellik ölü bant kapandı; kalan hava rakamın iki yanına bölünüyor (1440: 35 / 39). Tarih satırı yerine iki zilli künye (TR ve NY saati, sıradaki zil). 768'de kahraman 683 → 476. |
| Öne çıkan analiz: Analizi Oku yukarı, ad tıklanır | "Analizi Oku" tarih satırında; şirket adı bağlantı ve kartın tamamı hâlâ tıklanır. Skor sütunu kimlik satırına indi; kart 439 → 343 piksel. |
| Yaklaşan bilançolar tarihe göre; alttaki boşluk | Seçim piyasa değerine, sıra tarihe göre (24 Eyl, 30 Eyl, 13 Eki, 13 Eki, 14 Eki). Son satır ile bağlantı arasındaki 75 piksel boşluk gerçek satırlarla doluyor; iki kolon aynı hatta, kısa özetli analizde ve JavaScript kapalıyken de. |

Ek düzeltme: ana sayfadaki Korku Endeksi satırı 348 piksellik yan kolonda
kartın kenarından kesiliyordu (320'de 67 piksel taşma); iki katlı düzende
her genişlikte iç dolgunun sınırında bitiyor.

Doğrulama: 13 rota × 5 genişlik × TR/EN × açık/koyu seçkisinde **195
yerleşim**; hepsi 200, yatay taşma, dışarı taşan öge ve konsol hatası yok.
Typecheck, lint (kaynakta uyarı yok) ve üretim derlemesi temiz. Fiziksel
iOS/Safari testi bu kapsamda değil.
