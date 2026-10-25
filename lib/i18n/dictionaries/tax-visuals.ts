/**
 * `taxVisuals` ad alanı — Vergi hesaplayıcısının şelalesi, dilim bandı ve
 * beyan takviminin ay ölçeği (25 Ekim, öğrenme ve hesap araçlarının görsel
 * turu). Sözlüğün parçası (tr.ts / en.ts bunu `taxVisuals` anahtarına
 * koyuyor), ayrı dosyada: paralel geliştirilen paketler sözlüğün ortasına
 * anahtar serpiştirmesin. Var olan adım adları (`flowCostTl`, `taxBase`…)
 * `lira.tax`ta kalıyor; burada yalnızca yeni çizimlerin metni.
 */

export const taxVisualsTr = {
  waterfall: {
    title: "Kazançtan Matraha",
    /* Ekran okuyucu için şelalenin tamamı tek cümlede. */
    ariaLabel:
      "Kazancın dökümü: TL maliyet {cost}, endeksli maliyet {indexed}, satış bedeli {proceeds}, {gainName} {gain}, vergi matrahı {base}.",
    indexStep: "Endeksleme Payı",
    scaleNote: "Sütunlar aynı TL ölçeğinde; kesik çizgiler aynı tutarı birleştirir.",
  },
  band: {
    title: "Matrahın Dilimlere Dağılımı",
    ariaLabel: "Matrah {base}; {count} dilime yayılıyor, son dilim %{rate}.",
    /* Birleşik etiket: dar dilimlerin oran aralığı. */
    merged: "%{from}-%{to}",
    hint: "Her oran yalnızca kendi dilimine düşen kısma uygulanır; şerit dilimin TL genişliğiyle orantılı.",
  },
  timeline: {
    scaleLabel: "Ay Ölçeğinde Takvim",
    window: "Beyan Ayı",
    installment: "2. Taksit",
  },
};

export const taxVisualsEn: typeof taxVisualsTr = {
  waterfall: {
    title: "From Gain to Tax Base",
    ariaLabel:
      "Gain breakdown: lira cost {cost}, indexed cost {indexed}, sale proceeds {proceeds}, {gainName} {gain}, tax base {base}.",
    indexStep: "Indexation Uplift",
    scaleNote: "Columns share one lira scale; dashed lines join equal amounts.",
  },
  band: {
    title: "Tax Base Across Brackets",
    ariaLabel: "Tax base {base}; spread over {count} brackets, top bracket {rate}%.",
    merged: "{from}-{to}%",
    hint: "Each rate applies only to the slice inside its bracket; strip widths follow each bracket's lira width.",
  },
  timeline: {
    scaleLabel: "Calendar to Scale",
    window: "Filing Month",
    installment: "2nd Installment",
  },
};
