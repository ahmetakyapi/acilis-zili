"use client";

import { Fragment, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowRight, ArrowUpRight, Bell, CalendarBlank, CaretDown, Check, CircleNotch, Clock, TrendUp } from "@phosphor-icons/react";
import { LogoTile } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { displayFlowStatus, flowResultSignature, preserveConfirmedResults, type DayFlowSnapshot, type FlowEvent, type FlowMember } from "@/lib/day-flow";
import { clockOf, displayZone } from "@/lib/session-clock";
import { NO_VALUE } from "@/lib/utils";
import { withLocale } from "@/lib/i18n/routing";
import { onFlowSelect, publishFlow } from "./day-flow-store";
import { FlowFigures } from "./FlowFigures";
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

function Status({ event, nowMs, labels }: { event: Pick<FlowEvent, "status" | "scheduledAt">; nowMs: number; labels: Props["labels"] }) {
  const status = displayFlowStatus(event, nowMs);
  return <span key={status} className={styles.status} data-status={status}>
    {status === "released" || status === "analyzed" ? <Check size={12} weight="bold" /> : <span className={styles.statusDot} />}
    {labels[status]}
  </span>;
}

/* SAATİ BELİRSİZ OLAYIN KÜNYESİ SEBEBİ SÖYLER (28 Eylül). Künye
   "olayın kendi künyesi varsa o öncelikli" kuralıyla basılıyordu; ama
   bilançonun künyesi saat penceresi yoksa yalnızca "Bilanço"
   (`lib/day-flow-data.ts`) ve sütunda tire duruyor. Sonuç: 28 Eylül'de NKE
   satırı "01 / –  · Planlandı Bilanço" okunuyordu, tirenin ne demek
   olduğu ekranın hiçbir yerinde yazmıyordu (yalnızca `aria-label`da). Saat
   yoksa sebep künyenin sonuna ekleniyor: "Bilanço · Saat Belirtilmedi". */
function FlowNote({ event, labels }: { event: Pick<FlowEvent, "detail" | "timeEt">; labels: Props["labels"] }) {
  if (!event.detail) return event.timeEt ? null : <em>{labels.timeUnknown}</em>;
  return <em>{event.timeEt ? event.detail : `${event.detail} · ${labels.timeUnknown}`}</em>;
}

/* SEC BİLDİRİMİ (2 Ekim). Sonuç SEC'e yatırıldığı dakika görünüyor; bağlantı
   EDGAR'daki dizin sayfasına, basın bülteni (Ex-99.1) orada. Dış site:
   yeni sekme. Gerekçe `lib/providers/sec-edgar.ts`. */
function FilingLink({ filing }: { filing: NonNullable<FlowMember["filing"]> }) {
  return (
    <a href={filing.url} target="_blank" rel="noopener noreferrer" className={styles.filingLink}>
      <span className="numeral">{filing.label}</span>
      <ArrowUpRight size={12} weight="bold" aria-hidden />
    </a>
  );
}

/* KATLI LİSTE — çok şirketli bilançonun gövdesi (15 Ekim, sahibinin
   isteği: "6 şirket olunca çok uzatıyor, daha kompakt olsun"). Şirketler
   sıkı satırlar ve dörtten fazlası varsa yalnızca ilk üçü açık; kalanı
   "+N Şirket Daha" düğmesi YERİNDE açar (CLAUDE.md "katlama bastığın
   yerde açılır" — kaydırma/rotasyonla saklanmaz, sayısı yazılıdır).
   Tek tek dönen kart denendi ve İSTENMEDİ ("6 şirket tek tek gözükmesin");
   dönen şey olayların kendisi (DayFlow → "OTOMATİK TUR"). */
