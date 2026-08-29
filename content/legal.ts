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
export const LEGAL_UPDATED = "2026-08-29";

const PRIVACY_TR = `Açılış Zili kişisel bir projedir ve ABD borsalarını Türkçe takip etmek için yapılmıştır. Bu sayfa, 6698 sayılı **Kişisel Verilerin Korunması Kanunu** (KVKK) kapsamında hangi verinin neden işlendiğini, nereye gittiğini ve senin hangi haklara sahip olduğunu anlatır.

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
| Son giriş zamanı | Hesabın hâlâ kullanılıp kullanılmadığını görmek | Meşru menfaat (m. 5/2-f) |
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

const DISCLAIMER_TR = `Açılış Zili bir bilgi ekranıdır. Aşağıdakiler, siteyi kullanmadan önce bilinmesi gerekenlerdir.

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

/* --------------------------------------------------------------------------
   İngilizce sürümler

   ÇEVİRİ, AYRI BİR METİN DEĞİL: Türkçesiyle aynı şeyi söylüyor, aynı sırayla
   ve aynı tablolarla. İkisi ayrışırsa hangisinin geçerli olduğu tartışmalı
   hâle gelir — bu yüzden Türkçe metni değiştiren buradaki karşılığını da
   değiştirmeli.

   HUKUK TÜRKİYE HUKUKU. Metin İngilizce ama dayandığı kanun değişmiyor: veri
   sorumlusu Türkiye'de ve haklar 6698 sayılı KVKK'dan geliyor. GDPR terimleri
   (data subject, DPO, supervisory authority) BİLEREK kullanılmadı — burada
   karşılığı olmayan bir çerçeveye atıf yapmak, olmayan bir koruma vaat etmek
   olurdu.
   -------------------------------------------------------------------------- */

