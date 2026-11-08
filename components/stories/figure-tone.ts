/* --------------------------------------------------------------------------
   Kapak rakamının YÖNÜ — yalnız yazarın yazdığı işaretten.

   "Sayılarla" bloğunun değerini rutin düz metin olarak yazıyor ("−%42,9",
   "+%12,53", "9,6 Mr $", "~2 Mr $"). Kart renk ve ikonu buradan alıyor ve
   kural CLAUDE.md'nin "renk anlam taşır" maddesi: yön ANCAK değer açıkça
   işaretliyse var. İşaretsiz büyüklük (geri alım tutarı, nakit) bir yön
   söylemiyor — "9,6 Mr $" iyi ya da kötü değil, yalnız büyük; nötr kalır.
   Yaklaşık işareti (`~`, `≈`) yön değil, kesinlik künyesi: atlanıp
   arkasındaki işarete bakılıyor.

   Tanınan işaretler: eksi (U+2212), tire-eksi (yalnız ardından rakam, `%`
   ya da para simgesi gelirse — "10-K" bir eksi değil), artı ve ▲/▼. Türkçe
   yüzdede işaret `%`ten önce de sonra da gelebiliyor ("−%5", "%−5").
   Sıfır ("+%0", "−0,0") yön değil, düz.

   Düz modül: sunucu bileşeni de istemci bileşeni de aynı değeri alsın
   (CLAUDE.md → "use client" modülden dışa aktarılan değer).
   -------------------------------------------------------------------------- */

type FigureTone = "up" | "down" | "flat";

const LEAD = /^[\s~≈]*(?:[%$€₺]\s*)?/;

export function figureTone(value: string): FigureTone {
  const body = value.replace(LEAD, "");
  const sign = body.charAt(0);
  const rest = body.slice(1).trimStart();

  let tone: FigureTone = "flat";
  if (sign === "▲" || sign === "+") tone = "up";
  else if (sign === "▼" || sign === "−") tone = "down";
  else if (sign === "-" && /^[%$€₺\d]/.test(rest)) tone = "down";
  if (tone === "flat") return tone;

  /* "+%0", "−0,00", "▲ 0" — işaretli ama yönsüz. */
  const digits = rest.match(/\d[\d.,]*/);
  if (digits && !/[1-9]/.test(digits[0])) return "flat";
  return tone;
}
