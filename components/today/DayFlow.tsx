"use client";

import { Fragment, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { AnimatePresence, motion } from "motion/react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, CalendarBlank, Check, CircleNotch, Clock, TrendUp } from "@phosphor-icons/react";
import { LogoTile } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { displayFlowStatus, flowResultSignature, preserveConfirmedResults, type DayFlowSnapshot, type FlowEvent } from "@/lib/day-flow";
import { clockOf, displayZone } from "@/lib/session-clock";
import { NO_VALUE } from "@/lib/utils";
import { withLocale } from "@/lib/i18n/routing";
import { onFlowSelect, publishFlow } from "./day-flow-store";
import styles from "./DayFlow.module.css";

type Props = {
  initial: DayFlowSnapshot;
  locale: Locale;
  labels: Dictionary["dayFlow"];
  railLabels: Dictionary["dayRail"];
  /** Bölümün başlığı (sunucuda çizilir) — künye satırının solunda durur. */
  heading?: ReactNode;
};
const minutesOf = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };

/* Bu kadar ya da daha az olayda akış liste + sonuç paneli değil, satır
   kartları: gerekçe `DayFlow` içinde, "KISA GÜN" notunda. */
const COMPACT_MAX = 2;

function Status({ event, nowMs, labels }: { event: Pick<FlowEvent, "status" | "scheduledAt">; nowMs: number; labels: Props["labels"] }) {
  const status = displayFlowStatus(event, nowMs);
  return <span key={status} className={styles.status} data-status={status}>
    {status === "released" || status === "analyzed" ? <Check size={12} weight="bold" /> : <span className={styles.statusDot} />}
    {labels[status]}
  </span>;
}