function MemberList({ members, scheduledAt, nowMs, labels, openEventId, onEngage, source, href }: {
  members: FlowMember[];
  scheduledAt: FlowEvent["scheduledAt"];
  nowMs: number;
  labels: Props["labels"];
  /** Katlama açık olay değişince kapanır — sıradaki olayın listesi kısa başlar. */
  openEventId: string | null;
  /** Katlamayı açmak bir okuma niyetidir: otomatik tur durdurulsun. */
  onEngage: () => void;
  /** Kaynak ve takvim KATLAMAYLA AYNI ŞERİTTE (15 Ekim, sahibinin isteği:
      "altta boşluk olarak çıkmasın") — ayrı bir alt satır açılmıyor. */
  source: string;
  href: string;
}) {
  const [expanded, setExpanded] = useState(false);
  /* "Önceki prop" kalıbı (RollingDigit ile aynı): efekt içinde setState
     kademeli çizim tetikler, türetilmiş sıfırlama çizim sırasında yapılır. */
  const [lastEvent, setLastEvent] = useState(openEventId);
  if (openEventId !== lastEvent) {
    setLastEvent(openEventId);
    setExpanded(false);
  }
  /* Dört şirkete kadar katlama yok: tek satırlık bir kuyruk için düğme,
     düğmenin kendisinden uzun olurdu. */
  const folded = !expanded && members.length > 4;
  const shown = folded ? members.slice(0, 3) : members;
  return <>
    <ol className={styles.tlMembers}>
      {shown.map((member) => <li key={member.symbol} className={styles.tlMemberRow}>
        <span className={styles.memberIdentity}>
          <LogoTile symbol={member.symbol} logoUrl={member.logoUrl} size="xs" />
          <strong>{member.symbol}</strong>
          <Status event={{ status: member.status, scheduledAt }} nowMs={nowMs} labels={labels} />
          {member.filing && <FilingLink filing={member.filing} />}
        </span>
        {/* `detail` varyantı: sütunlar satırın payını PAYLAŞIR (max-content
            kenarda "Beklentisi"ni kırpıyordu, ölçüldü). */}
        {(member.revenue || member.eps || member.revenueEstimate || member.epsEstimate)
          ? <span className={styles.memberNumbers}><FlowFigures member={member} labels={labels} variant="detail" /></span>
          : <span aria-hidden="true" />}
        <Link href={member.href} prefetch={false} className={styles.tlMemberLink} data-analysis={member.status === "analyzed" || undefined}>{member.status === "analyzed" ? labels.readAnalysis : labels.viewCompany}<ArrowUpRight size={14} aria-hidden /></Link>
      </li>)}
    </ol>
    <div className={styles.memberFoot}>
      <span>{labels.source}: {source}</span>
      {folded && (
        <button type="button" className={styles.moreMembers} onClick={() => { setExpanded(true); onEngage(); }}>
          {labels.moreMembers.replace("{count}", String(members.length - 3))}
          <CaretDown size={14} weight="bold" aria-hidden />
        </button>
      )}
      <Link href={href}>{labels.calendar}<ArrowUpRight size={14} /></Link>
    </div>
  </>;
}

