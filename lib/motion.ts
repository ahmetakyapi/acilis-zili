/**
 * Marka eğrisi, Web Animations API için (10 Ekim).
 *
 * CSS tarafı `var(--ease-brand)` okuyor (app/globals.css); `element.animate`
 * CSS değişkeni çözmediği için JS'te aynı eğrinin metni gerekiyor. Yedi
 * bileşen onu elle yazıyordu ve tasarım denetimi bunu kopya olarak
 * işaretledi: eğri değişirse yedi yerin hepsini bulmak gerekirdi. Bu dosya
 * "use client" DEĞİL, sunucu ve istemci ikisi de okuyabilir.
 */
/** Motion ve Web Animations aynı eğriden türetilir. */
export const EASE_BRAND_POINTS = [0.22, 1, 0.36, 1] as const;
export const EASE_BRAND = `cubic-bezier(${EASE_BRAND_POINTS.join(", ")})`;

/** Seçim işaretleri hedefinde durur; panel gibi yaylanmaz. */
export const SELECTION_TRANSITION = { duration: 0.28, ease: EASE_BRAND_POINTS } as const;
