"use client";

import { useEffect, useMemo, useState } from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { etDateTimeToUtc } from "@/lib/market-hours";
import { formatInZone } from "@/lib/session-clock";
import { requestFlowSelect, useFlowSnapshot } from "./day-flow-store";
import styles from "./SessionRail.module.css";

/** Şeridin ilerleme adımı: saniye geri sayımda, şerit dakikanın işi. */
const TICK_MS = 60_000;
/** İşaretlerin merkezden merkeze en küçük aralığı (rozetin kendi boyu + nefes).
 *  Rozet artık saati de taşıyor ("01 15:30", ~62 piksel); 30 piksellik eski
 *  aralık yalnız numaraya göreydi. */
const MARKER_GAP_PX = 68;

const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/**
 * İşaretlerin eksendeki yeri — çakışanlar İTİLİR, saatleri kaymaz.
 * Gün akışının eski şeridindeki iki geçişli algoritmanın aynısı (orada
 * gerekçesi ölçülerle yazılıydı: 14:00 ile 14:30 telefonda 14 piksel
 * arayla düşüyor, rozetler birbirinin rakamını kesiyordu). Çentik gerçek
 * saatte kalır, kayan yalnızca rozet.
 */
function spread(points: number[], width: number, gap: number): number[] {
  if (width <= 0) return points.map((p) => p * width);
  const half = gap / 2;
  const order = points.map((p, i) => ({ i, x: p * width })).sort((a, b) => a.x - b.x);
  for (let k = 1; k < order.length; k++) order[k]!.x = Math.max(order[k]!.x, order[k - 1]!.x + gap);
  for (let k = order.length - 1; k >= 0; k--) {
    const ceiling = k === order.length - 1 ? width - half : order[k + 1]!.x - gap;
    order[k]!.x = Math.max(half, Math.min(order[k]!.x, ceiling));
  }
  const out = new Array<number>(points.length);
  for (const item of order) out[item.i] = item.x;
  return out;
}

export type SessionRailLabels = {
  /** Şeridin adı — "Piyasa Saatleri". */
  name: string;
  selectEvent: string;
  /** Eksenin iki ucu, okuyucunun saatiyle: "11:00", "03:00 TR". */
  start: string;
  end: string;
  /** Zil çentiklerinin adı ve saati: "Açılış 16:30", "Kapanış 23:00". */
  open: string;
  close: string;
};

/**
 * ZİL ŞERİDİ — geri sayımın altında, seansın kendisi.
 *
 * Gün şeridi eskiden "Bugünün Akışı" panelinin içindeydi: 1440'ta 623
 * piksellik panelin 190 pikseli şeritti ve açılış/kapanış saatleri ilk
 * ekranda İKİ KEZ yazıyordu (zil künyesinde ve şeridin üstünde). Kahramanın
 * zaten saydığı şey bu eksenin bir noktası; şerit oraya, sayacın altına
 * taşındı ve zil künyesinin iki kıl çizgisinin yerini aldı. Saatler yalnızca
 * künyede yazıyor, şerit onları konum olarak gösteriyor.
 *
 * Geometri markanın ağız çubuğu: 8 piksel boy, yarıçap boyun yarısı. Eksen
 * 04:00–20:00 ET (erken kapanışta 17:00), yani endeks kartlarındaki kıvılcım
 * çizgileriyle AYNI eksen (`sessionDomain`) — kahramandaki iki zaman çizimi
 * aynı günü aynı ölçekte anlatıyor. Ön seans ve kapanış sonrası çukur tonda,
 * asıl seans mavinin %30'u, geçen kısım düz mavi.
 *
 * "Şimdi" dakikada bir ilerliyor (600 ms, marka eğrisi); azaltılmış
 * harekette geçiş yok. Olay işaretleri gün akışının kendi fotoğrafından
 * (`day-flow-store`) ve yalnızca eksenin anlattığı günse: gece yarısından
 * sonra şerit dünkü seansı anlatırken akış bugünün takvimine geçmiş
 * olabilir. Telefonda işaret düğmesi yok, çentik var — 350 piksele
 * sıkışmış rozetler gün akışında bir kez denenip kaldırılmıştı.
 */
