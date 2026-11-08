"use client";

import { Fragment, useEffect, useId, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Bell, Buildings, CalendarBlank, CaretDown, CaretLeft, CaretRight, ChartLineUp, Check, CircleNotch, Clock, Equals, TrendUp } from "@phosphor-icons/react";
import { DeviationLine } from "@/components/calendar/DeviationLine";
import { legendMark } from "@/lib/release-deviation";
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
  /** Okla açılan geçmiş/gelecek günün başlığı — sunucuda aynı kalıpla çizilir. */
  otherHeadings?: { past: ReactNode; future: ReactNode };
  /** Bugün boşken önizlenen sıradaki işlem günü (RailSection; yoksa `null`). */
  preview?: DayFlowSnapshot | null;
  /** Sapma çizgisinin sözcükleri — takvim kartıyla aynı ad alanı
      (`calendarVisuals.released`); verilmezse çizgi basılmaz. */
  lineLabels?: Dictionary["calendarVisuals"]["released"];
};
/** Sonucu gelmiş (ya da gerçekleşmiş) olay — satırda durum SÖZÜ basılmaz. */
const DONE = new Set(["released", "analyzed", "held"]);
const minutesOf = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
/** Okla açılan günlerin oturum içi notu en çok bu kadar gün tutar. */
const DAY_CACHE_LIMIT = 30;
const validSnapshot = (value: unknown): value is DayFlowSnapshot => {
  const snap = value as DayFlowSnapshot | undefined;
  return !!snap && Array.isArray(snap.events) && Number.isFinite(Date.parse(snap.asOf));
};

/* "AÇIKLANDI" HER SATIRDA TEKRAR ETMİYOR (6 Kasım, sahibinin itirazı).
   Sonucu gelmiş satırda durum sözü yalnız ekran okuyucuya (`quiet`): sonucun
   kendisi (değer, sapma hapı, şirket rozetleri) ve düğümdeki onay işareti
   bunu zaten söylüyor, sayısı da başlığın yanındaki karnede. Söz yalnız
   okuyucunun bilmesi GEREKEN durumda görünür: bekleniyor, sürüyor, kısmen
   geldi, analiz hazır. Planlı satırın sözü de sessiz: "şimdi" çizgisinin
   altında durması onu söylüyor. */
function Status({ event, nowMs, labels, quiet = false }: { event: Pick<FlowEvent, "status" | "scheduledAt" | "endsAt">; nowMs: number; labels: Props["labels"]; quiet?: boolean }) {
  const status = displayFlowStatus(event, nowMs);
  if (quiet && (status === "released" || status === "held" || status === "scheduled")) return <span className="sr-only">{labels[status]}</span>;
  return <span key={status} className={styles.status} data-status={status}>
    {status === "released" || status === "analyzed" || status === "held" ? <Check size={12} weight="bold" /> : <span className={styles.statusDot} />}
    {labels[status]}
  </span>;
}

/** Günün karnesi — başlığın yanındaki hap (gerekçe DayFlow → "GÜNÜN KARNESİ"). */
function DaySummary({ events, nowMs, labels }: { events: FlowEvent[]; nowMs: number; labels: Props["labels"] }) {
  const states = events.map((event) => displayFlowStatus(event, nowMs));
  const done = states.filter((state) => state === "released" || state === "analyzed" || state === "held").length;
  return (
    <p className={styles.summary}>
      <span className="numeral">{labels.eventsCount.replace("{n}", String(events.length))}</span>
      <span aria-hidden className={styles.summaryBar}>
        {states.map((state, i) => (
          <i key={i} data-state={state === "released" || state === "analyzed" || state === "held" ? "done" : state === "partial" ? "partial" : state === "scheduled" ? "planned" : "due"} />
        ))}
      </span>
      <span className="numeral">{labels.eventsDone.replace("{n}", String(done)).replace("{total}", String(events.length))}</span>
    </p>
  );
}

/* SAATİ BELİRSİZ OLAYIN KÜNYESİ SEBEBİ SÖYLER (28 Eylül). Künye
   "olayın kendi künyesi varsa o öncelikli" kuralıyla basılıyordu; ama
   bilançonun künyesi saat penceresi yoksa yalnızca "Bilanço"
   (`lib/day-flow-data.ts`) ve sütunda tire duruyor. Sonuç: 28 Eylül'de NKE
   satırı "01 / –  · Planlandı Bilanço" okunuyordu, tirenin ne demek
   olduğu ekranın hiçbir yerinde yazmıyordu (yalnızca `aria-label`da). Saat
   yoksa sebep künyenin sonuna ekleniyor: "Bilanço · Saat Belirtilmedi". */
/* TÜR HER SATIRDA SÖZLE (6 Kasım, sahibinin itirazı: "satırların türü bir
   bakışta seçilmiyor"). Künyesi olmayan veri satırı yalnız bir ikon
   taşıyordu ve türü ekran okuyucuya kalıyordu; şimdi künye yoksa türün adı
   ("Ekonomik Veri") yazılır, düğümdeki ikon da türü çizer. */