export function DayFlow({ initial, locale, labels, railLabels, heading }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [nowMs, setNowMs] = useState(() => new Date(initial.asOf).getTime());
  /* `null` = seçim OTOMATİK (sıradaki olay açık); `allClosed` = okuyucu açık
     satırı kendisi kapattı — otomatik seçim onu yeniden açmasın. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allClosed, setAllClosed] = useState(false);
  /* Olaylar arası otomatik tur — elle ilk seçimde kapanır (aşağıda). */
  const [autoTour, setAutoTour] = useState(true);
  const [connection, setConnection] = useState<"ready" | "checking" | "error">("ready");
  const [announcement, setAnnouncement] = useState("");
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const refresh = useRef<() => void>(() => {});
  const announcedResults = useRef(flowResultSignature(initial.events));
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
  useEffect(() => onFlowSelect((id) => {
    setAllClosed(false);
    setAutoTour(false);
    setSelectedId(id);
    /* Kahramandaki şeritten gelen seçim: satır görünüme gelsin ki açılan
       gövde ekran dışında kalmasın. */
    window.requestAnimationFrame(() =>
      ref.current?.querySelector(`[data-event-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({
          block: "nearest",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        }));
  }), []);

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
  const nowEt = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(nowMs));
  const now = minutesOf(nowEt);
  /* "ŞİMDİ" İŞARETİ — çizelgenin neresindeyiz.
     Omurga zaten sıralı; işaret onu ikiye bölüyor ve "bunlar geçti, bunlar
     gelecek" tek bakışta okunuyor. Yalnızca GERÇEKTEN böldüğünde basılıyor:
     gün başlamadıysa hepsi zaten gelecek demektir ve işaret fazladan bir
     satır olurdu. Saati belirsiz olaylar işareti tetiklemiyor — onların
     hangi tarafta olduğu bilinmiyor. */
  const firstUpcoming = events.findIndex((event) => event.timeEt !== null && minutesOf(event.timeEt) > now);
  const hasPast = events.some((event) => event.timeEt !== null && minutesOf(event.timeEt) <= now);
  const dividerAt = !hasPast ? null : firstUpcoming === -1 ? events.length : firstUpcoming;
  /* OTOMATİK AÇIK SATIR SIRADAKİ OLAY: okuyucunun sorusu "şimdi ne olacak".
     Gün başlamadıysa ilk olay, gün bittiyse son olay (günün son cevabı). */
  const autoId = events.length === 0 ? null
    : (dividerAt === null ? events[0] : events[Math.min(dividerAt, events.length - 1)])!.id;
  const openId = allClosed ? null
    : selectedId && events.some((event) => event.id === selectedId) ? selectedId : autoId;
  const primary = (minutes: number) => clockOf(minutes + snapshot.offsets.primary);
  const nowLabel = `${railLabels.now} · ${primary(now)} ${snapshot.tags.primary}`;
  const timeOf = (event: FlowEvent) => event.timeEt ? `${event.approx ? "~" : ""}${primary(minutesOf(event.timeEt))}` : labels.timeUnknown;
  const checked = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: displayZone(locale), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(snapshot.asOf));
  const dayLabel = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "UTC", month: "long", day: "numeric", weekday: "long" }).format(new Date(snapshot.dateEt + "T12:00:00Z"));

  /* OTOMATİK TUR (15 Ekim, sahibinin isteği: "üç sekme kendi aralarında
     geçsin; kullanıcı isterse eliyle de geçsin"). Açık olay sekiz saniyede
     bir sıradakine akıp başa döner. Tur KİBAR: imleç ya da odak bölümün
     üstündeyken, bölüm ekran dışındayken, sekme arka plandayken ve hareketi
     azaltanda bekler; okuyucu bir olayı ELİYLE seçtiği ya da katlı listeyi
     açtığı an kendini tamamen kapatır (WCAG 2.2.2 — durdurma yolu,
     etkileşimin kendisi). Tur sayfayı KAYDIRMAZ; kaydırma yalnızca elle
     seçimde ve kahraman şeridinden gelen seçimde. */
  useEffect(() => {
    if (!autoTour || allClosed || events.length < 2 || !openId) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    let paused = false;
    let visible = true;
    const hold = () => { paused = true; };
    const release = () => { paused = false; };
    el?.addEventListener("pointerenter", hold);
    el?.addEventListener("pointerleave", release);
    el?.addEventListener("focusin", hold);
    el?.addEventListener("focusout", release);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    if (el) observer.observe(el);
    const timer = window.setInterval(() => {
      if (document.hidden || paused || !visible) return;
      const at = events.findIndex((event) => event.id === openId);
      setSelectedId(events[(at + 1) % events.length]!.id);
    }, 8_000);
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      el?.removeEventListener("pointerenter", hold);
      el?.removeEventListener("pointerleave", release);
      el?.removeEventListener("focusin", hold);
      el?.removeEventListener("focusout", release);
    };
  }, [autoTour, allClosed, events, openId]);

  function toggle(id: string) {
    setAutoTour(false);
    if (openId === id) { setAllClosed(true); setSelectedId(null); return; }
    setAllClosed(false);
    setSelectedId(id);
  }

  const nowMark = (
    <li className={styles.nowMark} aria-hidden="true"><b>{nowLabel}</b></li>
  );

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

    {/* ZAMAN ÇİZELGESİ (15 Ekim, sahibinin isteği: "hiç kompakt
        hissetmiyor, timeline gibi bir şey yapmalıyız"). Önceki düzen bir
        liste + yanında seçili olayı İKİNCİ kez anlatan büyük bir sonuç
        paneliydi; 1440'ta altı şirketli bir bilanço penceresi ~1200 piksel
        tutuyor ve telefon için üçüncü bir düzen (kısa liste) daha
        basılıyordu. Şimdi TEK düzen, her genişlikte: solda numaralı
        düğümlerin dizildiği bir omurga, her olay omurgada tek satır, gövdesi
        YERİNDE açılıyor (tek açık satır — seçim bir şeyi ayırsın), çok
        şirketli bilançoda şirketler tam satır yerine sıkı kartlarda. Sonuç
        paneli, gezinme okları ve telefon/masaüstü çifte düzeni kalktı.
        Sıradaki olay kendiliğinden açık: okuyucunun sorusu "şimdi ne
        olacak". Satır yüksekliği ~56 piksel; altı olaylı gün ilk ekranda
        bütünüyle okunuyor. */}
    {events.length > 0 ? <>
      <div className={styles.agendaHead}><h3>{labels.events}<span className="numeral">{events.length}</span></h3></div>
      <ol className={styles.timeline}>
        {events.map((event, index) => {
          const open = openId === event.id;
          const past = event.timeEt !== null && minutesOf(event.timeEt) <= now;
          const member = event.members?.length === 1 ? event.members[0]! : null;
          const value = event.actual ?? member?.eps ?? null;
          const valueLabel = event.actual ? labels.actual : member?.eps ? labels.eps : null;
          const bodyId = `${detailId}-${index}`;
          return <Fragment key={event.id}>
            {index === dividerAt && nowMark}
            <li className={styles.tlRow} data-event-id={event.id} data-open={open || undefined} data-past={past || undefined} data-kind={event.kind}>
              {/* Düğüm sıra numarasını taşıyor; omurga çizgisi CSS'te
                  (`.tlRow::before`). Geçmiş düğüm dolu ve sakin, açık düğüm
                  marka mavisi, gelecek düğüm çerçeveli — durum renk +
                  dolgunun İKİSİYLE ayrışıyor. */}
              <span className={styles.tlNode} aria-hidden="true"><b className="numeral">{String(index + 1).padStart(2, "0")}</b></span>
              <div className={styles.tlMain}>
                <button type="button" className={styles.tlHead} onClick={() => toggle(event.id)} aria-expanded={open} aria-controls={bodyId}>
                  <span className={styles.tlTime} data-unknown={!event.timeEt}><b className="numeral" aria-label={event.timeEt ? undefined : labels.timeUnknown}>{event.timeEt ? timeOf(event) : NO_VALUE}</b>{event.timeEt && <small>{snapshot.tags.primary}</small>}</span>
                  <span className={styles.tlSummary}>
                    <strong>{event.title}</strong>
                    <span className={styles.cardKind}>
                      {/* Bilanço satırında simge değil ŞİRKETİN LOGOSU: zil
                          her bilanço satırında aynıydı ve hiçbir şey ayırt
                          etmiyordu; logo ediyor. Üçten fazlası sığmıyor,
                          başlık kaçının olduğunu söylüyor. */}
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
                      <FlowNote event={event} labels={labels} />
                    </span>
                  </span>
                  {/* GERÇEKLEŞENİN YANINDA KIYAS yok — kapalı satır tek sayı
                      taşır (gerçekleşen, yoksa tek şirketin EPS'i); kıyas ve
                      gelir açılan gövdede. Satır kompakt kalsın diye. */}
                  {value && valueLabel ? (
                    <span className={styles.tlValue}><small>{valueLabel}</small><b className="numeral">{value}</b></span>
                  ) : <span aria-hidden="true" />}
                  <CaretDown size={15} weight="bold" aria-hidden className={styles.tlCaret} />
                </button>
                {/* Gövde YERİNDE açılır (`grid-template-rows` 0fr→1fr,
                    --ease-brand); `inert` kapalı gövdenin bağlantılarını
                    sekme sırasından düşürür. */}
                <div id={bodyId} className={styles.tlDetail} inert={!open}>
                  <div className={styles.tlDetailInner}>
                    {/* "BU DA NE?" — başlığın altındaki tek cümle. Cümle tür
                        başına sözlükte (`dayFlow.notes`), karşılığı olmayan
                        olayda hiç basılmıyor. */}
                    {event.note && <p className={styles.note}>{event.note}</p>}
                    {event.members ? (
                      <MemberList members={event.members} scheduledAt={event.scheduledAt} nowMs={nowMs} labels={labels} openEventId={openId} onEngage={() => setAutoTour(false)} source={event.source} href={event.href} />
                    ) : <>
                      {(event.actual || event.forecast || event.previous) && <dl className={styles.results}>{[[labels.actual, event.actual], [labels.forecast, event.forecast], [labels.previous, event.previous]].map(([label, figure]) => <div key={label}><dt>{label}</dt><dd className="numeral">{figure ?? NO_VALUE}</dd></div>)}</dl>}
                      {!event.actual && <p className={styles.waiting}>{displayFlowStatus(event, nowMs) === "scheduled" ? labels.scheduledHint : labels.pendingHint}</p>}
                      <div className={styles.detailFooter}><span>{labels.source}: {event.source}</span><Link href={event.href}>{labels.calendar}<ArrowUpRight size={14} /></Link></div>
                    </>}
                  </div>
                </div>
              </div>
            </li>
          </Fragment>;
        })}
        {dividerAt === events.length && nowMark}
      </ol>
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
