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

## Bugünün Akışı: Daha Sade Yerleşim — 7 Eylül

- Kullanıcının yönlendirmesiyle çalışma dalı `main` oldu; önceki iki yerel commit geçmişi korunarak ileri alındı.
- Olay kartları saat, tür/durum ve tam başlıktan oluşan kısa satırlara dönüştü. Mobil yatay kart dizisi yerine yüksekliği sınırlı olay listesi kullanılır. Seçim ve ekran boyutu değişimi yalnız görünüm dışındaki satırı gerektiği kadar kaydırır.
- İç içe şirket kartları kaldırıldı; logo, sonuçlar ve analiz bağlantısı düz satırlarda gösterilir. Makro gerçekleşen/beklenti/önceki değerleri üç sütunda birlikte okunur. Detay başlığı ve boşlukları küçültüldü; başlık veya sonuç kırpılmaz.
- Seans grafiği saat ızgarası, seans bandı ve veri/bilanço işaretleriyle yenilendi. Aynı saate denk gelen açıklamalar tek işarette sayılır; işarete tekrar basmak o saatin diğer olayını seçer. Fare, klavye ve dokunma hedefleri aynı detay alanına bağlıdır. Geçen süre çizgisi genişlik yerine dönüşümle ilerler.
- Aynı üç uzun başlıklı olay ve iki şirketli test yanıtıyla 1440px'te detay 433→288px, bütün akış 940→571px; 390px'te detay 645→375px, bütün akış 1288→919px ölçüldü. Saat bilgisi bilinmeyen olaylarda etiketin komşu başlığa taşması ayrıca giderildi.
- Gerçek sonuç, analiz bağlantısı, TR/NY saat dönüşümü ve 30 saniyelik yenileme yolu korunur. Test yanıtları yalnız tarayıcıda kullanıldı; veritabanına örnek olay eklenmedi.
- Yerel üretim sürümünde TR/EN × açık/koyu × 320/390/768/1024/1440px × ekonomik sonuç/bilanço/belirsiz saat: **60 durum kontrolü**; belge ve metin taşması, görünmez detay veya JavaScript hatası yok. Aynı saatteki olaylar arasında grafikten geçiş, klavye seçimi, yeniden boyutlandırmada seçili satırın görünürlüğü ve azaltılmış hareket iki dilde doğrulandı. Bekleyen → sıfır sonuç → şirket bazında analiz → bağlantı hatası akışı çalıştı. Lint, typecheck, build ve 14 veri/sağlayıcı testi başarılı.

## Mercek Açıklamaları ve Bülten Önizlemesi — 7 Eylül

- Ana sayfadaki Son Mercek Yazıları'nın üç ikincil yazısına mevcut `dek` açıklamaları eklendi. Başlık, kısa açıklama ve tarih/sembol künyesi birlikte okunur; mobilde künye aşağı geçer. Yazıların gerçek içeriği ve bağlantıları korunur. 1440px'te başlık satırları yaklaşık 40→103px, 390px'te 59→168px oldu; açıklamalar masaüstünde iki, mobilde üç satırlık önizlemedir.
- Bültenin dört ham satır sınırı iki paragraf ve iki kısa liste maddesinde kesiliyordu. Ortak `briefPreviewCut`, asgari satır tercihini koruyarak en az 900 karakterden sonra ilk tamamlanmış paragraf/liste sınırını kullanır. Başlık sonraki açıklamasından, liste de girişinden veya devamından ayrılmaz. Kısa metin ve küçük kalan kuyruk için düğme çıkmaz.
- Gerçek günlük bültende beş maddenin tamamı ve onları açıklayan paragraf birlikte gösterilir. 1440px özet paneli 438→614px, 390px 630→938px ölçüldü. Böylece daha uzun önizleme, ilk konunun sonunda biter.
- Native `details/summary` korunur; açıkken Daha Az düğmesi devam metninin sonuna yerleşir. JavaScript kapalıyken de açılıp kapanır. Bülten arşivinin tam metin görünümü değişmez.
- Yerel üretim sürümünde TR/EN × açık/koyu × 320/390/768/1024/1440px × günlük/haftalık: 40 kontrol; taşma veya JavaScript hatası yok. Açık metnin tamamı düğmenin üstünde kalır. Klavye sekmeleri, açma/kapatma ve JavaScript kapalı yerel denetim doğrulandı. Beş önizleme sınırı testi, lint, typecheck, build ve diff kontrolü başarılı.

## Şirket Verisi, Tekil Semboller ve Dizin Görselleri — 8 Eylül

