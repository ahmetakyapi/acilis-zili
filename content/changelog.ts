/* ==========================================================================
   Yenilikler — sitenin okura dönük değişiklik geçmişi (25 Ekim 2026)

   Neden depoda, veritabanında değil: geçmiş yazıldıktan sonra değişmez ve
   her madde bir commit'e dayanır. Kod incelemesinden geçmesi ve sürüm
   geçmişinde durması rehberle (`content/guide/`) aynı gerekçe.

   KAYNAK: `git log --reverse` — 1 Ağustos'tan 25 Ekim'e 800'e yakın commit,
   gövdeleriyle okundu. Her maddenin üstündeki yorum dayandığı commit'lerin
   kısa adresi; sayılar (516 şirket, 21 rehber yazısı, sekiz kurum…) o
   commit'in gövdesinden ve O GÜNÜN sayısı. Alınmayanlar: altyapı, refactor,
   CI ve dağıtım, yönetim paneli, rutin prompt'ları, iç araçlar, güvenlik
   ayrıntısı (okura etkisi varsa tek genel cümle) ve sonradan geri alınmış
   işler (1 Ağustos'un gazete teması aynı gün kalktı, katılım taraması
   sonradan silindi — "yeni" diye sunulmaz).

   YAPI. `CHANGELOG_TR` dilden bağımsız alanları (gün, etiket, bağlantı) da
   taşıyan kaynak; `CHANGELOG_EN` yalnız metin taşır ve tipi TR'den
   TÜRETİLİR: giriş sayısı, her girişin `date`i (sabit, hizalama denetimi)
   ve madde sayısı birebir aynı olmak zorunda — eksik ya da kaymış çeviri
   derlemeyi kırar. Gün ve madde sırası yazıldığı gibi; en yeni üstte.

   KURALLAR (tests/changelog.test.ts sınar):
   - `date` girişin son günü; `from` varsa giriş bir aralığı anlatır.
     Girişler kesin azalan sırada, gün tekil (sayfada çapa olarak kullanılır).
   - Her girişte 2-6 madde. TEK İSTİSNA en üstteki giriş: bu sürümün kendisi
     ve sayfada öne çıkarılan blok; on beş maddesi altıya sığdırılınca ya
     özellik düşüyordu ya da maddeler birbirine karışıyordu.
   - `href` bugün VAR OLAN bir rota (dinamik olanda gerçek bir değer:
     `/hisse/NVDA`, `content/guide/meta.ts`te olan bir rehber yazısı…). Emin
     olunamayan maddede bağlantı yok. `TELEGRAM_HREF` bir yer tutucu: kanal
     adresi (`NEXT_PUBLIC_TELEGRAM_URL`) tanımlı değilse "Dene" basılmaz.
   - Başlıklar Title Case, gövde tek cümle; arayüz metninde em dash yok.
     Hitap "sen" (sitenin sesi).
   ========================================================================== */

