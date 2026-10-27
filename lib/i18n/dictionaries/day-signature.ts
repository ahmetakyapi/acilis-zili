/**
 * `daySignature` ad alanı — "Zil ve Günün İmzası" (24 Ekim): Günün Posteri
 * (`/gun/[tarih]`, `/gun`), siluetin kendisi (`skyline`, 25 Ekim), ana
 * sayfanın son seans şeridi (`strip`) ve zil sesi anahtarı. Sözlüğün parçası (tr.ts / en.ts bunu `daySignature`
 * anahtarına koyuyor) ama ayrı dosyada, `datePicker` gibi: özellik tek
 * yerde okunuyor ve sözlüğün ortasına serpiştirilmiyor.
 *
 * Yazım CLAUDE.md "Title Case": künyeler ("23 Ekim Kapanışı", "312
 * Yükseldi") Title Case; açıklama ve ipucu satırları cümle düzeninde.
 */

export const daySignatureTr = {
  seal: {
    /** "{date}" kısa tarih: "23 Ekim Kapanışı". */
    close: "{date} Kapanışı",
    advancing: "{n} Yükseldi",
    declining: "{n} Düştü",
    /** Şeridin ekran okuyucu karşılığı — cümle. */
    stripLabel: "Nasdaq 100 genişliği: {adv} şirket yükseldi, {dec} şirket düştü, {flat} şirket değişmedi.",
  },
  poster: {
    title: "Günün Posteri",
    subtitle: "{date} seansı tek bakışta: Nasdaq 100'ün yüz şirketi tek bir şehir siluetinde.",
    metaTitle: "{date} Seansının Posteri",
    metaDescription: "{date}: {sentence}. Nasdaq 100'ün yüz şirketi tek siluette, sektör sektör, kapanış verisinden.",
    prev: "Önceki Seans",
    next: "Sonraki Seans",
    flatCount: "{n} Değişmedi",
    breadthNote: "Genişlik bugünkü Nasdaq 100 üye listesiyle sayılıyor; geçmiş bir günde o gün endekste olmayan birkaç şirket sayılmış, çıkmış olanlar sayılmamış olabilir.",
    basisNote: "Yüzdeler {date} kapanışının {prev} kapanışına göre değişimi; akşam seansı dahil değil.",
    proxyNote: "Endeksler fonlarıyla izleniyor (QQQ, SPY, DIA, IWM); değişim fon fiyatının, temettü dahil değil.",
    storyNote: "Üstteki cümle bu sayılardan kurallarla kuruluyor: hareket eden şirketlerin en az %70'i aynı yöne gittiyse geniş gün, endeks bir yöne şirketlerin çoğu öbür yöne gittiyse dar gün; Nasdaq 100 ±%0,10 içinde kapandıysa yatay. Sektör sırası mahallelerin değişiminden.",
    archiveLink: "Poster Arşivi",
  },
  /** GÜNÜN SİLUETİ (25 Ekim) — her şirket bir bina, ufuk sıfır
   *  (`components/day-poster/Skyline.tsx`, yerleşim `lib/day-skyline.ts`).
   *  Künyeler Title Case; açıklama ve ekran okuyucu metinleri cümle. */
  skyline: {
    title: "Nasdaq 100 Silueti",
    hint: "Her bina bir Nasdaq 100 şirketi; binalar sektör mahallelerinde, en güçlü mahalleden en zayıfa dizili. Binaya dokun ya da ok tuşlarıyla gez.",
    legendWidth: "Bina Genişliği: Piyasa Değeri",
    legendHeight: "Yükseklik: Günlük Değişim",
    legendHorizon: "Ufkun Üstü Yükseldi, Altı Düştü",
    /** Sahnenin ekran okuyucu adı — cümle. */
    sceneLabel: "Nasdaq 100 silueti: {adv} şirket yükseldi, {dec} şirket düştü. Ok tuşlarıyla bina bina gezin, Enter şirketin sayfasını açar.",
    districtMeta: "{adv} Yükseldi · {dec} Düştü",
    otherDistrict: "Diğer Sektörler",
    tipCap: "Piyasa Değeri {cap}",
    tipClip: "Ölçeğin dışında, tavanda kesik çizildi",
    allStocks: "Tüm Şirketler",
    allStocksClose: "Listeyi Kapat",
    colStock: "Şirket",
    colDistrict: "Sektör",
    colChange: "Değişim",
    colCap: "Piyasa Değeri",
    figIndex: "Nasdaq 100",
    figBreadth: "Yükselen ve Düşen",
    figStrongest: "En Güçlü Sektör",
    figWeakest: "En Zayıf Sektör",
    otherIndices: "Öteki Endeksler",
    extremesTitle: "Günün Uçları",
    shareTitle: "Paylaşım Görseli",
    shareWide: "Yatay",
    shareTall: "Dikey",
    sizeNote: "Binanın genişliği şirketin {date} kapanışındaki piyasa değerinin kareköküyle orantılı (hisse sayısı bugünkü): karekök, en büyük ile en küçük şirket arasındaki yüzlerce katlık farkı okunur tutuyor.",
    sizeMissing: "Piyasa değerleri okunamadı; binalar bu kez eşit genişlikte, sektörlerin değişimi eşit ağırlıklı.",
    clipNote: "Yükseklik ölçeği ±{hi}; bunu aşan binalar tavanda kesik çiziliyor, gerçek değerleri etiketinde ve listede.",
    districtNote: "Mahalleler GICS sektörleri; beşten az şirketi olan sektörler Diğer Sektörler'de birleşiyor. Bir mahallenin değişimi, şirketlerinin piyasa değeriyle ağırlıklı ortalaması.",
    /** TELEFON TABELASI (25 Ekim, "Silüet: mobil" turu): tabela telefonda
     *  tek satır. Uzun adlar anlamı değiştirmeden kısalıyor: ortak sözcük
     *  düşüyor ("Hizmetleri", "Sektörler"), iki tüketim mahallesinde
     *  ayırt eden sözcük kalıyor (İngilizce piyasa dilindeki
     *  "Discretionary" / "Staples" gibi). Listede olmayan mahalle tam
     *  adıyla. Tam ad bilgi kartında ve tabloda. */
    shortDistricts: {
      XLY: "İsteğe Bağlı",
      XLP: "Temel Tüketim",
      XLC: "İletişim",
      OTHER: "Diğer",
    },
    /** Telefonda sahnenin altındaki okuma satırı. */
    readoutOpen: "Hisseye Git",
    readoutClose: "Kartı kapat",
    /** TELEFONDA ÖNE ÇIKANLAR (27 Ekim, "Silüet: mobil 2"): sahnenin
     *  altındaki ızgara; sahnede yalnız numara rozeti. Çipin ekran okuyucu
     *  adı cümle. */
    highlights: "Öne Çıkanlar",
    highlightLabel: "{n}. {symbol}, {name}, {pct}, {district}. Sahnede binasını gösterir.",
  },
  /** Ana sayfanın son seans şeridi (`components/today/home/SkylineStrip.tsx`). */
  strip: {
    title: "Son Seansın Silueti",
    open: "Posteri Aç",
  },
  /** GÜNÜN CÜMLESİ — kurallar `lib/day-poster-story.ts`. Başlık ve
   *  cümle Title Case (başlıktır); bağlaçlar (ve, ama) küçük. */
  story: {
    kinds: {
      broadRally: "Geniş Yükseliş",
      broadSelloff: "Geniş Satış",
      narrowRally: "Dar Yükseliş",
      narrowDecline: "Dar Düşüş",
      rally: "Yükseliş Günü",
      decline: "Düşüş Günü",
      flat: "Yatay Kapanış",
    },
    join: "{title}: {detail}",
    broadRally: "Nasdaq 100'de {adv} Hisse Yükseldi; {sectors}",
    broadSelloff: "Nasdaq 100'de {dec} Hisse Düştü; {sectors}",
    narrowRally: "Nasdaq 100 {index} Yükseldi ama {dec} Hisse Düştü{focus}",
    narrowDecline: "Nasdaq 100 {index} Düştü ama {adv} Hisse Yükseldi{focus}",
    rally: "Nasdaq 100 {index} Yükseldi; {sectors}",
    decline: "Nasdaq 100 {index} Düştü; {sectors}",
    flat: "Nasdaq 100 Yerinde Saydı; {tail}",
    breadthUp: "{n} Hisse Yükseldi",
    breadthDown: "{n} Hisse Düştü",
    breadthSplit: "Hisseler İkiye Bölündü",
    sectorsAllUp: "Sektörlerin Hepsi Yükseldi",
    sectorsAllDown: "Sektörlerin Hepsi Düştü",
    sectorsOnlyUp: "Yalnız {list} Yükseldi",
    sectorsOnlyDown: "Yalnız {list} Düştü",
    sectorsLeadLag: "Önde {lead}, Geride {lag}",
    focusUp: "; En Çok {name} Yükseldi",
    focusDown: "; En Çok {name} Düştü",
  },
  archive: {
    /** Arşiv bölümünün ve künyelerin adı; sayfanın adı `poster.title`
     *  (menüyle aynı: "Günün Posteri"). */
    title: "Poster Arşivi",
    /** Daha Fazla panelinin ipucu — öteki ipuçlarının kalıbında: Title
     *  Case, noktasız, kısa. */
    menuHint: "Seansın Silueti",
    subtitle: "Her seansın kapanışı tek siluette: Nasdaq 100'ün yüz şirketi, sektör sektör. En son seans üstte, öncekiler arşivde.",
    openPoster: "Posteri Aç",
    listMeta: "Son {n} Seans",
    strongest: "En Güçlü",
    weakest: "En Zayıf",
    /** Kartın ekran okuyucu adı — cümle. */
    cardLabel: "{date} posteri: {sentence}.",
    empty: "Henüz tamamlanmış bir seans yok.",
  },
  sound: {
    panelTitle: "Ses",
    title: "Zil Sesi",
    hint: "Zile basınca ve sayaç sıfırlandığında kısa, yumuşak bir zil tınısı çalar. Tercih yalnız bu tarayıcıda saklanır.",
  },
  brief: {
    posterLink: "Bu Seansın Posteri",
  },
};

