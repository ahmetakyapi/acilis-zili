/* ==========================================================================
   Yasal metinler — KVKK aydınlatma, çerez politikası ve sorumluluk reddi.

   Rehber yazıları gibi depoda duruyor: bir gizlilik metninin ne dediği sürüm
   geçmişinde izlenebilir olmalı, veritabanından sessizce değiştirilebilir
   olmamalı.

   İLETİŞİM: başvurular şimdilik GitHub üzerinden alınıyor. E-posta adresi
   eklemek istersen aşağıdaki "Haklarını Nasıl Kullanırsın" bölümündeki
   satıra bir `mailto:` bağlantısı koyman yeterli — başka yeri değişmiyor.

   YÜRÜRLÜK: metni her değiştirdiğinde LEGAL_UPDATED tarihini de güncelle;
   sayfanın künyesi bu değeri gösteriyor.
   ========================================================================== */

/** Metnin son güncellendiği tarih — sayfa künyesinde görünür (ET/TR farkı önemsiz). */
export const LEGAL_UPDATED = "2026-08-13";

export const PRIVACY_MD = `Açılış Zili kişisel bir projedir ve ABD borsalarını Türkçe takip etmek için yapılmıştır. Bu sayfa, 6698 sayılı **Kişisel Verilerin Korunması Kanunu** (KVKK) kapsamında hangi verinin neden işlendiğini, nereye gittiğini ve senin hangi haklara sahip olduğunu anlatır.

Kısa cevap peşindeysen: hesap açmadan siteyi kullanabilirsin ve o durumda seni tanımlayan hiçbir kayıt oluşmaz. Reklam ağı, izleme çerezi ve üçüncü taraf piksel bu sitede **yok**. Hangi sayfanın kaç kez okunduğu sayılır ama bu sayım kimliksizdir ve aşağıda satır satır anlatılmıştır.

::: ozet Üç Cümlede
Hesap açmazsan yalnızca tema ve dil tercihin tarayıcında saklanır; sunucuda seni tanımlayan bir kayıt oluşmaz. Hesap açarsan kullanıcı adın, e-postan, şifrenin geri döndürülemez özeti ve takip listen saklanır. Bu veriler kimseye satılmaz, pazarlama amacıyla kullanılmaz.
:::

## Veri Sorumlusu

| | |
|---|---|
| Veri sorumlusu | Ahmet Akyapı (gerçek kişi, kişisel proje) |
| Hizmet | Açılış Zili — acilis-zili.vercel.app |
| Başvuru kanalı | [GitHub üzerinden](https://github.com/ahmetakyapi/acilis-zili/issues) |

Bu bir ticari işletme değildir; ürün ücretsizdir, ödeme alınmaz ve herhangi bir aracı kurumla bağı yoktur.

## İşlenen Kişisel Veriler

Site iki farklı durumda çalışır ve ikisi arasında ciddi bir fark vardır.

### Hesap Açmadan Kullanırken

Sunucuda seni tanımlayan bir kayıt oluşmaz. Yalnızca tarayıcında iki tercih çerezi tutulur:

- **Tema tercihi** (\`az-theme\`) — açık ya da koyu.
- **Dil tercihi** (\`az-locale\`) — Türkçe ya da İngilizce.

Bu ikisi kimlik bilgisi taşımaz, bir kullanıcı kimliğine bağlanmaz ve başka bir siteyle paylaşılmaz. Tarayıcı ayarlarından sildiğinde site varsayılanlara döner.

### Sayfa Sayımı

Hangi sayfanın kaç kez okunduğunu bilmek, neyin işe yaradığını görmek için gerekli — hangi rehber yazısı okunuyor, İngilizce tarafa gelen var mı, bir bilanço analizi karşılık buluyor mu. Bu sayım **çerez kullanmaz** ve seni tanımlamaz. Her okunan sayfa için kaydedilenler:

| Kaydedilen | Örnek |
|---|---|
| Yol | \`/hisse/AAPL\` |
| Arayüz dili | \`tr\` |
| Cihaz sınıfı | mobil / tablet / masaüstü |
| Yönlendiren alan adı | \`google.com\` — yolu ve arama terimi **atılır** |
| Giriş yapılmış mı | evet/hayır — **kim olduğu değil** |
| Tarih | \`2026-08-13\` |

**Kaydedilmeyenler:** IP adresin, tarayıcı künyenin tam metni, tam yönlendiren adres, kullanıcı kimliğin. Bunların hiçbiri hiçbir sütunda yer almaz.

Aynı ziyaretçiyi gün içinde iki kez saymamak için IP adresin ve tarayıcı künyen, o günün tarihi ve sunucudaki bir sırla birlikte **geri döndürülemez bir özete** çevrilir. Özet her gün değişir: dünkü kayıtla bugünkü kayıt birbirine bağlanamaz, özetten IP adresine geri gidilemez. Bu kayıtlar **180 gün** sonra otomatik silinir.

Hukuki sebep: meşru menfaat (m. 5/2-f) — ürünün hangi bölümünün kullanıldığını görmek. Bu sayım pazarlama amacı taşımadığı ve kimlik üretmediği için açık rıza gerektirmez.

### Hesap Açtığında

| Veri | Neden işleniyor | Hukuki sebep |
|---|---|---|
| Kullanıcı adı | Hesabı tanımlamak ve giriş yapmak | Sözleşmenin ifası (m. 5/2-c) |
| E-posta adresi | Hesabı benzersiz kılmak | Sözleşmenin ifası (m. 5/2-c) |
| Şifrenin özeti | Girişi doğrulamak | Sözleşmenin ifası (m. 5/2-c) |
| Takip listen ve notların | Ürünün asıl işlevi | Sözleşmenin ifası (m. 5/2-c) |
| Tema ve dil tercihi | Arayüzü hatırlamak | Meşru menfaat (m. 5/2-f) |
| Oturum çerezi | Girişi açık tutmak | Sözleşmenin ifası (m. 5/2-c) |

::: dikkat Şifren Saklanmıyor
Şifrenin kendisi hiçbir yerde tutulmaz. Kaydedilen şey **bcrypt** algoritmasıyla üretilmiş, geri çevrilemeyen bir özettir. Veritabanına erişen biri bile şifreni okuyamaz. Buna rağmen başka bir serviste kullandığın şifreyi burada kullanma — bu, tüm siteler için geçerli genel bir kuraldır.
:::

E-posta adresin **yalnızca** hesabın benzersiz olmasını sağlamak için tutulur; bu adrese hiçbir zaman posta gönderilmez. Şifre sıfırlama özelliği henüz yok, yani şifreni unutursan e-posta adresin hesabını geri getirmez — bu yüzden şifreni bir parola yöneticisinde sakla.

Özel nitelikli kişisel veri (sağlık, din, biyometri, siyasi görüş vb.) hiçbir biçimde toplanmaz. Kimlik numarası, telefon, adres, doğum tarihi ve finansal hesap bilgisi de istenmez — site senin adına işlem yapmaz, bir aracı kuruma bağlanmaz.

## Toplanmayan Veriler

Bu bölüm bilinçli olarak ayrı: çoğu gizlilik metni ne topladığını yazar, ne toplamadığını yazmaz.

- Reklam ve izleme çerezi kullanılmaz.
- Google Analytics ya da benzeri, ziyaretçiyi siteler arası izleyen bir araç kurulu değildir.
- Sosyal medya pikseli, ısı haritası, oturum kaydı yoktur.
- Parmak izi (fingerprinting) yöntemleriyle profil çıkarılmaz.
- Konum verisi istenmez ve kullanılmaz.
- Sayfa sayımı seni bir ziyaretten diğerine takip etmez: ayırt edici özet her gün sıfırlanır.

## Çerezler

Sitede yalnızca üç çerez vardır ve üçü de işlevseldir:

| Çerez | İşlevi | Ömrü |
|---|---|---|
| \`authjs.session-token\` | Oturumu açık tutar. Sadece hesap açanlarda oluşur. | 180 gün |
| \`az-theme\` | Açık/koyu tema tercihi | 1 yıl |
| \`az-locale\` | Arayüz dili | 1 yıl |

Üçü de \`SameSite\` koruması ile ve oturum çerezi ek olarak \`HttpOnly\` bayrağıyla yazılır; JavaScript ile okunamaz. Onay bandı gösterilmemesinin sebebi bu: kanunen açık rıza gerektiren pazarlama çerezi kullanılmıyor.

## Verilerin Aktarımı

Ürün, aşağıdaki altyapı ve veri sağlayıcılarıyla çalışır. Sunucuların bir kısmı yurt dışındadır; hesap açman bu aktarıma onay verdiğin anlamına gelir.

| Kim | Ne için | Sana ait ne gidiyor |
|---|---|---|
| Vercel (ABD) | Siteyi barındırır ve toplam ziyaret sayısını ölçer | İstek kayıtlarında IP adresi ve tarayıcı bilgisi. Ölçüm tarafı çerezsizdir ve kimlik üretmez |
| Neon (ABD/AB) | Veritabanı | Hesap ve takip listesi kayıtların |
| Alpaca, Finnhub, FRED | Fiyat, şirket ve makro verisi | **Hiçbir şey** — bu istekleri sunucu kendi adına yapar |
| DeepL | Haber başlıklarının çevirisi | **Hiçbir şey** — yalnızca haber metni gider |
| Anthropic | Bülten ve yazı metinlerinin üretimi | **Hiçbir şey** — yalnızca piyasa verisi gider |

Son üç satır önemli: veri sağlayıcılarına giden isteklerde senin kimliğin yoktur. Bir hisseye baktığında sağlayıcı bunu "Açılış Zili'nin isteği" olarak görür, "şu kullanıcının isteği" olarak değil.

Barındırma sağlayıcısının teknik kayıtlarında (log) IP adresi ve tarayıcı bilgisi kısa süre tutulabilir; bu, internetteki her sitede olan ve güvenlik için gereken bir işlemdir.

## Saklama Süresi

Hesap verilerin, hesabın açık kaldığı sürece saklanır. Hesabını sildiğinde kullanıcı kaydın ve ona bağlı bütün takip listeleri veritabanından **kalıcı olarak** silinir; yedeklerdeki kopyalar da yedek döngüsü tamamlandığında (en geç 30 gün) düşer.

Piyasa verileri, haberler ve yazılar kişisel veri değildir; onlar sende bir hesap olsun olmasın tutulur.

## Haklarını Nasıl Kullanırsın

KVKK m. 11 sana şu hakları verir: kişisel verinin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde ve yurt dışında aktarıldığı tarafları bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, bu işlemlerin aktarıldığı taraflara bildirilmesini isteme, otomatik sistemlerle analiz sonucu aleyhine bir sonuç çıkmasına itiraz etme ve zarara uğraman hâlinde giderilmesini talep etme.

Başvurunu [GitHub deposu üzerinden](https://github.com/ahmetakyapi/acilis-zili/issues) iletebilirsin. Talepler en geç **30 gün** içinde ücretsiz olarak sonuçlandırılır.

Hesap silme talebi için beklemene gerek yok: Ayarlar ekranından hesabını kendin silebilirsin, işlem anında uygulanır.

## Güvenlik

- Bütün trafik TLS ile şifrelenir; site yalnızca HTTPS üzerinden yayınlanır.
- Şifreler bcrypt ile, güncel maliyet katsayısıyla özetlenir.
- Veritabanı bağlantısı şifrelidir ve yalnızca uygulama sunucusundan erişilebilir.
- Oturum çerezi HttpOnly ve Secure bayraklarıyla yazılır.

Buna rağmen internet üzerinden yapılan hiçbir aktarım %100 güvenli değildir. Bir güvenlik açığı fark edersen [GitHub üzerinden](https://github.com/ahmetakyapi/acilis-zili/issues) bildirmen yeterli; açığı kötüye kullanmadan bildirdiğin sürece teşekkürden başka bir karşılık görmezsin.

## On Sekiz Yaş Altı

Site bilerek 18 yaşından küçüklerden veri toplamaz. Ebeveynseniz ve çocuğunuzun burada hesap açtığını fark ederseniz iletişime geçin, kayıt silinir.

## Bu Metin Değişirse

Değişiklikler bu sayfada yayımlanır ve sayfanın üstündeki tarih güncellenir. Metnin bütün geçmiş sürümleri projenin açık kaynak deposunda, değişiklik geçmişiyle birlikte durur — yani neyin ne zaman değiştiğini kendin de doğrulayabilirsin.`;