export function SessionRail({
  domain,
  openAt,
  closeAt,
  day,
  minutes,
  live,
  target,
  initialNowMs,
  zone,
  labels,
}: {
  domain: [number, number];
  openAt: number;
  closeAt: number;
  day: string;
  minutes: [number, number];
  /** Seans (ön, asıl ya da sonrası) sürüyor mu — nabız yalnızca o zaman. */
  live: boolean;
  /** Sayacın saydığı zil: kapalıyken açılış, seans içinde kapanış. */
  target: "open" | "close";
  initialNowMs: number;
  /** Okuyucunun saat dilimi — olay rozetindeki saat onunla yazılır. */
  zone: string;
  labels: SessionRailLabels;
}) {
  const [nowMs, setNowMs] = useState(initialNowMs);
  const [width, setWidth] = useState(0);
  const [axis, setAxis] = useState<HTMLDivElement | null>(null);
  const reduced = useMotionPreference();
  const snapshot = useFlowSnapshot();

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      if (!document.hidden) setNowMs(Date.now());
      timer = window.setTimeout(tick, TICK_MS - (Date.now() % TICK_MS) + 50);
    };
    const resume = () => {
      if (!document.hidden) setNowMs(Date.now());
    };
    timer = window.setTimeout(tick, 0);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  useEffect(() => {
    if (!axis || typeof ResizeObserver === "undefined") return;
    const sync = () => setWidth(axis.clientWidth);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(axis);
    return () => observer.disconnect();
  }, [axis]);

  const span = domain[1] - domain[0];
  const at = (seconds: number) => Math.max(0, Math.min(1, (seconds - domain[0]) / span));
  const nowFraction = at(nowMs / 1000);
  const open = at(openAt);
  const close = at(closeAt);

  /* Aynı dakikadaki olaylar TEK işaret: numara ilkinin, "+n" kalanların. */
  const groups = useMemo(() => {
    if (!snapshot || snapshot.dateEt !== day) return [];
    const byTime = new Map<string, { id: string; index: number; title: string; released: boolean }[]>();
    snapshot.events.forEach((event, index) => {
      if (!event.timeEt) return;
      const list = byTime.get(event.timeEt) ?? [];
      list.push({ id: event.id, index, title: event.title, released: event.status !== "scheduled" });
      byTime.set(event.timeEt, list);
    });
    return [...byTime.entries()]
      .map(([time, events]) => ({
        time,
        events,
        at: Math.max(0, Math.min(1, (minutesOf(time) - minutes[0]) / (minutes[1] - minutes[0]))),
      }))
      .sort((a, b) => a.at - b.at);
  }, [snapshot, day, minutes]);
  const xs = useMemo(() => spread(groups.map((group) => group.at), width, MARKER_GAP_PX), [groups, width]);

  function choose(id: string) {
    requestFlowSelect(id);
    document.getElementById("gunun-akisi")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  }

  const pct = (value: number) => `${(value * 100).toFixed(3)}%`;

  return (
    <div className={styles.rail} role="group" aria-label={labels.name}>
      {/* ZİLLERİN ADI ÇENTİĞİN ÜSTÜNDE (24 Eylül). Şeritte iki çentik vardı
          ama hangisinin açılış hangisinin kapanış olduğunu hiçbir şey
          söylemiyordu; okuyucu üç bandın (ön seans, seans, kapanış sonrası)
          anlamını tahmin etmek zorundaydı. Adlar çentiğin tam üstünde,
          sayacın saydığı zil koyu. Saatler okuyucunun saatiyle. */}
      <div className={styles.bells} aria-hidden="true">
        <span className={styles.bellLabel} data-target={target === "open" || undefined} style={{ left: pct(open) }}>
          {labels.open}
        </span>
        <span className={styles.bellLabel} data-target={target === "close" || undefined} style={{ left: pct(close) }}>
          {labels.close}
        </span>
      </div>
      <div ref={setAxis} className={styles.axis}>
        {/* Üç bant, her biri kendi dolgusuyla: ön seans ve kapanış sonrası
            yarı tonda dolar, asıl seans tam mavi — endeks kartlarındaki
            kıvılcım çizgisinin açılıştan önceki yarı tonuyla aynı dil. Tek
            bir düz dolgu, akşam seansında şeridi baştan sona tek renk bir
            ilerleme çubuğuna çeviriyordu ve seansın nerede olduğu
            okunmuyordu (1440, 17:28 NY'de ölçüldü). */}
        <div aria-hidden="true" className={styles.track}>
          {[
            { key: "pre", from: 0, to: open },
            { key: "regular", from: open, to: close },
            { key: "after", from: close, to: 1 },
          ].map((band) => (
            <span
              key={band.key}
              className={styles.band}
              data-band={band.key}
              style={{ left: pct(band.from), width: pct(band.to - band.from) }}
            >
              <span
                className={styles.elapsed}
                data-still={reduced || undefined}
                style={{
                  transform: `scaleX(${band.to > band.from ? Math.max(0, Math.min(1, (nowFraction - band.from) / (band.to - band.from))) : 0})`,
                }}
              />
            </span>
          ))}
        </div>
        {/* Zil çentikleri gerçek saatte; sayacın saydığı zil hangisiyse o
            koyu (kapalıyken açılış, seans içinde kapanış). */}
        <span aria-hidden="true" className={styles.bell} data-target={target === "open" || undefined} style={{ left: pct(open) }} />
        <span aria-hidden="true" className={styles.bell} data-target={target === "close" || undefined} style={{ left: pct(close) }} />
        {nowFraction > 0 && nowFraction < 1 && (
          <span
            aria-hidden="true"
            className={styles.now}
            data-live={live || undefined}
            data-still={reduced || undefined}
            style={{ left: pct(nowFraction) }}
          />
        )}
        {groups.map((group) => (
          <span
            aria-hidden="true"
            key={`tick-${group.time}`}
            className={styles.tick}
            data-released={group.events.some((event) => event.released) || undefined}
            style={{ left: pct(group.at) }}
          />
        ))}
      </div>
      <div className={styles.lane}>
        <span className={`numeral ${styles.end}`}>{labels.start}</span>
        {groups.map((group, index) => {
          const first = group.events[0]!;
          const x = width > 0 ? xs[index]! : null;
          return (
            <button
              key={group.time}
              type="button"
              className={styles.marker}
              data-released={group.events.some((event) => event.released) || undefined}
              style={x === null ? { left: pct(group.at) } : { left: x }}
              onClick={() => choose(first.id)}
              aria-label={`${labels.selectEvent}: ${group.events.map((event) => event.title).join(", ")}`}
              title={group.events.map((event) => event.title).join(", ")}
            >
              {/* NUMARA + SAAT (24 Eylül). Rozet yalnızca "01", "02" diyordu:
                  aşağıdaki Bugünün Akışı listesinin sıra numarası, ama şeritte
                  neyi işaret ettiği okunmuyordu. Saat eklenince rozet kendini
                  anlatıyor ("01 · 15:30" — o saatte bir olay var); numara
                  listeyle bağı koruyor, tıklamak o satıra götürüyor. */}
              <small className="numeral">{String(first.index + 1).padStart(2, "0")}</small>
              <span className="numeral">{formatInZone(etDateTimeToUtc(day, group.time), zone)}</span>
              {group.events.length > 1 && <small className="numeral">+{group.events.length - 1}</small>}
            </button>
          );
        })}
        <span className={`numeral ${styles.end}`}>{labels.end}</span>
      </div>
    </div>
  );
}
