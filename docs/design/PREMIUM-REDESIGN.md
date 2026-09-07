# Premium Arayüz Yenilemesi

6 Eylül 2026. Kapsam: ana sayfa, şirket detay ve bilanço detay ekranları.

## Tasarım Kararı

ABD piyasalarını takip eden kullanıcılar için finans verisinin okunabilirliği ile daha güçlü, hareketli bir görsel anlatım birleştirildi. Schibsted Grotesk, mavi marka rengi, yön bildiren yeşil/kırmızı, mevcut logolar ve iki tema korundu. Görsel çeşitlilik 8/10, hareket 7/10, veri yoğunluğu 6/10 olarak ele alındı. Yeni bir arayüz kütüphanesi veya animasyon bağımlılığı eklenmedi.

## İncelemede Görülenler

- Ana sayfada geri sayım, dört endeks ve gün şeridi aynı büyük paneldeydi. 1440px ölçümünde ana panel yaklaşık 523px yüksekliğindeydi; geri sayımın karşısındaki endekslerin yazı ve grafik alanları küçüktü.
- Şirket sayfasında fiyat, profil, temel metrikler ve analist dağılımı güçlü bir veri altyapısına sahipti; yüzey ve ölçek benzerliği aralarındaki hiyerarşiyi zayıflatıyordu.
- Bilanço sayfasında dönem, karar, metrikler, gerçekleşen sonuçlar, şirket öngörüsü ve metin analizi mevcuttu. Benzer panel başlıkları uzun raporun bölümlerini yeterince ayırmıyordu.
- Tema, dil, kaynak zamanı, gecikme bilgileri, erişilebilir sekmeler, sunucu bileşenleri ve bağımsız Suspense sınırları korunması gereken mevcut özelliklerdi.

## Uygulanan Düzen

**Ana sayfa:** ana odak açılış ziline kalan süre. Gün/saat/dakika/saniye dört sabit sütunda, yalnız değişen sayının kısa geçişiyle güncellenir. Türkçede açılış tarihi ve saat İstanbul saat diliminden hesaplanır; seans açıkken kapanışa geçilir. 7 Eylül geri bildirimiyle dekoratif zil sahnesinin yerini sağda 2×2 endeks kartları aldı; mobilde bu panel geri sayımın hemen altında kalır. Seans bilgisi geri sayımın üstünde, endekslerin vekil fon sembolleri ve veri damgası panelde görünür. Kartların ışık takibi ve giriş geçişleri korunur. Bölüm bağlantıları “Bugünün Akışı” başlığına taşındı. Günlük özet, Mercek ve son bilanço alanları farklı yüzeylerle ayrıştırıldı. En yeni bilanço gerçek özeti, şirket logosu, puanı ve kararıyla öne çıkan bir karta dönüştü.

**Şirket:** profil kartının ölçülen üst boşluğu 73px’ten 16px’e indirildi; sağda başlıkla aynı kotasyondan son fiyat, günlük değişim, piyasa değeri ve kotasyonun kendi kaynak damgası yer alır. Grafik hover okuması bu referansı değiştirmez. Büyük fiyat okuması, belirgin şirket kimliği, piyasa değeri ve profil yüzeyi, yaklaşan bilanço kartı, metrik ızgarası, gerçek analist dağılımından çizilen halka, şirket logolu sektör kartları ve haber ızgarası.

