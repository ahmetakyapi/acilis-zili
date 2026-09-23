"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, CalendarBlank, Check, CircleNotch, Clock, TrendUp } from "@phosphor-icons/react";
import { LogoTile } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { displayFlowStatus, flowResultSignature, preserveConfirmedResults, type DayFlowSnapshot, type FlowEvent } from "@/lib/day-flow";
import { clockOf, displayZone } from "@/lib/session-clock";
import { NO_VALUE } from "@/lib/utils";
import { withLocale } from "@/lib/i18n/routing";
import styles from "./DayFlow.module.css";

type Props = { initial: DayFlowSnapshot; locale: Locale; labels: Dictionary["dayFlow"]; railLabels: Dictionary["dayRail"] };
const pct = (minutes: number) => Math.max(0, Math.min(100, (minutes - 240) / 960 * 100));
const minutesOf = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };

/**
 * İşaretlerin eksendeki yeri — çakışanlar İTİLİR, saatleri kaymaz.
 *
 * Önceki düzende işaretler doğrudan `left: %` ile basılıyordu ve aynı
 * dakikaya yakın iki olay üst üste biniyordu: 14:00 ile 14:30 telefonda 14
 * piksel arayla düşüyor, iki rozet birbirinin rakamını kesiyordu (ölçüldü,
 * 390px'te %62 ve %66). Rozet artık en az `gap` piksel aralıkla yerleşiyor;
 * gerçek saat sapı (stem) ile eksende işaretleniyor, yani kayan yalnızca
 * etiket. Aynı iki geçişli algoritma fiyat haritasında da var
 * (`lib/technical.ts` → `priceMapLayout`).
 */
function spread(points: number[], width: number, gap: number): number[] {
  if (width <= 0) return points.map((p) => (p / 100) * width);
  const half = gap / 2;
  const order = points.map((p, i) => ({ i, x: (p / 100) * width })).sort((a, b) => a.x - b.x);
  for (let k = 1; k < order.length; k++) {
    order[k]!.x = Math.max(order[k]!.x, order[k - 1]!.x + gap);
  }
  for (let k = order.length - 1; k >= 0; k--) {
    const ceiling = k === order.length - 1 ? width - half : order[k + 1]!.x - gap;
    order[k]!.x = Math.max(half, Math.min(order[k]!.x, ceiling));
  }
  const out = new Array<number>(points.length);
  for (const item of order) out[item.i] = item.x;
  return out;
}

function Status({ event, nowMs, labels }: { event: Pick<FlowEvent, "status" | "scheduledAt">; nowMs: number; labels: Props["labels"] }) {
  const status = displayFlowStatus(event, nowMs);
  return <span key={status} className={styles.status} data-status={status}>
    {status === "released" || status === "analyzed" ? <Check size={12} weight="bold" /> : <span className={styles.statusDot} />}
    {labels[status]}
  </span>;
}