const PRIVACY_EN = `Opening Bell is a personal project built to follow US markets in Turkish. This page explains, under Turkey's **Personal Data Protection Law No. 6698** (KVKK), which data is processed and why, where it goes, and what rights you have.

If you want the short answer: you can use the site without an account, and in that case no record identifying you is created. There are **no** ad networks, tracking cookies or third-party pixels on this site. Page reads are counted, but that count is anonymous and is explained line by line below.

::: ozet In Three Sentences
Without an account, only your theme and language preferences are stored in your browser; no record identifying you is created on the server. With an account, your username, email address, an irreversible digest of your password and your watchlists are stored. This data is never sold and never used for marketing.
:::

## Data Controller

| | |
|---|---|
| Data controller | Ahmet Akyapı (individual, personal project) |
| Service | Opening Bell — acilis-zili.vercel.app |
| Contact channel | [via GitHub](https://github.com/ahmetakyapi/acilis-zili/issues) |

This is not a commercial business; the product is free, no payment is taken and it has no affiliation with any brokerage.

## Personal Data Processed

The site works in two different modes, and the difference between them matters.

### Using It Without an Account

No record identifying you is created on the server. Only two preference cookies are kept in your browser:

- **Theme preference** (\`az-theme\`) — light or dark.
- **Language preference** (\`az-locale\`) — Turkish or English.

Neither carries identifying information, neither is tied to a user id, and neither is shared with another site. Clear them in your browser settings and the site returns to its defaults.

### Page Counts

Knowing how many times a page is read is what shows which parts of the product work — which guide article gets read, whether anyone reaches the English side, whether an earnings analysis finds an audience. This count **uses no cookies** and does not identify you. For each page read, the following is recorded:

| Recorded | Example |
|---|---|
| Path | \`/hisse/AAPL\` |
| Interface language | \`tr\` |
| Device class | mobile / tablet / desktop |
| Referring domain | \`google.com\` — the path and search term are **discarded** |
| Signed in | yes/no — **not who** |
| Date | \`2026-08-13\` |

**Not recorded:** your IP address, the full text of your browser signature, the full referring address, your user id. None of these appear in any column.

So that the same visitor is not counted twice in a day, your IP address and browser signature are turned into an **irreversible digest** together with that day's date and a secret held on the server. The digest changes every day: yesterday's record cannot be linked to today's, and the digest cannot be reversed back to an IP address. These records are deleted automatically after **180 days**.

Legal basis: legitimate interest (Art. 5/2-f) — seeing which part of the product is used. Because this count serves no marketing purpose and produces no identity, it does not require explicit consent.

### When You Create an Account

| Data | Why it is processed | Legal basis |
|---|---|---|
| Username | To identify the account and sign in | Performance of a contract (Art. 5/2-c) |
| Email address | To keep the account unique | Performance of a contract (Art. 5/2-c) |
| Password digest | To verify sign-in | Performance of a contract (Art. 5/2-c) |
| Your watchlists and notes | The product's core function | Performance of a contract (Art. 5/2-c) |
| Theme and language preference | To remember the interface | Legitimate interest (Art. 5/2-f) |
| Last sign-in time | To see whether the account is still in use | Legitimate interest (Art. 5/2-f) |
| Session cookie | To keep you signed in | Performance of a contract (Art. 5/2-c) |

::: dikkat Your Password Is Not Stored
The password itself is kept nowhere. What is stored is an irreversible digest produced with the **bcrypt** algorithm. Even someone with database access cannot read your password. Even so, do not reuse a password from another service here — that is a general rule for every site.
:::

Your email address is stored **only** to keep your account unique; no mail is ever sent to it. There is no password reset feature yet, so if you forget your password your email address will not recover the account — keep it in a password manager.

No special categories of personal data (health, religion, biometrics, political opinion and so on) are collected in any form. National id number, phone, address, date of birth and financial account details are not requested either — the site does not act on your behalf and does not connect to a brokerage.

## Data That Is Not Collected

This section is deliberately separate: most privacy texts state what they collect, not what they don't.

- No advertising or tracking cookies are used.
- Google Analytics or any similar cross-site visitor tracking tool is not installed.
- There are no social media pixels, heat maps or session recordings.
- No profile is built through fingerprinting techniques.
- Location data is neither requested nor used.
- The page count does not follow you from one visit to the next: the distinguishing digest resets every day.

## Cookies

There are only three cookies on the site, and all three are functional:

| Cookie | Function | Lifetime |
|---|---|---|
| \`authjs.session-token\` | Keeps the session open. Created only for account holders. | 180 days |
| \`az-theme\` | Light/dark theme preference | 1 year |
| \`az-locale\` | Interface language | 1 year |

All three are written with \`SameSite\` protection, and the session cookie additionally carries the \`HttpOnly\` flag; it cannot be read by JavaScript. That is why no consent banner is shown: no marketing cookie requiring explicit consent is used.

## Data Transfers

The product runs on the following infrastructure and data providers. Some of these servers are outside Turkey; creating an account means you consent to that transfer.

| Who | What for | What of yours goes there |
|---|---|---|
| Vercel (US) | Hosts the site and measures total visits | IP address and browser information in request logs. The measurement side is cookieless and produces no identity |
| Neon (US/EU) | Database | Your account and watchlist records |
| Alpaca, Finnhub, FRED | Price, company and macro data | **Nothing** — the server makes these requests on its own behalf |
| DeepL | Translation of news headlines | **Nothing** — only the news text is sent |
| Anthropic | Generation of brief and article text | **Nothing** — only market data is sent |

The last three rows matter: requests to data providers carry no identity of yours. When you look at a stock, the provider sees it as "a request from Opening Bell", not "a request from this user".

The hosting provider's technical logs may hold an IP address and browser information for a short period; this happens on every site on the internet and is required for security.

## Retention

Your account data is kept for as long as the account exists. When you delete your account, your user record and every watchlist attached to it are **permanently** removed from the database; copies in backups fall away when the backup cycle completes (at most 30 days).

Market data, news and articles are not personal data; they are kept whether or not you have an account.

## How to Exercise Your Rights

Article 11 of the KVKK gives you the right to: learn whether your personal data is processed; request information if it has been; learn whether it is used for its intended purpose; know the parties it is transferred to inside and outside Turkey; request correction if it is incomplete or wrong; request its deletion or destruction; request that these actions be notified to the parties it was transferred to; object to an adverse outcome produced by automated analysis; and claim compensation if you suffer damage.

You can send your request [through the GitHub repository](https://github.com/ahmetakyapi/acilis-zili/issues). Requests are answered free of charge within **30 days** at the latest.

You do not have to wait for an account deletion request: you can delete your account yourself from the Settings screen, and it takes effect immediately.

## Security

- All traffic is encrypted with TLS; the site is served over HTTPS only.
- Passwords are digested with bcrypt at a current cost factor.
- The database connection is encrypted and reachable only from the application server.
- The session cookie is written with the HttpOnly and Secure flags.

Even so, no transmission over the internet is 100% secure. If you notice a security flaw, reporting it [via GitHub](https://github.com/ahmetakyapi/acilis-zili/issues) is enough; as long as you report it without exploiting it, you will get nothing but thanks.

## Under Eighteen

The site does not knowingly collect data from anyone under 18. If you are a parent and notice that your child has created an account here, get in touch and the record will be deleted.

## If This Text Changes

Changes are published on this page and the date at the top is updated. Every past version of the text sits in the project's open source repository along with its change history — so you can verify for yourself what changed and when.`;