export function DayFlow({ initial, locale, labels, railLabels, heading }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [nowMs, setNowMs] = useState(() => new Date(initial.asOf).getTime());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connection, setConnection] = useState<"ready" | "checking" | "error">("ready");
  const [announcement, setAnnouncement] = useState("");
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
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

  /* Kahramandaki zil şeridi bu fotoğrafı okuyor (`day-flow-store`): olay
     işaretleri ile buradaki satırlar aynı birleştirilmiş veriden. Şeritteki
     bir işarete basılınca seçim buraya geliyor. */
  useEffect(() => { publishFlow(snapshot); }, [snapshot]);
  useEffect(() => onFlowSelect((id) => setSelectedId(id)), []);

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

  const events = snapshot.events;
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  const selectedIndex = events.findIndex((event) => event.id === selected?.id);
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
    {/* BAŞLIK VE KÜNYE TEK SATIR (24 Eylül). Bölümün başlığı ayrı bir
        satırda, altında bir kıl çizgi ve ONUN altında künye satırı
        (piyasa günü, otomatik güncelleme) duruyordu: 1440'ta içerik
        başlamadan önce 120 piksel. Geniş ekranda ikisi yan yana, başlık
        solda künye sağda; dar ekranda eskisi gibi alt alta. */}
    <div className={styles.toolbar}>
      {heading && <div className={styles.heading}>{heading}</div>}
      <div className={styles.toolbarMeta}>
      <span className={styles.date}><CalendarBlank size={16} /><span className={styles.marketDay}>{labels.marketDay}</span>{dayLabel}<small>NY</small></span>
      <div className={styles.connection} data-state={connection}>
        {connection === "checking" ? <CircleNotch className={styles.spinner} size={14} /> : <span className={styles.connectionDot} />}
        <span>{connection === "error" ? labels.offline : labels.auto}</span>
        <button onClick={() => refresh.current()} disabled={connection === "checking"} aria-label={connection === "error" ? labels.retry : `${labels.checked}: ${checked} ${snapshot.tags.primary}`} title={labels.liveNote}><Clock size={15} /><span>{labels.checked}</span>{checked} {snapshot.tags.primary}</button>
      </div>
      </div>
    </div>

    {/* GÜN ŞERİDİ KAHRAMANDA (24 Eylül). Bu panelin içinde 190 piksel
        tutuyordu ve açılış/kapanış saatlerini zil künyesinden sonra ilk
        ekranda ikinci kez yazıyordu. Aynı fotoğrafı okuyarak geri sayımın
        altında çiziliyor (`SessionRail`, `day-flow-store`); "şimdi" ayracı
        ve seçim burada kaldı. */}
    {events.length > 0 && events.length <= COMPACT_MAX ? (
      /* KISA GÜN, KISA PANEL (24 Eylül). Bir-iki olaylı günde panel liste
         + sonuç paneli düzenini kuruyordu: 1440'ta tek olay için 622 piksel,
         "Günün Olayları 1" başlığı ve aynı olayı ikinci kez anlatan geniş
         bir sonuç kutusu. Her olay artık tek satırlık bir kart: saat, ad ve
         durum, varsa sonuç, ve olayın gideceği yer. Başlık basılmıyor —
         satırın kendisi ne olduğunu söylüyor. Üç ve daha fazla olayda
         liste ile sonuç paneli aynen duruyor; orada seçim bir şey ayırıyor. */
      <ol className={styles.compactRows} aria-label={labels.events}>
        {events.map((event, index) => {
          const member = event.members?.length === 1 ? event.members[0]! : null;
          const href = member ? member.href : event.href;
          const action = member
            ? member.status === "analyzed" ? labels.readAnalysis : labels.viewCompany
            : labels.calendar;
          const value = event.actual ?? member?.eps ?? event.forecast;
          const valueLabel = event.actual ? labels.actual : member?.eps ? labels.eps : labels.forecast;
          return <li key={event.id} className={styles.compactRow} data-selected={selectedId === event.id || undefined}>
            <span className={styles.cardTime} data-unknown={!event.timeEt}><span className={styles.eventNumber}>{String(index + 1).padStart(2, "0")}</span><b className="numeral" aria-label={event.timeEt ? undefined : labels.timeUnknown}>{event.timeEt ? timeOf(event) : NO_VALUE}</b>{event.timeEt && <small>{snapshot.tags.primary}</small>}</span>
            <span className={styles.cardSummary}>
              <strong>{event.title}</strong>
              <span className={styles.cardKind}>
                {event.kind === "earnings" && event.members?.length ? (
                  <span className={styles.cardLogos} aria-hidden="true">
                    {event.members.slice(0, 3).map((item) => (
                      <LogoTile key={item.symbol} symbol={item.symbol} logoUrl={item.logoUrl} size="xs" className={styles.cardLogo} />
                    ))}
                  </span>
                ) : (
                  <i data-kind={event.kind} aria-hidden="true">{event.kind === "earnings" ? <Bell size={13} /> : <TrendUp size={13} />}</i>
                )}
                {!event.detail && <span className="sr-only">{event.kind === "earnings" ? labels.earnings : labels.economic}</span>}
                <Status event={event} nowMs={nowMs} labels={labels} />
                {event.detail ? <em>{event.detail}</em> : !event.timeEt && <em>{labels.timeUnknown}</em>}
              </span>
            </span>
            {value ? <span className={styles.compactValue}><small>{valueLabel}</small><b className="numeral">{value}</b></span> : <span aria-hidden="true" />}
            <Link href={href} prefetch={false} className={styles.compactLink} data-analysis={member?.status === "analyzed" || undefined}>{action}<ArrowUpRight size={15} aria-hidden /></Link>
          </li>;
        })}
      </ol>
    ) : events.length ? <>
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
  return <div className={styles.flow}>
    {props.heading && <div className={styles.toolbar}><div className={styles.heading}>{props.heading}</div></div>}
    <div className={styles.unavailable} role="status"><CalendarBlank size={25} /><p>{props.labels.offline}</p><button onClick={() => retry.current()}>{props.labels.retry}<ArrowRight size={14} /></button></div>
  </div>;
}
