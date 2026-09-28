/**
 * `datePicker` ad alanı — sözlüğün parçası (tr.ts / en.ts bunu `datePicker`
 * anahtarına koyuyor) ama AYRI dosyada.
 *
 * NEDEN AYRI: tarih seçici bir istemci bileşeni ve dokuz yerde kullanılıyor
 * (vergi hesaplayıcı, ekstre önizlemesi, portföy, üç yönetim ekranı).
 * Etiketleri her birine prop olarak taşımak dokuz ayrı zincir demekti; tüm
 * sözlüğü istemciye içe aktarmak ise yüzlerce KB'lık iki dili tarayıcıya
 * indirmek. Bu küçük modül iki dilin yalnızca seçici metnini taşıyor ve
 * seçici dili adresten okuyup buradan seçiyor.
 */

export const datePickerTr = {
  openCalendar: "Takvimi Aç",
  dialog: "Tarih Seç",
  prevMonth: "Önceki Ay",
  nextMonth: "Sonraki Ay",
  prevYears: "Önceki Yıllar",
  nextYears: "Sonraki Yıllar",
  chooseMonthYear: "Ay ve Yıl Seç",
  backToDays: "Günlere Dön",
  today: "Bugün",
  clear: "Temizle",
  close: "Kapat",
  invalid: "Tarih okunamadı; {pattern} biçiminde yaz.",
  beforeMin: "{date} tarihinden önce olamaz.",
  afterMax: "{date} tarihinden sonra olamaz.",
  weekend: "Hafta Sonu",
  selected: "Seçili",
  keyboardHint: "Oklar gün, PageUp ve PageDown ay, Shift ile yıl değiştirir.",
};

export const datePickerEn: typeof datePickerTr = {
  openCalendar: "Open Calendar",
  dialog: "Choose a Date",
  prevMonth: "Previous Month",
  nextMonth: "Next Month",
  prevYears: "Earlier Years",
  nextYears: "Later Years",
  chooseMonthYear: "Choose Month and Year",
  backToDays: "Back to Days",
  today: "Today",
  clear: "Clear",
  close: "Close",
  invalid: "Couldn't read that date; use {pattern}.",
  beforeMin: "Can't be before {date}.",
  afterMax: "Can't be after {date}.",
  weekend: "Weekend",
  selected: "Selected",
  keyboardHint: "Arrows move by day, PageUp and PageDown by month, add Shift for a year.",
};

export type DatePickerLabels = typeof datePickerTr;