const DISCLAIMER_EN = `Opening Bell is an information screen. What follows is what you should know before using the site.

::: dikkat Not Investment Advice
No content on this site — prices, briefs, guide articles, close-up pieces and news summaries included — is investment advisory, a trading recommendation or a suggestion to buy any financial product. Investment advisory is a service provided by licensed institutions taking each person's risk and return preferences into account. Nothing you read here falls within that scope.
:::

## Data Accuracy

Prices, earnings dates and the economic calendar come from third-party providers (Alpaca, Finnhub, FRED). This data:

- **May be delayed.** Free data tiers are not real time; the price on screen may not be the last price on the exchange.
- **May be missing or wrong.** A provider can shift an earnings date or publish a figure late.
- **May be revised retroactively.** Macro figures are revised later; a past value on screen may differ from today's official value.

If you are going to trade, verify the number with your own broker. The site cannot be held responsible for the outcome of decisions made on the basis of a figure shown here.

## Automatically Generated Text

The daily summary, the weekly brief and the close-up pieces are largely generated automatically; the source is stated in each text's byline. These texts rest on publicly available news sources and reflect the information available on their publication date. They can contain errors.

Turkish translations of news headlines are automatic as well. Because meaning can shift, checking the original source is advised for anything important.

## The Participation Finance Screen Is Not a Religious Ruling

The participation finance indicator on company pages is an automatic **pre-screen** built from two pieces of public information (line of business and a few financial ratios). The criterion based on revenue breakdown cannot be applied because it is not available in the free data source. The result does not say "compliant"; it says "passes / fails these two criteria". The final judgement belongs to the school of thought a person follows and to expert boards that examine audited financial statements.

## Links

The site links out to news sources and company websites. Opening Bell is not responsible for the content, privacy practices or security of those sites.

## Continuity of Service

This is a personal project. It is offered free of charge, carries no service level commitment, and may change or stop without prior notice. If your data matters to you, it is worth keeping your watchlist somewhere else as well.`;

/**
 * Dile göre metin — çeviri yoksa Türkçesine düşülmez, ikisi de yazılı.
 *
 * Sayfa `lang` özniteliğini de bu seçime göre veriyor: yasal metnin hangi
 * dilde okunduğu ekran okuyucu ve tarayıcı çevirisi için önemli.
 */
export function privacyMd(locale: string): string {
  return locale === "en" ? PRIVACY_EN : PRIVACY_TR;
}

export function disclaimerMd(locale: string): string {
  return locale === "en" ? DISCLAIMER_EN : DISCLAIMER_TR;
}