- Eksik fiyatların kök nedeni doğrulandı: aynı Berkshire şirketi `BRK-B` ve `BRK.B` olarak kayıtlıydı. Alpaca, `BRK-B` için HTTP 400 (`invalid symbol`) veriyor ve aynı 200 sembollük pakette Apple, Amazon ve Broadcom gibi geçerli şirketleri de düşürüyordu. Paketlerden kalan başarılı yanıt, bu eksikliği tek başına telafi etmiyordu.
- Bilinen hisse sınıfı takma adları ortak `canonicalSymbol` ile noktalı biçime çevrilir. `primaryOnly` aynı şirketi tekilleştirirken veri tabanındaki kanonik kaydı tercih eder; yalnız takma ad varsa onu normalize eder. Şirket adlarını benzerliğe göre birleştirmez ve veri tabanı kayıtlarını silmez. Gerçek dizinde şirket adı tekrar kontrolü temiz çıktı; Berkshire tek satır.
- Snapshot, haftalık değişim ve çoklu grafik çağrıları sembol biçimini normalize eder. Sağlayıcının açıkça adını verdiği geçersiz sembol paketten ayrılarak diğerleri tekrar istenir; 429/ağ hatası için bu döngü çalışmaz. İstek dışı bir sembol adıyla veri elenmez; tekrar sayısı sınırlıdır.
- Aynı gerçek evrende 915 satır → 914 tekil şirket, fiyat alınan sembol sayısı 687→875 oldu. Kalan 39 sembole ayrı çağrı da boş döndü; bu veriler üretilmedi. Boş hücre açıklaması artık kesin olarak "işlem yok" demek yerine sağlayıcı verisinin alınamadığını söylüyor.
- Şirketler üst alanındaki sektör çubukları, gerçek piyasa değeri en yüksek altı şirketin seçilebilir logo düzenine dönüştü. Seçim tutarı, şirket adını ve detay bağlantısını değiştirir; dekoratif hareket çizgileri finansal grafik iddiası taşımaz. Hareket azaltma tercihinde çizgi animasyonu durur.
- Bilanço toplamı ve açıklama günü sayaçları kaldırıldı. Seçili takvim aralığında piyasa değeriyle öne çıkan şirketlerin gerçek açıklama tarihi, seans etiketi, gelir/EPS beklentileri ve ilgili güne bağlantıları gösterilir. Para birimi mevcut şirket metadata'sından alınır; bilinmeyen saat kesin bir saate çevrilmez.
- Site genelindeki sayfa ve bölüm başlıkları mevcut açık/koyu tema mavi geçişini kullanır; siyah metne zorlayan yazı kapağı kuralları kaldırıldı. Sayısal okumalar ve yükseliş/düşüş renkleri korunur. Zorunlu renk modunda düz sistem metin rengine dönülür.
- Yeni üst alanlar 1440px'te şirketler 360px, bilançolar 392px; 390px'te 554px ve 601px ölçüldü. Mobil takip satırlarındaki logo/date hizası ayrıca düzeltildi.
- Doğrulama: 22 rota × TR/EN × açık/koyu × 320/390/768/1024/1440px = **440 yerleşim kontrolü**. Sayfa başlıklarının mavi geçişi, yatay taşma ve yeni görsellerde metin sınırları doğrulandı; JavaScript hatası yok. Şirketler tablosunda AAPL/AMZN/AVGO/BRK.B fiyatları ve haftalık değişimleri dolu, Berkshire tek kayıt. Altı logo seçiminin doğru şirket bağlantısını açması, klavye seçimi ve azaltılmış harekette çizginin durması doğrulandı. Bilanço odak bağlantısı gerçek gün başlığını üst menünün altında 191px'e taşıdı. Lint, typecheck, build, diff kontrolü ve toplam 24 test başarılı; beş yeni regresyon testi sembol tekilleştirme ve geçersiz sembolün paketten ayrılması üzerine.

## Mobil Ana Sayfa: Önce Piyasanın Genel Görünümü — 8 Eylül

- 1024px altındaki tek sütunlu görünümde Dünya Piyasaları ve Günün Hareketleri, Bugünün Akışı'nın hemen arkasına taşındı. Ardından günün özeti, Mercek, tahvil/makro göstergeleri, takvim/favoriler ve haberler gelir. Bugün Bilanço Açıklayanlar ile Son Bilanço Analizleri içerik akışının sonunda yan yanadır (dikey sırada).
- 390px'te değişiklik öncesi Dünya Piyasaları/Günün Hareketleri başlıkları yaklaşık 4397/4817px'teydi; yeni düzende yaklaşık 1409/1833px. Konumlar günün canlı içeriğine göre değişir; bölüm önceliği sabittir.
- Sunucudan akan içerik ve yükleme iskeleti aynı sıralama yuvasını kullanır. Bölümler çoğaltılmaz; veri sorguları ve içerik durumu korunur. Masaüstü sütunları ve ölçüme dayalı `FillColumn` mekanizması devam eder. Mobil sıralama JavaScript gerektirmez.
- Sıralama CSS yerleşimine aittir; DOM/yardımcı teknoloji okuma sırası mevcut sütun gruplarını korur. Denenen `reading-flow` kuralı `display:contents` altındaki grupları birbirine karıştıramadığı için kullanılmadı. Mobil klavye sırasını tüm tarayıcılarda görsel sırayla birebir eşitlemek ayrıca sütun yapısının yeniden düzenlenmesini gerektirir.
- Son üretim derlemesinde TR/EN × açık/koyu × 320/390/768/1023/1024/1440px: **24 yerleşim kontrolü**; yatay taşma, bölüm çakışması veya JavaScript hatası yok. Bölüm kimlikleri tekil, mobil sıra doğru, masaüstünde haberler iki sütunun altında. Bilanço analizleri bağlantısı başlığı üst menünün altında yaklaşık 199/200px'e getirdi. Bültenin açık durumu ekran boyutu değişiminde korundu; bölüm bağlantılarına klavye odağı ve JavaScript kapalı sıralama doğrulandı. Lint, typecheck, build ve diff kontrolü başarılı. Kontroller yerel Chrome'da yapıldı; gerçek iOS/Safari cihazı kullanılmadı.

