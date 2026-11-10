"use client";

import { useEffect } from "react";
import { useMotionPreference } from "./useMotionPreference";

/**
 * ÇİZİM KAPISI (10 Kasım, tutarlılık denetimi). Kabukta BİR KEZ bağlanır;
 * `data-draw` taşıyan her öğenin CSS çizimi, öğe ekrana girdiği an oynar.
 *
 * NEDEN: veri çizimleri (ölçü şeridi, kulvar dolgusu, sütun) modül CSS'iyle
 * YÜKLEMEDE oynuyordu. Canlıda ölçüldü: dört ekranda 31 `MetricStrip` ve
 * ana sayfada 58 çizim ekranın altında, kimse görmeden dolup bitiyordu;
 * okur oraya indiğinde her şey çoktan durmuştu. Piyasalar ve şirket
 * sayfasının derinlik panelleri ise JS ile (`MotionExperience`) görününce
 * çiziyordu: aynı sitede iki ayrı davranış.
 *
 * NASIL: ekranın altındaki `data-draw` öğesi `data-armed` alır; globals.css
 * o durumda öğenin ve içinin `animation-name`ini kaldırır (öğe SON KAREDE
 * durur — sunucu son kareyi basar kuralı; görünmeyen yerde). Öğe ekrana
 * değdiği an öznitelik kalkar, animasyon adı geri gelir ve çizim BAŞTAN
 * oynar (gecikmeler ve kademe dahil). Duraklatma (`animation-play-state`)
 * yerine ad kaldırma: hidrasyon geç gelirse duraklatılan çizim yarıda
 * kalmış bir karede beklerdi.
 *
 * İlk ekrandaki öğeye DOKUNULMAZ: yüklemede kendi CSS'iyle oynar, ilk
 * boyama gecikmez. Hareketi azaltan için kapı hiç kurulmaz (genel blok
 * süreyi zaten sıfırlıyor). Akışla (Suspense) ve gezinmeyle sonradan gelen
 * öğeler `MutationObserver` ile yakalanır; yalnız eklenen düğümler izlenir,
 * stil değişiklikleri değil.
 *
 * Kullanım: çizimi taşıyan öğeye (ya da kabına) `data-draw` yaz. Yeni bir
 * sarmalayıcı bileşen gerekmez. Katalog: `.claude/rules/hareket.md`.
 */
export function DrawGate() {
  const reduced = useMotionPreference();

  useEffect(() => {
    if (reduced || typeof IntersectionObserver === "undefined") return;
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.removeAttribute("data-armed");
        observer.unobserve(entry.target);
      }
    });
    const scan = () => {
      for (const node of document.querySelectorAll("[data-draw]")) {
        if (seen.has(node)) continue;
        seen.add(node);
        if (node.getBoundingClientRect().top < window.innerHeight) continue;
        node.setAttribute("data-armed", "");
        observer.observe(node);
      }
    };
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    };
    scan();
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
      cancelAnimationFrame(frame);
      for (const node of document.querySelectorAll("[data-draw][data-armed]")) node.removeAttribute("data-armed");
    };
  }, [reduced]);

  return null;
}
