# Arayüz İyileştirme Devam Planı — 22 Eylül 2026

## Başlangıç ve Kanıt

Kullanıcının hedefi: sayfaları sırayla ele alarak Açılış Zili'ni Awwwards düzeyinde görsel işçiliğe, tutarlı etkileşimlere ve güçlü veri anlatımına taşımak. Bu bir kalite hedefidir; ödül veya değerlendirme sonucu iddiası değildir.

Bu plan önceki sohbetten değil, mevcut kaynak kodu, Git geçmişi ve tasarım kayıtlarından yeniden oluşturuldu. Başlangıç commit'i `3105097`, 22 Eylül 2026 **01:03:54 +03:00**. İnceleme başlangıcında çalışma ağacı temizdi.

Kaynaklar:
- `PREMIUM-REDESIGN.md`: uygulanan tasarım kararları ve geçmiş doğrulamalar.
- `REQUEST-AUDIT-2026-09-21.md`: son istek denetimi.
- `INTERFACE-AUDIT-2026-09.md`: sayfalar arası tutarlılık ve etkileşim kayıtları.
- İlgili sayfaların mevcut kaynak kodu.

Son denetim, 22 Eylül'de gelen **yedi yeni tasarım isteğinin henüz uygulanmadığını** belirtiyor. İsteklerin tam metni bu kayıtta yok. Tahvil/VIX sırasının değişeceğine dair not var, yeni sıra belirtilmemiş. Aşağıdaki işler mevcut hedefe göre öneridir; kayıp mesajların birebir karşılığı değildir. Geçmiş test sonuçları bu oturumda yeniden çalıştırılmış sayılmaz; bu plan kaynak incelemesine dayanır, yeni görsel kusur tespiti değildir.

## Korunacak Tamamlanmış İşler

- Teknik liste ve detay kapaklarında gerçek içerik bitişleri hizalandı; fiyat haritası, altı gösterge ve plan okuması geliştirildi.
- Üst menüde mavi geçiş, beş ana hedef, taşan bağlantılar menüsü ve kompakt yükseklik mevcut.
- Şirket detayında grafik/profil dengesi, büyüyen grafik alanı ve ikili değerleme kartları mevcut.
- Mobil ana sayfada Akış → Özet → Dünya Piyasaları → Günün Hareketleri sırası son kayıtta düzeltildi.
- Ortak başlık, tema, hareket, filtre yükleme ve kaynak/zaman bilgisi altyapısı mevcut.

## Uygulama Sırası

### 0. Mevcut Görünümü Sabitle

Önce ana sayfa, teknik liste/detay, bilanço liste/detay, piyasalar ve şirket detayının güncel masaüstü/mobil görüntülerini al. Gerçek içerikle başlık başlangıcı, ilk ekran yoğunluğu, grafik alanı ve yan yana içerik bitişlerini ölç. Teknik analizdeki son tasarımı başlangıç referansı olarak kullan. Önceki ölçümleri bugünkü içerikle doğrudan eşdeğer kabul etme.

Çıktı: rota bazlı başlangıç görüntüleri ve ölçülmüş sorun listesi. Değişiklikleri bu listeye bağla.

### 1. Bilanço Analizleri ve Rapor Detayı

Rotalar: `/bilancolar/analizler`, `/bilancolar/[symbol]/[period]`.

- Liste kapağı, öne çıkan rapor, skor/görüş ve arşiv tablosu arasında belirgin önem sırası kur; filtrelenmiş içeriğin öne çıkan kartla uyumunu koru.
- Detayda şirket/dönem, raporun ana sonucu ve temel rakamları ilk bakışta anlaşılır hâle getir.
- Gelir/EPS gerçekleşen–beklenti karşılaştırmaları, gelir dağılımı ve şirket öngörüsünde her veriye uygun görseli geliştir; tekrar eden kart ve metinleri ölçerek sadeleştir.
- Uzun raporda bölüm geçişlerini ve mobil okuma ritmini iyileştir; kaynakları ve açıklamaları erişilebilir tut.
- Takvim ve takip sekmelerinin aynı görsel ailede kaldığını kontrol et.

Ana dosyalar: `app/(app)/bilancolar/analizler/page.tsx`, `app/(app)/bilancolar/[symbol]/[period]/page.tsx`, `components/earnings/AnalysisTable.tsx`, `components/earnings/EarningsReport.module.css`.

### 2. Piyasalar ve Seçili Endeks Detayı

