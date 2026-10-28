"use client";

import { Fragment, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowRight, ArrowUpRight, Bell, CalendarBlank, CaretDown, CaretLeft, CaretRight, Check, CircleNotch, Clock, TrendUp } from "@phosphor-icons/react";
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
};
const minutesOf = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
/** Okla açılan günlerin oturum içi notu en çok bu kadar gün tutar. */
const DAY_CACHE_LIMIT = 30;
const validSnapshot = (value: unknown): value is DayFlowSnapshot => {
  const snap = value as DayFlowSnapshot | undefined;
  return !!snap && Array.isArray(snap.events) && Number.isFinite(Date.parse(snap.asOf));
};

function Status({ event, nowMs, labels }: { event: Pick<FlowEvent, "status" | "scheduledAt" | "endsAt">; nowMs: number; labels: Props["labels"] }) {
  const status = displayFlowStatus(event, nowMs);
  return <span key={status} className={styles.status} data-status={status}>
    {status === "released" || status === "analyzed" || status === "held" ? <Check size={12} weight="bold" /> : <span className={styles.statusDot} />}
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

export function DayFlow({ initial, locale, labels, railLabels, heading, otherHeadings }: Props) {
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
  const dayCache = useRef(new Map<string, DayFlowSnapshot>());
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
    setAutoTour(false);
    setSelectedId(null);
    setAllClosed(false);
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
      setSelectedId(events[(at + 1) % events.length]!.id);
    }, 8_000);
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [autoTour, viewingToday, allClosed, events, openId]);

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
      {heading && <div className={styles.heading}>{viewingToday || !otherHeadings ? heading : shown.dateEt < shown.today ? otherHeadings.past : otherHeadings.future}</div>}
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
                  <span className={styles.tlTime} data-unknown={!event.timeEt}><b className="numeral" aria-label={event.timeEt ? undefined : labels.timeUnknown}>{event.timeEt ? timeOf(event) : NO_VALUE}</b>{event.timeEt && <small>{shown.tags.primary}</small>}</span>
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
                  ) : <span className={styles.tlValue} aria-hidden="true" />}
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
                      {/* Bekleme cümlesi yalnız gerçekten bekleyen olayda: sonucu
                          olmayan toplantıda ve sayısız "Açıklandı"da yanlıştı. */}
                      {!event.actual && (displayFlowStatus(event, nowMs) === "scheduled" || displayFlowStatus(event, nowMs) === "awaiting") && <p className={styles.waiting}>{displayFlowStatus(event, nowMs) === "scheduled" ? labels.scheduledHint : labels.pendingHint}</p>}
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
    </> : shown.hiddenEarnings > 0 ? (
      /* Akış boş ama gün boş DEĞİL: eşiğin altındaki bilançolar var. "Açıklama
         yok" demek aynı sayfadaki bilanço paneliyle çelişirdi. */
      <div className={styles.empty}><span><CalendarBlank size={32} weight="duotone" /></span><div><h3>{labels.emptyMajorTitle}</h3><p>{(viewingToday ? labels.emptyMajorHint : labels.emptyMajorDayHint).replace("{count}", String(shown.hiddenEarnings))}{" "}<Link href={withLocale("/bilancolar", locale)} prefetch={false} className={styles.emptyLink}>{labels.emptyMajorLink}<ArrowUpRight size={12} weight="bold" aria-hidden /></Link></p></div></div>
    ) : <div className={styles.empty}><span><CalendarBlank size={32} weight="duotone" /></span><div><h3>{viewingToday ? labels.emptyTitle : labels.emptyDayTitle}</h3><p>{viewingToday ? labels.emptyHint : labels.emptyDayHint}</p></div></div>}
    </div>
    {viewingToday && snapshot.sourceDelayed && <p className={styles.sourceDelay}>{labels.sourceDelayed}</p>}
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