export function DayFlow({ initial, locale, labels, railLabels }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [nowMs, setNowMs] = useState(() => new Date(initial.asOf).getTime());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connection, setConnection] = useState<"ready" | "checking" | "error">("ready");
  const [announcement, setAnnouncement] = useState("");
  const [railWidth, setRailWidth] = useState(0);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const axis = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const refresh = useRef<() => void>(() => {});
  const announcedResults = useRef(flowResultSignature(initial.events));
  const reduced = useMotionPreference();
  const detailId = useId();

  useEffect(() => {
    // SessionRefresh can bring a partial provider response too. Merge it
    // exactly like polling, and never replace a newer poll with older SSR.
    // The loader is keyed by locale so formatted values cannot cross languages.
    const timer = window.setTimeout(() => setSnapshot((previous) =>
      Date.parse(initial.asOf) < Date.parse(previous.asOf)
        ? previous : preserveConfirmedResults(previous, initial)), 0);
    return () => window.clearTimeout(timer);
  }, [initial]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setNowMs(Date.now()); }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // Announce visible, merged results, not temporary gaps in raw responses.
    const signature = flowResultSignature(snapshot.events);
    if (signature === announcedResults.current) return;
    announcedResults.current = signature;
    const timer = window.setTimeout(() => {
      const time = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
        timeZone: displayZone(locale), hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      }).format(new Date());
      setAnnouncement(`${labels.updatedAnnouncement} ${time}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [snapshot.events, labels.updatedAnnouncement, locale]);

  useEffect(() => {
    let timer = 0;
    let abort: AbortController | null = null;
    let active = true;
    let visible = true;
    let failures = 0;
    async function poll() {
      window.clearTimeout(timer);
      if (!active || document.hidden || !visible || abort) return;
      const controller = new AbortController();
      abort = controller;
      const timeout = window.setTimeout(() => controller.abort(), 20_000);
      setConnection("checking");
      let delay = 30_000;
      try {
        const response = await fetch(`/api/day-flow?locale=${locale}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          delay = Math.max(delay, Number(response.headers.get("Retry-After") ?? 0) * 1000);
          throw new Error("unavailable");
        }
        const result: { ok: boolean; snapshot?: DayFlowSnapshot } = await response.json();
        if (!result.ok || !result.snapshot || !Array.isArray(result.snapshot.events) || !Number.isFinite(Date.parse(result.snapshot.asOf))) throw new Error("invalid-response");
        if (!active) return;
        const next = result.snapshot;
        startTransition(() => setSnapshot((previous) =>
          Date.parse(next.asOf) < Date.parse(previous.asOf)
            ? previous : preserveConfirmedResults(previous, next)));
        setNowMs(Date.now());
        setConnection("ready");
        failures = 0;
        delay = Math.max(30_000, next.pollAfterMs);
      } catch {
        if (!active) return;
        // Retain the last confirmed results. A failed refresh is visible,
        // never disguised as an empty day or a successful live update.
        setConnection("error");
        failures++;
        delay = Math.max(delay, Math.min(300_000, 30_000 * 2 ** failures));
      } finally {
        window.clearTimeout(timeout);
        abort = null;
        if (active && visible && !document.hidden) timer = window.setTimeout(poll, delay);
      }
    }
    function onVisibility() {
      window.clearTimeout(timer);
      if (!document.hidden && visible) void poll();
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) void poll(); else window.clearTimeout(timer);
    }, { rootMargin: "200px" });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener("visibilitychange", onVisibility);
    refresh.current = () => void poll();
    return () => {
      active = false;
      window.clearTimeout(timer);
      abort?.abort();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      refresh.current = () => {};
    };
  }, [locale]);

  /* İşaretlerin itilmesi PİKSELLE hesaplanıyor, yüzdeyle değil: aralık
     ekranın genişliğine göre değişmeyen bir ölçü (rozetin kendi boyu).
     Eksenin genişliği ölçülene kadar işaretler saf yüzdeyle basılıyor —
     sunucu çiziminde ve JS kapalıyken görünen hâl bu. */
  useEffect(() => {
    const element = axis.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const sync = () => setRailWidth(element.clientWidth);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const events = snapshot.events;
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  const selectedIndex = events.findIndex((event) => event.id === selected?.id);
  const markerTimes = useMemo(
    () => [...new Set(events.flatMap((event) => event.timeEt ? [event.timeEt] : []))]
      .sort((a, b) => minutesOf(a) - minutesOf(b)),
    [events],
  );
  const markerX = useMemo(
    /* 54 PİKSEL: rozetin kendi genişliği. `gap` merkezden merkeze ölçülüyor,
       yani iki rozetin yan yana durabilmesi için yarı genişliklerinin
       toplamından büyük olmalı. Ölçüldü (16 Eylül, FOMC günü): sade rozet
       30-34 piksel, "+n" ekli olan 46. En kötü çift (46+46)/2 = 46; üstüne
       8 piksel nefes payı. Eski değer 30'du ve rozetler birbirine giriyordu —
       768 ve 1024'te 10 piksel, 1440'ta 2 piksel ÜST ÜSTE (ölçüldü); ekranda
       "02 +1" ile "04" tek bir blok gibi okunuyordu. Sap (stem) gerçek saate
       eğilmeye devam ediyor, kayan yalnızca etiket. */
    () => spread(markerTimes.map((time) => pct(minutesOf(time))), railWidth, 54),
    [markerTimes, railWidth],
  );
  const nowEt = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(nowMs));
  const now = minutesOf(nowEt);
  /* "ŞİMDİ" AYRACI — listenin neresindeyiz.
     Şerit bunu bir eksende söylüyordu ama olaylar kümelendiğinde (bir FOMC
     gününde dördü de 21:00 civarı) eksen hiçbir şey ayırt etmiyor: on altı
     saatlik bir çizginin tek bir noktasında üst üste binen rozetler. Liste
     ise zaten sıralı; ayraç onu ikiye bölüyor ve "bunlar geçti, bunlar
     gelecek" tek bakışta okunuyor.
     Yalnızca GERÇEKTEN böldüğünde basılıyor: gün başlamadıysa hepsi zaten
     gelecek demektir ve ayraç fazladan bir satır olurdu. Saati belirsiz
     olaylar ayracı tetiklemiyor — onların hangi tarafta olduğu bilinmiyor. */
  const firstUpcoming = events.findIndex((event) => event.timeEt !== null && minutesOf(event.timeEt) > now);
  const hasPast = events.some((event) => event.timeEt !== null && minutesOf(event.timeEt) <= now);
  const dividerAt = !hasPast ? null : firstUpcoming === -1 ? events.length : firstUpcoming;
  const primary = (minutes: number) => clockOf(minutes + snapshot.offsets.primary);
  const nowLabel = `${railLabels.now} · ${primary(now)} ${snapshot.tags.primary}`;
  const timeOf = (event: FlowEvent) => event.timeEt ? `${event.approx ? "~" : ""}${primary(minutesOf(event.timeEt))}` : labels.timeUnknown;
  const checked = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: displayZone(locale), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(snapshot.asOf));
  const dayLabel = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "UTC", month: "long", day: "numeric", weekday: "long" }).format(new Date(snapshot.dateEt + "T12:00:00Z"));

  /* Seçim SAYFAYI kaydırıyor, kutunun içini değil.
     Liste bir dönem kendi içinde kayan 206 piksellik bir kutuydu ve mobilde
     sonuç paneli o kutunun ALTINDA kalıyordu: okuyucu bir satıra basıyor,
     cevabın nerede belirdiğini göremiyordu (ekran görüntüsünde 04. satır
     ortasından kesiliyordu). İç kaydırma kalktı; seçilen olayın paneli
     `block: "nearest"` ile görünüme giriyor, yani zaten görünüyorsa
     hiçbir şey kaymıyor — masaüstünde panel listenin yanında duruyor. */
  function select(id: string) {
    setSelectedId(id);
    const panel = detailRef.current;
    if (!panel) return;
    window.requestAnimationFrame(() =>
      panel.scrollIntoView({ block: "nearest", behavior: reduced ? "instant" : "smooth" }));
  }

  return <div ref={ref} className={styles.flow} data-day-flow>
    <div className={styles.toolbar}>
      <span className={styles.date}><CalendarBlank size={16} /><span className={styles.marketDay}>{labels.marketDay}</span>{dayLabel}<small>NY</small></span>
      <div className={styles.connection} data-state={connection}>
        {connection === "checking" ? <CircleNotch className={styles.spinner} size={14} /> : <span className={styles.connectionDot} />}
        <span>{connection === "error" ? labels.offline : labels.auto}</span>
        <button onClick={() => refresh.current()} disabled={connection === "checking"} aria-label={connection === "error" ? labels.retry : `${labels.checked}: ${checked} ${snapshot.tags.primary}`} title={labels.liveNote}><Clock size={15} /><span>{labels.checked}</span>{checked} {snapshot.tags.primary}</button>
      </div>
    </div>

    {/* ---- Gün şeridi ----
        KAT DÜZENİ: günün İSKELETİ (açılış, kapanış,
        şimdi) eksenin ÜSTÜNDE, günün İÇERİĞİ (olaylar) eksenin ALTINDA.
        Önceki düzende olay rozetleri eksenin ÜSTÜNE oturuyordu; rayı
        kapatıyor, açılış/kapanış saatleriyle aynı banda giriyor ve
        birbirlerinin rakamını kesiyorlardı. */}
    <div className={styles.rail} data-empty={events.length === 0} aria-label={railLabels.marketHours}>
      <div className={styles.bounds}>
        {[{ minutes: 570, label: railLabels.openShort }, { minutes: snapshot.closeMinutes, label: railLabels.closeShort }].map(({ minutes, label }) => <div key={label} className={styles.bound} style={{ left: `${pct(minutes)}%` }}><span>{label}</span><strong className="numeral">{primary(minutes)} <small>{snapshot.tags.primary}</small></strong></div>)}
      </div>

      <div className={styles.nowBand}>
        {now >= 240 && now <= 1200 && <div className={styles.now} data-live={snapshot.tradingDay} data-edge={pct(now) < 10 ? "start" : pct(now) > 90 ? "end" : undefined} style={{ left: `${pct(now)}%` }}><span>{railLabels.now}</span><i /></div>}
      </div>

      <div className={styles.axis} ref={axis}>
        <div className={styles.track} aria-hidden="true" />
        <div aria-hidden="true" className={styles.sessionBand} data-open={snapshot.tradingDay} style={{ left: `${pct(570)}%`, width: `${pct(snapshot.closeMinutes) - pct(570)}%` }} />
        <motion.div aria-hidden="true" className={styles.elapsed} style={{ transformOrigin: "left" }} animate={{ scaleX: pct(now) / 100 }} transition={{ duration: reduced ? 0 : 1.2, ease: "easeOut" }} />
        {[570, snapshot.closeMinutes].map((minutes) => <span aria-hidden="true" key={minutes} className={styles.boundDot} style={{ left: `${pct(minutes)}%` }} />)}
        {/* Sap: rozet itilmiş olsa bile olayın GERÇEK saati eksende duruyor. */}
        {markerTimes.map((time) => <span aria-hidden="true" key={time} className={styles.tick} data-released={events.some((event) => event.timeEt === time && event.status !== "scheduled")} style={{ left: `${pct(minutesOf(time))}%` }} />)}
      </div>

      <div className={styles.markers}>
        {markerTimes.map((time, index) => {
          const group = events.filter((event) => event.timeEt === time);
          const active = group.findIndex((event) => event.id === selected?.id);
          // Coincident releases share a timestamp, not a destination. Repeated
          // activation advances through every release at that time.
          const target = group[(active + 1) % group.length]!;
          const released = group.some((event) => event.status !== "scheduled");
          const truePct = pct(minutesOf(time));
          const x = railWidth > 0 ? markerX[index]! : null;
          return <button key={time} className={styles.marker} data-selected={active >= 0} data-released={released}
            style={x === null ? { left: `${truePct}%` } : { left: x, "--lean": `${(truePct / 100) * railWidth - x}px` } as React.CSSProperties}
            onClick={() => select(target.id)} aria-pressed={active >= 0} aria-controls={detailId}
            aria-label={`${labels.selectEvent}: ${timeOf(target)} ${snapshot.tags.primary} · ${target.title}`}
            title={`${primary(minutesOf(time))} · ${group.map((event) => event.title).join(", ")}`}>
            <i aria-hidden="true" className={styles.stem} />
            <span className="numeral">{String(events.indexOf(active >= 0 ? group[active]! : group[0]!) + 1).padStart(2, "0")}</span>
            {group.length > 1 && <small aria-hidden="true" className="numeral">+{group.length - 1}</small>}
          </button>;
        })}
      </div>

      <div className={styles.axisFoot}><span className="numeral">{primary(240)}</span><span>{snapshot.tradingDay ? railLabels.marketHours : labels.closed}</span><span className="numeral">{primary(1200)} {snapshot.tags.primary}</span></div>
      {/* LEJANT SATIRI KALKTI (23 Eylül). Şeridin altında "Ekonomik Veri ·
          Bilanço" simgelerini ve "bir olay seç" ipucunu taşıyordu; şeritte
          simge yok (rozetler numara), bilanço satırları logo taşıyor ve
          liste ile sonuç paneli hemen altta yan yana. Satır 35 piksel
          tutuyordu ve üstelik yapışkan sekme çubuğunun soluklaştırma bandı
          tam onun üstüne iniyordu. */}
    </div>

    {events.length ? <>
      {/* TEK OLAYDA LİSTE YOK. Tek satırlık liste ile sonuç paneli aynı olayı
          yan yana iki kez anlatıyordu (saat, ad, "Planlandı" iki yerde) ve
          ok düğmeleri gidecek yer olmadan, soluk duruyordu. Tek olayda
          yalnızca sonuç paneli, tam genişlikte. */}
      <div className={styles.eventHeading}><h3>{labels.events}<span className="numeral">{events.length}</span></h3>{events.length > 1 && <div><button aria-label={labels.back} disabled={selectedIndex <= 0} onClick={() => events[selectedIndex - 1] && select(events[selectedIndex - 1]!.id)}><ArrowLeft size={17} /></button><button aria-label={labels.next} disabled={selectedIndex >= events.length - 1} onClick={() => events[selectedIndex + 1] && select(events[selectedIndex + 1]!.id)}><ArrowRight size={17} /></button></div>}</div>
      <div className={styles.eventLayout} data-single={events.length === 1 || undefined}>
      {/* İÇ KAYDIRMA YOK. Liste sayfayla birlikte kayıyor; günün olayları
          altı-sekiz satır ve hepsi tek bakışta okunuyor. */}
      <ol className={styles.eventCards}>
        {events.map((event, index) => <Fragment key={event.id}>
          {index === dividerAt && <li className={styles.nowRow} aria-hidden="true"><span /><b>{nowLabel}</b><span /></li>}
          <li><button data-event-id={event.id} className={styles.eventCard} data-selected={selected?.id === event.id} data-kind={event.kind} onClick={() => select(event.id)} aria-pressed={selected?.id === event.id} aria-controls={detailId}>
          {/* SAATİ BELİRSİZ OLAYDA SÜTUN TİRE BASIYOR. "Saat Belirtilmedi"
              62 piksellik sütuna sığmıyor ve "Saat / Belirtilme / di" diye üç
              satıra bölünüyordu; üstelik aynı cümle satırın künyesinde İKİNCİ
              kez duruyordu. Sebep künyeye ait, sütun yalnızca saati taşır. */}
          <span className={styles.cardTime} data-unknown={!event.timeEt}><span className={styles.eventNumber}>{String(index + 1).padStart(2, "0")}</span><b className="numeral" aria-label={event.timeEt ? undefined : labels.timeUnknown}>{event.timeEt ? timeOf(event) : NO_VALUE}</b>{event.timeEt && <small>{snapshot.tags.primary}</small>}</span>
          <span className={styles.cardSummary}>
            <strong>{event.title}</strong>
            {/* Tür ADI değil İŞARETİ: altı satırın altısında da "Ekonomik
                Veri" yazıyordu ve satırın yarısını kaplıyordu. Simge türü
                söylüyor, lejant simgeyi adlandırıyor; okunacak bilgi
                DURUM — o her satırda farklı. */}
            <span className={styles.cardKind}>
              {/* BİLANÇO SATIRINDA SİMGE DEĞİL ŞİRKETİN LOGOSU.
                  Zil her bilanço satırında aynı ve o satırların tamamı zaten
                  künyesinde "Bilanço" yazıyor — yani simge hiçbir şey ayırt
                  etmiyordu. Logo ayırt ediyor: listede gözü çeken şey şirket.
                  Logolar zaten `event.members` içinde istemciye inmiş
                  durumda (`lib/day-flow-data.ts`), yeni bir sorgu yok.
                  Üçten fazlası sığmıyor; başlık kaçının olduğunu söylüyor. */}
              {event.kind === "earnings" && event.members?.length ? (
                <span className={styles.cardLogos} aria-hidden="true">
                  {event.members.slice(0, 3).map((member) => (
                    <LogoTile key={member.symbol} symbol={member.symbol} logoUrl={member.logoUrl} size="xs" className={styles.cardLogo} />
                  ))}
                </span>
              ) : (
                <i data-kind={event.kind} aria-hidden="true">{event.kind === "earnings" ? <Bell size={13} /> : <TrendUp size={13} />}</i>
              )}
              {/* TÜR BİR KEZ SÖYLENİR. Künye varsa türü zaten o taşıyor
                  (bilanço satırında "Bilanço · Kapanış Sonrası"); ikinci bir
                  gizli etiket ekran okuyucuya aynı kelimeyi iki kez okutur.
                  Künyesi olmayan satırda tür yalnızca simgede kalıyor, o
                  yüzden orada gizli etiket şart. */}
              {!event.detail && <span className="sr-only">{event.kind === "earnings" ? labels.earnings : labels.economic}</span>}
              <Status event={event} nowMs={nowMs} labels={labels} />
              {/* Sütundan düşen "Saat Belirtilmedi" künyeye burada iniyor;
                  olayın kendi künyesi varsa o öncelikli. */}
              {event.detail ? <em>{event.detail}</em> : !event.timeEt && <em>{labels.timeUnknown}</em>}
            </span>
          </span>
          <span className={styles.cardBottom}>{event.actual && <b className="numeral">{event.actual}</b>}<ArrowRight size={16} /></span>
        </button></li>
        </Fragment>)}
        {dividerAt === events.length && <li className={styles.nowRow} aria-hidden="true"><span /><b>{nowLabel}</b><span /></li>}
      </ol>
      <div ref={detailRef} className={styles.detailSlot}>
      <AnimatePresence initial={false} mode="wait">
        {selected && <motion.div key={selected.id} id={detailId} role="region" aria-label={selected.title} className={styles.detail} data-kind={selected.kind} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -3 }} transition={{ duration: .18 }}>
          <div className={styles.detailHeading}><div><span className={styles.detailKicker}><b className="numeral">{String(selectedIndex + 1).padStart(2, "0")}</b><span className="numeral">{timeOf(selected)} {selected.timeEt && snapshot.tags.primary}</span> · {selected.detail ?? (selected.kind === "earnings" ? labels.earnings : labels.economic)}</span><h4>{selected.title}</h4></div>{/* Tek şirketli bilançoda durum şirket satırında; başlıkta ikinci kez basılmıyor. */}{selected.members?.length !== 1 && <Status event={selected} nowMs={nowMs} labels={labels} />}</div>
          {/* "BU DA NE?" — başlığın altındaki tek cümle. Başlık olayın ADINI
              söylüyor ama adı bilmeyene bir şey anlatmıyor; "FOMC" ve "Nokta
              Grafiği" okuyucunun yarısı için boş. Cümle tür başına sözlükte
              (`dayFlow.notes`), karşılığı olmayan olayda hiç basılmıyor. */}
          {selected.note && <p className={styles.note}>{selected.note}</p>}
          {selected.members ? <div className={styles.members}>{selected.members.map((member) => <div key={member.symbol} className={styles.member}>
            <div className={styles.memberIdentity}><LogoTile symbol={member.symbol} logoUrl={member.logoUrl} size="sm" /><div><strong>{member.symbol}</strong><Status event={{ status: member.status, scheduledAt: selected.scheduledAt }} nowMs={nowMs} labels={labels} /></div></div>
            {(member.revenue || member.eps) && <dl className={styles.memberNumbers}>{member.revenue && <div><dt>{labels.revenue}</dt><dd className="numeral">{member.revenue}</dd></div>}{member.eps && <div><dt>{labels.eps}</dt><dd className="numeral">{member.eps}</dd></div>}</dl>}
            <Link href={member.href} className={styles.detailLink} data-analysis={member.status === "analyzed"}>{member.status === "analyzed" ? labels.readAnalysis : labels.viewCompany}<ArrowUpRight size={16} /></Link>
          </div>)}</div> : <>
            {(selected.actual || selected.forecast || selected.previous) && <dl className={styles.results}>{[[labels.actual, selected.actual], [labels.forecast, selected.forecast], [labels.previous, selected.previous]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="numeral">{value ?? NO_VALUE}</dd></div>)}</dl>}
            {!selected.actual && <p className={styles.waiting}>{displayFlowStatus(selected, nowMs) === "scheduled" ? labels.scheduledHint : labels.pendingHint}</p>}
          </>}
          <div className={styles.detailFooter}><span>{labels.source}: {selected.source}</span><Link href={selected.href}>{labels.calendar}<ArrowUpRight size={14} /></Link></div>
        </motion.div>}
      </AnimatePresence>
      </div>
      </div>
    </> : snapshot.hiddenEarnings > 0 ? (
      /* Akış boş ama gün boş DEĞİL: eşiğin altındaki bilançolar var. "Açıklama
         yok" demek aynı sayfadaki bilanço paneliyle çelişirdi. */
      <div className={styles.empty}><span><CalendarBlank size={32} weight="duotone" /></span><div><h3>{labels.emptyMajorTitle}</h3><p>{labels.emptyMajorHint.replace("{count}", String(snapshot.hiddenEarnings))}{" "}<Link href={withLocale("/bilancolar", locale)} prefetch={false} className={styles.emptyLink}>{labels.emptyMajorLink}<ArrowUpRight size={12} weight="bold" aria-hidden /></Link></p></div></div>
    ) : <div className={styles.empty}><span><CalendarBlank size={32} weight="duotone" /></span><div><h3>{labels.emptyTitle}</h3><p>{labels.emptyHint}</p></div></div>}
    {snapshot.sourceDelayed && <p className={styles.sourceDelay}>{labels.sourceDelayed}</p>}
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}