export const DISCLAIMER_MD = `Açılış Zili bir bilgi ekranıdır. Aşağıdakiler, siteyi kullanmadan önce bilinmesi gerekenlerdir.

::: dikkat Yatırım Tavsiyesi Değildir
Bu sitedeki hiçbir içerik — fiyatlar, bültenler, rehber yazıları, mercek yazıları ve haber özetleri dâhil — yatırım danışmanlığı, alım-satım tavsiyesi ya da bir finansal ürünün önerisi değildir. Yatırım danışmanlığı, yetkili kuruluşlar tarafından kişilerin risk ve getiri tercihleri dikkate alınarak verilen bir hizmettir. Burada okuduğun hiçbir cümle o kapsamda değildir.
:::

## Veri Doğruluğu

Fiyatlar, bilanço tarihleri ve ekonomik takvim üçüncü taraf sağlayıcılardan gelir (Alpaca, Finnhub, FRED). Bu veriler:

- **Gecikmeli olabilir.** Ücretsiz veri katmanları anlık değildir; ekrandaki fiyat borsadaki son fiyat olmayabilir.
- **Eksik ya da hatalı olabilir.** Sağlayıcı bir bilanço tarihini kaydırabilir, bir veriyi geç yayımlayabilir.
- **Geriye dönük düzeltilebilir.** Makro veriler sonradan revize edilir; ekrandaki geçmiş değer bugünkü resmî değerden farklı olabilir.

Bir işlem yapacaksan sayıyı kendi aracı kurumundan doğrula. Bu sitedeki bir rakama dayanarak verilen kararların sonucundan site sorumlu tutulamaz.

## Otomatik Üretilen Metinler

Günün özeti, haftalık bülten ve mercek yazıları büyük ölçüde otomatik üretilir; kaynağı her metnin künyesinde yazar. Bu metinler kamuya açık haber kaynaklarına dayanır ve yayımlandıkları tarihteki bilgiyi yansıtır. Hata içerebilirler.

Haber başlıklarının Türkçe çevirileri de otomatiktir. Anlam kayması olabileceği için önemli bir haberde özgün kaynağa bakman önerilir.

## Katılım Finansı Taraması Bir Fetva Değildir

Şirket sayfalarındaki katılım finansı göstergesi, kamuya açık iki bilgiyle (faaliyet alanı ve bazı finansal oranlar) yapılan otomatik bir **ön elemedir**. Gelir kırılımına dayanan kriter ücretsiz veri kaynağında bulunmadığı için uygulanamaz. Sonuç "uygundur" demez, "bu iki kritere göre eleniyor / elenmiyor" der. Nihai hüküm, kişinin bağlı olduğu görüşe ve denetlenmiş mali tablolara bakan uzman kurullara aittir.

## Bağlantılar

Site, haber kaynaklarına ve şirket sitelerine dış bağlantı verir. Bu sitelerin içeriğinden, gizlilik uygulamalarından ve güvenliğinden Açılış Zili sorumlu değildir.

## Hizmetin Sürekliliği

Bu kişisel bir projedir. Ücretsiz sunulur, bir hizmet seviyesi taahhüdü yoktur ve önceden haber verilmeden değişebilir ya da durdurulabilir. Verilerine önem veriyorsan takip listeni başka bir yerde de tutmakta fayda var.`;
