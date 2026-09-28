"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketSession } from "@/lib/market-hours";
import { cn } from "@/lib/utils";

export type SessionLineData = {
  session: MarketSession;
  /** Sayılan zil: seans açıkken kapanış, değilse açılış. */
  targetIso: string;
  /** Sunucunun anı — hidrasyonda aynı metin basılsın. */
  nowMs: number;
};

export type SessionLineLabels = {
  open: string;
  closed: string;
  preMarket: string;
  afterHours: string;
  toOpen: string;
  toClose: string;
  d: string;
  h: string;
  m: string;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Kalan süre parçaları: [5 sa, 48 dk] · [2 g, 4 sa] · [12 dk] — saniye yok. */
function remaining(ms: number, l: SessionLineLabels): { n: number; unit: string }[] {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  /* AŞAĞI YUVARLAMA (28 Eylül denetimi): yukarı yuvarlanınca 2 sa 0 dk 20 sn
     "2 sa 1 dk" oluyordu; saat hanesi aşağı, dakika yukarı sayıyordu. Son
     dakikada "1 dk" kalıyor, sıfır basılmıyor. */
  const minutes = ms < MINUTE ? 1 : Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return [{ n: days, unit: l.d }, { n: hours, unit: l.h }];
  if (hours > 0) return [{ n: hours, unit: l.h }, { n: minutes, unit: l.m }];
  return [{ n: minutes, unit: l.m }];
}

/**
 * Markanın altındaki seans satırı — her ekranda zilin durumu (28 Eylül).
 *
 * Sitenin adı Açılış Zili ama seansın açık olup olmadığı ve zile ne kadar
 * kaldığı yalnızca ana sayfada görünüyordu; bir hisse ya da teknik ekranda
 * okuyucu bunu hiç göremiyordu. Başlıkta sekmelere yer yok (1280'de 24
 * piksel pay, `nav-items.ts`), alt şeridin payı da ölçülü (1024'te 36
 * piksel, `MarketTicker.tsx`); satır bu yüzden marka adının ALTINDA ve
 * onunla ortak eksende ortalı (genişlik ve ölçüm globals.css'te).
 *
 * Durumu nokta rengi söylüyor (açık yeşil, uzatılmış seans pirinç, kapalı
 * gri); metin yalnızca sayılan zili ve kalan süreyi yazıyor. Tam durum
 * `title` ve ekran okuyucu metninde.
 *
 * DÜZEN KATMANINDA, YANİ GEZİNMEDE YENİDEN ÇİZİLMİYOR. Sunucu bir kez
 * hedef zili veriyor, istemci dakikada bir sayıyor. Hedef geçince sonraki
 * zili istemci bilemez (tatil takvimi sunucuda): satır o an durumu yazıyor
 * ve `router.refresh()` ile sunucudan yeni hedefi istiyor (aşağıda).
 * Uydurma bir geri sayım basılmıyor.
 */
export function SessionLine({
  data,
  labels,
  className,
}: {
  data: SessionLineData;
  labels: SessionLineLabels;
  className?: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(data.nowMs);
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      timer = window.setTimeout(tick, MINUTE - (Date.now() % MINUTE) + 50);
    };
    timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const target = new Date(data.targetIso).getTime();
  const passed = now >= target;

  /* ZİL GEÇİNCE SUNUCUDAN YENİ HEDEF (28 Eylül denetimi). Satır düzen
     katmanında ve istemci gezinmesinde yeniden çizilmiyor; hedef geçince
     "Piyasa Açık"ta donup kapanıştan sonra da öyle kalıyordu. Geçiş anında
     bir kez `router.refresh()`: düzen sunucuda yeniden çözülüyor ve bir
     sonraki zil (tatil takvimiyle) geliyor. Aynı hedef için tek istek. */
  useEffect(() => {
    if (!passed || refreshedFor.current === data.targetIso) return;
    refreshedFor.current = data.targetIso;
    router.refresh();
  }, [passed, data.targetIso, router]);
  /* Hedef geçtiyse durum tersine döndü: açıktı → kapandı, kapalıydı → açıldı. */
  const open = passed ? data.session !== "regular" : data.session === "regular";
  const extended = !passed && (data.session === "pre-market" || data.session === "after-hours");
  const tone = open ? "open" : extended ? "extended" : "closed";
  const state = open
    ? labels.open
    : extended
      ? data.session === "pre-market"
        ? labels.preMarket
        : labels.afterHours
      : labels.closed;
  const parts = passed ? null : remaining(target - now, labels);
  const lead = data.session === "regular" ? labels.toClose : labels.toOpen;
  const spoken = parts ? `${lead} ${parts.map((part) => `${part.n} ${part.unit}`).join(" ")}` : null;

  /* OKUMA SIRASI (28 Eylül): sayılar koyu ve eşit genişlikli, birimler ve
     "Kapanışa" soluk — süre bir bakışta okunuyor; ilk hâlde bütün satır aynı
     soluk tondaydı ve marka adının altında bir dipnot gibi duruyordu. */
  return (
    <span className={cn("session-line", className)} data-tone={tone} title={spoken ? `${state} · ${spoken}` : state}>
      <i aria-hidden className="session-dot" />
      <span className="sr-only">{spoken ? `${state}: ${spoken}` : state}</span>
      <span aria-hidden className="session-text">
        {parts ? (
          <>
            <span className="session-lead">{lead}</span>
            {parts.map((part) => (
              <span key={part.unit} className="session-part">
                <b className="numeral">{part.n}</b>
                <small>{part.unit}</small>
              </span>
            ))}
          </>
        ) : (
          <span className="session-state">{state}</span>
        )}
      </span>
    </span>
  );
}