Rota: `/piyasalar?endeks=nasdaq|dow|sp500`. Mevcut uygulamada ayrı bir piyasa detay rotası yerine aynı sayfadaki `IndexDetail` bölümü kullanılıyor.

- Endeks özeti → seçili endeksin genişliği/hareketleri → bileşenler arasında daha belirgin bağ kur.
- Tahvil/VIX için önerilen yeni yerleşim: endeks özeti ve seçili endeksin kısa okumasından sonra, uzun bileşen tablosundan önce. Bu sıra kayıp talebin geri kazanımı değildir; uygulama öncesi mevcut ekranla karşılaştırılacak tasarım önerisidir.
- Kompakt endeks grafiklerinin, yükselen/düşen dağılımının ve tablo rakamlarının okunabilirliğini geliştir.
- Endeks seçimi, sıralama ve daha fazla satır yüklemede mevcut kaydırma ve yükseklik korumasını sürdür.

Ana dosyalar: `app/(app)/piyasalar/page.tsx`, `components/markets/MarketExperience.module.css`, `components/markets/FearGauge.tsx`.

### 3. Şirket Detayı ve Şirketler Dizini

Rotalar: `/hisse/[symbol]`, `/sirketler`.

- Şirket kimliği, fiyat ve grafiği ana odak olarak işle; profilin uzunluğuyla değişen grafik dengesini gerçek içerikle denetle.
- Değerleme, ortalamalar, analist beklentileri ve bilanço geçmişinin görsel önem sırasını güçlendir.
- Şirket → teknik analiz → bilanço raporu bağlantılarını ilgili içerikle birlikte görünür kıl.
- Şirketler dizinindeki ilk on şirketi, mevcut kısa piyasa değerlerini ve hızlı taranabilir tabloyu koruyarak detay sayfasıyla tutarlılığı tamamla.

Ana dosyalar: `app/(app)/hisse/[symbol]/page.tsx`, `app/(app)/hisse/[symbol]/stock.module.css`, `components/stock/PriceChart.module.css`, `components/companies/CompanyLeaders.module.css`.

### 4. Teknik Analizde Son İnce İşçilik

Rotalar: `/teknik`, `/teknik/[symbol]`.

- Son tamamlanan tasarımı yeniden kurmadan; diğer ekranlarda iyileşen tipografi, yüzey ve etkileşim kararlarıyla eşleştir.
- Dağılım, filtreler, plan şeridi, fiyat haritası, göstergeler ve senaryolar arasındaki okuma sırasını kontrol et.
- Uzun şirket adı, dar alım bandı, bekleyen analiz ve farklı görüş durumlarında hizayı doğrula.

Ana dosyalar: `components/technical/Technical.module.css`, `PriceMap.tsx`, `IndicatorPanels.tsx`, teknik liste/detay sayfaları.

### 5. Kalan Sayfalarda Bütünlük

Sıra: ana sayfa → makro/takvim → Mercek ve yazı detayı → haberler/bülten → rehber → karşılaştırma → favoriler/ayarlar/giriş ve boş/hata durumları. Her sayfayı aynı kalıba zorlamadan tipografi, aralık, yüzey ve hareket kurallarını eşleştir. Yönetim paneli bu kullanıcı arayüzü turundan ayrı değerlendirilir.

## Her Sayfanın Tamamlanma Ölçütleri

- Güçlü ama kompakt açılış; birincil bilgi ilk bakışta seçiliyor, içerik dekorasyon yüzünden aşağı itilmiyor.
- Mavi marka dili, Schibsted Grotesk ve mevcut iki tema tutarlı; veri grafikleri gerçek veri/ölçek taşıyor.
- Masaüstünde yan yana karşılaştırılan içerikler ölçülerek hizalanıyor; mobilde anlamlı sırayla akıyor. Sabit yükseklikle metin kesilmiyor.
- Hareket seçim, geçiş ve veri ilişkisini açıklıyor; azaltılmış hareket tercihinde içerik eksiksiz kalıyor.
- Kaynak, gecikme, dönem, saat dilimi ve eksik veri bilgileri korunuyor; tasarım için sayı veya finansal seri üretilmiyor.
- Değişen ekranlar 320/390/768/1024/1440px, TR/EN ve açık/koyu temalarda kontrol ediliyor. Klavye, filtre/grafik etkileşimleri, yükleme ve boş durumlar ayrıca deneniyor.
- Her turda önce/sonra görüntüleri ve kısa değişiklik kaydı; ilgili mevcut testler, lint, build, build sonrası typecheck ve diff kontrolü. Başarılı kontroller yalnız yeni bir değişiklik veya bulgu gerektirirse tekrarlanıyor.

