/**
 * `daySignature` ad alanı — "Zil ve Günün İmzası" (24 Ekim): kahramanın
 * kapanış künyesi (`DaySeal`), Günün Posteri (`/gun/[tarih]`, `/gun`) ve
 * zil sesi anahtarı. Sözlüğün parçası (tr.ts / en.ts bunu `daySignature`
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
    breadth: "S&P 500 Genişliği",
    advancing: "{n} Yükseldi",
    declining: "{n} Düştü",
    /** Şeridin ekran okuyucu karşılığı — cümle. */
    stripLabel: "S&P 500 genişliği: {adv} hisse yükseldi, {dec} hisse düştü, {flat} hisse değişmedi.",
    posterLink: "Günün Posteri",
    /** Ana sayfadaki son seans karosunun ekran okuyucu adı — cümle. */
    tileLabel: "Günün Posteri, {close}: {sentence}",
  },
  poster: {
    title: "Günün Posteri",
    subtitle: "{date} seansı tek bakışta: ne oldu, hangi sektör önde, hisselerin kaçı yükseldi.",
    metaTitle: "{date} Seansının Posteri",
    metaDescription: "{date}: {sentence}. Sektörler, S&P 500 genişliği ve endeksler, kapanış verisinden.",
    prev: "Önceki Seans",
    next: "Sonraki Seans",
    /** Ölçü ızgarası — Title Case künyeler. */
    figBreadth: "Yükselen Hisse",
    flatCount: "{n} Değişmedi",
    indicesTitle: "Endeksler",
    breadthMissing: "Bu gün için genişlik hesaplanamadı: üyelerin yeterince büyük bir kısmının iki kapanışı birden yok.",
    breadthNote: "Genişlik bugünkü S&P 500 üye listesiyle sayılıyor; geçmiş bir günde o gün endekste olmayan birkaç şirket sayılmış, çıkmış olanlar sayılmamış olabilir.",
    basisNote: "Yüzdeler {date} kapanışının {prev} kapanışına göre değişimi; akşam seansı dahil değil.",
    proxyNote: "Sektörler SPDR sektör fonlarıyla, endeksler fonlarıyla (SPY, QQQ, DIA, IWM) izleniyor; değişim fon fiyatının, temettü dahil değil.",
    storyNote: "Üstteki cümle bu sayılardan kurallarla kuruluyor: hareket eden hisselerin en az %70'i aynı yöne gittiyse geniş gün, endeks bir yöne hisselerin çoğu öbür yöne gittiyse dar gün; S&P 500 ±%0,10 içinde kapandıysa yatay.",
    archiveLink: "Poster Arşivi",
  },
  /** SAHNE (25 Ekim) — her hisse bir nokta, sektör sektör
   *  (`components/day-poster/PosterStage.tsx`). Künyeler Title Case,
   *  açıklama ve ekran okuyucu metinleri cümle. */
  stage: {
    title: "S&P 500, Hisse Hisse",
    hint: "Her nokta bir hisse: sağa gittikçe yükseldi, sola gittikçe düştü; büyüklüğü piyasa değeri. Noktaya dokun ya da sektörün adına bas.",
    axisDown: "Düştü",
    axisUp: "Yükseldi",
    legendSize: "Nokta Boyu: Piyasa Değeri",
    legendFund: "Sektör Fonu",
    legendClip: "Ölçek Dışı",
    /** Satırın ekran okuyucu adı — cümle. */
    laneLabel: "{sector}: {n} hisse, {adv} yükseldi, {dec} düştü. Ok tuşlarıyla hisse hisse gezin, Enter hissenin sayfasını açar.",
    rowMeta: "{adv} Yükseldi · {dec} Düştü",
    focusTop: "En Çok Yükselen",
    focusBottom: "En Çok Düşen",
    focusClear: "Tüm Sektörler",
    tipCap: "Piyasa Değeri {cap}",
    tipClip: "Ölçeğin dışında, kenara kondu",
    allStocks: "Tüm Hisseler",
    allStocksClose: "Listeyi Kapat",
    colStock: "Hisse",
    colChange: "Değişim",
    colCap: "Piyasa Değeri",
    extremesTitle: "Günün Uçları",
    shareTitle: "Paylaşım Görseli",
    shareWide: "Yatay",
    shareTall: "Dikey",
    sizeNote: "Noktanın alanı şirketin {date} kapanışındaki piyasa değeriyle orantılı (hisse sayısı bugünkü); en küçük şirketler taban boyda çiziliyor.",
    sizeMissing: "Piyasa değerleri okunamadı; noktalar bu kez eşit boyda.",
    clipNote: "Eksen {lo} ile {hi} arası; dışında kalan uç hisseler kenarda halkalı çiziliyor, gerçek değerleri etiketinde ve listede.",
    unplacedNote: "{n} hissenin sektörü bilinmediği için sahnede yok; genişlik sayımında var.",
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
    broadRally: "S&P 500'de {adv} Hisse Yükseldi; {sectors}",
    broadSelloff: "S&P 500'de {dec} Hisse Düştü; {sectors}",
    narrowRally: "S&P 500 {spy} Yükseldi ama {dec} Hisse Düştü{focus}",
    narrowDecline: "S&P 500 {spy} Düştü ama {adv} Hisse Yükseldi{focus}",
    rally: "S&P 500 {spy} Yükseldi; {sectors}",
    decline: "S&P 500 {spy} Düştü; {sectors}",
    flat: "S&P 500 Yerinde Saydı; {tail}",
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
    menuHint: "Seansın Tek Sahnesi",
    subtitle: "Her seansın kapanışı tek sahnede: sektörlerin sırası, S&P 500 genişliği ve endeksler. En son seans üstte, öncekiler arşivde.",
    latestTitle: "Son Seans",
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
    breadth: "S&P 500 Breadth",
    advancing: "{n} Up",
    declining: "{n} Down",
    stripLabel: "S&P 500 breadth: {adv} stocks rose, {dec} fell, {flat} were unchanged.",
    posterLink: "The Day's Poster",
    tileLabel: "The Day's Poster, {close}: {sentence}",
  },
  poster: {
    title: "The Day's Poster",
    subtitle: "The {date} session at a glance: what happened, which sectors led and how many stocks rose.",
    metaTitle: "Poster of the {date} Session",
    metaDescription: "{date}: {sentence}. Sectors, S&P 500 breadth and the indices, from the closing data.",
    prev: "Previous Session",
    next: "Next Session",
    figBreadth: "Stocks Up",
    flatCount: "{n} Unchanged",
    indicesTitle: "Indices",
    breadthMissing: "Breadth couldn't be computed for this day: too many members are missing one of the two closes.",
    breadthNote: "Breadth is counted with today's S&P 500 member list; on a past day a few companies not yet in the index may be counted and departed ones left out.",
    basisNote: "Changes are the {date} close against the {prev} close; after-hours trading is not included.",
    proxyNote: "Sectors are tracked through the SPDR sector funds and the indices through their funds (SPY, QQQ, DIA, IWM); changes are fund price changes, excluding dividends.",
    storyNote: "The headline is built from these numbers by fixed rules: a broad day when at least 70% of the stocks that moved went the same way, a narrow day when the index went one way and most stocks the other; flat when the S&P 500 closed within ±0.10%.",
    archiveLink: "Poster Archive",
  },
  stage: {
    title: "The S&P 500, Stock by Stock",
    hint: "Each dot is a stock: further right rose more, further left fell more; its size is market value. Tap a dot or press a sector's name.",
    axisDown: "Fell",
    axisUp: "Rose",
    legendSize: "Dot Size: Market Value",
    legendFund: "Sector Fund",
    legendClip: "Off Scale",
    laneLabel: "{sector}: {n} stocks, {adv} rose, {dec} fell. Use the arrow keys to step through the stocks; Enter opens the stock's page.",
    rowMeta: "{adv} Up · {dec} Down",
    focusTop: "Top Gainers",
    focusBottom: "Top Losers",
    focusClear: "All Sectors",
    tipCap: "Market Value {cap}",
    tipClip: "Off scale, placed at the edge",
    allStocks: "All Stocks",
    allStocksClose: "Close List",
    colStock: "Stock",
    colChange: "Change",
    colCap: "Market Value",
    extremesTitle: "The Day's Extremes",
    shareTitle: "Share Image",
    shareWide: "Landscape",
    shareTall: "Portrait",
    sizeNote: "A dot's area is proportional to the company's market value at the {date} close (using today's share count); the smallest companies are drawn at a minimum size.",
    sizeMissing: "Market values couldn't be read; the dots are equal in size this time.",
    clipNote: "The axis runs from {lo} to {hi}; the extreme stocks outside it are drawn ringed at the edge, with their real values in their labels and in the list.",
    unplacedNote: "{n} stocks have no known sector and aren't on the stage; they're still counted in breadth.",
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
    broadRally: "{adv} S&P 500 Stocks Rose; {sectors}",
    broadSelloff: "{dec} S&P 500 Stocks Fell; {sectors}",
    narrowRally: "The S&P 500 Rose {spy} but {dec} Stocks Fell{focus}",
    narrowDecline: "The S&P 500 Fell {spy} but {adv} Stocks Rose{focus}",
    rally: "The S&P 500 Rose {spy}; {sectors}",
    decline: "The S&P 500 Fell {spy}; {sectors}",
    flat: "The S&P 500 Barely Moved; {tail}",
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
    menuHint: "The Session in One Scene",
    subtitle: "Every session's close in one scene: how the sectors ranked, S&P 500 breadth and the indices. The latest session on top, earlier ones in the archive.",
    latestTitle: "Latest Session",
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