export const daySignatureEn: typeof daySignatureTr = {
  seal: {
    close: "{date} Close",
    advancing: "{n} Up",
    declining: "{n} Down",
    stripLabel: "Nasdaq 100 breadth: {adv} companies rose, {dec} fell, {flat} were unchanged.",
  },
  poster: {
    title: "The Day's Poster",
    subtitle: "The {date} session at a glance: the Nasdaq 100's hundred companies drawn as one city skyline.",
    metaTitle: "Poster of the {date} Session",
    metaDescription: "{date}: {sentence}. The Nasdaq 100's hundred companies in one skyline, sector by sector, from the closing data.",
    prev: "Previous Session",
    next: "Next Session",
    flatCount: "{n} Unchanged",
    breadthNote: "Breadth is counted with today's Nasdaq 100 member list; on a past day a few companies not yet in the index may be counted and departed ones left out.",
    basisNote: "Changes are the {date} close against the {prev} close; after-hours trading is not included.",
    proxyNote: "The indices are tracked through their funds (QQQ, SPY, DIA, IWM); changes are fund price changes, excluding dividends.",
    storyNote: "The headline is built from these numbers by fixed rules: a broad day when at least 70% of the companies that moved went the same way, a narrow day when the index went one way and most companies the other; flat when the Nasdaq 100 closed within ±0.10%. The sector order comes from the districts' changes.",
    archiveLink: "Poster Archive",
  },
  skyline: {
    title: "The Nasdaq 100 Skyline",
    hint: "Each building is a Nasdaq 100 company; the buildings stand in sector districts, from the strongest district to the weakest. Tap a building or step through with the arrow keys.",
    legendWidth: "Building Width: Market Value",
    legendHeight: "Height: Daily Change",
    legendHorizon: "Above the Horizon Rose, Below Fell",
    sceneLabel: "Nasdaq 100 skyline: {adv} companies rose, {dec} fell. Use the arrow keys to step through the buildings; Enter opens the company's page.",
    districtMeta: "{adv} Up · {dec} Down",
    otherDistrict: "Other Sectors",
    tipCap: "Market Value {cap}",
    tipClip: "Off scale, cut at the top",
    allStocks: "All Companies",
    allStocksClose: "Close List",
    colStock: "Company",
    colDistrict: "Sector",
    colChange: "Change",
    colCap: "Market Value",
    figIndex: "Nasdaq 100",
    figBreadth: "Up and Down",
    figStrongest: "Strongest Sector",
    figWeakest: "Weakest Sector",
    otherIndices: "Other Indices",
    extremesTitle: "The Day's Extremes",
    shareTitle: "Share Image",
    shareWide: "Landscape",
    shareTall: "Portrait",
    sizeNote: "A building's width is proportional to the square root of the company's market value at the {date} close (using today's share count): the square root keeps the gap of several hundred times between the largest and smallest company readable.",
    sizeMissing: "Market values couldn't be read; the buildings are equal in width this time and the sectors' changes equally weighted.",
    clipNote: "The height scale runs to ±{hi}; buildings beyond it are cut at the top, with their real values in their labels and in the list.",
    districtNote: "Districts are GICS sectors; sectors with fewer than five companies are grouped as Other Sectors. A district's change is its companies' average weighted by market value.",
    shortDistricts: {
      XLY: "Discretionary",
      XLP: "Staples",
      XLC: "Communication",
      OTHER: "Other",
    },
    readoutOpen: "Go to Stock",
    readoutClose: "Close card",
    highlights: "Highlights",
    highlightLabel: "{n}. {symbol}, {name}, {pct}, {district}. Shows its building in the skyline.",
  },
  strip: {
    title: "The Last Session's Skyline",
    open: "Open Poster",
  },
  story: {
    kinds: {
      broadRally: "Broad Rally",
      broadSelloff: "Broad Selloff",
      narrowRally: "Narrow Rally",
      narrowDecline: "Narrow Decline",
      rally: "Up Day",
      decline: "Down Day",
      flat: "Flat Close",
    },
    join: "{title}: {detail}",
    broadRally: "{adv} Nasdaq 100 Stocks Rose; {sectors}",
    broadSelloff: "{dec} Nasdaq 100 Stocks Fell; {sectors}",
    narrowRally: "The Nasdaq 100 Rose {index} but {dec} Stocks Fell{focus}",
    narrowDecline: "The Nasdaq 100 Fell {index} but {adv} Stocks Rose{focus}",
    rally: "The Nasdaq 100 Rose {index}; {sectors}",
    decline: "The Nasdaq 100 Fell {index}; {sectors}",
    flat: "The Nasdaq 100 Barely Moved; {tail}",
    breadthUp: "{n} Stocks Rose",
    breadthDown: "{n} Stocks Fell",
    breadthSplit: "Stocks Split Evenly",
    sectorsAllUp: "All Sectors Rose",
    sectorsAllDown: "All Sectors Fell",
    sectorsOnlyUp: "Only {list} Rose",
    sectorsOnlyDown: "Only {list} Fell",
    sectorsLeadLag: "{lead} Led, {lag} Lagged",
    focusUp: "; {name} Rose the Most",
    focusDown: "; {name} Fell the Most",
  },
  archive: {
    title: "Poster Archive",
    menuHint: "The Session's Skyline",
    subtitle: "Every session's close in one skyline: the Nasdaq 100's hundred companies, sector by sector. The latest session on top, earlier ones in the archive.",
    openPoster: "Open Poster",
    listMeta: "Last {n} Sessions",
    strongest: "Strongest",
    weakest: "Weakest",
    cardLabel: "Poster of {date}: {sentence}.",
    empty: "No completed session yet.",
  },
  sound: {
    panelTitle: "Sound",
    title: "Bell Sound",
    hint: "Plays a short, soft bell tone when you press the bell and when the countdown reaches zero. The choice is stored in this browser only.",
  },
  brief: {
    posterLink: "This Session's Poster",
  },
};

export type DaySignatureLabels = typeof daySignatureTr;