## Mercek ve Bilanço Detayları, Sade Seans Hattı — 8 Eylül

- Mercek detayında 720px genişliğindeki eski başlık bloğu yerine 1200px sınırında bir editoryal kapak kullanılır. Yazının kendi `stats`/`shift`/`share` bloğu varsa başlığın yanında gösterilir; uygun blok yoksa başlık alanı tek sütundur. Rakam ve açıklamalar mevcut yayın içeriğinden gelir. Mobilde görsel metnin altına geçer; asıl okuma sütunu 720px sınırını korur.
- Kapakta imleci izleyen yumuşak ışık ve görselde kaydırma geçişi; gövdedeki `oku-blok` görsellerinde görünürken giriş animasyonu kullanılır. Mercek için işaretlenmiş gövdeler ortak hareket denetiminden yararlanır; paragraf metinleri giriş animasyonuna alınmaz. Yazı/kaynak bağlantıları doğal çapalı, aktif durumu izlenen yapışkan gezinmede bulunur. Diğer yazı satırlarına gerçek açıklamalar eklendi.
- Bilanço kapağının arka plan ızgarası kaldırıldı. İki öncelikli sonuç ve gerçek çeyreklik gelir grafiği ortak bir sonuç bandında, belirgin değerler ve tonlu sütunlarla sunulur. Dönem ikincil etiket olarak kalır. Bölüm gezinmesi numaralandırıldı; değerlendirme bölümleri küçük kenar numaralarıyla iki sütunda, mobilde tek sütunda okunur. Özetin giriş paragrafı ve kalan metin geniş ekranda iki sütun kullanır; başlık için boş bir yan sütun ayrılmaz.
- AVGO kapağı ilk ölçümde 1440px'te 553px, 390px'te 864px'ti; sonuç bandıyla yaklaşık 593/876px oldu. Micron Mercek kapağı 385/370px'ten, yayınlanmış rakamları da içeren 471/710px'e geçti. Metin veya rakam atılarak kısaltılmadı.
- Bugünün Akışı'ndaki 17 dikey çizgili, 54px yüksekliğindeki ızgara kaldırıldı. Tek bir ince zaman hattı, yumuşak seans bandı, açılış/kapanış noktaları ve seçilebilir yuvarlak açıklama işaretleri kullanılır. Şimdi etiketi olay işaretlerinden ayrı bir sırada durur; işlem gününde saat noktası hafifçe hareketlenir. Seans dönüşümü, gerçek ET konumları, TR önceliği, açıklama durumları ve aynı saate düşen olaylar arasında seçim korunur. Zamanın geçmesi tek başına bir açıklamayı yayımlanmış yapmaz.
- Doğrulama: ana sayfa, AVGO/SNOW raporları ve üç farklı Mercek yazısı, TR/EN × açık/koyu × 320/390/768/1024/1440px ile **120 yerleşimde** tarandı. Son özet/kelime sarma düzeltmelerinden sonra AVGO ve Micron için **40 odak kontrolü** tekrarlandı. Belge taşması, kesilen başlık/rakam veya JavaScript hatası yok. Bölüm çapaları, açık sayfada hareket azaltma tercihi, görsel girişlerinin tamamlanması ve JavaScript kapalı görünürlük doğrulandı.
- Seans hattında üç olay türüyle **60 durum kontrolü** geçti. Aynı saatli olaylar arasında grafikten geçiş, klavye seçimi, yeniden boyutlandırmada seçili satırın görünürlüğü, sıfır sonuç, şirket bazında analiz bağlantısı ve bağlantı hatasında sonucun korunması doğrulandı. Test yanıtları yalnız tarayıcıya verildi; veritabanına örnek veri eklenmedi. Lint, typecheck, build, diff kontrolü ve 24 veri/sağlayıcı testi başarılı. Tarayıcı kontrolü yerel Chrome'da yapıldı; fiziksel iOS/Safari cihaz testi yapılmadı.