function FlowNote({ event, labels }: { event: Pick<FlowEvent, "detail" | "timeEt" | "kind">; labels: Props["labels"] }) {
  const kind = event.detail ?? (event.kind === "earnings" ? labels.earnings : labels.economic);
  return <em>{event.timeEt ? kind : `${kind} · ${labels.timeUnknown}`}</em>;
}

/* BİLANÇO SATIRININ RÖZETLİ LOGOLARI (6 Kasım, sahibinin itirazı: "logolar
   16 piksel ve üst üste"). Logolar artık 26 piksel ve YAN YANA; her biri
   açıklandıysa hisse başına kârın beklentiye göre yönünü köşesinde küçük bir
   okla taşır (renk yalnız yön, `--up`/`--down`; eşitse nötr çizgi). Sayı ve
   sözcük açılan gövdede; burada bir bakışta "kaçı aştı" okunur. Satırın
   tür işareti eskiden de logoydu, simge değil: zil her bilanço satırında
   aynıydı ve hiçbir şey ayırt etmiyordu; logo ediyor. Dörtten
   fazlası "+N" ile. Logolar `aria-hidden`: aynı bilgi sr-only cümlede. */
const LOGO_LIMIT = 4;
function MemberMarks({ members, labels }: { members: FlowMember[]; labels: Props["labels"] }) {
  const shown = members.slice(0, members.length > LOGO_LIMIT ? LOGO_LIMIT - 1 : LOGO_LIMIT);
  /* Rozetin sözle karşılığı: "2/3 Beklentiyi Aştı" — renk tek taşıyıcı değil. */
  const reported = members.filter((member) => member.epsSurprise);
  return (
    <span className={styles.memberMarks}>
      <span className={styles.memberLogos} aria-hidden="true">
        {shown.map((member) => {
          const dir = member.epsSurprise?.direction;
          return (
            <span key={member.symbol} className={styles.memberLogo} data-dir={dir} title={dir ? `${member.symbol} · ${labels.eps}: ${labels[dir]}` : member.symbol}>
              <LogoTile symbol={member.symbol} logoUrl={member.logoUrl} size="sm" className={styles.memberTile} />
              {dir && <i>{dir === "beat" ? <ArrowUp size={9} weight="bold" /> : dir === "miss" ? <ArrowDown size={9} weight="bold" /> : <Equals size={9} weight="bold" />}</i>}
            </span>
          );
        })}
        {members.length > shown.length && <span className={`numeral ${styles.memberMore}`}>+{members.length - shown.length}</span>}
      </span>
      {reported.length > 0 && (
        <span className={styles.beatCount}>
          {labels.beatCount.replace("{n}", String(reported.filter((member) => member.epsSurprise!.direction === "beat").length)).replace("{total}", String(reported.length))}
          <span className="sr-only">: {reported.map((member) => `${member.symbol} ${labels[member.epsSurprise!.direction]}`).join(", ")}</span>
        </span>
      )}
    </span>
  );
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
          <LogoTile symbol={member.symbol} logoUrl={member.logoUrl} size="sm" />
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

/** Açık satırın kipi — gerekçe DayFlow içindeki `selection`. */
type DaySelection =
  | { kind: "auto"; tour: boolean }
  | { kind: "picked"; id: string; tour: boolean }
  | { kind: "closed" };

export function DayFlow({ initial, locale, labels, railLabels, heading, otherHeadings, preview, lineLabels }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [nowMs, setNowMs] = useState(() => new Date(initial.asOf).getTime());
  /* `auto` = seçim OTOMATİK (sıradaki olay açık); `closed` = okuyucu açık
     satırı kendisi kapattı — otomatik seçim onu yeniden açmasın. `tour`:
     olaylar arası otomatik tur — elle ilk seçimde kapanır (aşağıda).
     TEK BİRLEŞİM (8 Kasım, durum makinesi denetimi § 13): üç ayrı durumdu
     (`selectedId`, `allClosed`, `autoTour`) ve "seçili ama hepsi kapalı"
     gibi anlamsız birleşimler her yolda ayrı ayrı sıfırlanarak
     önleniyordu. Kapalı kipte tur yok; okuyan adlar aşağıda türetiliyor. */
  const [selection, setSelection] = useState<DaySelection>({ kind: "auto", tour: true });
  const selectedId = selection.kind === "picked" ? selection.id : null;
  const allClosed = selection.kind === "closed";
  const autoTour = selection.kind !== "closed" && selection.tour;
  const stopTour = () => setSelection((current) => (current.kind === "closed" || !current.tour ? current : { ...current, tour: false }));
  const [connection, setConnection] = useState<"ready" | "checking" | "error">("ready");
  const [announcement, setAnnouncement] = useState("");
  /* GÜN GEZİNMESİ (21 Ekim, sahibinin isteği: "geçmişe de gidebilsin,
     sağda oklarla"). `view` okla açılmış BAŞKA bir günün görüntüsü; `null`
     bugün demek. Bugünün görüntüsü (`snapshot`) arkada yoklanmaya devam
     eder — "Bugüne Dön" anında taze açılır, kahramandaki zil şeridi de
     hep bugünü okur (`publishFlow` yalnız `snapshot`ı yayımlar). Başka
     günde yoklama, "şimdi" işareti ve otomatik tur yok: gün kapanmış ya da
     başlamamış, değişen bir şey yok. Açılan günler oturum içinde notlanır;
     ileri geri gezmek aynı günü yeniden istemez. Adres değişmiyor: sığ
     adres güncellemesi uçuştaki gezinmeyi öldürüyor (CLAUDE.md). */
  const [view, setView] = useState<DayFlowSnapshot | null>(null);
  const [dayState, setDayState] = useState<{ phase: "idle" | "loading" | "error"; date: string | null }>({ phase: "idle", date: null });
  /* Önizlenen gün nota baştan girer: "Günün Tamamını Gör" aynı görüntüyü
     ikinci kez istemeden açar (DayPreview). */
  const dayCache = useRef(new Map<string, DayFlowSnapshot>(preview ? [[preview.dateEt, preview]] : []));
  const dayAbort = useRef<AbortController | null>(null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const refresh = useRef<() => void>(() => {});
  /** Yoklama saatinin ilk dayanağı — elimizdeki görüntünün yaşı (aşağıda). */
  const mountedAsOf = useRef(initial.asOf);
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
    /* Şerit hep bugünü gösterir: başka bir gündeyken seçim bugüne döndürür. */
    dayAbort.current?.abort();
    setView(null);
    setDayState({ phase: "idle", date: null });
    setSelection({ kind: "picked", id, tour: false });
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

  /* YOKLAMA SAATE BAĞLI, GÖRÜNÜRLÜĞE DEĞİL (20 Ekim). Gözlemci `observe()`
     anında bir kez ateşliyor ve bölüm kahramanın hemen altında, 200
     piksellik payın içinde: hidrasyonun ardından ilk iş, sunucunun bir an
     önce çizdiği görüntüyü yeniden istemekti. Bölüm görünüme her
     dönüşünde de 30 saniye beklenmeden bir istek daha gidiyordu; oturumlu
     okuyucuda her biri önbelleksiz `loadDayFlow`. Artık görünürlük ve
     sekmeye dönüş yalnız SIRADAKİ yoklamayı kurar: son görüntüden bu yana
     aralık dolduysa hemen, dolmadıysa kalan sürede. İlk dayanak
     görüntünün kendi `asOf`u (istemci saati sunucunun gerisindeyse şimdiki
     an; yoksa ilk yoklama dakikalarca ertelenirdi): geri tuşuyla gelen eski
     bir görüntü yine hemen tazelenir. Elle tazeleme düğmesi beklemez. */
  useEffect(() => {
    let timer = 0;
    let abort: AbortController | null = null;
    let active = true;
    let visible = true;
    let failures = 0;
    let lastAt = Math.min(Date.parse(mountedAsOf.current) || Date.now(), Date.now());
    let nextDelay = 30_000;
    function due() {
      window.clearTimeout(timer);
      if (!active || document.hidden || !visible || abort) return;
      timer = window.setTimeout(poll, Math.max(0, lastAt + nextDelay - Date.now()));
    }
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
        lastAt = Date.now();
        nextDelay = delay;
        if (active && visible && !document.hidden) timer = window.setTimeout(poll, delay);
      }
    }
    function onVisibility() {
      if (document.hidden) window.clearTimeout(timer); else due();
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) due(); else window.clearTimeout(timer);
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

  const shown = view ?? snapshot;
  const viewingToday = !view;
  const events = shown.events;
  const nowEt = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(nowMs));
  /* Başka günün "şimdi"si: geçmiş gün bitmiştir (bütün satırlar geçmiş),
     gelecek gün başlamamıştır (hiçbiri geçmiş değil). */
  const now = viewingToday ? minutesOf(nowEt) : shown.dateEt < shown.today ? 24 * 60 : -1;
  /* "ŞİMDİ" İŞARETİ — çizelgenin neresindeyiz.
     Omurga zaten sıralı; işaret onu ikiye bölüyor ve "bunlar geçti, bunlar
     gelecek" tek bakışta okunuyor. Yalnızca GERÇEKTEN böldüğünde basılıyor:
     gün başlamadıysa hepsi zaten gelecek demektir ve işaret fazladan bir
     satır olurdu. Saati belirsiz olaylar işareti tetiklemiyor — onların
     hangi tarafta olduğu bilinmiyor. */
  const firstUpcoming = events.findIndex((event) => event.timeEt !== null && minutesOf(event.timeEt) > now);
  const hasPast = events.some((event) => event.timeEt !== null && minutesOf(event.timeEt) <= now);
  const dividerAt = !viewingToday || !hasPast ? null : firstUpcoming === -1 ? events.length : firstUpcoming;
  /* OTOMATİK AÇIK SATIR SIRADAKİ OLAY: okuyucunun sorusu "şimdi ne olacak".
     Gün başlamadıysa ilk olay, gün bittiyse son olay (günün son cevabı). */
  const autoId = events.length === 0 ? null
    : (dividerAt === null ? events[0] : events[Math.min(dividerAt, events.length - 1)])!.id;
  const openId = allClosed ? null
    : selectedId && events.some((event) => event.id === selectedId) ? selectedId : autoId;
  const primary = (minutes: number) => clockOf(minutes + shown.offsets.primary);
  const nowLabel = `${railLabels.now} · ${primary(now)} ${shown.tags.primary}`;
  const timeOf = (event: FlowEvent) => event.timeEt ? `${event.approx ? "~" : ""}${primary(minutesOf(event.timeEt))}` : labels.timeUnknown;
  const checked = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: displayZone(locale), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(snapshot.asOf));
  const partsOf = (date: string) => new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "UTC", month: "long", day: "numeric", weekday: "long" }).formatToParts(new Date(date + "T12:00:00Z"));
  /* Yüklenirken künye HEDEF günü yazar: okun tepkisi anında görünsün.
     Telefonda kısa biçim ("21 Eki Çar"): iki ok ve tazelik düğmesiyle uzun
     ad tek satıra sığmıyor. Kısa ad Intl'in `short` biçiminden DEĞİL,
     uzun adın ilk üç harfinden: Node ile tarayıcının ICU sürümleri en-GB
     kısa biçimini farklı basıyor ve /en'de hidrasyon uyuşmazlığı çıktı
     (21 Ekim, duman testinde ölçüldü); uzun biçim iki tarafta aynı. */
  const labelDate = dayState.phase === "loading" && dayState.date ? dayState.date : shown.dateEt;
  const parts = partsOf(labelDate);
  const dayLabel = parts.map((part) => part.value).join("");
  const dayLabelShort = parts.map((part) => part.type === "weekday" || part.type === "month" ? part.value.slice(0, 3) : part.value).join("").replace(/,/g, "");
  const loadingDay = dayState.phase === "loading";

  function goTo(date: string | null) {
    dayAbort.current?.abort();
    dayAbort.current = null;
    setSelection({ kind: "auto", tour: false });
    if (!date || date === snapshot.today) {
      setView(null);
      setDayState({ phase: "idle", date: null });
      return;
    }
    const held = dayCache.current.get(date);
    if (held) {
      setView(held);
      setDayState({ phase: "idle", date: null });
      return;
    }
    const controller = new AbortController();
    dayAbort.current = controller;
    setDayState({ phase: "loading", date });
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    fetch(`/api/day-flow?locale=${locale}&tarih=${date}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: { ok?: boolean; snapshot?: unknown } = response.ok ? await response.json() : {};
        if (!result.ok || !validSnapshot(result.snapshot)) throw new Error("unavailable");
        const next = result.snapshot;
        if (dayCache.current.size >= DAY_CACHE_LIMIT) dayCache.current.delete(dayCache.current.keys().next().value!);
        dayCache.current.set(date, next);
        if (dayAbort.current !== controller) return;
        setView(next);
        setDayState({ phase: "idle", date: null });
      })
      .catch(() => {
        if (dayAbort.current !== controller) return;
        setDayState({ phase: "error", date });
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (dayAbort.current === controller) dayAbort.current = null;
      });
  }
  useEffect(() => () => dayAbort.current?.abort(), []);

  /* OTOMATİK TUR (15 Ekim, sahibinin isteği: "üç sekme kendi aralarında
     geçsin; kullanıcı isterse eliyle de geçsin"). Açık olay sekiz saniyede
     bir sıradakine akıp başa döner. Tur KİBAR: imleç ya da odak bölümün
     üstündeyken, bölüm ekran dışındayken, sekme arka plandayken ve hareketi
     azaltanda bekler; okuyucu bir olayı ELİYLE seçtiği ya da katlı listeyi
     açtığı an kendini tamamen kapatır (WCAG 2.2.2 — durdurma yolu,
     etkileşimin kendisi). Tur sayfayı KAYDIRMAZ; kaydırma yalnızca elle
     seçimde ve kahraman şeridinden gelen seçimde.
     BEKLEME DOM'DAN OKUNUR, HER TIKTA (20 Ekim). Efekt her yoklamada
     yeniden kuruluyor (`events` her başarılı yoklamada yeni dizi) ve
     `paused` false başlıyordu; imleç ya da odak zaten içerideyken
     `pointerenter`/`focusin` yeniden ateşlenmediği için bekleme
     kayboluyordu. Kurulurken DOM'u okumak da yetmedi: imleç ve odak TEK
     bayrağı paylaşıyordu, biri bitince öbürü de düşüyordu — klavyeyle
     gezinen okuyucunun altından sayfa kayıp imleç çıkınca `pointerleave`
     odaklı beklemeyi siliyor, sekiz saniye sonra tur ilerliyor ve odaklı
     bağlantının gövdesi `inert` olup odak `<body>`ye düşüyordu (WCAG
     2.4.3); tersine odak çıkınca tur imlecin altında sürüyordu. Artık
     bayrak yok: her tikte `:hover` ve `activeElement` sorulur, ikisi
     birbirini silemez ve yeniden kurulmanın önemi kalmaz. `:hover` yalnız
     gerçek imleçli aygıtta sayılır; dokunmatikte dokunuştan sonra yapışık
     kalıp turu sonsuza dek durdururdu. */
  useEffect(() => {
    if (!autoTour || !viewingToday || allClosed || events.length < 2 || !openId) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    const canHover = window.matchMedia("(hover: hover)").matches;
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    if (el) observer.observe(el);
    const timer = window.setInterval(() => {
      if (document.hidden || !visible) return;
      if (el && ((canHover && el.matches(":hover")) || el.contains(document.activeElement))) return;
      const at = events.findIndex((event) => event.id === openId);
      const next = events[(at + 1) % events.length]!.id;
      setSelection((current) => (current.kind === "closed" || !current.tour ? current : { kind: "picked", id: next, tour: true }));
    }, 8_000);
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [autoTour, viewingToday, allClosed, events, openId]);

  function toggle(id: string) {
    setSelection(openId === id ? { kind: "closed" } : { kind: "picked", id, tour: false });
  }

  /* "Şimdi" işareti saat sütununda saatini, omurgada halkalı noktasını,
     içerik sütununda ince çizgisini taşır (gerekçe CSS → "ŞİMDİ"). */
  const nowMark = (
    <li className={styles.nowMark} aria-hidden="true">
      <span className={styles.nowTime}><small>{railLabels.now}</small><b className="numeral">{primary(now)}</b></span>
      <span className={styles.nowDot} />
      <span className={styles.nowLine}><b>{nowLabel}</b></span>
    </li>
  );

  return <div ref={ref} className={styles.flow} data-day-flow>
    {/* BAŞLIK VE KÜNYE TEK SATIR (24 Eylül). Bölümün başlığı ayrı bir
        satırda, altında bir kıl çizgi ve ONUN altında künye satırı
        (piyasa günü, otomatik güncelleme) duruyordu: 1440'ta içerik
        başlamadan önce 120 piksel. Geniş ekranda ikisi yan yana, başlık
        solda künye sağda; dar ekranda eskisi gibi alt alta. */}
    <div className={styles.toolbar}>
      {/* GÜNÜN KARNESİ BAŞLIĞIN YANINDA (29 Ekim, sahibinin isteği: "içerikler
          mantıklı şekilde başlık yanında olsun"). "Günün Olayları 4" kendi
          satırıydı (1440'ta 40 piksel) ve yalnız bir sayı taşıyordu; şimdi
          başlığın yanında tek hap: olay sayısı, kaçının açıklandığı ve
          olay başına bir kare (açıklanan yeşil, kısmen açıklanan yarı yeşil,
          saati gelip bekleyen mavi, planlı boş). Renk yalnız durumdan. */}
      {heading && (
        <div className={styles.headingRow}>
          <div className={styles.heading}>{viewingToday || !otherHeadings ? heading : shown.dateEt < shown.today ? otherHeadings.past : otherHeadings.future}</div>
          {events.length > 0 && <DaySummary events={events} nowMs={nowMs} labels={labels} />}
        </div>
      )}
      <div className={styles.toolbarMeta}>
      {/* GÜN SEÇİCİ (21 Ekim): tarih iki okun arasında; ok yoksa (pencerenin
          ucu) düğme pasif kalır, yer değiştirmez. */}
      <div className={styles.dayNav} role="group" aria-label={labels.dayNav} aria-busy={loadingDay || undefined}>
        <button type="button" className={styles.dayArrow} onClick={() => shown.prevDate && goTo(shown.prevDate)} disabled={!shown.prevDate} aria-label={labels.prevDay} title={labels.prevDay}><CaretLeft size={16} weight="bold" /></button>
        <span className={styles.date}>
          {loadingDay ? <CircleNotch className={styles.spinner} size={15} aria-hidden /> : <CalendarBlank size={15} aria-hidden />}
          <span className={styles.marketDay}>{labels.marketDay}</span>
          <span aria-live="polite"><span className={styles.dayLong}>{dayLabel}</span><span className={styles.dayShort} aria-hidden="true">{dayLabelShort}</span></span>
          <small>NY</small>
        </span>
        <button type="button" className={styles.dayArrow} onClick={() => shown.nextDate && goTo(shown.nextDate)} disabled={!shown.nextDate} aria-label={labels.nextDay} title={labels.nextDay}><CaretRight size={16} weight="bold" /></button>
      </div>
      {viewingToday && dayState.phase !== "error" ? <div className={styles.connection} data-state={connection}>
        {connection === "checking" ? <CircleNotch className={styles.spinner} size={14} /> : <span className={styles.connectionDot} />}
        <span>{connection === "error" ? labels.offline : labels.auto}</span>
        <button onClick={() => refresh.current()} disabled={connection === "checking"} aria-label={connection === "error" ? labels.retry : `${labels.checked}: ${checked} ${snapshot.tags.primary}`} title={labels.liveNote}><Clock size={15} /><span>{labels.checked}</span>{checked} {snapshot.tags.primary}</button>
      </div> : <button type="button" className={styles.todayButton} onClick={() => goTo(null)}>{labels.backToToday}<ArrowRight size={13} weight="bold" aria-hidden /></button>}
      </div>
    </div>
    {dayState.phase === "error" && dayState.date && (
      <p className={styles.dayError} role="status">{labels.dayFailed}
        <button type="button" onClick={() => goTo(dayState.date)}>{labels.retry}</button>
      </p>
    )}

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
    <div className={styles.dayBody} data-loading={loadingDay || undefined} aria-busy={loadingDay || undefined}>
    {events.length > 0 ? <>
      {/* Listenin başlığı ekran okuyucuda; görünen sayı başlığın yanındaki hapta. */}
      <h3 className="sr-only">{labels.events}</h3>
      <ol className={styles.timeline}>
        {events.map((event, index) => {
          const open = openId === event.id;
          const past = event.timeEt !== null && minutesOf(event.timeEt) <= now;
          const member = event.members?.length === 1 ? event.members[0]! : null;
          const value = event.actual ?? member?.eps ?? null;
          const valueLabel = event.actual ? labels.actual : member?.eps ? labels.eps : null;
          const bodyId = `${detailId}-${index}`;
          const status = displayFlowStatus(event, nowMs);
          const done = DONE.has(status);
          const KindIcon = event.kind === "earnings" ? Buildings : ChartLineUp;
          const deviation = event.kind === "event" && event.actual ? event.deviation : undefined;
          return <Fragment key={event.id}>
            {index === dividerAt && nowMark}
            {/* SATIRIN HİYERARŞİSİ (6 Kasım, sahibinin isteği: "kolay okuyup
                anlasın, kolay seçilsin"). Soldan sağa üç soru: NE ZAMAN
                (saat sütunu), NE (düğümdeki tür ikonu + başlık + tür adı),
                NE ÇIKTI (sağda sonuç). Numaralı daireler bilgi taşımıyordu
                ("01/02/03"); düğüm artık türü çizer ve durumu dolgusuyla
                söyler: geçmiş sakin dolu + onay işareti, sıradaki çerçeveli,
                açık olan marka mavisi. Satırın TAMAMI tek buton (saat ve
                düğüm dahil); açık satır gömülü tonda bir kart. */}
            <li className={styles.tlRow} data-event-id={event.id} data-open={open || undefined} data-past={past || undefined} data-kind={event.kind} data-status={status}>
              <button type="button" className={styles.tlHead} onClick={() => toggle(event.id)} aria-expanded={open} aria-controls={bodyId}>
                <span className={styles.tlTime} data-unknown={!event.timeEt}><b className="numeral" aria-label={event.timeEt ? undefined : labels.timeUnknown}>{event.timeEt ? timeOf(event) : NO_VALUE}</b>{event.timeEt && <small>{shown.tags.primary}</small>}</span>
                <span className={styles.tlNode} aria-hidden="true">
                  <KindIcon size={16} weight={open ? "bold" : "regular"} />
                  {done && <i className={styles.tlTick}><Check size={8} weight="bold" /></i>}
                </span>
                <span className={styles.tlSummary}>
                  <strong>{event.title}</strong>
                  <span className={styles.cardKind}>
                    <FlowNote event={event} labels={labels} />
                    <Status event={event} nowMs={nowMs} labels={labels} quiet />
                  </span>
                </span>
                {/* SONUÇ SÜTUNU. Veri satırında gerçekleşen ve YANINDA
                    beklentiye göre yeri (hap: yön oku + "Beklentinin 15 Bin
                    Üstünde"; renk yalnız yön). Sonuç gelmeden beklenti
                    sönük yazılır: satır okuyucuya neyi beklediğini söyler.
                    Bilançoda logolar ve yön rozetleri. Kıyasın çizimi
                    açılan gövdede (sapma çizgisi). 28 Ekim'deki kompakt
                    turda kapalı satır kıyassız tek sayı taşıyordu ("satır
                    kompakt kalsın"); sahibi 6 Kasım'da tam bunun
                    okunmadığını söyledi — hap tek satıra sığıyor, satır
                    uzamıyor (ölçüm CSS'te). */}
                <span className={styles.tlAside}>
                  {event.kind === "earnings" && event.members?.length ? <MemberMarks members={event.members} labels={labels} /> : null}
                  {deviation && (
                    <span className={styles.devPill} data-dir={deviation.direction}>
                      {deviation.direction === "above" ? <ArrowUp size={12} weight="bold" aria-hidden /> : deviation.direction === "below" ? <ArrowDown size={12} weight="bold" aria-hidden /> : <Equals size={12} weight="bold" aria-hidden />}
                      {deviation.verdict}
                    </span>
                  )}
                  {value && valueLabel ? (
                    <span className={styles.tlValue} data-with-pill={deviation ? true : undefined}><small>{valueLabel}</small><b className="numeral">{value}</b></span>
                  ) : event.kind === "event" && event.forecast ? (
                    <span className={styles.tlValue} data-pending><small>{labels.forecast}</small><b className="numeral">{event.forecast}</b></span>
                  ) : null}
                </span>
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
                    <MemberList members={event.members} scheduledAt={event.scheduledAt} nowMs={nowMs} labels={labels} openEventId={openId} onEngage={stopTour} source={event.source} href={event.href} />
                  ) : <>
                    {/* ÜÇ DEĞER + SAPMA ÇİZGİSİ (6 Kasım). Üç sayı düz yazı
                        olarak duruyordu; kıyas okunarak yapılıyordu. Şimdi
                        "Son Açıklanan Veriler" kartının çizgisi: ortası
                        beklenti, nokta gerçekleşen, gri çentik önceki
                        (`DeviationLine`). Etiketin önündeki işaret çizgideki
                        işaretin aynısı — lejant ayrı kutu değil. Çizgi
                        yalnız düz sayılarda; Fed aralığı gibi değerlerde üç
                        sayı eskisi gibi. Geniş ekranda sayılar solda, çizgi
                        sağda aynı hatta; telefonda alt alta. */}
                    {(event.actual || event.forecast || event.previous) && (
                      <div className={styles.resultsBlock} data-line={deviation && lineLabels ? true : undefined}>
                        <dl className={styles.results}>
                          {([["actual", labels.actual, event.actual], ["forecast", labels.forecast, event.forecast], ["previous", labels.previous, event.previous]] as const).map(([key, label, figure]) => {
                            /* İşaret TABANDAN (6 Kasım, inceleme): taban olan
                               değer dik çizgi, çentik yalnız çizgide duruyorsa,
                               düz sayı olmayan beklenti işaretsiz (`legendMark`). */
                            const mark = deviation && lineLabels && figure ? legendMark(key, deviation) : null;
                            return (
                            <div key={key} data-kind={key} data-dir={key === "actual" ? deviation?.direction : undefined}>
                              <dt>{mark && <i aria-hidden className={styles.key} data-mark={mark} />}{label}</dt>
                              <dd className="numeral" data-empty={!figure || undefined}>{figure ?? NO_VALUE}</dd>
                            </div>
                            );
                          })}
                        </dl>
                        {deviation && lineLabels && (
                          <div className={styles.devBlock}>
                            <DeviationLine key={open ? "open" : "closed"} deviation={deviation} below={lineLabels.sideBelow} above={lineLabels.sideAbove} baseLabel={deviation.base === "forecast" ? labels.forecast : labels.previous} motion={false} className={styles.devLine} />
                            <p className={styles.verdictLine}>
                              <span className={styles.verdict} data-dir={deviation.direction}>{deviation.verdict}</span>
                              {deviation.versus && <span>{deviation.versus}</span>}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Bekleme cümlesi yalnız gerçekten bekleyen olayda: sonucu
                        olmayan toplantıda ve sayısız "Açıklandı"da yanlıştı. */}
                    {!event.actual && (status === "scheduled" || status === "awaiting") && <p className={styles.waiting}>{status === "scheduled" ? labels.scheduledHint : labels.pendingHint}</p>}
                    <div className={styles.detailFooter}><span>{labels.source}: {event.source}</span><Link href={event.href}>{labels.calendar}<ArrowUpRight size={14} /></Link></div>
                  </>}
                </div>
              </div>
            </li>
          </Fragment>;
        })}
        {dividerAt === events.length && nowMark}
      </ol>
    </> : shown.hiddenEarnings > 0 ? (
      /* Akış boş ama gün boş DEĞİL: eşiğin altındaki bilançolar var. "Açıklama
         yok" demek aynı sayfadaki bilanço paneliyle çelişirdi. */
      <div className={styles.empty}><span><CalendarBlank size={32} weight="duotone" /></span><div><h3>{labels.emptyMajorTitle}</h3><p>{(viewingToday ? labels.emptyMajorHint : labels.emptyMajorDayHint).replace("{count}", String(shown.hiddenEarnings))}{" "}<Link href={withLocale("/bilancolar", locale)} prefetch={false} className={styles.emptyLink}>{labels.emptyMajorLink}<ArrowUpRight size={12} weight="bold" aria-hidden /></Link></p></div></div>
    ) : viewingToday && preview && preview.events.length > 0 ? (
      <DayPreview preview={preview} locale={locale} labels={labels} onOpen={() => goTo(preview.dateEt)} />
    ) : <div className={styles.empty}><span><CalendarBlank size={32} weight="duotone" /></span><div><h3>{viewingToday ? labels.emptyTitle : labels.emptyDayTitle}</h3><p>{viewingToday ? labels.emptyHint : labels.emptyDayHint}</p></div></div>}
    </div>
    {viewingToday && snapshot.sourceDelayed && <p className={styles.sourceDelay}>{labels.sourceDelayed}</p>}
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}

/** Önizlemede en çok kaç olay satırı açık — kalanı sayıyla yazılır. */
const PREVIEW_ROWS = 3;
/** Önizleme cetvelinin ekseni, ET dakikası: ön seansın başı ve akşam seansının sonu. */
const RULER_MINUTES: [number, number] = [4 * 60, 20 * 60];
const REGULAR_OPEN_MINUTES = 9 * 60 + 30;

/* SIRADAKİ GÜNE BAKIŞ (31 Ekim, sahibinin isteği: "burayı da çok daha iyi
   görselliği artıracak, görsel ve animasyonlu hâle getirelim"). Hafta
   sonu ve tatilde akış tek satırlık "Bugün Planlanmış Açıklama Yok"
   diyordu (1440'ta 217 piksellik panelin yarısı boş bir cümle); oysa
   okuyucunun o gün sorduğu soru "pazartesi ne var". Bugün boşken sunucu
   sıradaki işlem gününün GERÇEK görüntüsünü de veriyor (`RailSection` →
   `loadSharedOtherDay`, okların açtığı görüntünün aynısı) ve akış onu
   önizliyor:
   - üstte o günün saat cetveli: kahramandaki zil şeridiyle aynı dil (ön
     seans ve akşam seansı çukur tonda, asıl seans mavi), olaylar saatinde
     numaralı birer nokta — gün tek bakışta "sabah iki bilanço, akşam altı";
   - altında en çok üç olay satırı, bilançoda şirket logoları;
   - künyede eşiğin altındaki bilanço sayısı ve günün tamamını açan buton
     (oklarla aynı yol, görüntü notta hazır).
   Uydurma yok: o günün kaydı yoksa eski boş durum basılıyor. Hareket bir
   kez: cetvel soldan çizilir, noktalar ve satırlar sırayla belirir; hareketi
   azaltana son kare (DayFlow.module.css → "SIRADAKİ GÜNE BAKIŞ"). */
function DayPreview({ preview, locale, labels, onOpen }: { preview: DayFlowSnapshot; locale: Locale; labels: Props["labels"]; onOpen: () => void }) {
  const events = preview.events;
  const rows = events.slice(0, PREVIEW_ROWS);
  const primary = (minutes: number) => clockOf(minutes + preview.offsets.primary);
  const day = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
    .format(new Date(preview.dateEt + "T12:00:00Z"));
  const span = RULER_MINUTES[1] - RULER_MINUTES[0];
  const share = (minutes: number) => Math.max(0, Math.min(1, (minutes - RULER_MINUTES[0]) / span));
  const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
  const open = share(REGULAR_OPEN_MINUTES);
  const close = share(preview.closeMinutes);
  return (
    <div className={styles.preview}>
      <div className={styles.previewHead}>
        <span className={styles.previewIcon} aria-hidden="true"><CalendarBlank size={22} weight="duotone" /></span>
        <div>
          <h3>{labels.emptyTitle}</h3>
          <p>{labels.previewLead.replace("{day}", day).replace("{n}", String(events.length))}</p>
        </div>
      </div>
      {/* Cetvel bir resim; olaylar ekran okuyucuya listeden okunur. */}
      <div className={styles.ruler} role="img" aria-label={labels.previewRuler}>
        <span className={styles.rulerTrack}>
          <span className={styles.rulerRegular} style={{ left: pct(open), width: pct(close - open) }} />
        </span>
        {events.map((event, index) => event.timeEt && (
          <span key={event.id} className={styles.rulerDot} data-kind={event.kind} style={{ left: pct(share(minutesOf(event.timeEt))), "--i": index } as CSSProperties}>
            <b className="numeral">{String(index + 1).padStart(2, "0")}</b>
          </span>
        ))}
        <span className={`numeral ${styles.rulerEnd}`} data-at="start">{primary(RULER_MINUTES[0])}</span>
        <span className={`numeral ${styles.rulerEnd}`} data-at="open" style={{ left: pct(open) }}>{primary(REGULAR_OPEN_MINUTES)}</span>
        <span className={`numeral ${styles.rulerEnd}`} data-at="close" style={{ left: pct(close) }}>{primary(preview.closeMinutes)}</span>
        <span className={`numeral ${styles.rulerEnd}`} data-at="end">{primary(RULER_MINUTES[1])} {preview.tags.primary}</span>
      </div>
      <ol className={styles.previewList}>
        {rows.map((event, index) => (
          <li key={event.id} className={styles.previewRow} data-kind={event.kind} style={{ "--i": index } as CSSProperties}>
            <span className={styles.previewNode} aria-hidden="true"><b className="numeral">{String(index + 1).padStart(2, "0")}</b></span>
            <span className={styles.previewTime}>
              <b className="numeral">{event.timeEt ? `${event.approx ? "~" : ""}${primary(minutesOf(event.timeEt))}` : NO_VALUE}</b>
              <small>{event.timeEt ? preview.tags.primary : labels.timeUnknown}</small>
            </span>
            <span className={styles.previewMain}>
              <strong>{event.title}</strong>
              <em>{event.detail ?? (event.kind === "earnings" ? labels.earnings : labels.economic)}</em>
            </span>
            {event.kind === "earnings" && event.members?.length ? (
              <span className={styles.previewLogos} aria-hidden="true">
                {event.members.slice(0, 4).map((member) => (
                  <LogoTile key={member.symbol} symbol={member.symbol} logoUrl={member.logoUrl} size="xs" className={styles.cardLogo} />
                ))}
              </span>
            ) : (
              <i className={styles.previewKind} data-kind={event.kind} aria-hidden="true">{event.kind === "earnings" ? <Bell size={14} /> : <TrendUp size={14} />}</i>
            )}
          </li>
        ))}
      </ol>
      <div className={styles.previewFoot}>
        <span>
          {events.length > PREVIEW_ROWS && <b>{labels.previewMore.replace("{n}", String(events.length - PREVIEW_ROWS))}</b>}
          {preview.hiddenEarnings > 0 && <span>{labels.previewHidden.replace("{count}", String(preview.hiddenEarnings))}</span>}
        </span>
        <button type="button" className={styles.previewOpen} onClick={onOpen}>
          {labels.previewOpen}<ArrowRight size={13} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
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
