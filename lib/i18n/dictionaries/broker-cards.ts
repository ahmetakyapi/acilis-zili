/**
 * `brokerCards` ad alanı — aracı kurum kartları ve yan yana karşılaştırma
 * (25 Ekim görsel turu). Ayrı dosyada: birleştirmede iki büyük sözlükte
 * çakışma alanı küçük kalsın (personal-visuals.ts ile aynı gerekçe).
 *
 * Başlıklar, düğmeler, rozetler ve künyeler Title Case; cümleler ve ekran
 * okuyucu metinleri cümle düzeninde. Sayıya ek getiren kalıp yok ("5'i"
 * gibi): "8 kurumun 3 tanesi".
 */
export const brokerCardsTr = {
  lead: {
    range:
      "{amount} tutarındaki tek alımda komisyon {min} ile {max} arasında değişiyor; {total} kurumun {fractional} tanesi kesirli hisse sunduğunu yazıyor.",
    same: "{amount} tutarındaki tek alımda hesaplanan bütün kurumların komisyonu {min}; {total} kurumun {fractional} tanesi kesirli hisse sunduğunu yazıyor.",
    unpricedOne: "{n} kurumun tarifesinden tek bir komisyon çıkmıyor.",
    unpriced: "{n} kurumun tarifesinden tek bir komisyon çıkmıyor.",
  },
  title: "Kurum Kurum ABD Tarifesi",
  meta: "{count} Kurum",
  intro:
    "Her kart bir kurum. Rakam yukarıda seçtiğin alımın komisyonu; çizgide renkli nokta bu kurum, gri çentikler öteki kurumlar. Notlar ve kaynak numaraları Ayrıntı'da.",
  sortLabel: "Kart Sırası",
  sorts: { ad: "Ada Göre", komisyon: "Komisyona Göre" },
  sortNote: {
    ad: "Kartlar ada göre dizili; sıra bir kurumu önermez.",
    komisyon:
      "Kartlar {amount} alımdaki işlem komisyonuna göre dizili, eşitlikte ada göre; komisyonu hesaplanamayan kurumlar sonda. Sıra bir kurumu önermez.",
  },
  feeLabel: "{amount} Alımda Komisyon",
  ofTrade: "tutarın {pct}",
  notPriced: "Hesaplanmadı",
  notPricedFallback: "Tarifeden tek anlamlı bir komisyon çıkmıyor.",
  scaleLabel: "{name}: {fee}. Çizgi sıfırdan bu tutardaki en yüksek komisyona ({max}) kadar; gri çentikler öteki kurumlar.",
  tariff: "Tarife",
  yes: "Var",
  no: "Yok",
  licence: {
    full: "SPK · Geniş Yetkili",
    partial: "SPK · Kısmi Yetkili",
    foreign: "Yurt Dışı · SPK Listesinde Yok",
  },
  checked: "{date} Okundu",
  sourcesLink: "{n} Kaynak",
  compare: {
    add: "Karşılaştır",
    on: "Karşılaştırmada",
    full: "En Çok 3 Kurum",
    title: "Yan Yana",
    stripLabel: "Yan Yana Karşılaştır",
    hint: "Yan yana görmek için iki ya da üç kurum seç.",
    hintOne: "Bir kurum daha seç.",
    clear: "Seçimi Temizle",
    remove: "{name} karşılaştırmadan çıkar",
    see: "Yan Yana Gör",
    count: "{n}/3 Seçili",
    announce: "Yan yana: {names}",
    announceEmpty: "Karşılaştırma seçimi boş",
    region: "Seçilen kurumlar yan yana; yana kaydırılabilir",
    scrollPrev: "Önceki kurumlar",
    scrollNext: "Sonraki kurumlar",
  },
  fold: {
    more: "Ayrıntı",
    less: "Kısalt",
    caveat: "Not Var",
  },
  /* Telefonda katlanan panel parçaları (25 Ekim, 640 altı). */
  panelFolds: {
    sourcesMore: "Kaynakları Göster",
    sourcesLess: "Kaynakları Gizle",
    notesMore: "Tümünü Göster",
    notesLess: "Kısalt",
    lineMore: "Varsayımlar ve Ölçek",
    lineLess: "Kısalt",
  },
  /* Alımına göre komisyon panosu: üç kart (25 Ekim, kurum logoları turu). */
  board: {
    cheapest: {
      title: "Bu Tutarda En Ucuz",
      podiumLabel: "{amount} alımda komisyonu en düşük üç kurum",
      restLabel: "Öteki kurumlar, komisyona göre",
      rank: "{rank}.",
    },
    curves: {
      title: "Tutar Büyüdükçe",
      chartLabel: "Kurumların komisyon eğrileri, 100 $ ile 50.000 $ arasında; iki eksen de logaritmik.",
      same: "En düşük komisyon {lo} ile {hi} arasındaki her alımda {first}.",
      change: "En düşük komisyon {to} altındaki alımda {first}, {from} üstündeki alımda {last}; aradaki tutarlar alttaki şeritte.",
      stripTitle: "En Düşük Komisyon",
      stripLabel: "{from} ile {to} arası: {names}",
      scaleNote: "İki Eksen Logaritmik",
      pick: "Grafiğe dokunarak tutar seçebilirsin.",
    },
    yearly: {
      title: "Yıllık Maliyet",
      freqLabel: "Ayda Alım",
      freq: "{n} Alım",
      freqAria: "Ayda {n} alım",
      commission: "Komisyon",
      custody: "Saklama",
      custodyFree: "Saklama Yok",
      custodyUnknown: "Saklama Belirtilmemiş",
      custodyFloor: "Saklama En Az {eur}/Yıl",
      rowLabel: "{name}: yılda {total}; komisyon {commission}, saklama {custody}",
      custodyNone: "belirtilmemiş",
      assumption:
        "Her ay {n} kez {amount} alım, fiyat sabit; saklama ay sonu bakiyesinden. Kur farkı, BSMV, ADR ve veri ücreti dahil değil.",
    },
    unpriced: {
      title: "Hesaplanamayanlar",
      more: "Nedenleri",
      less: "Kısalt",
    },
  },
  rank: "{amount} Alımda Sıra {rank}/{total}",
  tileLabels: {
    fractional: "Kesirli Hisse",
    data: "Anlık Veri",
    w8ben: "W-8BEN",
    options: "Opsiyon",
    custody: "Saklama",
    minimum: "Asgari Ücret",
  },
  unspecifiedShort: "Belirtilmemiş",
  details: {
    title: "Tüm Tarife Ayrıntıları",
    meta: "{count} Kurum, {columns} Kalem",
    lead: "Kartlardaki her değerin tablo hâli; ekran okuyucuyla gezmek ve hücre hücre doğrulamak için.",
  },
};

