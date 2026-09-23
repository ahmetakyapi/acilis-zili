"use client";

import { useEffect, useState } from "react";
import styles from "@/components/calendar/CalendarExperience.module.css";

const DAY_HREF = "#gun-";
/** Gündem kabı — sayfa `data-agenda` ile işaretliyor. */
const agendaOf = () => document.querySelector<HTMLElement>("[data-agenda]");

/**
 * Takvimde gün SEÇİMİ — çapaya atlamanın yerine.
 *
 * Şeritteki her olaylı gün `#gun-…` çapasıydı: tıklayınca tarayıcı o günün
 * bölümünü ekranın tepesine atıyor, takvim görünümden çıkıyordu. Ay
 * görünümünde bölüm ızgaranın 300-1500 piksel altında; başka bir güne
 * bakmak için okuyucu her seferinde yukarı kaydırmak zorundaydı (sahibinin
 * şikâyeti, 23 Eylül).
 *
 * Şimdi tıklama günü SEÇİYOR: gündem yalnızca o günü gösteriyor, bölüm
 * ızgaranın hemen altına iniyor ve sayfa ancak bölüm ekrandan taşıyorsa o
 * kadar kayıyor (`block: "nearest"`). Aynı güne ikinci tıklama ya da
 * "Tüm Günler" seçimi kaldırır. Kapaktaki "sıradaki açıklama" kartı da aynı
 * çapayı taşıyor ve aynı yoldan geçiyor.
 *
 * Çapalar yerinde duruyor: JavaScript yokken, yeni sekmede açarken ve
 * bağlantı paylaşılırken eski davranış (bölüme atlama) geçerli. Seçim
 * sunucunun çizdiği düğümlere öznitelik olarak yazılıyor; görünüm ya da
 * önem süzgeci değişince sayfa bu bileşeni `key` ile yeniden kuruyor.
 */
export function DayPicker({ note, showAll }: { note: string; showAll: string }) {
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const href = link?.getAttribute("href");
      if (!href?.startsWith(DAY_HREF)) return;
      const section = document.getElementById(href.slice(1));
      if (!section || section.parentElement !== agendaOf()) return;
      event.preventDefault();
      const date = href.slice(DAY_HREF.length);
      setDay((current) => (current === date ? null : date));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const agenda = agendaOf();
    if (!agenda) return;
    const id = day ? `gun-${day}` : null;
    if (id) agenda.dataset.picked = "";
    else delete agenda.dataset.picked;
    for (const child of Array.from(agenda.children)) {
      child.toggleAttribute("data-picked", child.id === id);
    }
    document.querySelectorAll<HTMLAnchorElement>(`a[href^="${DAY_HREF}"]`).forEach((link) => {
      if (link.getAttribute("href") === `#${id}`) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    if (!id) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [day]);

  return (
    <p className={styles.quiet} data-picker hidden={!day}>
      <span>{note}</span>
      <button type="button" className={styles.quietAction} onClick={() => setDay(null)}>
        {showAll}
      </button>
    </p>
  );
}
