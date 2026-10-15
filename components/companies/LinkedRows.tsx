"use client";

import type { ComponentProps, MouseEvent } from "react";

/**
 * Dizin tablosunun gövdesi — SATIRIN TAMAMI GEZİNİR (14 Ekim).
 *
 * Hover/odak vurgusu satırın tamamına uygulanıyor (mavi tint + mürekkep
 * kenarı: projenin dilinde "bu etkileşimli") ama bağlantı yalnızca şirket
 * hücresindeydi: yüzde ya da piyasa değeri hücresine tıklayan okuyucuya
 * hiçbir şey olmuyordu. Tıklama artık satırdaki GERÇEK bağlantıya
 * devrediliyor (`link.click()`):
 *
 * - Semantik bozulmuyor: orta tık, yeni sekme, ekran okuyucu ve klavye
 *   bağlantının kendisinde; biz yalnızca düz sol tıklamayı taşıyoruz.
 * - Gezinme göstergesi kendiliğinden yanıyor — RouteProgress belgeyi
 *   yakalama evresinde dinliyor ve `click()` gerçek bir olay üretiyor.
 * - Metin seçimi tıklama değildir: seçim varsa devretmiyoruz (sayı kopyalan
 *   okuyucunun sayfası değişmesin).
 * - İç içe etkileşimli öğeye (bağlantı, düğme) basılmışsa karışmıyoruz.
 */
export function LinkedRows(props: ComponentProps<"tbody">) {
  function delegate(event: MouseEvent<HTMLTableSectionElement>) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target as Element | null;
    if (!target || target.closest("a, button, input, summary, label")) return;
    if (window.getSelection()?.toString()) return;
    target.closest("tr")?.querySelector("a")?.click();
  }
  return <tbody {...props} onClick={delegate} />;
}
