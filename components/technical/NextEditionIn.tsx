"use client";

import { useEffect, useState } from "react";
import { durationOf } from "@/components/figures/session-bell/model";

/**
 * Sıradaki yayına KALAN SÜRE — saat künyesinin yanına eklenen küçük yaprak
 * (14 Ekim). Künye yalnızca dilim + saat yazıyordu ("Kapanışa Doğru ·
 * 21:45") ve okuyucuya saat hesabı bırakıyordu; sayfanın kendi kaydı bu
 * satırı "elindeki görüş ne kadar geçerli" sorusunun cevabı sayıyor.
 *
 * - Sunucu hiçbir şey basmıyor: içerik hidrasyonda EKLENİR, var olan
 *   hiçbir şey sönmez (ilk ekran kuralı). JS yokken künye bugünkü hâliyle
 *   kalır — eksilme yok.
 * - Dakika taneciği, saniye tıkırtısı yok: zamanlayıcı dakikada bir
 *   uyanıyor, gizli sekmede durup öne gelince tazeleniyor (TabCountdown
 *   deseni). Döngülü animasyon yok.
 * - Süre biçimi seans zili figürüyle aynı (`durationOf`): "2 sa 14 dk".
 */
export function NextEditionIn({
  atIso,
  template,
  units,
  sep,
}: {
  atIso: string;
  /** "{d} sonra" — sözlükte `technical.nextEditionIn`. */
  template: string;
  units: { day: string; hour: string; minute: string };
  /** Künye ayracı — etiketle BİRLİKTE basılır ki etiket yokken ayraç
      tek başına sarkmasın. */
  sep?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);
  /* Alanlar tek tek: `units` her çizimde yeni bir nesne ve doğrudan
     bağımlılık yapılsaydı etki her çizimde yeniden kurulurdu. */
  const { day, hour, minute } = units;
  useEffect(() => {
    const atMs = Date.parse(atIso);
    const update = () => {
      const ms = atMs - Date.now();
      setLabel(ms > 60_000 ? template.replace("{d}", durationOf(ms, { day, hour, minute })) : null);
    };
    update();
    const timer = window.setInterval(() => {
      if (!document.hidden) update();
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [atIso, template, day, hour, minute]);
  if (!label) return null;
  return <>{sep}<span className="whitespace-nowrap">{label}</span></>;
}
