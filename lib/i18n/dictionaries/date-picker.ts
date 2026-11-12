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
  today: "Bugün",
  clear: "Temizle",
  close: "Kapat",
  empty: "Tarih Seçilmedi",
  invalid: "Tarih okunamadı; {pattern} biçiminde yaz.",
  beforeMin: "{date} tarihinden önce olamaz.",
  afterMax: "{date} tarihinden sonra olamaz.",
  selected: "Seçili",
  keyboardHint: "Oklar gün, PageUp ve PageDown ay, Shift ile yıl değiştirir; başlığa basınca yıl ve ay ızgarası açılır.",
  pickPeriod: "Yıl ve Ay Seç",
  backToDays: "Günlere Dön",
  chooseYear: "Yıl Seç",
  chooseMonth: "Ay Seç",
  prevMonth: "Önceki Ay",
  nextMonth: "Sonraki Ay",
  prevYear: "Önceki Yıl",
  nextYear: "Sonraki Yıl",
  typeHint: "Yazarak da girebilirsin: {example}",
};

export const datePickerEn: typeof datePickerTr = {
  openCalendar: "Open Calendar",
  dialog: "Choose a Date",
  today: "Today",
  clear: "Clear",
  close: "Close",
  empty: "No Date Chosen",
  invalid: "Couldn't read that date; use {pattern}.",
  beforeMin: "Can't be before {date}.",
  afterMax: "Can't be after {date}.",
  selected: "Selected",
  keyboardHint: "Arrows move by day, PageUp and PageDown by month, add Shift for a year; press the heading to open the year and month grid.",
  pickPeriod: "Choose Year and Month",
  backToDays: "Back to Days",
  chooseYear: "Choose a Year",
  chooseMonth: "Choose a Month",
  prevMonth: "Previous Month",
  nextMonth: "Next Month",
  prevYear: "Previous Year",
  nextYear: "Next Year",
  typeHint: "You can also type it: {example}",
};
