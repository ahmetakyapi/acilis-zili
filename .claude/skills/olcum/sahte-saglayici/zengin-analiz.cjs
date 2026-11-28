/* Ölçüm için zengin analiz satırı (HD 3Ç 2026): canlı Dell analizinin
   yoğunluğu — beş bölüm, ekler (özet, segment, ölçü), öngörü, CEO, dokuz
   kaynak. `/bilancolar/HD/3c-2026`. */
const P = (n) => Array.from({ length: n }, (_, i) => `Bu paragraf ölçüm için uzun bir değerlendirme cümlesi taşır; mağaza trafiği, ortalama sepet ve profesyonel müşteri satışlarının gelişimini ${i + 1}. kez anlatır ve sayfanın gerçek yoğunluğunu taklit eder.`).join(" ");

module.exports = function zengin(last, NOW_ISO, s) {
  const row = {
    id: "00000000-0000-4000-8000-0000000000aa",
    symbol: "HD", period: "3c-2026", period_label: "3Ç 2026", locale: "tr", company: "The Home Depot, Inc.", exchange: "NYSE", sector: "Consumer Discretionary",
    report_date: last, timing: "bmo", next_period_label: "4Ç 2026", next_report_estimate: "~Şubat 2027",
    score: s(72), verdict: "buy", headline: "Home Depot üçüncü çeyrekte 44,6 milyar dolar gelirle beklentiyi %1,4 aştı; düzeltilmiş hisse başına kâr 4,02 dolarla beklentinin %1,8 üzerinde kaldı ve yıl sonu hedefi korundu.",
    price: s(386.2), reaction_pct: s(2.4), market_cap: s(384e9), return_1y_pct: s(-4.2), target_price: s(428.5), upside_pct: s(10.9), analyst_count: s(31),
    revenue: s(44.6e9), revenue_yoy_pct: s(6.1), eps: s(4.02), eps_surprise_pct: s(4.6), eps_ttm: s(15.1), growth_pct: s(6.5), growth_basis: "ileriye dönük 3 yıl",
    summary: JSON.stringify([
      "Home Depot üçüncü çeyrekte 44,6 milyar dolar gelir açıkladı. Yıllık artış %6,1, piyasa beklentisinin %1,4 üzerinde. Düzeltilmiş hisse başı kâr 4,02 dolar ile beklentiyi %1,8 aştı. Yıl sonu hedefi korundu; büyümenin motoru profesyonel müşteri satışları.",
      P(3), P(3),
    ]),
    analysis: JSON.stringify([
      { title: "Profesyonel müşteri satışları gelirin yarısını taşıyor.", body: P(5) },
      { title: "Benzer mağaza satışları üç çeyrek sonra pozitife döndü.", body: P(6) },
      { title: "Brüt marj fiyat disipliniyle yatay kaldı.", body: P(6) },
      { title: "Nakit ve hissedar getirisi istikrarlı.", body: P(5) },
      { title: "Bir sonraki çeyrekte tek ölçü: konut cirosu.", body: P(5) },
    ]),
    strengths: JSON.stringify(["Gelir beklentiyi %1,4 aştı.", "Profesyonel müşteri satışları %9 büyüdü.", "Yıl sonu hedefi korundu.", "Brüt marj %33,4 ile yatay.", "Temettü artırıldı.", "Stok devir hızı iyileşti."]),
    risks: JSON.stringify(["Konut cirosu zayıf seyrediyor.", "Faiz oranları tadilat talebini baskılıyor.", "Büyük bilet kalemleri geriledi.", "Satın alma entegrasyon maliyeti sürüyor.", "Kur etkisi gelirin %0,5'ini sildi.", "Rekabet fiyat baskısı yaratıyor."]),
    upcoming: JSON.stringify(["4Ç 2026 bilançosu Şubat 2027'nin sonunda açıklanacak.", "Yatırımcı günü Aralık'ta yapılacak.", "Temettü ödemesi 18 Aralık'ta."]),
    highlights: JSON.stringify([
      { label: "Profesyonel Satışlar", value: "22,3 Mr $", note: "%9 Yıllık · Payı %50", tone: "up" },
      { label: "Benzer Mağaza Satışları", value: "%1,8", note: "Üç Çeyrek Sonra Pozitif", tone: "up" },
      { label: "Brüt Marj", value: "%33,4", note: "Geçen Yıl %33,5", tone: null },
      { label: "Hisse Tepkisi", value: "▲ %2,4", note: "Açılış Öncesi · Zirve %3,1", tone: "up" },
    ]),
    quarterly_revenue: JSON.stringify([
      { label: "3Ç25", value: 40.2e9 }, { label: "4Ç25", value: 39.7e9 }, { label: "1Ç26", value: 39.9e9 }, { label: "2Ç26", value: 45.3e9 }, { label: "3Ç26", value: 44.6e9 }, { label: "4Ç26Ö", value: 41.1e9, projected: true },
    ]),
    revenue_footer: JSON.stringify([{ label: "Yıllık Gelir Büyümesi", value: "%6,1", tone: "up" }, { label: "Profesyonel Payı", value: "%50", note: "Geçen Yıl %47", tone: "up" }, { label: "Büyük Bilet", value: "%2,1", tone: "down" }]),
    guidance_footer: JSON.stringify([{ label: "Faaliyet Gideri (4Ç)", value: "Gelirin ~%19'u" }, { label: "Hisse Sayısı (4Ç)", value: "~994 Mn" }, { label: "Yatırım Harcaması", value: "~3,5 Mr $" }]),
    guidance: JSON.stringify([
      { label: "Gelir (4Ç 2026)", low: 40.8, high: 41.4, consensus: 40.9, unit: "Mr $", note: "Beklentinin %0,4 Üzerinde", tone: "up" },
      { label: "Düzeltilmiş HBK (4Ç)", low: 3.02, high: 3.1, consensus: 3.04, unit: "$", note: "Beklentide", tone: null },
      { label: "Gelir (Tüm Yıl)", low: 169, high: 170, consensus: 169.3, unit: "Mr $", note: "Önceki Hedef 168,5", tone: "up" },
    ]),
    ceo_quote: JSON.stringify({ quote: "Profesyonel müşterilerimizle kurduğumuz ilişki her çeyrek derinleşiyor; konut piyasası toparlandığında bu yatırımların karşılığını iki kat alacağız. Kendi ifadesiyle: we are gaining share in a soft market — zayıf bir pazarda pay kazanıyoruz.", name: "Ted Decker", title: "CEO · Kazanç Çağrısı", topics: ["Pay Kazanımı", "Profesyonel Müşteri", "Konut Döngüsü"] }),
    sources: JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ label: `HD 3Ç 2026 Kaynak Belgesi ${i + 1} (Uzun Yayın Adı)`, url: `https://example.com/kaynak/${i}` }))),
    generated_by: "claude", updated_at: NOW_ISO, published_at: NOW_ISO,
  };
  const extras = {
    analysis_id: row.id,
    takeaways: JSON.stringify(["Gelir yıllık %6 artışla 44,6 milyar dolar oldu ve beklentiyi %1,4 aştı.", "Profesyonel müşteri satışları %9 büyüdü, gelirin yarısına ulaştı.", "Yıl sonu hedefi korundu; hisse açılış öncesi %2,4 yükseldi."]),
    segments: JSON.stringify([{ name: "Profesyonel Müşteri", revenue: 22.3e9, yoyPct: 9 }, { name: "Bireysel Müşteri", revenue: 18.1e9, yoyPct: 2.1 }, { name: "Online", revenue: 3.2e9, yoyPct: 11 }, { name: "Diğer", revenue: 1.0e9, yoyPct: -4 }]),
    segments_source: "press-release",
    kpis: JSON.stringify([{ name: "İşlem Sayısı", value: 412e6, unit: "işlem", yoyPct: 1.2, source: "press-release" }, { name: "Ortalama Sepet", value: 90.4, unit: "USD", yoyPct: 0.6, source: "press-release" }, { name: "Serbest Nakit Akışı", value: 4.1e9, unit: "USD", yoyPct: 12, source: "press-release" }, { name: "Hisse Geri Alımı", value: 1.2e9, unit: "USD", source: "press-release" }, { name: "Ödenen Temettü", value: 2.2e9, unit: "USD", source: "press-release" }]),
    updated_at: NOW_ISO,
  };
  return { row, extras };
};
