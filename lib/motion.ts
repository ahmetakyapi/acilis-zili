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

/** Çıkış eğrisi (ease-in-quint), CSS `--ease-brand-in` ile aynı. */
export const EASE_BRAND_IN_POINTS = [0.64, 0, 0.78, 0] as const;
export const EASE_BRAND_IN = `cubic-bezier(${EASE_BRAND_IN_POINTS.join(", ")})`;

/**
 * Çıkış girişten kısa (12 Ekim; motion-film `sayilar.md`: Material 3 400 ms
 * girişe 200 ms çıkış). Menü, açılır panel, silinen satır: `exit` geçişi bu.
 * Süre girişin %55'i, eğri ease-in — giden şey hızlanarak gider.
 */
export const exitOf = (enterSeconds: number) => ({ duration: Math.round(enterSeconds * 0.55 * 1000) / 1000, ease: EASE_BRAND_IN_POINTS });

/** Seçim işaretleri hedefinde durur; panel gibi yaylanmaz. */
export const SELECTION_TRANSITION = { duration: 0.28, ease: EASE_BRAND_POINTS } as const;
