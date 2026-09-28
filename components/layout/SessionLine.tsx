"use client";

import { useEffect, useState } from "react";
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

/** "5 sa 48 dk" · "2 g 4 sa" · "12 dk" — saniye yok, satır dakikada bir değişiyor. */
function remaining(ms: number, l: SessionLineLabels): string {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.max(1, Math.ceil((ms % HOUR) / MINUTE));
  if (days > 0) return `${days} ${l.d} ${hours} ${l.h}`;
  if (hours > 0) return `${hours} ${l.h} ${Math.min(minutes, 59)} ${l.m}`;
  return `${minutes} ${l.m}`;
}

/**
 * Markanın altındaki seans satırı — her ekranda zilin durumu (28 Eylül).
 *
 * Sitenin adı Açılış Zili ama seansın açık olup olmadığı ve zile ne kadar
 * kaldığı yalnızca ana sayfada görünüyordu; bir hisse ya da teknik ekranda
 * okuyucu bunu hiç göremiyordu. Başlıkta sekmelere yer yok (1280'de 24
 * piksel pay, `nav-items.ts`), alt şeridin payı da ölçülü (1024'te 36
 * piksel, `MarketTicker.tsx`); satır bu yüzden marka adının ALTINDA ve
 * genişliği yerleşime sayılmıyor (`w-0 min-w-full`, sağa taşabilir):
 * sekmelerin ölçülmüş yeri kıpırdamıyor.
 *
 * Durumu nokta rengi söylüyor (açık yeşil, uzatılmış seans pirinç, kapalı
 * gri); metin yalnızca sayılan zili ve kalan süreyi yazıyor. Tam durum
 * `title` ve ekran okuyucu metninde.
 *
 * DÜZEN KATMANINDA, YANİ GEZİNMEDE YENİDEN ÇİZİLMİYOR. Sunucu bir kez
 * hedef zili veriyor, istemci dakikada bir sayıyor. Hedef geçince sonraki
 * zili istemci bilemez (tatil takvimi sunucuda): satır durumu yazıp süreyi
 * bırakıyor ("Piyasa Açık" gibi), bir sonraki tam yüklemede yeni hedef
 * geliyor. Uydurma bir geri sayım basılmıyor.
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
  const [now, setNow] = useState(data.nowMs);
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
  const count = passed ? null : `${data.session === "regular" ? labels.toClose : labels.toOpen} ${remaining(target - now, labels)}`;

  return (
    <span className={cn("session-line", className)} data-tone={tone} title={count ? `${state} · ${count}` : state}>
      <i aria-hidden className="session-dot" />
      <span className="sr-only">{state}: </span>
      <span className="numeral" aria-hidden={count ? undefined : true}>
        {count ?? state}
      </span>
    </span>
  );
}