/** Initial data failures recover too; an empty calendar is never fabricated. */
export function DayFlowLoader({ initial, ...props }: Omit<Props, "initial"> & { initial: DayFlowSnapshot | null }) {
  const [loaded, setLoaded] = useState(initial);
  const retry = useRef<() => void>(() => {});
  useEffect(() => {
    if (loaded || initial) return;
    let active = true;
    let timer = 0;
    let controller: AbortController | null = null;
    async function check() {
      window.clearTimeout(timer);
      if (document.hidden || controller) return;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 20_000);
      try {
        const response = await fetch(`/api/day-flow?locale=${props.locale}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          if (active && result.ok && Array.isArray(result.snapshot?.events) && Number.isFinite(Date.parse(result.snapshot.asOf))) setLoaded(result.snapshot);
        }
      } catch { /* The explicit retry state remains visible. */ }
      finally {
        window.clearTimeout(timeout); controller = null;
        if (active) timer = window.setTimeout(check, 30_000);
      }
    }
    timer = window.setTimeout(check, 0);
    retry.current = () => void check();
    document.addEventListener("visibilitychange", check);
    return () => { active = false; window.clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", check); retry.current = () => {}; };
  }, [initial, loaded, props.locale]);
  const snapshot = initial ?? loaded;
  if (snapshot) return <DayFlow key={props.locale} initial={snapshot} {...props} />;
  return <div className={styles.unavailable} role="status"><CalendarBlank size={25} /><p>{props.labels.offline}</p><button onClick={() => retry.current()}>{props.labels.retry}<ArrowRight size={14} /></button></div>;
}
