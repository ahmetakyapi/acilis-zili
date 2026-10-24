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
    nextOpen: "Sonraki Açılış",
    posterLink: "Günün Posteri",
  },
  poster: {
    title: "Günün Posteri",
    subtitle: "{date} seansı tek sahnede: sektörlerin sırası, piyasanın genişliği ve endekslerin kapanışı.",
    metaTitle: "{date} Seansının Posteri",
    metaDescription: "{date} seansında ABD sektörleri, S&P 500 genişliği ve endeksler: kapanış verisinden çizilmiş tek bir mürekkep sahnesi.",
    prev: "Önceki Seans",
    next: "Sonraki Seans",
    sceneTitle: "Seansın Mürekkebi",
    sceneLabel: "{date} seansının mürekkep sahnesi. Değerler sahnenin yanındaki tabloda.",
    legendTitle: "Nasıl Okunur",
    legendDots: "Üstteki her nokta bir S&P 500 hissesi: solda yükselenler, sağda düşenler, ortada değişmeyenler.",
    legendLanes: "Her kulvar bir sektör fonu; yukarıdan aşağı günün en güçlüsünden en zayıfına.",
    legendLength: "Şeridin boyu günlük değişim; orta çizgiden kulvarın ucuna kadar {scale}.",
    legendColor: "Renk yalnız yönü söyler: yükseliş ya da düşüş.",
    legendIndices: "Alttaki dört kulvar endeks fonları, aynı ölçekle.",
    colSector: "Sektör",
    colFund: "Fon",
    colChange: "Değişim",
    breadthAdvancing: "Yükselen",
    breadthDeclining: "Düşen",
    breadthUnchanged: "Değişmeyen",
    breadthMissing: "Bu gün için genişlik hesaplanamadı: üyelerin yeterince büyük bir kısmının iki kapanışı birden yok.",
    breadthNote: "Genişlik bugünkü S&P 500 üye listesiyle sayılıyor; geçmiş bir günde o gün endekste olmayan birkaç şirket sayılmış, çıkmış olanlar sayılmamış olabilir.",
    basisNote: "Yüzdeler {date} kapanışının {prev} kapanışına göre değişimi; akşam seansı dahil değil.",
    proxyNote: "Sektörler SPDR sektör fonlarıyla, endeksler fonlarıyla (SPY, QQQ, DIA, IWM) izleniyor; değişim fon fiyatının, temettü dahil değil.",
    archiveLink: "Poster Arşivi",
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
    sectorsTitle: "Sektörler",
    strongest: "En Güçlü",
    weakest: "En Zayıf",
    /** Kartın ekran okuyucu adı — cümle. */
    cardLabel: "{date} posteri: S&P 500 {anchor}.",
    sectorsLabel: "{up} sektör yükseldi, {down} sektör düştü.",
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
    nextOpen: "Next Open",
    posterLink: "The Day's Poster",
  },
  poster: {
    title: "The Day's Poster",
    subtitle: "The {date} session in one scene: how the sectors ranked, how broad the market was and where the indices closed.",
    metaTitle: "Poster of the {date} Session",
    metaDescription: "US sectors, S&P 500 breadth and the indices on {date}: a single ink scene drawn from the closing data.",
    prev: "Previous Session",
    next: "Next Session",
    sceneTitle: "The Session in Ink",
    sceneLabel: "Ink scene of the {date} session. The values are in the table next to it.",
    legendTitle: "How to Read It",
    legendDots: "Each dot at the top is one S&P 500 stock: gainers on the left, decliners on the right, unchanged in between.",
    legendLanes: "Each lane is a sector fund, ranked from the day's strongest at the top to the weakest.",
    legendLength: "Bar length is the daily change; from the center line to the end of a lane is {scale}.",
    legendColor: "Color only shows direction: up or down.",
    legendIndices: "The four lanes at the bottom are the index funds, on the same scale.",
    colSector: "Sector",
    colFund: "Fund",
    colChange: "Change",
    breadthAdvancing: "Advancing",
    breadthDeclining: "Declining",
    breadthUnchanged: "Unchanged",
    breadthMissing: "Breadth couldn't be computed for this day: too many members are missing one of the two closes.",
    breadthNote: "Breadth is counted with today's S&P 500 member list; on a past day a few companies not yet in the index may be counted and departed ones left out.",
    basisNote: "Changes are the {date} close against the {prev} close; after-hours trading is not included.",
    proxyNote: "Sectors are tracked through the SPDR sector funds and the indices through their funds (SPY, QQQ, DIA, IWM); changes are fund price changes, excluding dividends.",
    archiveLink: "Poster Archive",
  },
  archive: {
    title: "Poster Archive",
    menuHint: "The Session in One Scene",
    subtitle: "Every session's close in one scene: how the sectors ranked, S&P 500 breadth and the indices. The latest session on top, earlier ones in the archive.",
    latestTitle: "Latest Session",
    openPoster: "Open Poster",
    listMeta: "Last {n} Sessions",
    sectorsTitle: "Sectors",
    strongest: "Strongest",
    weakest: "Weakest",
    cardLabel: "Poster of {date}: S&P 500 {anchor}.",
    sectorsLabel: "{up} sectors rose, {down} fell.",
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
