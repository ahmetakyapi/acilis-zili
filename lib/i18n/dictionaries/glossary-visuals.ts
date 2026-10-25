/**
 * `glossaryVisuals` ad alanı — Sözlüğün terim görselleri (kesir, kadran)
 * (25 Ekim, öğrenme ve hesap araçlarının görsel turu). Sözlüğün parçası
 * (tr.ts / en.ts bunu `glossaryVisuals` anahtarına koyuyor), ayrı dosyada:
 * paralel geliştirilen paketler sözlüğün ortasına anahtar serpiştirmesin.
 *
 * Formüllerin kendisi (pay, payda) `content/glossary/formulas.ts`te, terim
 * verisinin yanında; burada yalnız çizimin çevresindeki kelimeler.
 */

export const glossaryVisualsTr = {
  /** Ekran okuyucu: "Formül: Hisse Fiyatı bölü Hisse Başı Kâr". */
  formulaAria: "Formül: {a} {op} {b}",
  ops: { divide: "bölü", multiply: "çarpı", subtract: "eksi" },
  /** "× 100" çipinin ipucu. */
  percent: "Sonuç yüzde olarak okunur",
  rsi: { low: "Aşırı Satım", mid: "Nötr", high: "Aşırı Alım" },
  pmi: { low: "Daralma", high: "Genişleme" },
  dialAria: "0 ile 100 arasında bir ölçek; eşikler {cuts}",
};

export const glossaryVisualsEn: typeof glossaryVisualsTr = {
  formulaAria: "Formula: {a} {op} {b}",
  ops: { divide: "divided by", multiply: "times", subtract: "minus" },
  percent: "The result is read as a percentage",
  rsi: { low: "Oversold", mid: "Neutral", high: "Overbought" },
  pmi: { low: "Contraction", high: "Expansion" },
  dialAria: "A scale from 0 to 100; thresholds at {cuts}",
};
