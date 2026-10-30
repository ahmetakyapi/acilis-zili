# Görsel ve Hareket Denetimi · 10 Ekim 2026

Son görsel değişiklikler, ortak bileşenler ve ziyaretçiye açık ekran aileleri incelendi. Mevcut Schibsted tipografisi, mürekkep sahneleri, anlam taşıyan renkler ve tonla ayrılan yüzeyler korundu.

## Uygulanan Düzeltmeler

| Alan | Bulgular ve Sonuç |
| --- | --- |
| Bölüm başlıkları | Piyasalar ekranında 390×844 boyutunda, y=721 konumundaki “Piyasa Nabzı” başlığının altı hâlâ %45 kırpılıyordu. Giriş aralığı 40–200 pikselden 20–100 piksele alındı; başlık okuma alanına geldiğinde harfleri tamamen görünür. |
| Sayısal karşılaştırma çubukları | Dar tabloda sıfır noktası x=377, kaydırıcının sağ kenarı x=372 olabiliyor. Küçültülmüş negatif çubuğu izleyen gözlemci hiç tetiklenmiyordu. Artık sabit ray izleniyor; görünen çubuklar giriş pozunda kalmıyor. Ortak hedefi paylaşan öğelerden biri kaldırılınca diğerlerinin gözlemi de korunuyor. |
| Sekmeler ve panel girişleri | Grafik aralığı, bölüm dizini ve sekme alt çizgisi aynı 280 ms seçim geçişini kullanıyor. Reveal hareketi 26 yerine 18 piksel; konum ve opaklık aynı eğriyle 550 ms'de tamamlanıyor. |
| Ortak hareket dili | Motion bileşenlerindeki kopyalanmış marka eğrileri `lib/motion.ts` kaynağına bağlandı. Web Animations metni de aynı koordinatlardan üretiliyor. |
| Menü | Karolara yön oku, ikonun yüzey/renginde hover ve klavye karşılığı eklendi. Alt gruplar yükleme anında görünmeden animasyonunu bitirmek yerine göründükçe satır sırasıyla açılıyor. |
| Katlanan listeler | Paylaşılan aç/kapa kontrolüne durumla birlikte dönen ok eklendi. Dokunmatik cihazda takılı kalan hover alt çizgisi kaldırıldı. Klavye odağı ve 44 piksel hedef korundu. |
| Tema haritası | Klavye odağı, End ile atlanan bölüm ve çalışma anında değişen hareket tercihi karoları son hâline getiriyor. Hareket yeniden açıldığında bitmiş harita tekrar gizlenmiyor. |
| Haber detayı | Paylaş düğmesinin div'i p içine yerleştiği için React #418 hidrasyon hatası oluşuyordu. Künye geçerli bir div'e taşındı; tipografi ayrı sınıfta korundu. |

## Doğrulama

- İlk inceleme: 36 adres × 390/1440 piksel, 72 görünüm. Ekran görüntüleri, yatay taşma ve istemci hataları kontrol edildi.
- Detay/gömülü ekran incelemesi: 9 adres × 390/1440 piksel, 18 koyu tema görünümü. Haber detayındaki hidrasyon hatası burada bulundu ve düzeltildi.
- Menü: 320/390/768/1440 piksel × açık/koyu tema × Türkçe/İngilizce, 16 kombinasyon. Yatay taşma yok; klavye odağı ve End sonrası karoların görünürlüğü doğrulandı.
- Gerçek hareket açıkken başlık kırpması, kısmen görünen grafik rayları, liste açma okunun dönüşü ve açma sırasında kaydırma konumunun korunması doğrulandı.
- Tema haritasında görünür bağlantıya klavye odağı ve canlı `prefers-reduced-motion` değişimi doğrulandı.
- Haber düzeltmesi üretim derlemesinde iki genişlik × iki tema × iki dilde (8 kombinasyon) yeniden doğrulandı: hidrasyon hatası ve yatay taşma yok.
- `npm run typecheck` ve `npm run build` başarılı.
- `npm run lint`: hata yok. Önceden bulunan `.tmp-heads.mjs` dosyasında kullanılmayan `bb` değişkeni uyarısı ve ESLint aracının `TSNonNullExpression` bildirimi sürüyor; bu dosya değiştirilmedi.
- Karşılaştırma ölçeği, tema haritası geometrisi, gezinme ve sahne eşlemelerine ait mevcut 22 test başarılı.

## Sınırlar

Hesap içi portföy, favoriler ve ayarlar ziyaretçi oturumunda girişe yönlendi; bu ekranların istemci kodu incelendi ve ortak eğrileri güncellendi, oturum açılmış verileri görsel olarak doğrulanmadı. Yönetici ekranları için yetkili oturum kullanılmadı. Şifre sıfırlama sağlayıcısı yapılandırılmadığında şifremi-unuttum ekranının 404 vermesi mevcut davranış.

Depodaki geniş `npm run smoke` koşumu bazı gezinme tekrarlarından sonra Chrome'un `Target.disposeBrowserContext` zaman aşımıyla kesildi; tam geçti olarak değerlendirilmedi. Yukarıdaki hedefli tarayıcı kontrolleri ayrı koşumlarda tamamlandı. Yayınlama veya veri yazma işlemi yapılmadı.