**Bilanço:** şirket ve gerçek sonuçları öne çıkaran rapor kapağı. Büyük mali dönem satırı (1440px'te 111px) kaldırıldı; dönem üst künyede küçük etiket. İlk iki rapor metriği aşağıdaki ızgaradan kapağa taşındı, tekrarlanmıyor. Mini gelir grafiği yalnızca gerçekleşmiş son beş çeyreği gösterir; öngörüler filtrelenir. Skor halkası, karar alanı, yüksek gelir sütunları, öngörü aralıkları, CEO alıntısı ve ayrışan okuma bölümleri korunur.

## Ortak Hareket Sistemi

`components/motion/PremiumMotion.tsx` altı bağımsız istemci bileşeni sunar:

- `Reveal`: sunucu içeriği görünür kalır; henüz ekran altındaki bölümler bir defa yükselerek belirir.
- `SpotlightCard`: hassas işaretçide yay fiziğiyle ışık takibi; sayısal metinler eğilmez.
- `ScrollProgress`: sayfanın okuma ilerlemesi.
- `SectionNav`: doğal hash bağlantıları, yapışkan bölüm menüsü, aktif bölüm ve ölçülmüş başlık mesafesi.
- `ScrollStage`: gün akışı, şirket metrikleri ve raporun okuma alanları görünürken doğal boyutlarına ulaşır; kaydırma kilitlenmez.
- `MotionExperience`: sayfa girişleri, sırayla beliren sunucu kartları ve gerçek gelir sütunlarının çizimi. Web Animations kullanır; akışla gelen HTML'in özniteliklerini değiştirip hidrasyonla yarışmaz.

Sürekli kaydırma veya işaretçi değerleri React state ile takip edilmez. Motion değerleri, IntersectionObserver ve CSS kullanılır. Dokunmatik ve `prefers-reduced-motion` için uygun davranışlar bulunur. Sabit gezinme zemini opaktır; arkasındaki yazılar etiketlere karışmaz.

## Doğrulama ve Bulunan Düzeltmeler

- Üç sayfa × açık/koyu tema × 360, 390, 768, 1024, 1440, 1600px: 36 kombinasyonda belge düzeyinde yatay taşma görülmedi.
- İngilizce mobil sürümlerin üçü de HTTP 200, `lang=en`, sıfır yatay taşma ve hareket azaltılmış modda görünür içerikle açıldı.
- Günlük/haftalık özet ve ok tuşlarıyla sekme değişimi doğrulandı.
- Şirket grafiğinde 1 aylık aralık ve mum görünümü doğrulandı.
- Bölüm bağlantıları masaüstünde hedefleri yaklaşık 157px konumuna yerleştirdi; üst menü ve bölüm çubuğunun altında kaldılar. Sayfa sonundaki kaynaklar bölümü son kaydırma konumunda aktif olur.
- Grafik 1440px'ten 390px'e daraltıldığında son işlemlerin kesilebildiği görüldü. `lockVisibleTimeRangeOnResize` ve `minBarSpacing: 0.1` ile seçili dönem korunur; yaklaşık 960 dakikalık uzatılmış seans mobil çizim alanına sığar. [Grafik kütüphanesinin aralık seçenekleri](https://tradingview.github.io/lightweight-charts/docs/api/interfaces/TimeScaleOptions).
- Endeks yükleme iskeleti gerçek dört sütun / mobil iki sütun düzenine uyarlandı.
- Aktif bölüm gözlemi piksel bazlı bir okuma çizgisine bağlandı. Yüzdeli `rootMargin` ile okuma eşiği arasındaki uyumsuzluk giderildi.
- `npm run lint`, `npm run typecheck`, `npm run build` başarılı. Tarayıcı etkileşim kontrollerinde yakalanan JavaScript çalışma zamanı hatası yok.

Kontroller yerel Chrome üzerinde yapıldı. Gerçek iOS/Safari cihaz ölçümü ve saha Core Web Vitals ölçümü yapılmadı. Yayımlama iş akışları ve veritabanı şeması değiştirilmedi. Gün içi sonuçların okunma yolu aşağıdaki canlı akış kapsamıyla genişletildi.

## Geri Bildirim Sonrası Kontroller

- 7 Eylül endeks yerleşimi: endeksler sağdaki zilin yerine taşındı; dört kart her genişlikte 2×2 düzeni korur. Kahraman alan 1440px'te 679→508px, 390px'te 848→764px oldu. TR/EN × açık/koyu × 320/360/390/768/1024/1280/1440/1600px: 32 kontrolde taşma, eksik endeks ve kesilmiş geri sayım rakamı yok. Azaltılmış hareket dahil tarayıcı hatası yok.
- 7 Eylül: son bilanço analizinin uzun özeti daha küçük bir önizlemeye dönüştürüldü (masaüstü 20→16px / 3 satır, mobil 16→14px / 4 satır). Mobil puan halkası şirket kimliğiyle üst sıraya alındı; özet tüm satırı kullanır. Gerçek SNOW kartı 360px ekranda 649→257px, masaüstünde 394→219px oldu. Tam metin analiz sayfasında kalır. TR/EN × açık/koyu × 320/360/390/430/768/1024/1440px kontrollerinde kart/belge taşması ve tarayıcı hatası yok; lint, typecheck ve build başarılı.
- Ana sayfa: iki dil × iki tema × 360/390/768/1024/1280/1440px, 24 düzende belge taşması yok. Hedef saat ekrandaki ISO tarihinden ilgili saat diliminde doğrulandı.
- Sayaç saniye değişimi, kaydırmayla zil dönüşümü, gün akışı içindeki bölüm bağlantıları, azaltılmış hareket ve JavaScript kapalı ilk görünüm doğrulandı. Tarayıcı çalışma zamanı hatası yok.
- Bilanço: AVGO ve SNOW için 20 Türkçe genişlik/tema birleşimi ve iki İngilizce mobil kontrolü taşmasız. 1440px kapak 549px; artık yalnız dönem yerine iki sonuç ve gerçek veri grafiği içeriyor.

## Canlı Gün Akışı

`lib/day-flow-data.ts` sunucu çizimi ve `GET /api/day-flow?locale=tr|en` için tek veri yoludur. Takvim, gerçek sonuç ve yayımlanmış analiz aynı olay içinde buluşur. Etkinlik kartları, seans çizgisi, seçilen olayın gerçekleşen/beklenti/önceki değerleri ve şirket başına sonuç/analiz bağlantıları bulunur. Kart değişimleri kısa bir geçişle gerçekleşir; yeni sonuç kullanıcının seçimini değiştirmez.

- Görünür sekmede, akış ekrandayken veya yakındayken 30 saniyede bir kontrol edilir. API yanıtı kullanıcıya özeldir ve saklanmaz; sağlayıcı sorguları paylaşılabilir 60 saniyelik önbellek kullanır. Hatalarda yeniden deneme aralığı artar.
- Saatin geçmesi yalnızca **Sonuç Bekleniyor** durumuna geçirir. **Açıklandı** için gerçek EPS/gelir veya ekonomik veri, **Analizi Oku** için veritabanında yayımlanmış rapor gerekir. Aynı gruptaki şirketlerin durumları bağımsızdır.
- Bilanço sonuçları Finnhub'ın güncel takviminden okunur. Makroda desteklenen FRED serisinin olay gününe ait gözlemi, önceki günün veri sürümüyle karşılaştırılır. Yalnız eski gözlemin revize edilmesi yeni açıklama sayılmaz. İşsizlik başvurularında kişi/bin kişi dönüşümü yapılır; aylık FEDFUNDS ortalaması FOMC kararı yerine kullanılmaz.
- FRED dışındaki veya desteklenmeyen ekonomik sonuçlar mevcut takvim veri girişinden gelmeye devam eder. Sağlayıcının yayın gecikmesi vardır; 30 saniyelik kontrol, resmi açıklamayla aynı saniyede görünme garantisi değildir. Analiz üretilmez; yayımlandığında bağlantısı belirir.
- Geçici bağlantı/veri kaybında son doğrulanmış sayılar alan bazında, aynı ET günü ve şirket sembolüyle korunur. Şirketin saat grubunun değişmesi veya seansın sunucudan yenilenmesi bu sayıları silmez. Geri çekilen analizin bağlantısı korunmaz. Kritik takvim, analiz, şirket meta ve takip sorguları hata verirse eksik bir gün döndürülmez. İlk yükleme başarısızsa yeniden deneme alanı gösterilir.
- Birincil saat Türkçede TR, İngilizcede NY. Yaz saati farkı mevcut `session-clock` üzerinden hesaplanır; bilanço pencereleri yaklaşık olarak işaretlenir. Takvim günü açıkça NY olarak belirtilir.

## Canlı Akış ve Hareket Doğrulaması

- `node --import tsx --test tests/day-flow*.test.ts`: 14 test; sıfır ve negatif sonuç, bekleme/açıklanma ayrımı, karma bilanço grubu, FRED yayın/revizyon ayrımı, birim dönüşümü, sağlayıcı önbelleği ve geçici kayıpta gerçek sonuçların korunması. Analizi yayımlanmış şirketin sayılarının eksilmesi, yalnız EPS'nin kaybolması ve şirketin saat grubu değişmesi ayrı regresyon senaryolarıdır.
- Tarayıcıya özel test yanıtlarıyla bekleyen olay → gerçek sonuç → şirket bazında analiz → bağlantı hatası sırası doğrulandı. Test verileri veritabanına veya uygulama kaynaklarına eklenmedi.
- Ayrı tarayıcı kontrolünde yayımlanmış analiz dururken eksilen EPS/gelirin hem API yenilemesinde hem gerçek `router.refresh()` yanıtında korunduğu doğrulandı; JavaScript veya hidrasyon hatası yok.
- Akış: açık/koyu temada 360, 390, 768, 1024, 1440px genişliklerde taşma yok. Klavyeyle seçim ve azaltılmış harekette sonuç görünürlüğü doğrulandı.
- Zilin işaretçiye tepki veren derinliği, şirket bölümünün kaydırmayla tam boyuta ulaşması ve gelir sütunlarının görünürken çizilmesi gerçek tarayıcıda ölçüldü. Sayısal değerler sıfırdan saydırılmaz.
- Azaltılmış harekette CSS ilk boyamadan itibaren dönüşümleri kapatır; sunucu ve istemci aynı başlangıç özniteliklerini üretir.

## Dizinler ve Akış Okunabilirliği — 7 Eylül

- Önceki çalışma `dev` dalında `b17cd01` ile kaydedildi. Sonraki dizin ve akış düzenleri `bbe2963` ve `40366ce` commitlerinde yer alıyor.
- Şirketler dizininde başlık, gerçek şirket/sektör sayısı ve en kalabalık üç sektörün dağılımı birlikte okunur. Çubuklar piyasa payını değil dizindeki şirket sayısını gösterir ve mevcut sektör filtresine bağlanır. Sıralama, sayfalama ve sunucudan akan tablo korunur.
- Bilanço takviminde seçili aralığın gerçek açıklama sayıları ve önümüzdeki yedi günün yoğunluğu bulunur. Sütuna basmak ilgili gün başlığına götürür; boş günler sıfır kalır. Kartlarda şirket adı kırpılmaz; tutarlar dar ekranda gerektiğinde sarılır. Takvim, analizler ve takip görünümleri aynı başlık/sekme dilini kullanır.
- Analiz arşivinin öne çıkan özeti 14px, masaüstünde beş/mobilde dört satırlık önizlemedir; tam metne giden bağlantı görünür. Son analiz şeridinin puan ve dönem etiketleri 9px yerine 11px.
- Akışın eski 9–10px künyeleri 12–13px, olay başlıkları 17px oldu. Masaüstünde olay listesi ve sonuç paneli yan yana; mobilde tam başlıkları gösteren yatay liste ve altında sonuç bulunur. Önceki/sonraki okları seçimi değiştirir, cihaz döndürülünce seçili kart görünür kalır. Sonuç, beklenti, önceki değer ve her şirketin analiz durumu ayrı okunur.
- Mobil kontrolünde zaman çizgisinin `TR` etiketi alt satıra düşüyordu; saat ve birim birlikte tutuldu. Bilanço sekmelerinin 16px negatif kenar boşluğu kaldırıldı. 390px'te dizin tablosunun başlangıcı yaklaşık 683→607px, takvimin ilk gün başlığı 865→811px oldu; veri gizlenmeden üst alanlar sıkılaştırıldı.
- Sayfa giriş animasyonunun kalıcı `translate:0 0` değeri sabit ilerleme çizgisinin referansını değiştiriyordu. Animasyon sonunda dönüşüm serbest bırakılır.
- Kurulu Motion 13 sürümünün hareket azaltma hook'u tercihi yalnız montaj anında alıyor. Ortak `useMotionPreference` dış mağazası sistem tercihini açık sayfada da izler; devam eden Web Animations temizlenir. CSS sunucu boyamasından itibaren metinleri görünür tutar.

### Bu Turun Son Kontrolleri

- Yerel üretim sürümünde ana sayfa, şirketler, bilanço takvimi, analiz arşivi, takip giriş ekranı, NVDA detay ve AVGO raporu: TR/EN × açık/koyu × 320/390/768/1024/1440px, toplam 140 düzende belge taşması ve JavaScript hatası yok. Her rotada açık sayfada hareket azaltma tercihine geçildi; soluk kalan işaretli öğe ve hareketli bölüm dönüşümü yok.
- Şirket listesi 60→120 satır genişledi; fiyat sıralaması ve sektör grafiğinden Sağlık filtresine geçiş çalıştı. Takvim sütunu ilgili gün başlığını üst menünün altında yaklaşık 165px'e taşıdı; ay görünümünde 22 açıklama günü listelendi. SNOW araması ve sonuçsuz arama doğrulandı.
- Tarayıcıya özel uzun başlık/saat belirsizliği/sıfır sonuç/karma bilanço grubu yanıtlarıyla 12 tema-genişlik birleşiminde başlık kesilmesi, saat birimi sarılması ve seçili kartın ekran dışında kalması görülmedi. Analiz bağlantısı şirket bazında belirdi, başarısız yenileme son sonuçları korudu. Klavye seçimi ve azaltılmış hareket doğrulandı; JavaScript hatası yok.
- `npm run lint`, `npm run typecheck`, `npm run build` ve 14 veri/sağlayıcı testi başarılı. Test yanıtları yalnız tarayıcıda kullanıldı; gerçek veri tabanına örnek olay eklenmedi. Oturum açılmış takip sayfası gerçek bir kullanıcı hesabıyla ayrıca denenmedi.

## Piyasalar, Mercek ve Rehber — 7 Eylül

- Ana sayfadaki **Piyasayı Keşfet** bağlantısı kaldırıldı. Geri sayım açıklaması boşalan alanı kullanır; ilgili kullanılmayan stil ve çeviri anahtarları temizlendi.
- Üç dizinde ortak, açık bir başlık düzeni kullanıldı: büyük sayfa adı, ayrı açıklama ve ince ayırıcı. Mevcut marka, gezinme, URL'ler, içerik ve veri kaynakları korundu.
- Piyasalar'da seçili endeks geniş grafik kartına dönüştü; diğer iki endeks yanında, mobilde altında bulunur. Görsel sıra ve klavye sırası birlikte değişir. Gerçek fiyat, grafik, kaynak ve gecikme bilgileri korunur. Tahvil, piyasa katılımı ve günün hareketlerinde daha belirgin değerler, aşamalı girişler ve gerçek değerleri çizen çubuklar kullanıldı.
- Mercek'te öne çıkan haber, daha geniş başlık ve gerçek şirket/getiri paneliyle sunulur. Arşiv masaüstünde iki sütuna geçer; mobil filtreler tek satırda kayar. Uzun şirket adları, tarih ve okuma süresi sarılır. Mobilde öne çıkan haber başlığı yaklaşık 578→400px konumuna taşındı.
- Rehber'de öğrenme sırası, konu başlıkları ve makale kartları yeniden düzenlendi. Mobil adımlar numara, ad ve seviyeyi yaklaşık 66px satırlarda birlikte gösterir. Mercek ve Rehber yazı detaylarına ortak başlık ölçeği, giriş geçişi ve okuma ilerleme çizgisi uygulandı; içerik sütunu 720px sınırını korur.
- Kartların görünürken sıralı girişi ve işaretçi geçişleri ortak hareket sistemini kullanır. Aynı öğede iki giriş animasyonu oluşmaması için eski panel animasyonu bu sayfalarda kapatıldı. Hareket azaltma tercihi ve JavaScript olmadan içerik görünürlüğü korunur.

### Bu Turun Doğrulaması

- Yerel üretim sürümünde ana sayfa, Piyasalar, Mercek, Rehber, bir Mercek yazısı, bir Rehber yazısı ve NVDA detay: TR/EN × açık/koyu × 320/390/768/1024/1440px, toplam **140 yerleşim kontrolü**. Belge taşması, kesilen endeks grafiği veya JavaScript hatası görülmedi. Ana sayfa butonunun kaldırıldığı doğrulandı.
- Açık sayfada 14 hareket azaltma tercihi değişimi ve üç dizinde JavaScript kapalı yükleme doğrulandı; görünmez kalan içerik yok.
- Üç endeks seçimi, NASDAQ listesinin 60→102 satır açılması, fiyat sıralaması, MU filtresi ve sonuçsuz Mercek araması çalıştı. Rehber konu bağlantısı başlığı üst menünün altında yaklaşık 76px'e yerleştirdi; konu filtresi, sonraki yazı bağlantısı ve sabit okuma ilerlemesi doğrulandı.
- `npm run lint`, `npm run typecheck`, `npm run build` ve `git diff --check` başarılı. Bu tur veri/sağlayıcı mantığını değiştirmedi; gerçek veri tabanına test içeriği eklenmedi. Kontroller yerel Chrome'da yapıldı; gerçek iOS/Safari cihaz kontrolü yapılmadı.