export const brokerCardsEn: typeof brokerCardsTr = {
  lead: {
    range:
      "On a single {amount} trade, commission runs from {min} to {max}; {fractional} of {total} brokers say they offer fractional shares.",
    same: "On a single {amount} trade, every priced broker charges {min}; {fractional} of {total} brokers say they offer fractional shares.",
    unpricedOne: "{n} broker's fee schedule doesn't give a single commission.",
    unpriced: "{n} brokers' fee schedules don't give a single commission.",
  },
  title: "US Fees, Broker by Broker",
  meta: "{count} Brokers",
  intro:
    "Each card is one broker. The figure is the commission on the trade picked above; on the line, the coloured dot is this broker and the grey ticks are the others. Notes and source numbers are under Details.",
  sortLabel: "Card Order",
  sorts: { ad: "By Name", komisyon: "By Commission" },
  sortNote: {
    ad: "Cards are in name order; the order recommends no broker.",
    komisyon:
      "Cards are ordered by the trade commission on {amount}, ties by name; brokers whose commission can't be priced come last. The order recommends no broker.",
  },
  feeLabel: "Commission on {amount}",
  ofTrade: "{pct} of the trade",
  notPriced: "Not Priced",
  notPricedFallback: "The fee schedule doesn't give a single commission.",
  scaleLabel: "{name}: {fee}. The line runs from zero to the highest commission at this amount ({max}); grey ticks are the other brokers.",
  tariff: "Fee Schedule",
  yes: "Yes",
  no: "No",
  licence: {
    full: "CMB · Full Scope",
    partial: "CMB · Partial Scope",
    foreign: "Foreign · Not on CMB Register",
  },
  checked: "Read {date}",
  sourcesLink: "{n} Sources",
  compare: {
    add: "Compare",
    on: "Comparing",
    full: "3 Brokers at Most",
    title: "Side by Side",
    stripLabel: "Compare Side by Side",
    hint: "Pick two or three brokers to see them side by side.",
    hintOne: "Pick one more broker.",
    clear: "Clear Selection",
    remove: "Remove {name} from the comparison",
    see: "See Side by Side",
    count: "{n}/3 Selected",
    announce: "Side by side: {names}",
    announceEmpty: "Comparison cleared",
    region: "Selected brokers side by side; scrolls sideways",
    scrollPrev: "Previous brokers",
    scrollNext: "Next brokers",
  },
  fold: {
    more: "Details",
    less: "Show Less",
    caveat: "Note",
  },
  panelFolds: {
    sourcesMore: "Show Sources",
    sourcesLess: "Hide Sources",
    notesMore: "Show All",
    notesLess: "Show Less",
    lineMore: "Assumptions and Scale",
    lineLess: "Show Less",
  },
  board: {
    cheapest: {
      title: "Cheapest at This Size",
      podiumLabel: "The three lowest commissions on {amount}",
      restLabel: "Other brokers, by commission",
      rank: "#{rank}",
    },
    curves: {
      title: "As the Trade Grows",
      chartLabel: "Each broker's commission from $100 to $50,000; both axes are logarithmic.",
      same: "The lowest commission on every trade from {lo} to {hi} is at {first}.",
      change: "Below {to} the lowest commission is at {first}; above {from}, at {last}. The strip below shows the sizes in between.",
      stripTitle: "Lowest Commission",
      stripLabel: "{from} to {to}: {names}",
      scaleNote: "Both Axes Logarithmic",
      pick: "Tap the chart to pick a trade size.",
    },
    yearly: {
      title: "Cost Over a Year",
      freqLabel: "Trades a Month",
      freq: "{n} Trades",
      freqAria: "{n} trades a month",
      commission: "Commission",
      custody: "Custody",
      custodyFree: "No Custody Fee",
      custodyUnknown: "Custody Not Stated",
      custodyFloor: "Custody at Least {eur} a Year",
      rowLabel: "{name}: {total} a year; commission {commission}, custody {custody}",
      custodyNone: "not stated",
      assumption:
        "{n} buys of {amount} every month at a flat price; custody on the month-end balance. FX spread, BSMV tax, ADR and data fees not included.",
    },
    unpriced: {
      title: "Not Priced",
      more: "Reasons",
      less: "Show Less",
    },
  },
  rank: "Rank {rank} of {total} at {amount}",
  tileLabels: {
    fractional: "Fractional",
    data: "Live Data",
    w8ben: "W-8BEN",
    options: "Options",
    custody: "Custody",
    minimum: "Minimum Fee",
  },
  unspecifiedShort: "Not Stated",
  details: {
    title: "Full Fee Details",
    meta: "{count} Brokers, {columns} Items",
    lead: "Every value on the cards as a table, for screen readers and for checking cell by cell.",
  },
};
