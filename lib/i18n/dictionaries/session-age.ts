/**
 * `sessionAge` ad alanı — geçmiş seansı anlatan ana sayfa panellerinin
 * "hangi seans" künyesi (28 Ekim; gerekçe `components/today/home/SessionAgeTag.tsx`).
 * Ayrı dosyada: paralel paketler sözlüğün ortasına anahtar serpiştirmesin.
 */

export const sessionAgeTr = {
  today: "Bugünkü Seans",
  yesterday: "Dünkü Seans",
  /* {day}: hafta günü, "Cuma Seansı". */
  weekday: "{day} Seansı",
  earlier: "Önceki Seans",
  /* Seans açıkken panel bugünü anlatmıyor; tek cümleyle söylenir. */
  liveNote: "Bugünün seansı sürüyor; bu panel önceki kapanışı anlatıyor.",
};

export const sessionAgeEn: typeof sessionAgeTr = {
  today: "Today's Session",
  yesterday: "Yesterday's Session",
  weekday: "{day}'s Session",
  earlier: "Earlier Session",
  liveNote: "Today's session is underway; this panel covers the previous close.",
};