/** Okura gösterilen etiket — madde başına. Sıra süzgeç çiplerinin sırası. */
export const CHANGE_KINDS = ["yeni", "iyilestirme", "duzeltme"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

/** Telegram kanalı için yer tutucu bağlantı — `lib/changelog.ts` çözer. */
export const TELEGRAM_HREF = "@telegram";

type IsoDay = `${number}-${number}-${number}`;

type SourceItem = {
  readonly kind: ChangeKind;
  readonly title: string;
  readonly body: string;
  readonly href?: string;
};

type SourceEntry = {
  readonly date: IsoDay;
  readonly from?: IsoDay;
  readonly title: string;
  readonly summary: string;
  readonly items: readonly SourceItem[];
};

/**
 * EN'in tipi TR'den: aynı uzunlukta demet, her girişte TR'nin `date`i
 * (değişmez dize) ve aynı uzunlukta madde demeti. Etiket ve bağlantı
 * EN'de yok — TR'den okunur, iki dil ayrı düşemez.
 */
type Translation<T extends readonly SourceEntry[]> = {
  readonly [I in keyof T]: {
    readonly date: T[I]["date"];
    readonly title: string;
    readonly summary: string;
    readonly items: TextItems<T[I]["items"]>;
  };
};

/* Ayrı genel tip ŞART: eşlenen tip ancak bir tip PARAMETRESİ üzerinden
   kurulunca demet kalıyor (homomorfik); `T[I]["items"]` üzerinde doğrudan
   kurulunca `length` dahil bütün anahtarları eşliyordu. */
type TextItems<Items extends readonly SourceItem[]> = {
  readonly [J in keyof Items]: { readonly title: string; readonly body: string };
};

export const CHANGELOG_TR = [
  /* ---- 24-25 Ekim: bu sürüm (main..HEAD) ---- */
  {
    date: "2026-10-25",
    from: "2026-10-24",
    title: "Sayfada Claude, Her Güne Yeni Bir Parça",
    summary:
      "Claude artık tarayıcıda, hisse sayfasında ve takip listende sayfanın kendi verisiyle çalışıyor. Bilanço sezonu için şirket sayfaları, her seans yenilenen poster, grafik ve bulmaca da bu sürümle geldi.",
    items: [
      // a44d8b4c, d2d18282
      { kind: "yeni", title: "Cümleyle Tarama", body: "Tarayıcıya “borcu az, kârlı yarı iletkenler” gibi bir cümle yazınca Claude onu süzgeçlere çeviriyor; hisseleri Claude değil, sayfanın kendi süzgeçleri seçiyor.", href: "/tarama" },
      // 685b60dc, 5d69f2c1
      { kind: "yeni", title: "Bu Hisseye Sor", body: "Hisse sayfasında sorduğun soruyu Claude yalnız o sayfadaki veriyle cevaplıyor; veri yetmiyorsa bunu söylüyor, al ya da sat demiyor.", href: "/hisse/NVDA" },
      // 685b60dc, 5d69f2c1
      { kind: "yeni", title: "Takip Listem Bugün", body: "Takip listendeki hisselerin son seansı kısa bir notla özetleniyor: en çok hareket edenler, S&P 500'e göre farkları ve yedi gün içinde bilançosu olanlar.", href: "/favoriler" },
      // 6f5ef5de, c699e996
      { kind: "yeni", title: "Portföy Analizi", body: "Portföyünün sektör dağılımını S&P 500 ile yan yana, yoğunlaşmasını, son bir yıldaki oynaklığını ve en büyük düşüşünü tek ekranda görüyorsun.", href: "/portfoy/analiz" },
      // dc681c39, 55526c2a
      { kind: "yeni", title: "Şirketin Bilanço Sayfası", body: "Her şirketin sıradaki bilanço günü ve saati kendi sayfasında; üyeler “Beklentiyi Geçer mi?” oylamasına katılıp yıl boyu isabetini görebiliyor.", href: "/bilancolar/NVDA" },
      // dc681c39
      { kind: "yeni", title: "Bilanço Hikâye Kartları", body: "Skorlu bir bilanço analizi beş kartlık bir hikâye olarak da okunuyor; her kartın telefona ve bağlantı önizlemesine uygun görseli var.", href: "/bilancolar/acn/4c-fy2026/hikaye" },
      // 76a9c338, 140825b9
      { kind: "yeni", title: "Günün Posteri", body: "Tamamlanan her seans tek sahnede çiziliyor: her nokta bir S&P 500 hissesi, on bir sektör güçlüden zayıfa sıralı; eski seanslar arşivde.", href: "/gun" },
      // 76a9c338, 140825b9
      { kind: "yeni", title: "Kapanış Künyesi ve Zil Sesi", body: "Seans kapanınca ana sayfadaki zilin altında o gün yükselen ve düşen hisse sayısı duruyor; istersen Ayarlar'dan zile ses de açabiliyorsun.", href: "/" },
      // 01f10d1f, 09dcab86
      { kind: "yeni", title: "Günün Grafiği", body: "Her işlem günü tek bir grafik ve yüz kelimelik bir açıklama yayımlanıyor; önceki günler arşivde duruyor.", href: "/gunun-grafigi" },
      // 7825f6ab, 0003573e
      { kind: "yeni", title: "Hisseyi Bil", body: "Her gün tek gizli hisse ve altı tahmin hakkı var; her yanlış tahmin fiyat silueti, sektör ya da piyasa değeri gibi yeni bir ipucu açıyor.", href: "/bulmaca" },
      // c19fb604, 2c477e68
      { kind: "yeni", title: "Aracı Kurum Karşılaştırması", body: "Türkiye'den ABD hissesi alınabilen sekiz kurumun komisyonu, saklama ücreti ve kesirli hisse koşulu tek tabloda, her hücre kurumun resmî tarifesine bağlı.", href: "/araci-kurumlar" },
      // c19fb604
      { kind: "yeni", title: "İki Yeni Rehber Yazısı", body: "SPK'nın bankaların yurt dışı pay emirlerine aracılığını bitiren kararı ve İrlanda ETF'i ile ABD ETF'i arasındaki vergi farkı birincil kaynaklarıyla anlatılıyor.", href: "/rehber/bankadan-araci-kuruma-gecis" },
      // 0e579ff6, aee683ea
      { kind: "iyilestirme", title: "Veri Taşıyan Paylaşım Kartları", body: "Paylaştığın hisse kartında son bir ayın kapanış çizgisi ve fiyatın hangi seansa ait olduğu, Mercek kartında da yazının ilk rakamları görünüyor.", href: "/mercek" },
      // 968de34c, 7e943919
      { kind: "yeni", title: "Telegram Kanalı", body: "Açılıştan önce günün özeti, kapanıştan sonra seansın sonucu ve yeni Mercek yazıları Telegram kanalına kendiliğinden düşüyor.", href: TELEGRAM_HREF },
      // 0e579ff6, aee683ea
      { kind: "duzeltme", title: "Mercek Çubukları", body: "Eksi işaretli ya da birimli değer taşıyan çubuk blokları artık boş çizilmiyor; birimler karışıksa değerler çubuksuz bir liste olarak okunuyor.", href: "/mercek" },
    ],
  },
  /* ---- C ---- */
  {
    date: "2026-10-22",
    title: "Geçmiş Günler ve Mavi Bekleme Filmleri",
    summary: "Bugünün Akışı artık yalnız bugüne bakmıyor; bekleme filmleri de sitenin mavi diline geçti. Aynı günlerde bir dizi düzeltme yayına çıktı.",
    items: [
      // 739a1f94, 7a229db9
      { kind: "yeni", title: "Önceki ve Sonraki Günler", body: "Ana sayfadaki akışta oklarla bir önceki ya da sonraki işlem gününe geçip dün açıklanan bilançoların sonucuna bakabiliyorsun.", href: "/" },
      // 305f1929
      { kind: "iyilestirme", title: "Mavi Bekleme Filmleri", body: "Claude analizi ve hareket notu beklenirken oynayan kısa filmler sitenin mavi diline geçti; açık temada film de açık kalıyor." },
      // 88aa23d4
      { kind: "duzeltme", title: "İngilizce Manşet Kalmıyor", body: "Ekranda çevrilmemiş kalan haber başlıkları artık sayfa açıldıktan hemen sonra Türkçeye çevriliyor.", href: "/haberler" },
      // fc2f7ead
      { kind: "duzeltme", title: "İngilizce Sayfalarda Bağlantılar", body: "İngilizce sayfalardaki site içi bağlantılar artık seni Türkçe sayfaya düşürmüyor." },
      // 7652f300, fc2f7ead
      { kind: "duzeltme", title: "Güvenlik ve Oturum Düzeltmeleri", body: "Kapsamlı bir güvenlik incelemesinin bulguları kapatıldı; şifresi başka bir cihazda değişen okur artık girişte takılı kalmıyor." },
    ],
  },
  {
    date: "2026-10-18",
    title: "Claude Notları Çoğaldı, Sekiz Ekran Yenilendi",
    summary: "Claude'un kısa notları bilanço öncesine, ekonomik veriye, karşılaştırmaya ve portföye yayıldı. Piyasalar'dan Vergi'ye sekiz ekran daha ince bir grafik diliyle yeniden düzenlendi.",
    items: [
      // 021c200e
      { kind: "yeni", title: "Bilanço Öncesi Önizleme", body: "On gün içinde bilanço açıklayacak şirketin sayfasında beklentileri, son dört çeyreğin sürprizini ve haberlerdeki konuları özetleyen bir not çıkıyor.", href: "/hisse/NVDA" },
      // b8984575
      { kind: "yeni", title: "Son Açıklanan Veriler", body: "Takvim'de son on günün önemli ekonomik verileri gerçekleşen, beklenti ve önceki değerle, yanında Claude'un ne anlattığını söyleyen kısa notuyla duruyor.", href: "/takvim" },
      // b8984575
      { kind: "yeni", title: "Claude Karşılaştırma Notu", body: "Karşılaştırdığın hisselerin kim ne kadar hareket etti, S&P 500'e göre nerede durdu ve temel verilerde nasıl ayrıştı sorularına kısa bir özet geliyor.", href: "/karsilastir/nvda-amd" },
      // 5dfe6039
      { kind: "yeni", title: "Portföyünün Kısa Okuması", body: "Portföy ekranında ağırlığın nerede toplandığını, son beş seansı kimin taşıdığını ve yakında kimin bilanço açıklayacağını anlatan bir not var.", href: "/portfoy" },
      // 9ed5d1df, ea8fc768, 4ab32e51
      { kind: "iyilestirme", title: "Sekiz Ekran Yenilendi", body: "Piyasalar, Bilançolar, Mercek, Takvim, Vergi, Ünlü Yatırımcılar, bilanço detayı ve Teknik Analiz daha sade ve ince grafiklerle yeniden düzenlendi.", href: "/piyasalar" },
      // da317fbc
      { kind: "iyilestirme", title: "Analizlerim Kartlarda", body: "Analizlerim sayfası önce kendi yazılarını, sonra Claude raporlarını okunur kartlar hâlinde gösteriyor.", href: "/analizlerim" },
    ],
  },
  {
    date: "2026-10-17",
    title: "Hisse Sayfasında Claude ve Pazar Özeti",
    summary: "Hisse sayfası artık haftanın hareketini ve son bilançoyu kısa notlarla anlatıyor. Her pazar sabahı üyelere haftanın özeti postayla gidiyor.",
    items: [
      // 401765b0, 309a3acd
      { kind: "yeni", title: "Bu Hafta Neden Hareket Etti", body: "Hisse sayfasında son beş seansın hareketi S&P 500 ve şirketin o haftaki haberleriyle açıklanıyor; haberler bir sebep göstermiyorsa not bunu açıkça söylüyor.", href: "/hisse/NVDA" },
      // 401765b0
      { kind: "yeni", title: "Bilanço Notu", body: "Son on günde bilanço açıklayan şirketin sayfasında beklenti ile gerçekleşenin çubukları, ilk seans tepkisi ve kısa bir not çıkıyor." },
      // 309a3acd, 4ab32e51, f3636cd6
      { kind: "yeni", title: "Günün Gündemi ve Haber Notları", body: "Haberler sayfası günün ve haftanın önemli haberlerini başlıklar altında topluyor, haber detayında da haberin ne anlattığı sade dille açılıyor.", href: "/haberler" },
      // 9fc914ab, a3f6ed4e, 583dee62
      { kind: "yeni", title: "Pazar Özeti Postası", body: "Her pazar sabahı geçen haftanın özeti ve yeni haftanın takvimi postana geliyor; istemezsen Ayarlar'dan ya da postadaki bağlantıdan kapatabiliyorsun.", href: "/ayarlar" },
      // 9fc914ab
      { kind: "yeni", title: "Alarm Postası", body: "İstersen fiyat alarmın tetiklendiğinde onayladığın adrese e-posta da gidiyor.", href: "/ayarlar" },
      // 3a59180b
      { kind: "iyilestirme", title: "Gün Aralığı Şeridi", body: "Piyasalar'daki her endeks kartında fiyatın günün dibi ile tepesi arasında nerede durduğunu gösteren ince bir şerit var.", href: "/piyasalar" },
    ],
  },
  {
    date: "2026-10-16",
    title: "Tarayıcı, Topluluk ve Bildirim Kutusu",
    summary: "Hisseleri temel ölçülerle süzen bir tarayıcı, üyelerin yazı yazabildiği bir topluluk ve tüm uyarıları toplayan bir bildirim kutusu açıldı.",
    items: [
      // 36600dd4
      { kind: "yeni", title: "Hisse Tarayıcı", body: "Endeks şirketlerini sektöre, hazır süzgeçlere ve F/K gibi temel ölçülere göre süzüp sıralayabiliyorsun.", href: "/tarama" },
      // 233fe14e, 0047546e
      { kind: "yeni", title: "Topluluk Yazıları", body: "Mercek'in görsel bloklarıyla kendi yazını hazırlayabiliyor, şablonlardan başlayabiliyorsun; yazılar onaydan sonra Topluluk'ta yayımlanıyor.", href: "/topluluk" },
      // 6ce96fc0
      { kind: "yeni", title: "Herkese Açık Profil", body: "İstersen Ayarlar'dan bir profil açıp portföyünün getirisini tutar göstermeden, aynı günlerde SPY'a yatırılsaydı sorusuyla karşılaştırmalı paylaşabiliyorsun; profil varsayılan olarak gizli.", href: "/ayarlar" },
      // a61c7cde
      { kind: "yeni", title: "Zil Raporu", body: "Üyeliğin boyunca takip ettiğin hisseleri, tetiklenen alarmları ve portföyünün seyrini kaydırdıkça ilerleyen kişisel bir özet olarak okuyabiliyorsun.", href: "/raporum" },
      // 5bdfc0d0, 0047546e
      { kind: "yeni", title: "Bildirim Kutusu ve Yüzde Alarmı", body: "Fiyat alarmının yanında günlük yüzde değişim alarmı ve “bilanço yarın” hatırlatması geldi; hepsi başlıktaki zilin açtığı tek kutuda toplanıyor.", href: "/bildirimler" },
      // 19ea7330
      { kind: "duzeltme", title: "Şifre Değişince Oturumlar Kapanıyor", body: "Şifreni değiştirdiğinde ya da sıfırladığında öteki cihazlardaki açık oturumlar artık kapanıyor." },
    ],
  },
  {
    date: "2026-10-15",
    title: "Seans Zili ve Bugünün Akışı",
    summary: "Ana sayfaya seansın gününü anlatan bir zil makinesi ve tek düzende okunan bir zaman çizelgesi geldi. Kahramandaki zil de artık basılabiliyor.",
    items: [
      // 2435ed4f, 815b0efe, 3f12a991, 06612062
      { kind: "yeni", title: "Seans Zili", body: "Ana sayfadaki zil makinesi günün seanslarını gösteriyor; bir seansa dokununca ibre o seansı oynatıyor, “Günü Oynat” ise bütün günü hızlıca dolaşıyor.", href: "/" },
      // 81543e53, cc771546
      { kind: "yeni", title: "Bugünün Akışı Zaman Çizelgesi", body: "Günün bilançoları ve verileri her ekranda aynı zaman çizelgesinde diziliyor; sıradaki olay kendiliğinden açık, öteki satırlar yerinde açılıyor.", href: "/" },
      // 309c9d0a
      { kind: "yeni", title: "Zili Çal", body: "Ana sayfadaki zile basınca çalıyor, geri sayım sıfırlandığında da kendiliğinden çalıyor.", href: "/" },
      // 196c893b
      { kind: "iyilestirme", title: "Sekmede Kalan Süre", body: "Siteyi arka plandaki bir sekmede açık bıraktığında sekme başlığı açılışa ya da kapanışa kalan süreyi gösteriyor." },
      // 196c893b
      { kind: "duzeltme", title: "Okunamayan Takvim Boş Sayılmıyor", body: "Veri alınamadığında ana sayfa artık “bugün bilanço yok” demek yerine verinin okunamadığını söylüyor." },
      // 8c9f21f0, 8848d92e
      { kind: "iyilestirme", title: "Daha Erişilebilir Ekranlar", body: "Liste silme onayı listenin kendi başlığında açılıyor; kontrast ve dokunma hedefleri ekran okuyucu ve küçük ekran için düzeltildi.", href: "/favoriler" },
    ],
  },
  {
    date: "2026-10-12",
    title: "Claude ile Şirket Analizi",
    summary: "Bir hisse için Claude'a teknik ya da şirket odaklı rapor yazdırabileceğin bir sayfa açıldı. Hisse Seçimi ve şirket sayfası da açıklayıcı figürler aldı.",
    items: [
      // 7f968309, 53a36210, 13d2dd95, 223b34e1
      { kind: "yeni", title: "Şirket Analizi Sayfası", body: "Yetkili üyeler bir hisse için 1-2 haftalık teknik ya da 3-6 aylık şirket odaklı bir Claude raporu yazdırabiliyor; raporlar fiyat haritası ve senaryolarla görsel okunuyor, herkes okuyabiliyor.", href: "/claude/NVDA" },
      // 53a36210, 15c632ce
      { kind: "yeni", title: "Kayıtlı Raporlar", body: "Yazdırdığın raporlar Analizlerim sayfasında toplanıyor, hisse sayfasında da son raporlar listeleniyor.", href: "/analizlerim" },
      // 93461529, c4311a73
      { kind: "yeni", title: "Kural Tezgâhı", body: "Hisse Seçimi raporunda hisse yedi istasyonlu bir tezgâhtan geçiyor ve her kural geçti, dikkat ya da kaldı diye bir lamba olarak yanıyor.", href: "/hisse-secimi/NVDA" },
      // b5f588b6
      { kind: "yeni", title: "Beklenen Hareket Figürü", body: "Hisse sayfasında opsiyonların fiyatladığı bant ile geçmiş raporların ertesindeki hareketler aynı eksende, kaç kez bandın dışına çıkıldığıyla birlikte duruyor.", href: "/hisse/NVDA" },
      // 2aa27157
      { kind: "iyilestirme", title: "Yazdıkça Öneren Sembol Alanı", body: "Hisse Seçimi'nde şirket adını yazmaya başladığında sembol önerileri çıkıyor; “mu” yazınca Micron'u buluyorsun.", href: "/hisse-secimi" },
      // 9d679e10
      { kind: "iyilestirme", title: "Analiz Araçları Bir Arada", body: "Menüde Teknik Analiz, Hisse Seçimi ve Karşılaştır gibi araçlar kendi grubunda en üstte duruyor.", href: "/menu" },
    ],
  },
  {
    date: "2026-10-10",
    title: "Fiyat Alarmları ve Hesap Araçları",
    summary: "Hisse için hedef fiyat kurup bildirim alabiliyor, portföyde satış kaydedebiliyor ve unuttuğun şifreyi sıfırlayabiliyorsun. Canlı rakamlar da artık yönüyle değişiyor.",
    items: [
      // a2dab8fb
      { kind: "yeni", title: "Fiyat Alarmları", body: "Hisse sayfasındaki zil düğmesiyle hedef fiyat kuruyorsun; tüm alarmların Favoriler'de, hedefe ne kadar yaklaştığıyla listeleniyor.", href: "/favoriler" },
      // 5c558d08
      { kind: "yeni", title: "Tarayıcı Bildirimleri", body: "Ayarlar'dan açtığın cihazda alarm, site kapalıyken de tarayıcı bildirimi olarak geliyor.", href: "/ayarlar" },
      // 78fa3813
      { kind: "yeni", title: "Portföyde Satış", body: "Satışlar en eski alıştan başlayarak düşülüyor ve gerçekleşen kâr ya da zarar dolar ve lira olarak yıl yıl görünüyor.", href: "/portfoy" },
      // a68fae47, 78fa3813
      { kind: "yeni", title: "Şifre Değiştirme ve Sıfırlama", body: "Şifreni Ayarlar'dan değiştirebiliyor, unuttuysan e-postana gelen tek kullanımlık bağlantıyla sıfırlayabiliyorsun." },
      // 4d754929, aa119144
      { kind: "iyilestirme", title: "Yönüyle Dönen Rakamlar", body: "Seans içinde güncellenen fiyatlarda yalnız değişen rakamlar dönüyor; yükselişte yukarı, düşüşte aşağı." },
      // 41a38c19
      { kind: "iyilestirme", title: "Haber Detayında Şirketler", body: "Haber sayfası haberde geçen şirketleri logolarıyla başlığın altında, günün fiyat çizgisiyle de aşağıda gösteriyor.", href: "/haberler" },
    ],
  },
  {
    date: "2026-10-04",
    title: "Gerçek Zamanlı Fiyat ve Hisse Seçimi",
    summary: "Seans içinde fiyatlar artık 15 dakika geriden gelmiyor. Bir hisseyi kurallarla sınayan Hisse Seçimi ekranı açıldı, portföy teknik planla buluştu.",
    items: [
      // bdafd081, 241fd799
      { kind: "iyilestirme", title: "Seans İçinde Gerçek Zamanlı Fiyat", body: "Normal seansta fiyat gerçek zamanlı akışın kendisinden geliyor, gün içi grafik de anlık; eski fiyatın önbellekten gelmesi engellendi.", href: "/hisse/NVDA" },
      // ed99452d, 146dac57
      { kind: "yeni", title: "Hisse Seçimi", body: "Bir hisseyi büyüme, kârlılık, finansal sağlık ve sahiplik gibi 22 sabit kuralla sınayıp önce dikkat isteyen noktaları görüyorsun.", href: "/hisse-secimi" },
      // 37f89cf3
      { kind: "yeni", title: "Bilançonun Açıklandığı An", body: "Bugünün Akışı, şirket bilançosunu SEC'e yatırdığı dakikada “Açıklandı” diyor ve bildirime bağlantı veriyor.", href: "/" },
      // 0caefe94, 3a6d197f, 0dfd3e77
      { kind: "yeni", title: "Portföyde Teknik Plan", body: "Teknik analizi yazılan hisselerden portföyünde olanlar için alım bölgesi, hedefler ve stop, senin maliyetine ve güncel fiyata göre gösteriliyor.", href: "/portfoy" },
      // 6ffda26e, aea0b7cb
      { kind: "yeni", title: "Fonların İçindekiler", body: "SPY, QQQ, sektör fonları ve yapay zekâ fonları gibi ETF'lerin sayfasında en büyük pozisyonlar ve ağırlıkları görünüyor.", href: "/hisse/SPY" },
      // acd2dcdf, c78fd2da
      { kind: "yeni", title: "Her Ekranda Paylaş", body: "Ünlü yatırımcılar, temalar, hisse, karşılaştırma ve bülten gibi ekranları bağlantısıyla paylaşabiliyorsun.", href: "/yatirimcilar" },
    ],
  },
  {
    date: "2026-09-29",
    title: "Haftalık Bilanço Tahtası ve Sözlük",
    summary: "Bilançolara haftanın tamamını gösteren bir sekme, siteye de yerinde açılan bir sözlük geldi. Ana sayfa sektörleri ve temaları her gün gösteriyor.",
    items: [
      // a150fb2f
      { kind: "yeni", title: "Haftalık Bilanço Tahtası", body: "Bu haftanın en çok beklenen bilançoları ve gün gün tam liste, beklenti ve gerçekleşenle tek sayfada.", href: "/bilancolar/hafta" },
      // 78e88b34, 4b855b45, 8e24ab57
      { kind: "yeni", title: "Sözlük", body: "150 yatırım terimi kavram çizimli kartlarda; bir terime basınca tanımı sayfadan ayrılmadan açılıyor.", href: "/sozluk" },
      // 286ff164, 2ae8768c
      { kind: "yeni", title: "Sektörler ve Temalar Bandı", body: "Ana sayfa günün sektör hareketlerini ve en güçlü ile en zayıf temayı tek bantta gösteriyor.", href: "/" },
      // d5a08bd8, a150fb2f
      { kind: "yeni", title: "Piyasa Nabzı ve Makro Özeti", body: "Piyasalar'da bileşenleri tek tek görünen bir piyasa nabzı, Makro'da da 11 göstergenin hepsi üstte bir özet ızgarasında.", href: "/makro" },
      // 2010963c
      { kind: "yeni", title: "Şirket Kartı", body: "Bir şirket logosunun üzerine gelince adı, sektörü, piyasa değeri, fiyatı ve hangi seansa ait olduğu yazan değişimiyle bir kart açılıyor." },
      // c96740a1
      { kind: "yeni", title: "Her Ekranda Seans Durumu", body: "Logonun altında piyasanın açık olup olmadığı ve sıradaki zile ne kadar kaldığı her sayfada yazıyor." },
    ],
  },
  {
    date: "2026-09-28",
    title: "Vergi, Portföy ve Ünlü Yatırımcılar",
    summary: "Türkiye'den ABD hissesi alan okur için vergi hesaplayıcı, lira bakışlı portföy ve rehber yazıları geldi. Ünlü yatırımcıların portföyleri de artık sitede.",
    items: [
      // 4bdc57de, 9c42197c, cef89061
      { kind: "yeni", title: "Yurt Dışı Hisse Vergi Hesaplayıcı", body: "Alım satımlarını girip ya da Midas ve IBKR ekstrelerini yükleyip vergi matrahını hesaplayabiliyorsun; dosyalar yalnız tarayıcında okunuyor.", href: "/vergi" },
      // 4bdc57de, e6154e04
      { kind: "yeni", title: "Portföy ve Lira Bakışı", body: "Pozisyonlarını kaydedip kâr ve zararı dolar ve lira olarak görüyorsun; alış maliyeti o günün kuruyla çevriliyor.", href: "/portfoy" },
      // 244ff105, a83f499a
      { kind: "yeni", title: "Ünlü Yatırımcılar", body: "Buffett'tan Pelosi'ye ünlü yatırımcıların SEC beyanlarından portföyleri ve çeyrekte ne alıp sattıkları; Cathie Wood'un sayfasında ARK fonlarının günlük işlemleri de var.", href: "/yatirimcilar" },
      // 78e88b34, 2ae8768c
      { kind: "yeni", title: "Temalar ve Karşılaştırma Çiftleri", body: "Yapay zekâ ve yarı iletkenler gibi on tematik liste ile yirmi hazır karşılaştırma çifti eklendi.", href: "/tema" },
      // d5a08bd8
      { kind: "yeni", title: "Hisse Sayfası Derinleşti", body: "Hisse sayfasına içeriden işlemler, bilanço öncesi beklenen hareket, sektörüne göre karne ve temettü panelleri geldi.", href: "/hisse/NVDA" },
      // 78e88b34, fd7b52b5
      { kind: "yeni", title: "Türkiye'den Yatırım Rehberi", body: "ABD hissesi almak, aracı kurum, W-8BEN ve yurt dışı hisse vergisi gibi konularda on dört yeni rehber yazısı ile teknik görüşlerin ne anlama geldiğini anlatan bir yazı eklendi.", href: "/rehber/abd-hisse-nasil-alinir" },
    ],
  },
  {
    date: "2026-09-27",
    title: "Hareketli Geçişler ve Isı Haritası",
    summary: "Sayfalar arası geçişler ve beklemeler kısa mürekkep sahneleriyle anlatılıyor. Piyasalar'a logolu bir ısı haritası, aramaya da daha doğru bir sıralama geldi.",
    items: [
      // 9df9d92b
      { kind: "yeni", title: "Gidilen Ekrana Göre Bekleme Sahnesi", body: "Sayfa yüklenirken çıkan kart gittiğin ekrana göre kısa bir sahne oynatıyor; Mercek'e giderken büyüteç, bilançoya giderken terazi." },
      // e8c64c60, 3d771d94, 13d83c7a
      { kind: "yeni", title: "Logo Uçuşu", body: "Bir hisse kartına basınca şirket logosu açılan sayfanın başlığındaki yerine uçuyor." },
      // 93a8ad46, 4cfc6dab
      { kind: "iyilestirme", title: "Yeni Giriş ve Kayıt Ekranı", body: "Giriş ve kayıt sayfası sitenin mürekkep diliyle, kendini kuran bir formla yeniden çizildi.", href: "/giris" },
      // a270c506, 6ec87368, 1aa2a1ef
      { kind: "yeni", title: "Logolu Isı Haritası", body: "Piyasalar'da endeksin en büyük 30 şirketi logolu karolarda günlük yüzdeleriyle duruyor.", href: "/piyasalar" },
      // 1aa2a1ef
      { kind: "iyilestirme", title: "Daha Doğru Arama", body: "Arama önce birebir sembolü, sonra şirket adını getiriyor; sonuçlar logolu ve son aramaların hatırlanıyor." },
      // 1dec3559
      { kind: "yeni", title: "Profil İkonları", body: "Ayarlar'dan sitenin kendi çizdiği on iki ikondan birini profil ikonu olarak seçebiliyorsun.", href: "/ayarlar" },
    ],
  },
  /* ---- B ---- */
  {
    date: "2026-09-24",
    title: "Yeni Marka Zili ve Küçük Dokunuşlar",
    summary: "Marka işareti yenilendi, site açılışta ve boş ekranlarda fırçayla çizilen zil sahneleri kazandı. Bültenin her sayısı artık kendi adresinde duruyor.",
    items: [
      // b208ed77, b789c70c
      { kind: "iyilestirme", title: "Klasik Tören Zili", body: "Marka işareti açık maviden gece mavisine inen bir karonun üstünde beyaz bir zile dönüştü; sekme ikonu ve paylaşım kartları da aynı işareti taşıyor." },
      // 6d3bad72
      { kind: "yeni", title: "Mürekkep Sahneleri", body: "Sitenin ilk açılışında ve boş listelerde zil fırçayla çizilip canlanıyor; hareketi azaltan okur yalnızca son kareyi görüyor." },
      // 43b60f7b
      { kind: "yeni", title: "Açılışta Zil Çalıyor", body: "Ana sayfadaki geri sayım sıfıra vardığında rakamlar marka rengine dönüyor ve yanında zil çalıyor.", href: "/" },
      // 7def9617, c3089523
      { kind: "yeni", title: "Ayarlarda Görünüm", body: "Tema ve dil artık Ayarlar sayfasından da seçiliyor; yeni tema tıkladığın yerden büyüyen bir daireyle açılıyor.", href: "/ayarlar" },
      // da0b765b
      { kind: "yeni", title: "Her Bülten Sayısının Adresi", body: "Günlük ve haftalık bültenin her sayısı kendi kalıcı adresinde açılıyor, böylece tek bir sayıyı paylaşmak kolaylaştı.", href: "/bulten" },
      // 91946494, cd23f7d6
      { kind: "iyilestirme", title: "Hisse Sayfasında Okuma", body: "Grafikte gezerken başlıktaki canlı fiyat sabit kalıyor, okuma noktanın yanında küçük bir etikette çıkıyor; profil kartı şirketin dizindeki sırasını da gösteriyor.", href: "/hisse/NVDA" },
    ],
  },
  {
    date: "2026-09-23",
    title: "Okuma Sayfaları ve Takvim Yenilendi",
    summary: "Mercek ve rehber yazıları tek, rahat okunan bir sütuna geçti. Takvimde gün seçmek, şirketlerde bütün dizini aramak mümkün oldu.",
    items: [
      // 83c28037, f7858964
      { kind: "iyilestirme", title: "Mercek'te Editoryal Düzen", body: "Yazılar daha büyük puntolu tek bir sütunda; yanda numaralı içindekiler ve yazıda geçen şirketlerin olaydan bugüne değişimi duruyor.", href: "/mercek" },
      // f7858964
      { kind: "iyilestirme", title: "Rehber Aynı Ölçüde", body: "Rehber yazıları Mercek'le aynı okuma düzenine geçti ve kapağın yanında yazının bölümlerine giden bağlantılar var.", href: "/rehber" },
      // 19840dcf
      { kind: "yeni", title: "Takvimde Gün Seçimi", body: "Şeritte bir güne dokununca gündem yalnızca o günü gösteriyor; başka güne bakmak için sayfayı yukarı kaydırmak gerekmiyor.", href: "/takvim" },
      // 8bdd6993
      { kind: "yeni", title: "Şirketlerde Arama", body: "Şirketler sayfasında ad ya da sembolle arama, yalnızca ilk satırlarda değil seçili sektörün tamamında çalışıyor.", href: "/sirketler" },
      // 5d998b8b
      { kind: "iyilestirme", title: "Tahvil ve Korku Endeksi Kapakta", body: "Piyasalar sayfasında dört vadeli tahvil faizi, getiri eğrisi ve VIX artık sayfanın dibinde değil, kapağın altında tek bir şeritte.", href: "/piyasalar" },
      // 8bdd6993, cb5d43de
      { kind: "iyilestirme", title: "Bilanço Analizlerinde Dağılım", body: "Analizler listesinin kapağı, filtrelenen raporların kaçının Al, Tut ya da Sat dediğini gösteriyor; yaklaşan bilançolar da tarih sırasıyla diziliyor.", href: "/bilancolar/analizler" },
    ],
  },
  {
    date: "2026-09-19",
    title: "Teknik Analiz Büyüdü",
    summary: "Teknik analiz listesine üç hisse eklendi, göstergeler ne anlama geldiklerini anlatmaya başladı. Şirket sayfası da hissenin günlük teknik görüşünü gösteriyor.",
    items: [
      // 1174ad95
      { kind: "yeni", title: "AMD, INTC ve PLTR", body: "Teknik analiz listesine üç hisse eklendi; ilk yayına kadar Yayın Bekliyor olarak görünüyorlar.", href: "/teknik" },
      // 38085d14
      { kind: "yeni", title: "Göstergeler Kendini Anlatıyor", body: "RSI, MACD, ATR ve pivot gibi ölçülerin her birinin altında ne anlama geldiğini söyleyen kısa bir açıklama var.", href: "/teknik/NVDA" },
      // de5b1fcf
      { kind: "yeni", title: "Şirket Sayfasında Teknik Kart", body: "Teknik analizi olan hissenin sayfasında görüş, fiyatın plana göre yeri ve gerekçenin ilk cümlesi en üstte duruyor.", href: "/hisse/NVDA" },
      // dc890798, c8a0a085
      { kind: "yeni", title: "Kapanış Öncesi Yayını", body: "Teknik analiz günde üç kez yayımlanmaya başladı ve sayfa bir sonraki yayının saatini de yazıyor." },
      // 965b55a4, 1ee83dc6
      { kind: "yeni", title: "Paylaş ve Öteki Hisseler", body: "Teknik analiz sayfası paylaş düğmesi aldı; sayfanın sonundaki kartlarla listedeki öteki hisselere tek dokunuşla geçiliyor.", href: "/teknik/NVDA" },
      // 31e13ab5
      { kind: "iyilestirme", title: "Karşılaştırmada Ölçek Çubukları", body: "Karşılaştırma tablosunda her sayının altındaki ince çubuk, hangisinin büyük olduğunu okumadan görmeyi sağlıyor.", href: "/karsilastir/spy-qqq" },
    ],
  },
  {
    date: "2026-09-18",
    title: "Daha Doğru Fiyat, Daha Rahat Telefon",
    summary: "Eski verinin bugünkü gibi görünmesine yol açan hatalar kapandı. Telefonda gizli kalan düğmeler, zıplayan sayfalar ve okunması zor yazılar düzeltildi.",
    items: [
      // 95d3234e, ae6b168d, 56a95647
      { kind: "duzeltme", title: "Eski Veri Bugünmüş Gibi Görünmüyor", body: "Bir önceki günün fiyatları ve yüzdeleri artık seans içi diye gösterilmiyor; başlıktaki fiyat ile grafiğin son noktası da aynı sayıyı yazıyor." },
      // c9008076
      { kind: "iyilestirme", title: "Olaylar Ne Olduklarını Söylüyor", body: "Bugünün Akışı'nda Fed kararları kurumun adıyla, bilançolar şirket adıyla yazılıyor ve her olay türünün yanında tek cümlelik bir açıklama var.", href: "/" },
      // 189bd280, 88d6d9f8
      { kind: "duzeltme", title: "Grafiğin Bütün Aralıkları", body: "Telefonda ekran dışında kalan 1Y ve 5Y düğmeleri artık hisse grafiğinin altında görünüyor.", href: "/hisse/NVDA" },
      // 988ec56b
      { kind: "iyilestirme", title: "Kayan Şeritlerde Devamı Var", body: "Yana kayan şeritlerin kenarı soluyor, böylece telefonda da sağda daha fazla içerik olduğu anlaşılıyor." },
      // f62e2e3f
      { kind: "duzeltme", title: "Sayfa Zıplaması Azaldı", body: "Yazı tipi yüklendiğinde ya da içerik geldiğinde sayfanın aşağı yukarı kayması büyük ölçüde ortadan kalktı." },
      // af8d505d, 4911df72
      { kind: "duzeltme", title: "Okunurluk ve Dokunma", body: "Renkli zeminlerdeki soluk yazılar koyulaştı, telefonda parmakla ıskalanan küçük düğmeler büyüdü." },
    ],
  },
  {
    date: "2026-09-13",
    title: "Teknik Analiz Açıldı",
    summary: "Seçili hisseler için her işlem günü yenilenen teknik analiz sayfası yayına girdi. Masaüstü başlık tek şeride indi ve teknik analiz orada kendi sekmesini aldı.",
    items: [
      // ad167f49
      { kind: "yeni", title: "Teknik Analiz", body: "On iki hisse için Al, Tut ya da Sat görüşü, alım bölgesi, hedefler, stop, destek ve direnç her işlem günü güncelleniyor; göstergeler sitenin kendi verisinden hesaplanıyor.", href: "/teknik" },
      // 1fb55872
      { kind: "yeni", title: "Nereden Alınır, Nerede Vazgeçilir", body: "Plan şeridi bu üç soruyu doğrudan cevaplıyor, fiyat haritası da seviyeleri fiyata orantılı bir eksende gösteriyor.", href: "/teknik/NVDA" },
      // be29fef5
      { kind: "yeni", title: "Görüş Dağılımı", body: "Teknik analiz listesinin başında kaç hissenin Al, Tut ya da Sat dediği görülüyor ve liste görüşe göre süzülebiliyor.", href: "/teknik" },
      // 9e215d0c, d33c2952
      { kind: "iyilestirme", title: "Tek Şeritlik Başlık", body: "Masaüstü başlık sadeleşti; ana sekmeler tek satırda, öteki sayfalar Daha Fazla menüsünde." },
      // 38c93cad
      { kind: "iyilestirme", title: "Değerleme Kartları", body: "Hisse sayfasındaki temel veriler dört ayrı kompakt karta bölündü ve hareketli ortalamalara uzaklık tek eksende okunuyor.", href: "/hisse/AAPL" },
    ],
  },
  {
    date: "2026-09-08",
    title: "Yeni Ana Sayfa ve Hareket",
    summary: "Ana sayfanın en üstünde açılışa geri sayım büyük bir manşete dönüştü. Grafikler ve yazılardaki bloklar ekrana girerken kendini çiziyor.",
    items: [
      // 46f6e55d, 50dea34a
      { kind: "yeni", title: "Geri Sayım Manşette", body: "Açılışa kalan süre ana sayfanın en büyük öğesi oldu ve dört ana endeks hemen karşısında duruyor.", href: "/" },
      // b17cd01e, f048ed42, c8cf4434
      { kind: "iyilestirme", title: "Bugünün Akışı", body: "Günün olayları kısa satırlara ve ince bir seans hattına geçti; hat üzerindeki işaretlere dokunarak olaylar arasında gezilebiliyor.", href: "/" },
      // 91e641aa, c1e68cb7
      { kind: "yeni", title: "Hareket Dili", body: "Küçük grafikler kendini çiziyor, çubuklar doluyor, sekme çizgisi sayfadan sayfaya kayıyor; işletim sisteminde hareketi azaltan okurda hepsi sabit kalıyor." },
      // f17355a1
      { kind: "yeni", title: "Kendini Çizen Bloklar", body: "Rehber ve Mercek yazılarındaki sayı, çubuk ve zaman çizelgesi blokları okur onlara vardığında kuruluyor.", href: "/rehber" },
      // 33a74a58
      { kind: "yeni", title: "52 Hafta Bandında Fiyatın Yeri", body: "Hisse sayfasında iki ayrı satır yerine tek bir ray var ve fiyatın bandın neresinde durduğu bir bakışta görülüyor.", href: "/hisse/NVDA" },
      // 0763c2af
      { kind: "duzeltme", title: "Renk Körlüğünde Önem İşareti", body: "Takvimdeki önem noktaları artık yalnızca renkle değil, dolu daire, halka ve küçük nokta biçimiyle de ayrılıyor.", href: "/takvim" },
    ],
  },
  {
    date: "2026-09-03",
    title: "Yeni Ölçüler ve Veri Düzeltmeleri",
    summary: "Hisse sayfası hareketli ortalamalar ve birkaç yeni oran kazandı. Bazı hisselerde yanlış görünen ölçüler düzeltildi.",
    items: [
      // 30e562e1
      { kind: "yeni", title: "Hareketli Ortalamalar", body: "Hisse ve ETF sayfalarında 50, 100 ve 200 günlük ortalamalar ile fiyatın onlara göre yüzde uzaklığı görünüyor.", href: "/hisse/AAPL" },
      // 30e562e1, bcbb8afa
      { kind: "yeni", title: "İleri F/K, Net Kâr Marjı, Borç / Özsermaye", body: "Anahtar metrikler şirketin ne kadar kazandığını ve bilançosunun ne kadar borçlu olduğunu da söylüyor.", href: "/hisse/AAPL" },
      // 30e562e1
      { kind: "duzeltme", title: "BRK.B'nin Ölçüleri", body: "B sınıfı hissede A sınıfına ait F/K, hisse başına kâr ve 52 hafta bandı gösteriliyordu; bu ölçüler artık gizleniyor ve kart nedenini yazıyor." },
      // f0a8a0c9, b5261b0d
      { kind: "duzeltme", title: "Katılım Taraması Daha Dürüst", body: "Bir ölçüt hesaplanamadığında kart artık geçti demiyor, İnceleme Gerekir yazıp eksiğin ne olduğunu söylüyor." },
      // a9155584
      { kind: "duzeltme", title: "Grafikte Tek Fiyat", body: "Hisse grafiğinin kenarında başlıktaki fiyatla çelişen ikinci bir fiyat görünmüyor.", href: "/hisse/NVDA" },
      // f0a8a0c9
      { kind: "duzeltme", title: "Takvime Ekle", body: "Bir olayı takvime eklerken ekranda takılı kalan yükleniyor şeridi artık çıkmıyor.", href: "/takvim" },
    ],
  },
  /* ---- A2 ---- */
  {
    date: "2026-08-29",
    title: "Bilanço Kartları ve Takvim Dosyası",
    summary: "Bilanço takvimindeki kartlar şirketin büyüklüğünü yeniden gösteriyor, takvime eklenen dosyalar Türkçe harflerde bozulmuyor.",
    items: [
      // 3072294a
      { kind: "iyilestirme", title: "Mini Kartlarda Piyasa Değeri", body: "Bilanço takvimindeki her kartın dibinde şirketin piyasa değeri sabit bir satırda yazıyor, kartlar da aynı boyda kalıyor.", href: "/bilancolar" },
      // 4bb1c481, 9241fc5d
      { kind: "iyilestirme", title: "Okunur Öngörü Kartı", body: "Şirketin verdiği aralık, piyasanın beklentisi ve orta nokta artık üç ayrı işaretle çiziliyor, hangisinin ne olduğu karışmıyor." },
      // d1cff005
      { kind: "duzeltme", title: "Takvim Dosyasında Türkçe Harfler", body: "Takvimine eklediğin bilanço ve veri açıklamalarında ç, ğ, ş gibi harfler içeren satırlar artık bozulmuyor.", href: "/takvim" },
      // 2023eb0d
      { kind: "duzeltme", title: "Dengeli Ana Sayfa Kolonları", body: "Hangi kolon kısa kalırsa kalsın, boşluk o kolona eklenen satırlarla doluyor.", href: "/" },
      // 7665602b
      { kind: "iyilestirme", title: "Hesap Silme Ayrı Bölümde", body: "Hesabını silme düğmesi çıkış düğmesinin yanından kalktı, sayfanın en altında kendi bölümünde duruyor.", href: "/ayarlar" },
      // f13e77fe
      { kind: "duzeltme", title: "Daha Güvenli Giriş", body: "Giriş yaptıktan sonra yalnızca sitenin kendi sayfalarına yönlendiriliyorsun." },
    ],
  },
  {
    date: "2026-08-27",
    title: "Karşılaştırma Yeniden Kuruldu",
    summary: "Hisseleri yan yana koyduğun karşılaştırma ekranı baştan kuruldu ve menünün dışından da bulunur oldu. Telefonda yorucu ekranlar sadeleşti.",
    items: [
      // a2ec0769, c77c394b
      { kind: "yeni", title: "Karşılaştırma Ekranı", body: "Dört hisseye kadar getiriyi aynı grafikte izleyebiliyor, logolu hazır setlerden biriyle tek tıkla başlayabiliyorsun.", href: "/karsilastir" },
      // 2de57e07
      { kind: "iyilestirme", title: "Anında Değişen Aralık", body: "Karşılaştırmada aralığı değiştirdiğinde sayfa yeniden yüklenmiyor, yüzdeler hemen yenileniyor.", href: "/karsilastir/spy-qqq" },
      // 5f3eef0f
      { kind: "yeni", title: "Günün Hareketleri", body: "Ana sayfanın yan kolonunda günün en çok yükselen ve düşen hisseleri artık her seansta görünüyor.", href: "/" },
      // 0aaf8b14
      { kind: "iyilestirme", title: "Müfredat Gibi Rehber", body: "Rehber yazıları konu ve zorluk sırasıyla diziliyor, yazıların ara başlıklarına bağlantı verilebiliyor.", href: "/rehber" },
      // e404814d
      { kind: "iyilestirme", title: "Uzayan Favori Listesi", body: "Ana sayfadaki favori listesi yerine göre beş ile on satır arasında açılıyor, boş alan bırakmıyor.", href: "/" },
      // 51539515, 999c8eb2, 858b9516
      { kind: "iyilestirme", title: "Telefonda Sade Ekranlar", body: "Bilanço analizi başlığı, geçmiş bilanço tablosu ve analiz araması telefona sığacak şekilde sadeleşti.", href: "/bilancolar/analizler" },
    ],
  },
  {
    date: "2026-08-23",
    title: "Açılış Öncesi Ana Sayfada",
    summary: "Fiyatlar artık bütün borsaların toplamından geliyor; bu sayede açılış öncesi ve kapanış sonrası hareketler ilk kez ekranda. Mercek yazıları ana sayfanın üstüne çıktı.",
    items: [
      // 030ce0d8, d66cad43
      { kind: "yeni", title: "Açılış Öncesi ve Kapanış Sonrası", body: "Seans dışında ana sayfa, yalnızca o seansta gerçekten işlem gören hisselerin hareketini gösteriyor.", href: "/" },
      // c39a8cac, 0e3ec0f2
      { kind: "iyilestirme", title: "Mercek Sayfanın Başında", body: "En yeni Mercek yazısı günün özetinin hemen ardından, olayın fiyat eğrisiyle birlikte görünüyor.", href: "/mercek" },
      // c39a8cac
      { kind: "yeni", title: "Paylaş Düğmesi", body: "Mercek ve rehber yazılarını telefonun kendi paylaşım menüsüyle gönderebiliyorsun.", href: "/rehber/hisse-senedi" },
      // d66cad43
      { kind: "duzeltme", title: "Gerçek İşlem Hacmi", body: "Şirketler dizinindeki hacim artık tek bir borsanın değil bütün borsaların toplamı, hacme göre sıralama da doğru çıkıyor.", href: "/sirketler" },
      // 3ec62226
      { kind: "duzeltme", title: "Kendi Para Birimiyle", body: "TSM ve ASML gibi yurt dışı şirketlerin fiyat ve oranları dolar sanılmıyor, kendi para birimiyle yazılıyor.", href: "/hisse/TSM" },
      // 705629c9
      { kind: "duzeltme", title: "Tekrarsız Bilanço Takvimi", body: "Rapor tarihi değişen şirketler takvimde iki kez görünmüyor.", href: "/bilancolar" },
    ],
  },
  {
    date: "2026-08-16",
    title: "Tıklamanın Karşılığı Görünüyor",
    summary: "Favoriler, arama ve gezinme daha hızlı tepki veriyor. Telefonda metin keskinleşti, yasal metinlerin İngilizcesi geldi.",
    items: [
      // df4396a9
      { kind: "iyilestirme", title: "Anında Dolan Favori Kalbi", body: "Bir hisseyi favoriye eklediğinde kalp hemen doluyor, ikinci kez basıp yanlışlıkla geri çıkarmıyorsun.", href: "/favoriler" },
      // df4396a9
      { kind: "yeni", title: "Liste Adı ve Rengi", body: "Favori listelerinin adını ve rengini, listeyi silmeden değiştirebiliyorsun.", href: "/favoriler" },
      // f3b9abda
      { kind: "yeni", title: "Hisse Sayfasında Mercek", body: "Bir şirketin sayfasında o şirketi anlatan son Mercek yazıları listeleniyor.", href: "/hisse/NVDA" },
      // 1bc88c22
      { kind: "yeni", title: "Yasal Metinlerin İngilizcesi", body: "KVKK aydınlatma metni ve sorumluluk reddi İngilizce arayüzde kendi dilinde açılıyor.", href: "/kvkk" },
      // b2fca582, 562a57e0
      { kind: "duzeltme", title: "Telefonda Keskin Metin", body: "Üst çubuk ve sayfa geçişlerinde iPhone'da yumuşayan yazılar artık net görünüyor." },
      // 91504db9
      { kind: "iyilestirme", title: "Durdurulabilen Piyasa Şeridi", body: "Kendi kendine kayan piyasa şeridi, üstüne gelince ya da hareketi azaltma ayarı açıksa duruyor." },
    ],
  },
  {
    date: "2026-08-13",
    title: "İngilizce Kendi Adresinde",
    summary: "İngilizce sayfalar kendi adreslerine kavuştu ve paylaşılabilir oldu. Bilinmeyen değerler artık sıfır diye gösterilmiyor.",
    items: [
      // cedfcec3
      { kind: "yeni", title: "İngilizce Adresler", body: "Sitenin İngilizcesi /en ile başlayan kendi adreslerinde açılıyor; paylaştığın bağlantı karşı tarafta da aynı dilde görünüyor." },
      // 7553ec1a
      { kind: "duzeltme", title: "Bilinmeyen Sıfır Değil", body: "Önceki kapanış bilinmediğinde hisse yüzde sıfır değişmiş gibi gösterilmiyor, makro sayıların hangi aya ait olduğu da yazıyor." },
      // cd040563
      { kind: "duzeltme", title: "Her Ekranda Aynı Piyasa Değeri", body: "Bir şirketin piyasa değeri şirketler dizininde, hisse sayfasında ve karşılaştırmada aynı canlı hesapla yazılıyor.", href: "/sirketler" },
      // 601c5fd3
      { kind: "yeni", title: "Adla Seçilen Şirketler", body: "Yapay zekâ, uzay ve enerji altyapısında çok konuşulan küçük şirketler, piyasa değeri eşiğinin altında kalsa da bilanço takviminde görünüyor.", href: "/bilancolar" },
      // 1d23d6cb, e8b3ea38
      { kind: "iyilestirme", title: "Daha Okunur Renkler", body: "Açık temada soluk yazılar koyulaştı, koyu temada paneller ve kartlar birbirinden ayırt ediliyor." },
      // 53bf3e39, 778f60a4
      { kind: "iyilestirme", title: "Klavye ve Ekran Okuyucu", body: "Arama penceresi, sıralı tablolar ve form hataları klavyeyle gezenler ve ekran okuyucu kullananlar için düzgün çalışıyor." },
    ],
  },
  {
    date: "2026-08-12",
    title: "Tıklanabilir Gün Şeridi",
    summary: "Ana sayfadaki gün şeridinden doğrudan ilgili takvime geçebiliyorsun. Şirket logoları her yerde yükleniyor.",
    items: [
      // c97ef519
      { kind: "yeni", title: "Tıklanabilir Gün Şeridi", body: "Şeritteki bilanço kartı bilanço takvimine, veri kartı ekonomik takvime götürüyor.", href: "/" },
      // fb472170
      { kind: "duzeltme", title: "Eksiksiz Şirket Logoları", body: "686 şirketin logosu sitenin kendisinden sunuluyor, büyük şirketlerin kırık görünen logoları geri geldi." },
      // 0a9a4981, ffe29e37
      { kind: "iyilestirme", title: "Okunaklı Bilanço Takvimi", body: "Gün başlıkları kaydırırken üstte kalıyor, kartlarda gelir beklentisi büyük puntoyla öne çıkıyor.", href: "/bilancolar" },
      // 0a9a4981
      { kind: "iyilestirme", title: "Sakin Favori Satırları", body: "Fiyatlar aynı hizada duruyor, sıralama ve silme düğmeleri yalnızca satırın üstüne gelince çıkıyor.", href: "/favoriler" },
    ],
  },
  /* ---- A1 ---- */
  {
    date: "2026-08-09",
    title: "Rehber Büyüdü, Tarihler Takvimine Geçiyor",
    summary: "Rehbere altı yeni yazı geldi ve yazılar kolaydan zora sıralandı. Ekonomik veri ve bilanço tarihlerini artık kendi takvimine ekleyebiliyorsun.",
    items: [
      // 14f15a45, 1333bcd9
      { kind: "yeni", title: "Altı Yeni Rehber Yazısı", body: "Hedge, kısa sıkışma, bilanço günü, hisse geri alımı, getiri eğrisi ve sektör rotasyonu yazıları Türkçe ve İngilizce olarak eklendi.", href: "/rehber/hedge" },
      // 0c5028bf, 604ae04e
      { kind: "iyilestirme", title: "Zorluk Sırası", body: "Rehber yazıları her konunun içinde temelden ileriye doğru sıralanıyor, böylece nereden başlayacağını listeye bakarak görebiliyorsun.", href: "/rehber" },
      // 63a03d91, 37d7f1ad, ef2c7702
      { kind: "yeni", title: "Takvime Ekle", body: "Ekonomik veri ve bilanço tarihlerini tek dokunuşla telefonunun ya da bilgisayarının takvimine ekleyebiliyorsun; saat kendi saat diliminde görünüyor.", href: "/takvim" },
      // 63a03d91
      { kind: "yeni", title: "Arama Yazıları da Buluyor", body: "Arama kutusu artık yalnız hisseleri değil, rehber ve Mercek yazılarını da buluyor." },
      // 63a03d91
      { kind: "yeni", title: "RSS Akışı", body: "Yeni yazıları bir RSS okuyucusuyla takip edebilmen için sitenin akışı açıldı." },
      // 604ae04e, cc6209c2
      { kind: "yeni", title: "Analizde Değerleme Künyesi", body: "Bilanço analizlerinde F/K, hisse başı kâr ve net kâr marjı gösteriliyor; oran her gün güncel fiyattan yeniden hesaplanıyor." },
    ],
  },
  {
    date: "2026-08-08",
    title: "Takvim ve Listeler Daha Kolay Okunuyor",
    summary: "Takvim her verinin ne olduğunu anlatmaya başladı, listeler logo ve çubuklarla daha hızlı okunuyor. Paylaştığın bağlantı artık o sayfanın kendi kartıyla görünüyor.",
    items: [
      // 05be0a49
      { kind: "iyilestirme", title: "Takvimde Olay Açıklamaları", body: "Takvimdeki her satır, TÜFE ya da istihdam raporu gibi verinin ne anlattığını kısa bir cümleyle söylüyor.", href: "/takvim" },
      // c203ac14
      { kind: "iyilestirme", title: "Kaç Gün Kaldı", body: "Takvimde her günün başlığında “Bugün”, “Yarın” ya da “4 gün sonra” yazıyor; açıklanmamış verinin satırı boş tirelerle dolmuyor.", href: "/takvim" },
      // 4546594f
      { kind: "iyilestirme", title: "Endeks Bileşenlerinde Çubuk", body: "Endeks bileşenleri tablosunda her şirketin logosu ve günlük değişimini gösteren bir çubuk var; kimin ne kadar oynadığı bir bakışta okunuyor.", href: "/piyasalar" },
      // 987eb2c9
      { kind: "iyilestirme", title: "Logolu Favoriler", body: "Favoriler listesi de diğer listeler gibi şirket logolarıyla geliyor.", href: "/favoriler" },
      // 1a67d95f
      { kind: "yeni", title: "Ana Sayfada Son Analizler", body: "Ana sayfada son bilanço analizleri ve son Mercek yazıları, tıklamadan önce ne bulacağını gösterecek şekilde listeleniyor.", href: "/" },
      // b27d7902
      { kind: "yeni", title: "Sayfaya Özel Paylaşım Kartları", body: "Bir hisseyi, analizi ya da yazıyı WhatsApp'ta paylaştığında o sayfanın kendi başlığı ve görseli çıkıyor." },
    ],
  },
  {
    date: "2026-08-07",
    title: "Bilanço Analizleri Geldi",
    summary: "Açıklanan çeyrekler artık okunmuş hâliyle sitede: görüş, skor, güçlü yönler ve riskler. Bilançolar ekranı sekmelere ayrıldı.",
    items: [
      // 58c69607
      { kind: "yeni", title: "Bilanço Analizleri", body: "Büyük şirketlerin açıklanan çeyreği görüş, skor, güçlü yönler, riskler ve beklenen gelişmelerle tek sayfada okunuyor.", href: "/bilancolar/analizler" },
      // 58c69607
      { kind: "yeni", title: "Takvimde Analiz Rozeti", body: "Analizi yazılmış bir bilanço, takvim satırında ve Bugün ekranında görüş ve skor rozetiyle işaretleniyor.", href: "/bilancolar" },
      // f26f039a
      { kind: "yeni", title: "Hisse Sayfasında Analizler", body: "Analizi olan şirketin sayfasında, geçmiş bilançolar tablosunun hemen üstünde o şirketin analizleri listeleniyor." },
      // 6e4db02b
      { kind: "iyilestirme", title: "Önce Rakamlar", body: "Analiz sayfası paragraflarla değil, metrik kartları, çeyreklik gelir grafiği ve öngörü aralıklarıyla açılıyor." },
      // 58c69607
      { kind: "duzeltme", title: "Büyük Bilanço Üstte", body: "Bugün ekranındaki bilanço listesi piyasa değerine göre sıralanıyor; günün en büyük bilançosu artık aşağıda kalmıyor.", href: "/" },
      // 62d32397
      { kind: "iyilestirme", title: "Yeni Yazı Karakteri", body: "Site Schibsted Grotesk'e geçti ve metinler bir punto büyüdü." },
    ],
  },
  {
    date: "2026-08-05",
    title: "Türkiye Saati Önce, Mercek ve Rehber İki Dilde",
    summary: "Saatler artık önce Türkiye saatiyle yazılıyor. Mercek yeni görünümüne kavuştu, Mercek ve Rehber İngilizce de okunabiliyor.",
    items: [
      // ef29f95f
      { kind: "iyilestirme", title: "Önce Türkiye Saati", body: "Türkçe okurken birincil saat İstanbul, ikincisi New York; ABD'nin yaz saati farkı her gün yeniden hesaplanıyor.", href: "/takvim" },
      // ef29f95f
      { kind: "iyilestirme", title: "Günlük ve Haftalık Özet Yan Yana", body: "Ana sayfadaki özet kartında günlük ve haftalık bülten arasında sekmeyle geçebiliyorsun; kart gün içinde boş kalmıyor, en son yazılan özeti gösteriyor.", href: "/" },
      // f26eb749, cb1a0f63, 8d038c62
      { kind: "yeni", title: "Mercek'in Yeni Görünümü", body: "Yazılar, konu şirketlerin logolarını ve olaydan bugüne getirilerini gösteren kartlarla listeleniyor; arşiv sembole göre süzülebiliyor.", href: "/mercek" },
      // f26eb749
      { kind: "yeni", title: "Üç Yeni Yazı Bloğu", body: "Yazılarda pazar payı dağılımı, adım adım süreç ve önce/sonra karşılaştırması metinden çizilen bloklarla gösteriliyor.", href: "/mercek" },
      // 82bb6db3, 32d8e85c
      { kind: "yeni", title: "İngilizce Mercek ve Rehber", body: "Rehberin 21 yazısı İngilizceye çevrildi; çevirisi olmayan Mercek yazısı ve bülten, boş kalmak yerine orijinal Türkçesiyle ve bir rozetle gösteriliyor.", href: "/rehber" },
      // 82bb6db3
      { kind: "yeni", title: "Dört Yeni Rehber Yazısı", body: "Halka arz, opsiyonlar, nakit akışı ve istihdam yazıları eklendi; yazı sonunda önceki ve sıradaki yazıya geçebiliyorsun.", href: "/rehber/opsiyonlar" },
    ],
  },
  {
    date: "2026-08-02",
    title: "Rehber, Mercek ve Karşılaştırma",
    summary: "Açılışın ertesi günü okuma bölümleri geldi: kavramları anlatan Rehber ve tek bir piyasa olayını derinlemesine anlatan Mercek. Hisseleri yan yana koyan karşılaştırma ekranı da aynı gün açıldı.",
    items: [
      // d23984c1, 5c07e693
      { kind: "yeni", title: "Rehber", body: "Hisse senedinden getiri eğrisine kadar temel kavramları anlatan yazılar sekizle başladı, aynı gün dört konu bloğunda 21 yazıya çıktı.", href: "/rehber" },
      // d23984c1, 9247c45f, 34b1e042
      { kind: "yeni", title: "Mercek", body: "Tek bir piyasa olayını rakamlar, zaman çizelgesi ve karşılaştırma çubuklarıyla anlatan uzun yazılar.", href: "/mercek" },
      // 7132a3a0, 40a9aff6
      { kind: "yeni", title: "Karşılaştırma Ekranı", body: "İki ile dört hisseyi aynı başlangıç noktasından çizip getirilerini ve temel ölçülerini tek tabloda yan yana gösteriyor.", href: "/karsilastir/nvda-amd" },
      // 0dc71e44
      { kind: "yeni", title: "Halka Arz Takvimi", body: "Önümüzdeki altı haftada borsaya gelecek şirketler, fiyatlanıp fiyatlanmadıkları da yazılı olarak takvimde.", href: "/takvim" },
      // 4fb1b34d
      { kind: "yeni", title: "Korku Endeksi", body: "Piyasanın önümüzdeki 30 gün için beklediği oynaklığı ölçen VIX, ne anlattığını söyleyen bir ölçekle piyasalar ekranında.", href: "/piyasalar" },
      // 5c07e693
      { kind: "yeni", title: "Gizlilik ve Hesap Silme", body: "Hangi verinin toplanıp hangisinin bilerek toplanmadığı ayrı bir sayfada anlatılıyor; hesabını Ayarlar'dan silebiliyorsun.", href: "/kvkk" },
    ],
  },
  {
    date: "2026-08-01",
    title: "Açılış Zili Yayında",
    summary: "Türkiye'den ABD borsasını takip edenler için ilk sürüm yayına girdi: günün takvimi, canlı fiyatlar, şirket sayfaları ve günlük bülten.",
    items: [
      // e800df71, fad87b6c
      { kind: "yeni", title: "Bugün Ekranı", body: "Açılışa kalan süre, endeksler ve günün ekonomik verileriyle bilançoları tek ekranda.", href: "/" },
      // e800df71
      { kind: "yeni", title: "Ekonomik Takvim", body: "Fed toplantıları, enflasyon ve istihdam gibi piyasayı oynatan veriler tarihleriyle bir arada.", href: "/takvim" },
      // e800df71, d2c38bba
      { kind: "yeni", title: "Bilanço Takvimi", body: "Hangi şirketin ne zaman bilanço açıklayacağı ve beklentiler sıralanabilir bir listede.", href: "/bilancolar" },
      // 21b8cf79, f59c37e3
      { kind: "yeni", title: "Şirket Sayfaları", body: "S&P 500, Nasdaq-100 ve Dow'daki 516 şirketin her biri için elle yazılmış tanıtım, canlı piyasa değeri ve aynı alt sektördeki şirketler.", href: "/hisse/NVDA" },
      // 21b8cf79, c9d3482d
      { kind: "yeni", title: "Dünya Piyasaları ve Tahviller", body: "Japonya, Güney Kore, Türkiye, Çin ve Almanya ülke fonlarıyla, ABD tahvil faizleri 2, 5, 10 ve 30 yıllık vadeleriyle izleniyor.", href: "/piyasalar" },
      // 23174e78
      { kind: "yeni", title: "Günlük ve Haftalık Bülten", body: "Piyasanın günü ve haftası kısa bir özetle yazılıyor; geçmiş bültenler tarih arşivinde.", href: "/bulten" },
    ],
  },
] as const satisfies readonly SourceEntry[];

export const CHANGELOG_EN: Translation<typeof CHANGELOG_TR> = [
  /* ---- 24-25 Ekim ---- */
  {
    date: "2026-10-25",
    title: "Claude on the Page, Something New Every Day",
    summary:
      "Claude now works inside the screener, the stock page and your watchlist, using only the page's own data. Company earnings pages and a poster, chart and puzzle that renew every session arrived with this release.",
    items: [
      { title: "Screen With a Sentence", body: "Type a sentence like “profitable chipmakers with little debt” into the screener and Claude turns it into filters; the page's own filters, not Claude, pick the stocks." },
      { title: "Ask About This Stock", body: "Claude answers your question on a stock page using only that page's data; when the data is not enough it says so, and it never tells you to buy or sell." },
      { title: "My Watchlist Today", body: "A short note sums up your watchlist's last session: the biggest movers, how they did against the S&P 500 and which ones report within seven days." },
      { title: "Portfolio Analysis", body: "See your portfolio's sector mix next to the S&P 500, how concentrated it is, its volatility over the past year and its deepest drawdown on one screen." },
      { title: "Company Earnings Page", body: "Each company's next report date and time has its own page; members can vote in “Will It Beat?” and track their hit rate through the year." },
      { title: "Earnings Story Cards", body: "A scored earnings analysis can also be read as a five-card story, and every card has an image sized for phones and link previews." },
      { title: "The Day's Poster", body: "Every completed session is drawn as a single scene: each dot an S&P 500 stock, eleven sectors ranked from strongest to weakest, with past sessions in the archive." },
      { title: "Closing Line and Bell Sound", body: "After the close, the bell on the home page shows how many stocks rose and fell that day; you can also turn on a bell sound in Settings." },
      { title: "Chart of the Day", body: "Every trading day brings one chart and a hundred-word note, with earlier days kept in the archive." },
      { title: "Guess the Stock", body: "One hidden stock a day and six guesses; every miss opens a new clue such as the price silhouette, the sector or the market cap." },
      { title: "Broker Comparison", body: "Commission, custody fees and fractional shares at eight brokers that sell US stocks to residents of Türkiye, in one table with every cell linked to the broker's official fee schedule." },
      { title: "Two New Guides", body: "The Capital Markets Board decision that ends banks' role in foreign share orders, and the tax gap between Irish and US ETFs, explained from primary sources." },
      { title: "Share Cards That Carry Data", body: "A shared stock card now shows the past month's closing line and which session the price belongs to, and a Close-Up card shows the article's first figures." },
      { title: "Telegram Channel", body: "The day's summary before the open, the session's result after the close and new Close-Up articles post to the Telegram channel on their own." },
      { title: "Close-Up Bars", body: "Bar blocks with minus signs or units no longer draw empty; when units are mixed, the values are listed without bars." },
    ],
  },
  /* ---- C ---- */
  {
    date: "2026-10-22",
    title: "Earlier Days and Blue Waiting Films",
    summary: "Today's Flow no longer looks only at today, and the waiting films moved to the site's blue palette. A round of fixes shipped alongside.",
    items: [
      { title: "Previous and Next Days", body: "Arrows in the home page flow step to the previous or next trading day, so you can see how yesterday's earnings turned out." },
      { title: "Blue Waiting Films", body: "The short films that play while a Claude analysis or a move note is being written now use the site's blue palette, and stay light in the light theme." },
      { title: "No English Headlines Left", body: "Headlines still untranslated on screen are now translated into Turkish right after the page opens." },
      { title: "Links on English Pages", body: "Links on English pages no longer drop you onto the Turkish version." },
      { title: "Security and Session Fixes", body: "Findings from a broad security review were closed, and readers whose password changed on another device no longer get stuck at sign-in." },
    ],
  },
  {
    date: "2026-10-18",
    title: "More Claude Notes, Eight Screens Redrawn",
    summary: "Claude's short notes now cover upcoming earnings, economic data, comparisons and your portfolio. Eight screens, from Markets to Tax, were rebuilt with a lighter chart style.",
    items: [
      { title: "Earnings Preview", body: "A company reporting within ten days gets a note summarising expectations, the last four quarters' surprises and the topics in the news." },
      { title: "Latest Releases", body: "The calendar shows the past ten days' key economic releases with actual, forecast and previous values, plus a short Claude note on what they said." },
      { title: "Claude Comparison Note", body: "Stocks you compare get a short summary of who moved how much, where they stand against the S&P 500 and how their fundamentals differ." },
      { title: "A Short Reading of Your Portfolio", body: "The portfolio screen has a note on where your weight sits, which positions carried the last five sessions and who reports soon." },
      { title: "Eight Screens Redrawn", body: "Markets, Earnings, Close-Up, Calendar, Tax, Famous Investors, the earnings detail and Technicals were reworked with simpler, thinner charts." },
      { title: "My Analyses as Cards", body: "My Analyses now shows your own posts first, then your Claude reports, as readable cards." },
    ],
  },
  {
    date: "2026-10-17",
    title: "Claude on the Stock Page and a Sunday Digest",
    summary: "Stock pages now explain the week's move and the latest report in short notes. Every Sunday morning members get the week's digest by email.",
    items: [
      { title: "Why It Moved This Week", body: "The stock page explains the last five sessions against the S&P 500 and the company's news that week, and says so plainly when the news gives no reason." },
      { title: "Earnings Note", body: "A company that reported in the last ten days shows expected versus actual bars, the first session's reaction and a short note." },
      { title: "Today's Agenda and News Notes", body: "The news page groups the day's and the week's key stories under topics, and each story page explains what it means in plain words." },
      { title: "Sunday Digest Email", body: "Every Sunday morning the past week's summary and the new week's calendar arrive by email; turn it off in Settings or from the link in the email." },
      { title: "Alert Emails", body: "If you like, a triggered price alert also sends an email to your confirmed address." },
      { title: "Day Range Strip", body: "Each index card on Markets has a thin strip showing where the price sits between the day's low and high." },
    ],
  },
  {
    date: "2026-10-16",
    title: "Screener, Community and Notifications",
    summary: "A screener that filters stocks by fundamentals, a community where members can write, and a single inbox for every alert all opened.",
    items: [
      { title: "Stock Screener", body: "Filter and sort index companies by sector, ready-made screens and fundamentals such as P/E." },
      { title: "Community Posts", body: "Write your own piece with Close-Up's visual blocks or start from a template; posts are published in Community after review." },
      { title: "Public Profile", body: "If you choose, open a profile in Settings and share your portfolio's return without amounts, next to what the same money in SPY on the same days would have done; profiles are hidden by default." },
      { title: "Bell Report", body: "A personal summary that unfolds as you scroll: the stocks you followed, the alerts that fired and how your portfolio did." },
      { title: "Notification Inbox and Percent Alerts", body: "Daily percent-change alerts and an “earnings tomorrow” reminder join price alerts, all gathered in one inbox behind the bell in the header." },
      { title: "Password Change Signs Out Other Devices", body: "Changing or resetting your password now closes open sessions on your other devices." },
    ],
  },
  {
    date: "2026-10-15",
    title: "Session Bell and Today's Flow",
    summary: "The home page gained a bell machine that tells the day's sessions and a timeline that reads the same everywhere. The bell in the hero can now be rung.",
    items: [
      { title: "Session Bell", body: "The bell machine on the home page shows the day's sessions; tap a session to play it, or use “Play the Day” to run through the whole day." },
      { title: "Today's Flow Timeline", body: "The day's earnings and releases sit on one timeline at every width; the next event opens on its own and the others expand in place." },
      { title: "Ring the Bell", body: "Press the bell on the home page to ring it; it also rings by itself when the countdown reaches zero." },
      { title: "Time Left in the Tab", body: "When the site sits in a background tab, the tab title shows the time left to the open or the close." },
      { title: "Unreadable Calendar Is Not Empty", body: "When data can't be read, the home page now says so instead of claiming there are no earnings today." },
      { title: "More Accessible Screens", body: "Deleting a list is confirmed in the list's own header, and contrast and touch targets were fixed for screen readers and small screens." },
    ],
  },
  {
    date: "2026-10-12",
    title: "Company Analysis With Claude",
    summary: "A new page lets you have Claude write a technical or company-focused report on a stock. Stock Screening and the stock page also gained explanatory figures.",
    items: [
      { title: "Company Analysis Page", body: "Members with access can have Claude write a 1-2 week technical or a 3-6 month company-focused report; reports read visually with a price map and scenarios, and anyone can read them." },
      { title: "Saved Reports", body: "Reports you request collect on My Analyses, and the stock page lists the latest ones." },
      { title: "Rule Bench", body: "In the Stock Screening report the stock moves through a seven-station bench, and each rule lights up as passed, caution or failed." },
      { title: "Expected Move Figure", body: "The stock page puts the options-implied band and the moves after past reports on one axis, with a count of how often the band was broken." },
      { title: "Suggestions as You Type", body: "The Stock Screening field suggests symbols as you type a company name; typing “mu” finds Micron." },
      { title: "Analysis Tools Together", body: "Technicals, Stock Screening and Compare now sit in their own group at the top of the menu." },
    ],
  },
  {
    date: "2026-10-10",
    title: "Price Alerts and Account Tools",
    summary: "Set a target price and get notified, record sales in your portfolio and reset a forgotten password. Live figures now change with their direction.",
    items: [
      { title: "Price Alerts", body: "Set a target price with the bell button on a stock page; all your alerts are listed in Watchlist with how close each one is." },
      { title: "Browser Notifications", body: "On a device you turn on in Settings, alerts arrive as browser notifications even when the site is closed." },
      { title: "Sales in the Portfolio", body: "Sales come out of your oldest purchases first, and realised gains or losses appear in dollars and lira, year by year." },
      { title: "Change and Reset Your Password", body: "Change your password in Settings, or reset it with a one-time link sent to your email if you forgot it." },
      { title: "Figures That Roll With Direction", body: "When prices update during the session only the changed digits roll: up on a rise, down on a fall." },
      { title: "Companies on Story Pages", body: "News pages show the companies in the story with their logos under the headline, and their day's price line further down." },
    ],
  },
  {
    date: "2026-10-04",
    title: "Real-Time Prices and Stock Screening",
    summary: "Prices no longer run 15 minutes behind during the session. A Stock Screening screen that tests a stock against rules opened, and the portfolio met the technical plan.",
    items: [
      { title: "Real-Time Prices in Session", body: "During the regular session the price comes from the real-time feed and the intraday chart is live; stale prices from the cache are blocked." },
      { title: "Stock Screening", body: "Test a stock against 22 fixed rules on growth, profitability, financial health and ownership, and see what needs attention first." },
      { title: "The Moment a Report Lands", body: "Today's Flow says “Reported” the minute a company files its results with the SEC, with a link to the filing." },
      { title: "Technical Plan in the Portfolio", body: "For holdings covered by the technical analysis, the entry zone, targets and stop are shown against your cost and the current price." },
      { title: "What Funds Hold", body: "ETF pages such as SPY, QQQ, the sector funds and AI funds show their largest positions and weights." },
      { title: "Share From Every Screen", body: "Share screens such as famous investors, themes, stocks, comparisons and briefs with a link." },
    ],
  },
  {
    date: "2026-09-29",
    title: "Weekly Earnings Board and Glossary",
    summary: "Earnings gained a tab for the whole week, and the site gained a glossary that opens in place. The home page shows sectors and themes every day.",
    items: [
      { title: "Weekly Earnings Board", body: "This week's most anticipated reports and the full day-by-day list, with estimates and actuals, on one page." },
      { title: "Glossary", body: "150 investing terms on illustrated cards; tap a term and its definition opens without leaving the page." },
      { title: "Sectors and Themes Band", body: "The home page shows the day's sector moves and the strongest and weakest themes in one band." },
      { title: "Market Pulse and Macro Summary", body: "Markets gets a market pulse with every component visible, and Macro puts all 11 indicators in a summary grid at the top." },
      { title: "Company Card", body: "Hover a company logo to open a card with its name, sector, market cap, price and a change labelled with its session." },
      { title: "Session Status on Every Screen", body: "Under the logo, every page says whether the market is open and how long until the next bell." },
    ],
  },
  {
    date: "2026-09-28",
    title: "Tax, Portfolio and Famous Investors",
    summary: "Readers buying US stocks from Türkiye got a tax calculator, a portfolio with a lira view and new guides. Famous investors' portfolios are now on the site too.",
    items: [
      { title: "Foreign Stock Tax Calculator", body: "Enter your trades or upload Midas and IBKR statements to work out your tax base; files are read only in your browser." },
      { title: "Portfolio With a Lira View", body: "Save your positions and see profit and loss in dollars and lira, with cost converted at the purchase day's rate." },
      { title: "Famous Investors", body: "From Buffett to Pelosi, famous investors' portfolios from their SEC filings and what they bought and sold in the quarter; Cathie Wood's page also shows ARK funds' daily trades." },
      { title: "Themes and Compare Pairs", body: "Ten thematic lists such as AI and semiconductors, plus twenty ready-made comparison pairs." },
      { title: "A Deeper Stock Page", body: "Stock pages gained insider transactions, the expected move before earnings, a sector scorecard and a dividend panel." },
      { title: "Investing From Türkiye", body: "Fourteen new guide articles on buying US stocks, brokers, W-8BEN and foreign stock tax, plus one on what the technical views mean." },
    ],
  },
  {
    date: "2026-09-27",
    title: "Moving Transitions and a Heatmap",
    summary: "Page changes and waits are now told with short ink scenes. Markets gained a logo heatmap, and search got a more accurate order.",
    items: [
      { title: "Waiting Scenes by Destination", body: "The loading card plays a short scene based on where you are going: a magnifier for Close-Up, scales for earnings." },
      { title: "Logo Flight", body: "Tap a stock card and the company logo flies to its place in the new page's header." },
      { title: "New Sign-In and Sign-Up", body: "The sign-in and sign-up pages were redrawn in the site's ink style with a form that builds itself." },
      { title: "Logo Heatmap", body: "Markets shows the index's 30 largest companies as logo tiles with their daily change." },
      { title: "More Accurate Search", body: "Search puts the exact symbol first, then company names; results carry logos and your recent searches are remembered." },
      { title: "Profile Icons", body: "Pick one of twelve icons drawn for the site as your profile icon in Settings." },
    ],
  },
  /* ---- B ---- */
  {
    date: "2026-09-24",
    title: "A New Bell and Small Touches",
    summary: "The brand mark was redrawn, and the site gained brush-drawn bell scenes on first load and on empty screens. Every newsletter issue now has its own address.",
    items: [
      { title: "The Classic Ceremony Bell", body: "The brand mark became a white bell on a tile that fades from light blue to midnight blue; the browser tab icon and share cards carry the same mark." },
      { title: "Ink Scenes", body: "On your first visit and in empty lists, the bell is drawn with a brush and comes to life; readers who reduce motion see only the final frame." },
      { title: "The Bell Rings at the Open", body: "When the countdown on the home page reaches zero, the digits turn the brand color and a bell rings beside them." },
      { title: "Appearance in Settings", body: "Theme and language can now be chosen on the Settings page too; the new theme opens in a circle that grows from where you clicked." },
      { title: "An Address for Every Issue", body: "Every daily and weekly newsletter issue opens at its own permanent address, which makes sharing a single issue easy." },
      { title: "Reading the Stock Chart", body: "While you move across the chart, the live price in the header stays put and the reading appears in a small label next to the point; the profile card also shows the company's rank in the directory." },
    ],
  },
  {
    date: "2026-09-23",
    title: "Reading Pages and the Calendar, Renewed",
    summary: "Close-Up and Guide articles moved to a single, comfortable reading column. You can now pick a day on the calendar and search the whole company directory.",
    items: [
      { title: "An Editorial Layout for Close-Up", body: "Articles sit in a single column with larger type, alongside a numbered table of contents and the move since the event for every company mentioned." },
      { title: "The Guide at the Same Measure", body: "Guide articles moved to the same reading layout as Close-Up, with links to each section next to the cover." },
      { title: "Pick a Day on the Calendar", body: "Tap a day on the strip and the agenda shows only that day; no more scrolling back up to look at another one." },
      { title: "Search in Companies", body: "Searching by name or symbol on the Companies page now covers the whole selected sector, not just the first rows." },
      { title: "Bonds and the Fear Gauge Up Top", body: "On the Markets page, four Treasury yields, the yield curve and the VIX now sit in one strip under the cover instead of at the bottom of the page." },
      { title: "Rating Mix in Earnings Analyses", body: "The cover of the analyses list shows how many of the filtered reports say Buy, Hold or Sell, and upcoming earnings are listed in date order." },
    ],
  },
  {
    date: "2026-09-19",
    title: "Technicals Grew",
    summary: "Three stocks joined the technicals list, and the indicators started explaining what they mean. The stock page now shows the day's technical view as well.",
    items: [
      { title: "AMD, INTC and PLTR", body: "Three stocks joined the technicals list; until their first edition they show as Awaiting Edition." },
      { title: "Indicators Explain Themselves", body: "RSI, MACD, ATR, pivots and the rest each carry a short note on what they mean." },
      { title: "A Technicals Card on the Stock Page", body: "For stocks with a technical analysis, the view, where the price sits against the plan and the first line of the reasoning appear at the top." },
      { title: "A Late Session Edition", body: "Technical analysis started publishing three times a day, and the page also shows when the next edition is due." },
      { title: "Share and Other Stocks", body: "The technical analysis page got a share button, and cards at the bottom take you to the other stocks on the list in one tap." },
      { title: "Scale Bars in Compare", body: "A thin bar under every number in the comparison table lets you see which one is bigger without reading the digits." },
    ],
  },
  {
    date: "2026-09-18",
    title: "More Accurate Prices, a Friendlier Phone",
    summary: "Bugs that made old data look like today's were fixed. Hidden buttons, jumping pages and hard-to-read text on phones were cleaned up.",
    items: [
      { title: "Old Data No Longer Looks Current", body: "The previous day's prices and percentages are no longer shown as in-session, and the price in the header matches the last point on the chart." },
      { title: "Events Say What They Are", body: "In Today's Flow, Fed decisions name the Fed and earnings rows name the company, and each event type comes with a one-line explanation." },
      { title: "Every Chart Range", body: "On phones, the 1Y and 5Y buttons that sat off screen now show under the stock chart." },
      { title: "More to Scroll", body: "Sideways-scrolling strips fade at the edge, so on a phone too you can tell there is more content to the right." },
      { title: "Less Page Jumping", body: "The page no longer shifts up and down as fonts load or content arrives, for the most part." },
      { title: "Readability and Touch", body: "Faint text on colored backgrounds got darker, and small buttons that fingers kept missing on phones got bigger." },
    ],
  },
  {
    date: "2026-09-13",
    title: "Technical Analysis Opens",
    summary: "A technical analysis page, refreshed every trading day for selected stocks, went live. The desktop header shrank to a single strip, where technicals got their own tab.",
    items: [
      { title: "Technical Analysis", body: "For twelve stocks, a Buy, Hold or Sell view, buy zone, targets, stop, support and resistance are updated every trading day; indicators are computed from the site's own data." },
      { title: "Where to Buy, Where to Walk Away", body: "The plan strip answers those questions directly, and the price map shows the levels on an axis proportional to price." },
      { title: "View Breakdown", body: "The top of the technicals list shows how many stocks say Buy, Hold or Sell, and the list can be filtered by view." },
      { title: "A Single-Strip Header", body: "The desktop header got simpler: the main tabs sit on one line and the other pages live in the More menu." },
      { title: "Valuation Cards", body: "The fundamentals on the stock page were split into four compact cards, and the distance to the moving averages reads on a single axis." },
    ],
  },
  {
    date: "2026-09-08",
    title: "A New Home Page and Motion",
    summary: "At the top of the home page, the countdown to the open became a large headline. Charts and article blocks now draw themselves as they come into view.",
    items: [
      { title: "The Countdown as the Headline", body: "The time left to the open became the largest element on the home page, with the four main indices right across from it." },
      { title: "Today's Flow", body: "The day's events moved to short rows and a thin session line; tap the markers on the line to move between events." },
      { title: "A Motion Language", body: "Small charts draw themselves, bars fill and the tab underline slides from page to page; for readers who reduce motion in their system settings, everything stays still." },
      { title: "Blocks That Draw Themselves", body: "Number, bar and timeline blocks in Guide and Close-Up articles build up as the reader reaches them." },
      { title: "Where the Price Sits in the 52-Week Range", body: "Instead of two separate rows, the stock page shows one rail, so you can see at a glance where the price sits in its range." },
      { title: "Impact Dots for Color Blindness", body: "Importance dots on the calendar are now told apart by shape too (filled circle, ring and small dot), not just by color." },
    ],
  },
  {
    date: "2026-09-03",
    title: "New Measures and Data Fixes",
    summary: "The stock page gained moving averages and a few new ratios. Measures that showed up wrong for some stocks were fixed.",
    items: [
      { title: "Moving Averages", body: "Stock and ETF pages show the 50, 100 and 200-day averages and how far the price is from each, in percent." },
      { title: "Forward P/E, Net Margin, Debt to Equity", body: "Key metrics now also tell you how much a company earns and how much debt its balance sheet carries." },
      { title: "BRK.B's Measures", body: "The B share was showing the A share's P/E, earnings per share and 52-week range; those measures are now hidden and the card says why." },
      { title: "A More Honest Sharia Screening", body: "When a criterion cannot be computed, the card no longer says it passes; it says Needs Review and names what is missing." },
      { title: "One Price on the Chart", body: "The edge of the stock chart no longer shows a second price that contradicts the one in the header." },
      { title: "Add to Calendar", body: "Adding an event to your calendar no longer leaves a stuck loading bar on screen." },
    ],
  },
  /* ---- A2 ---- */
  {
    date: "2026-08-29",
    title: "Earnings Cards and Calendar Files",
    summary: "Earnings calendar cards show company size again, and calendar files no longer break on Turkish characters.",
    items: [
      { title: "Market Cap on Mini Cards", body: "Every card in the earnings calendar shows the company's market cap on a fixed bottom line, and the cards stay the same height." },
      { title: "Readable Guidance Card", body: "The company's range, the market's expectation and the midpoint are now drawn with three distinct marks, so they no longer blur together." },
      { title: "Turkish Characters in Calendar Files", body: "Earnings and data releases you add to your calendar no longer break on lines with letters like ç, ğ or ş." },
      { title: "Balanced Home Columns", body: "Whichever column runs short, the gap now fills with extra rows in that column." },
      { title: "Account Deletion in Its Own Section", body: "The delete account button moved away from sign out and now sits in its own section at the bottom of the page." },
      { title: "Safer Sign-In", body: "After signing in, you are only ever sent back to pages on this site." },
    ],
  },
  {
    date: "2026-08-27",
    title: "Compare, Rebuilt",
    summary: "The screen for putting stocks side by side was rebuilt and can now be reached from outside the menu. Busy screens got simpler on phones.",
    items: [
      { title: "Compare Screen", body: "Track the returns of up to four stocks on one chart, or start with a single tap from a preset set shown with its logos." },
      { title: "Instant Range Switching", body: "Changing the range on Compare no longer reloads the page; the percentages update right away." },
      { title: "Movers of the Day", body: "The home sidebar now shows the day's biggest gainers and losers in every session." },
      { title: "Guide as a Curriculum", body: "Guide articles are ordered by topic and difficulty, and you can link straight to a section heading." },
      { title: "Watchlist That Fills the Gap", body: "The watchlist on the home page opens between five and ten rows depending on the space, leaving no empty area." },
      { title: "Simpler Screens on Phones", body: "The earnings analysis header, past earnings table and analysis search were trimmed to fit a phone." },
    ],
  },
  {
    date: "2026-08-23",
    title: "Pre-Market on the Home Page",
    summary: "Prices now come from all exchanges combined, which puts pre-market and after-hours moves on screen for the first time. Close-Up pieces moved to the top of the home page.",
    items: [
      { title: "Pre-Market and After-Hours", body: "Outside the regular session, the home page shows moves only for stocks that actually traded in that session." },
      { title: "Close-Up at the Top", body: "The latest Close-Up piece now sits right after the daily summary, with the price curve around the event." },
      { title: "Share Button", body: "Send Close-Up and Guide articles through your phone's own share menu." },
      { title: "Real Trading Volume", body: "Volume in the company directory is now the total across all exchanges, not a single one, so sorting by volume is right." },
      { title: "In Their Own Currency", body: "Prices and ratios for foreign companies like TSM and ASML are no longer shown as dollars; they use their own currency." },
      { title: "No Duplicates in the Earnings Calendar", body: "Companies whose report date changed no longer appear twice in the calendar." },
    ],
  },
  {
    date: "2026-08-16",
    title: "Every Click Shows a Result",
    summary: "Watchlists, search and navigation respond faster. Text got sharper on phones, and the legal pages are now in English too.",
    items: [
      { title: "Instant Watchlist Heart", body: "When you add a stock to your watchlist the heart fills right away, so you don't tap again and remove it by mistake." },
      { title: "List Name and Color", body: "Rename your watchlists or change their color without deleting them." },
      { title: "Close-Up on Stock Pages", body: "A company's page lists the latest Close-Up pieces about that company." },
      { title: "Legal Pages in English", body: "The privacy notice and disclaimer open in English when you browse in English." },
      { title: "Sharp Text on Phones", body: "Text that looked soft on iPhone in the top bar and during page transitions is now crisp." },
      { title: "Pausable Market Ticker", body: "The self-scrolling market ticker stops when you hover over it, or entirely if you prefer reduced motion." },
    ],
  },
  {
    date: "2026-08-13",
    title: "English Gets Its Own Address",
    summary: "English pages now have their own shareable addresses. Unknown values are no longer shown as zero.",
    items: [
      { title: "English Addresses", body: "The English site lives at its own addresses starting with /en, so a link you share opens in the same language for others." },
      { title: "Unknown Is Not Zero", body: "When the previous close is unknown, a stock no longer looks unchanged at 0%, and macro figures say which month they belong to." },
      { title: "Same Market Cap Everywhere", body: "A company's market cap is computed live the same way in the directory, on the stock page and in Compare." },
      { title: "Hand-Picked Companies", body: "Much-discussed smaller names in AI, space and energy infrastructure show up in the earnings calendar even below the market cap threshold." },
      { title: "More Readable Colors", body: "Faint text got darker in the light theme, and panels and cards are easier to tell apart in the dark theme." },
      { title: "Keyboard and Screen Readers", body: "The search window, sorted tables and form errors now work properly for keyboard and screen reader users." },
    ],
  },
  {
    date: "2026-08-12",
    title: "Clickable Day Strip",
    summary: "Go straight from the day strip on the home page to the right calendar. Company logos load everywhere.",
    items: [
      { title: "Clickable Day Strip", body: "Earnings cards in the strip open the earnings calendar, data cards open the economic calendar." },
      { title: "Complete Company Logos", body: "Logos for 686 companies are served from the site itself, bringing back the ones that looked broken for large companies." },
      { title: "Readable Earnings Calendar", body: "Day headings stay on top as you scroll, and the revenue estimate stands out in large type on each card." },
      { title: "Calmer Watchlist Rows", body: "Prices line up, and the sort and delete buttons appear only when you hover over a row." },
    ],
  },
  /* ---- A1 ---- */
  {
    date: "2026-08-09",
    title: "A Bigger Guide, and Dates for Your Calendar",
    summary: "Six new guide articles arrived and the guide is now ordered from easy to hard. You can add economic releases and earnings dates to your own calendar.",
    items: [
      { title: "Six New Guide Articles", body: "Articles on hedging, short squeezes, earnings day, buybacks, the yield curve and sector rotation, in Turkish and English." },
      { title: "Ordered by Difficulty", body: "Within each topic the guide now runs from basic to advanced, so the list itself tells you where to start." },
      { title: "Add to Calendar", body: "Add any economic release or earnings date to your phone or computer calendar in one tap; it shows up in your own time zone." },
      { title: "Search Finds Articles", body: "The search box now finds guide and Close-Up articles, not just stocks." },
      { title: "RSS Feed", body: "The site now has a feed, so you can follow new articles in any RSS reader." },
      { title: "Valuation Line in Analyses", body: "Earnings analyses show P/E, earnings per share and net margin, with ratios recalculated from the current price each day." },
    ],
  },
  {
    date: "2026-08-08",
    title: "An Easier Calendar and Lists",
    summary: "The calendar now explains what each release is, and lists read faster with logos and bars. A shared link now shows that page's own card.",
    items: [
      { title: "Event Explanations", body: "Every calendar row says in one short sentence what a release such as CPI or the jobs report tells you." },
      { title: "Days to Go", body: "Each calendar day is headed “Today”, “Tomorrow” or “In 4 days”, and rows for unreleased data no longer fill up with dashes." },
      { title: "Bars in Index Constituents", body: "The index constituents table carries each company's logo and a bar for its daily move, so who moved how much reads at a glance." },
      { title: "Watchlist With Logos", body: "The watchlist now shows company logos like every other list." },
      { title: "Latest Analyses on the Home Page", body: "The home page lists the latest earnings analyses and Close-Up articles, so you see what is there before you click." },
      { title: "Page-Specific Share Cards", body: "Sharing a stock, an analysis or an article on WhatsApp now shows that page's own title and image." },
    ],
  },
  {
    date: "2026-08-07",
    title: "Earnings Analyses Arrive",
    summary: "Reported quarters now come with a reading: a view, a score, strengths and risks. The earnings screen is split into tabs.",
    items: [
      { title: "Earnings Analyses", body: "A large company's reported quarter on one page, with a view, a score, strengths, risks and what to watch next." },
      { title: "Analysis Badges in the Calendar", body: "An earnings report that has been analysed carries a view and score badge in its calendar row and on the Today screen." },
      { title: "Analyses on Stock Pages", body: "When a company has analyses, its stock page lists them right above the past earnings table." },
      { title: "Numbers First", body: "An analysis page now opens with metric cards, a quarterly revenue chart and guidance ranges instead of paragraphs." },
      { title: "Biggest Report on Top", body: "The earnings list on the Today screen is sorted by market cap, so the day's largest report no longer sits at the bottom." },
      { title: "A New Typeface", body: "The site moved to Schibsted Grotesk and the text grew by one step." },
    ],
  },
  {
    date: "2026-08-05",
    title: "Istanbul Time First, Close-Up and Guide in Two Languages",
    summary: "Times in Turkish are now written in Istanbul time first. Close-Up got a new look, and both Close-Up and the guide can be read in English.",
    items: [
      { title: "Istanbul Time First", body: "In Turkish the main clock is Istanbul and the second is New York; the US daylight saving gap is worked out for each day." },
      { title: "Daily and Weekly Side by Side", body: "The summary card on the home page switches between the daily and weekly brief with a tab, and it shows the latest brief instead of sitting empty for hours." },
      { title: "A New Look for Close-Up", body: "Articles are listed as cards showing the companies involved and their return since the event, and the archive can be filtered by symbol." },
      { title: "Three New Article Blocks", body: "Articles can show a market share split, a step-by-step process and a before/after comparison, all drawn from the text." },
      { title: "Close-Up and Guide in English", body: "All 21 guide articles were translated, and a Close-Up article or brief without a translation is shown in the original Turkish with a badge instead of an empty page." },
      { title: "Four New Guide Articles", body: "New articles on IPOs, options, cash flow and the jobs report, plus previous and next links at the end of each article." },
    ],
  },
  {
    date: "2026-08-02",
    title: "Guide, Close-Up and Compare",
    summary: "The day after launch brought the reading sections: the Guide for concepts and Close-Up for in-depth looks at a single market event. A screen that puts stocks side by side opened the same day.",
    items: [
      { title: "Guide", body: "Articles on the basics, from what a stock is to the yield curve, started with eight and grew to 21 in four topic blocks the same day." },
      { title: "Close-Up", body: "Long reads on a single market event, told with figures, timelines and comparison bars." },
      { title: "Compare Screen", body: "Puts two to four stocks on the same starting line and shows their returns and key measures side by side in one table." },
      { title: "IPO Calendar", body: "Companies coming to market in the next six weeks, with whether each offering has been priced yet." },
      { title: "Fear Gauge", body: "VIX, the volatility the market expects over the next 30 days, on the markets screen with a scale that says what the level means." },
      { title: "Privacy and Account Deletion", body: "A dedicated page explains what is collected and what is deliberately not, and you can delete your account from Settings." },
    ],
  },
  {
    date: "2026-08-01",
    title: "Açılış Zili Goes Live",
    summary: "The first version for readers in Türkiye following the US market went live: the day's calendar, live prices, company pages and a daily brief.",
    items: [
      { title: "Today Screen", body: "Time to the opening bell, the indices and the day's economic releases and earnings on one screen." },
      { title: "Economic Calendar", body: "Fed meetings, inflation, jobs and other market-moving releases together with their dates." },
      { title: "Earnings Calendar", body: "Which company reports when, with estimates, in a sortable list." },
      { title: "Company Pages", body: "A hand-written profile, live market cap and same-industry peers for each of the 516 companies in the S&P 500, Nasdaq-100 and Dow." },
      { title: "World Markets and Treasuries", body: "Japan, South Korea, Türkiye, China and Germany through country funds, and US Treasury yields at 2, 5, 10 and 30 years." },
      { title: "Daily and Weekly Brief", body: "The market's day and week in a short write-up, with past briefs in a date archive." },
    ],
  },
];