## Sonraki Somut İş

**22 Eylül uygulama durumu:** Bilanço Analizleri listesi ve rapor kapağının ilk iyileştirme turu tamamlandı. Rapor dağılımı, öne çıkan analiz, mobil arşiv sırası ve sonuçlarla birleştirilen görüş/analist hedefi uygulandı. ADBE/AVGO/ONDS ve listede 80 üretim yerleşimi, 6 etkileşim kontrolü başarılı; ayrıntılar `PREMIUM-REDESIGN.md` son bölümünde.

**İkinci tur tamamlandı:** Piyasalar ve seçili endeks görünümü. Endeks seçimi ve genişliği yukarı alındı, veri kapsamı görünür oldu, hareket listeleri ortak ölçeğe bağlandı; tahvil/VIX tablonun önüne taşındı. Üç endeks için 60 üretim yerleşimi ve 7 etkileşim kontrolü başarılı.

**Üçüncü tur tamamlandı:** Şirketler dizini ve şirket detayı. Kapağa tüm dizinde çalışan ad/sembol araması eklendi; arama sektör, sıralama ve daha fazla yükleme boyunca adreste korunuyor. Şirket açılışında son bilanço analizine dönem etiketli doğrudan bağlantı var, raporu olmayan şirkette aynı yer bilanço bölümüne iniyor. 80 üretim yerleşimi ve 14 etkileşim kontrolü başarılı; ayrıntılar `PREMIUM-REDESIGN.md` son bölümünde.

**Dördüncü tur tamamlandı:** Teknik analizde son ince işçilik. Tarayıcı taraması kusur bulmadı (160 + 84 yerleşim temiz); kusurlar kod denetiminden çıktı ve yedisi düzeltildi — yatay modun yarım kalan kararı, koyu temada panelden açık kalan harita halkası, kapakta ikiye ayrılan etiket dili, "On iki hisse" diyen paylaşım kartı, iki teknik rotada eksik `DataStamp`, "yeni eklendi" ile "yayını gecikti"yi aynı cümleye düşüren bekleyen-sembol mantığı ve kodla çelişen bir karar kaydı. 11/11 hedefli kontrol başarılı; ayrıntılar `PREMIUM-REDESIGN.md` son bölümünde.

## İkinci Faz — 22 Eylül İstek Listesi

Kullanıcının tek cümlelik ölçütü: **ekrana ilk girişte scroll yapmadan doğru
veriyle karşılaşmak.** Gereksiz boşluk düşman, ilk ekran yoğunluğu hedef.
Aşağıdaki sıra o ölçüte göre kuruldu; her madde ölçülerek açılır, ölçülerek
kapanır.

1. **Teknik analiz üçlüsü** (`/teknik` liste kartları, `/teknik/[symbol]`
   detay). Kartlar daha okunaklı ve görsel olarak daha güçlü; her kartta
   boşluk yerine doğru veri. Detayda "Nereden Alınır" çizgi grafiği ne
   anlattığını söylemiyor: dikeyde çok uzun, sağ–sol mesafesi çok açık.
   Görüş rozetinin üstündeki büyük boşluk kalkacak. Kart üzerinde şirkete
   gelindiğinde küçük, görsel olarak zengin bir bilgi kartı (logo, ad,
   görüş, piyasa değeri).
2. **Masthead.** Kompakt, gereksiz boşluk ve renk geçişi olmadan; seçili
   sekmenin arka planı göz yormayacak.
3. **Şirketler araması.** Daha minimal ama görsel olarak çok daha güçlü;
   gerekirse o alana ikinci bir işlev.
4. **Bilançolar kapağı.** Sol kolon sağa göre boş duruyor.
5. **Takvim.** Gün/hafta/ay seçimi üst kartın sağına.
6. **Karşılaştırma.** Grafik üstte, seçili semboller altında; boşluk azalt.
7. **Rehber.** Gereksiz boşluklar.
8. **Ana sayfa.** Başlık ve seans saati görseli büyüyecek.
9. **Mercek.** Şirkete göre süzme üst kapağın sağına; boşluk azalt.
10. **Boşluk taraması.** Rota × genişlik matrisinde ölçülen ölü alanlar.
11. **Yönetim paneli.** Her detayıyla yükseltme.
