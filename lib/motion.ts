/**
 * Marka eğrisi, Web Animations API için (10 Ekim).
 *
 * CSS tarafı `var(--ease-brand)` okuyor (app/globals.css); `element.animate`
 * CSS değişkeni çözmediği için JS'te aynı eğrinin metni gerekiyor. Yedi
 * bileşen onu elle yazıyordu ve tasarım denetimi bunu kopya olarak
 * işaretledi: eğri değişirse yedi yerin hepsini bulmak gerekirdi. Bu dosya
 * "use client" DEĞİL, sunucu ve istemci ikisi de okuyabilir.
 */
export const EASE_BRAND = "cubic-bezier(0.22, 1, 0.36, 1)";
