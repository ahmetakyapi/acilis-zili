"use client";

import { Fragment, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Buildings, CaretDown, ChartLineUp, Check, Equals } from "@phosphor-icons/react";
import { LogoTile } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import { displayFlowStatus, type FlowEvent } from "@/lib/day-flow";
import { axisBands, axisHours, axisShare, bandOf, capTier, layoutFlags, leadMember, minutesOfClock, type AxisDomain } from "@/lib/flow-axis";
import { clockOf } from "@/lib/session-clock";
import styles from "./FlowAxis.module.css";

/** Bayrağın eni, eksenin payı (≈ 2 sa 15 dk). Zamanla ölçülür: yerleşim
    ekran eninden bağımsız, sunucu son kareyi basar (lib/flow-axis.ts). */
export const FLAG_SHARE = 0.14;
/** Bu kadar kattan fazlası sıkı yoğunlukta çizilir (tek satırlık bayrak). */
const COMFY_ROWS = 4;
const DONE = new Set(["released", "analyzed", "held"]);

type Labels = Dictionary["dayFlow"];
type RailLabels = Dictionary["dayRail"];

export type FlowAxisProps = {
  events: FlowEvent[];
  domain: AxisDomain;
  offsets: { primary: number; secondary: number };
  tags: { primary: string; secondary: string };
  labels: Labels;
  railLabels: RailLabels;
  /** Durum sözleri için an (sonucu beklenen / süren). */
  nowMs: number;
  /** "Şimdi"nin ET dakikası; başka günde `null` (im basılmaz). */
  nowMinutes: number | null;
  /** Geçen kısmın sınırı, ET dakikası: geçmiş günde gün sonu, gelecekte −1. */
  elapsedMinutes: number;
  /** Açık (ayrıntısı görünen) olay ve başlık cümlesinin işaret ettiği olay. */
  openId?: string | null;
  leadId?: string | null;
  onPick: (id: string) => void;
  /** Açık olayın ayrıntı kartı; verilmezse bayraklar yalnız seçer (önizleme). */
  renderDetail?: (event: FlowEvent) => ReactNode;
  detailId?: (id: string) => string;
  /** Her bayrağın adına eklenen eylem cümlesi (önizlemede "günü aç"). */
  pickHint?: string;
  /** Açık olay kendiliğinden değişiyor (otomatik tur): ayrıntı kartının boyu
      o ana dek görülen en uzun karta sabitlenir (aşağıda "KARTIN TABANI"). */
  steady?: boolean;
};

/** Olayın bayrakta ve satırda yazılan sonucu — tek yerde, iki düzen okur. */
function resultOf(event: FlowEvent, labels: Labels) {
  const member = event.members?.length === 1 ? event.members[0]! : null;
  const deviation = event.kind === "event" && event.actual ? event.deviation : undefined;
  const surprise = event.kind === "earnings" ? member?.epsSurprise : undefined;
  const reported = event.members?.filter((item) => item.epsSurprise) ?? [];
  const value = event.actual ?? member?.eps ?? null;
  const dir: "above" | "below" | "inline" | undefined = deviation?.direction
    ?? (surprise ? (surprise.direction === "beat" ? "above" : surprise.direction === "miss" ? "below" : "inline") : undefined);
  return {
    member,
    value,
    valueLabel: event.actual ? labels.actual : member?.eps ? labels.eps : null,
    pending: !value ? (event.kind === "event" ? event.forecast : member && !member.eps ? member.epsEstimate : undefined) : undefined,
    pendingLabel: event.kind === "event" ? labels.forecast : labels.epsEstimate,
    dir,
    verdict: deviation?.verdict ?? (surprise ? `${labels[surprise.direction]}${surprise.pct ? ` ${surprise.pct}` : ""}` : undefined),
    beats: event.members && event.members.length > 1 && reported.length > 0
      ? labels.beatCount.replace("{n}", String(reported.filter((item) => item.epsSurprise!.direction === "beat").length)).replace("{total}", String(reported.length))
      : undefined,
  };
}

const DirIcon = ({ dir, size }: { dir: "above" | "below" | "inline"; size: number }) =>
  dir === "above" ? <ArrowUp size={size} weight="bold" aria-hidden /> : dir === "below" ? <ArrowDown size={size} weight="bold" aria-hidden /> : <Equals size={size} weight="bold" aria-hidden />;

/**
 * GÜNÜN EKSENİ (14 Kasım 2026, sahibinin isteği: "Bugünün akışını görsel
 * olarak çok daha iyi ve görselliği öne çıkaracak gerçekten iyi bir tasarım").
 *
 * Panel bir satır listesiydi: saat metindi, eksen yoktu; geçen ile gelen
 * olay aynı ağırlıktaydı; önem, tür ve sonuç sözle okunuyordu. Şimdi günün
 * kendisi çiziliyor: ön seans / seans / akşam seansı bantlı bir eksen
 * (kahramandaki `SessionRail`in dili: 8 piksellik oluk, asıl seans mavinin
 * %30'u, geçen kısım dolu), üstünde her olay SAATİNDE dikilen bir direk ve
 * direğe asılı bayrak. Bayraklar soldan sağa inen bir basamak kurar; aynı
 * dakikadaki olaylar aynı direkte kümelenir (yerleşim `layoutFlags`).
 *
 * - ÖNEM imin boyu ve dolgusunda (yüksek: dolu ve büyük; düşük: küçük,
 *   çerçeveli), eksendeki ayak noktasında da aynı üç boy.
 * - SONUÇ imin rozetinde: beklentinin üstü/altı yön renginde ok, yönsüz
 *   sonuç nötr onay; değer bayrağın saat satırında. Renk yalnız yön.
 * - "ŞİMDİ" eksende bir çizgi ve künye; solundaki oluk dolu, geçmiş
 *   bayraklar bir ton sakin, sıradaki olayın imi mavi halkalı.
 * - Saati yaklaşık bilanço (`approx`) "~" ile yazılır, direği kesiklidir ve
 *   penceresinin bandı boyunca kesikli bir iz taşır: "bu bandın içinde bir
 *   yerde" (Veri Dürüstlüğü 1). Saati hiç bilinmeyen olay eksene konmaz,
 *   altındaki tepside durur.
 *
 * TEK DOM, İKİ DÜZEN. Olaylar tek bir sıralı liste (`<ol>`) ve her biri bir
 * buton: geniş kapta butonlar eksene bayrak olarak dizilir, ayrıntı kartı
 * eksenin altında açılır; dar kapta (telefon, tablet) aynı liste dikey bir
 * zaman şeridine döner, zil satırları (açılış, kapanış) ve "şimdi" satırı
 * araya girer, ayrıntı bastığın satırın altında açılır, eksen küçük bir
 * harita olarak üstte kalır. Ekran okuyucu ve klavye iki düzende de aynı
 * listeyi saat sırasıyla okur; eksenin çizimi `aria-hidden`.
 *
 * Kırılım KABIN eninden (`@container`), ekranınkinden değil: panel dar bir
 * kolona girerse kendiliğinden şeride döner (FlowAxis.module.css).
 */
export function FlowAxis({ events, domain, offsets, tags, labels, railLabels, nowMs, nowMinutes, elapsedMinutes, openId = null, leadId = null, onPick, renderDetail, detailId, pickHint, steady = false }: FlowAxisProps) {
  /* KARTIN TABANI (14 Kasım 2026, ikinci tur). Otomatik tur açık olayı sekiz
     saniyede bir değiştirir; kartın boyu içeriğe göre oynadığı için (sonucu
     beklenen veri: iki satır; bilanço: şirket satırları) panelin dibi ve
     altındaki bütün sayfa her adımda zıplıyordu (ölçüm modül CSS'inin
     sonunda). Tur sürerken kart, o ana dek görülen EN UZUN kartın boyunu
     taban alır: boy yalnız büyüyebilir, ilk turdan sonra hiç oynamaz. Okur
     bir olayı eliyle seçtiği an tur biter (`steady` düşer) ve taban kalkar:
     kendi seçtiği kart içeriği kadar yer tutar.
     Ölçüm DOM'dan, boyamadan önce (`useLayoutEffect`); taban eksenin
     `--detail-floor` değişkenine yazılır (durum değil: fazladan çizim yok)
     ve onu yalnız GENİŞ düzenin kartı okur (FlowAxis.module.css). Dar
     düzende kart satırın altında açılır, satırlar zaten yer değiştirir;
     orada taban kısa olayın altında yüzlerce piksellik boş kutu bırakırdı.
     Kap eni değişince taban sıfırlanır. */
  const axisRef = useRef<HTMLDivElement>(null);
  const floor = useRef({ px: 0, width: 0 });
  useLayoutEffect(() => {
    const axis = axisRef.current;
    if (!axis) return;
    const measure = () => {
      const card = axis.querySelector<HTMLElement>("[data-flow-detail]");
      axis.style.removeProperty("--detail-floor");
      if (!steady || !card) { floor.current.px = 0; return; }
      const width = axis.clientWidth;
      if (floor.current.width !== width) floor.current = { px: 0, width };
      floor.current.px = Math.max(floor.current.px, card.offsetHeight);
      axis.style.setProperty("--detail-floor", `${floor.current.px}px`);
    };
    measure();
    if (!steady) return;
    const onResize = () => { if (axis.clientWidth !== floor.current.width) measure(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [openId, steady, events]);

  const primary = (minutes: number) => clockOf(minutes + offsets.primary);
  const secondary = (minutes: number) => clockOf(minutes + offsets.secondary);
  const pct = (share: number) => `${(share * 100).toFixed(3)}%`;
  const minuteOf = (event: FlowEvent) => (event.timeEt ? minutesOfClock(event.timeEt) : null);
  const layout = layoutFlags(events.map((event) => ({ id: event.id, minutes: minuteOf(event) })), domain, FLAG_SHARE);
  const placedOf = new Map(layout.placed.map((flag) => [flag.id, flag]));
  const rows = layout.rows;
  const density = rows > COMFY_ROWS ? "compact" : "comfy";
  const bands = axisBands(domain);
  const hours = axisHours(domain);
  const elapsed = axisShare(elapsedMinutes, domain);
  const nowAt = nowMinutes !== null && nowMinutes > domain.start && nowMinutes < domain.end ? axisShare(nowMinutes, domain) : null;

  /* Direkler: aynı dakikadaki bayraklar tek direği paylaşır; boyu kümenin
     en üst katına kadar. Ayak noktası kümenin en önemli olayının boyunda. */
  const rank = { high: 3, medium: 2, low: 1 } as const;
  const stems = new Map<number, { at: number; top: number; importance: FlowEvent["importance"]; approx: boolean; past: boolean; open: boolean; done: boolean }>();
  for (const event of events) {
    const flag = placedOf.get(event.id);
    const minutes = minuteOf(event);
    if (!flag || minutes === null) continue;
    const held = stems.get(minutes);
    const done = DONE.has(displayFlowStatus(event, nowMs));
    stems.set(minutes, {
      at: flag.at,
      top: Math.max(held?.top ?? 0, flag.row),
      importance: held && rank[held.importance] >= rank[event.importance] ? held.importance : event.importance,
      approx: (held?.approx ?? true) && !!event.approx,
      past: minutes <= elapsedMinutes,
      open: (held?.open ?? false) || event.id === openId,
      done: (held?.done ?? true) && done,
    });
  }
  /* Yaklaşık saatli olayın penceresi: bandının tamamı (işlem günü değilse iz yok). */
  const windows = [...new Set(events.filter((event) => event.approx && event.timeEt).map((event) => bandOf(minutesOfClock(event.timeEt!), domain)))]
    .map((key) => bands.find((band) => band.key === key))
    .filter((band): band is NonNullable<typeof band> => !!band);

  /* Dar düzenin ara satırları: zil satırları (açılış, kapanış) ve "şimdi"
     olayların arasına SAAT SIRASIYLA girer; aynı dakikada zil olaydan önce
     (kapanış zili, sonra kapanış sonrası bilançosu). "Şimdi" yalnız günü
     gerçekten böldüğünde basılır: önünde geçmiş bir satır yoksa hepsi zaten
     gelecektir. Saati bilinmeyen olaylar sonda, tepside. */
  type Entry = { minutes: number; order: number; node: "open" | "close" | "now" | FlowEvent };
  const timed = events.filter((event) => event.timeEt);
  const entries: Entry[] = timed.map((event) => ({ minutes: minutesOfClock(event.timeEt!), order: 1, node: event }));
  if (domain.trading && timed.length > 0) {
    entries.push({ minutes: domain.open, order: 0, node: "open" }, { minutes: domain.close, order: 0, node: "close" });
  }
  if (nowMinutes !== null && entries.some((entry) => entry.minutes <= nowMinutes)) entries.push({ minutes: nowMinutes, order: 2, node: "now" });
  entries.sort((a, b) => a.minutes - b.minutes || a.order - b.order);
  const sequence: Entry["node"][] = [...entries.map((entry) => entry.node), ...events.filter((event) => !event.timeEt)];

  return (
    <div className={styles.gauge} data-density={density}>
      <div
        ref={axisRef}
        className={styles.axis}
        data-density={density}
        data-draw
        style={{ "--rows": rows, "--flag-w": pct(FLAG_SHARE) } as CSSProperties}
      >
        {/* Çizim katmanı: oluk, bantlar, saat cetveli, direkler, "şimdi".
            Bilgi listede; bu katman ekran okuyucuya kapalı. */}
        <div className={styles.decor} aria-hidden="true">
          {nowAt !== null && (
            <span className={styles.now} style={{ "--now": pct(nowAt) } as CSSProperties} data-beat={Math.floor(nowMs / 60_000) % 2}>
              <b className="numeral">{railLabels.now} {primary(nowMinutes!)}</b>
              <i />
            </span>
          )}
          {windows.map((band) => (
            <i key={`window-${band.key}`} className={styles.window} style={{ left: pct(band.from), width: pct(band.to - band.from) }} />
          ))}
          {[...stems.entries()].map(([minutes, stem]) => (
            <i key={`stem-${minutes}`} className={styles.stem} data-approx={stem.approx || undefined} data-past={stem.past || undefined} data-open={stem.open || undefined} style={{ left: pct(stem.at), "--top": stem.top } as CSSProperties} />
          ))}
          <span className={styles.track}>
            {bands.length > 0 ? bands.map((band) => (
              <span key={band.key} className={styles.band} data-band={band.key} style={{ left: pct(band.from), width: pct(band.to - band.from) }}>
                <i className={`bar-fill ${styles.elapsed}`} style={{ transform: `scaleX(${band.to > band.from ? Math.max(0, Math.min(1, (elapsed - band.from) / (band.to - band.from))).toFixed(4) : 0})` }} />
              </span>
            )) : (
              <span className={styles.band} data-band="closed" style={{ left: 0, width: "100%" }}>
                <i className={`bar-fill ${styles.elapsed}`} style={{ transform: `scaleX(${elapsed.toFixed(4)})` }} />
              </span>
            )}
          </span>
          {domain.trading && (["open", "close"] as const).map((key) => (
            <i key={key} className={styles.bell} style={{ left: pct(axisShare(domain[key], domain)) }} />
          ))}
          {hours.map((hour) => <i key={hour.at} className={styles.hour} data-major={hour.major || undefined} style={{ left: pct(hour.at) }} />)}
          {[...stems.entries()].map(([minutes, stem]) => (
            <i key={`foot-${minutes}`} className={styles.foot} data-imp={stem.importance} data-past={stem.past || undefined} data-done={stem.done || undefined} data-open={stem.open || undefined} style={{ left: pct(stem.at) }} />
          ))}
          <span className={styles.scale}>
            <span className={`numeral ${styles.edge}`} data-at="start">{primary(domain.start)}</span>
            {domain.trading ? <>
              <span className={styles.edge} data-at="open" style={{ left: pct(axisShare(domain.open, domain)) }}><em>{railLabels.openShort} </em><span className="numeral">{primary(domain.open)}</span></span>
              <span className={styles.edge} data-at="close" style={{ left: pct(axisShare(domain.close, domain)) }}><em>{railLabels.closeShort} </em><span className="numeral">{primary(domain.close)}</span></span>
              {bands.map((band) => (
                <span key={band.key} className={styles.bandName} style={{ left: pct((band.from + band.to) / 2) }}>{labels.axis.bands[band.key]}</span>
              ))}
            </> : <span className={styles.bandName} style={{ left: "50%" }}>{labels.axis.closedDay}</span>}
            <span className={`numeral ${styles.edge}`} data-at="end">{primary(domain.end)} {tags.primary}</span>
          </span>
        </div>

        <ol className={styles.events} data-loose={layout.loose.length > 0 || undefined}>
          {sequence.map((event) => {
            if (event === "now") {
              return (
                <li key="now" className={styles.nowRow} aria-hidden="true">
                  <span className={styles.nowText}><b>{railLabels.now}</b><span className="numeral">{primary(nowMinutes!)} {tags.primary}</span></span>
                </li>
              );
            }
            if (event === "open" || event === "close") {
              const at = domain[event];
              return (
                <li key={`bell-${event}`} className={styles.bellRow} data-past={at <= elapsedMinutes || undefined}>
                  <span className={styles.bellText}>
                    <b>{event === "open" ? railLabels.openShort : railLabels.closeShort}</b>
                    <span className="numeral">{primary(at)} {tags.primary}</span>
                    <small className="numeral">{secondary(at)} {tags.secondary}</small>
                  </span>
                </li>
              );
            }
            const flag = placedOf.get(event.id);
            const minutes = minuteOf(event);
            const status = displayFlowStatus(event, nowMs);
            const done = DONE.has(status);
            const open = openId === event.id;
            const past = minutes !== null && minutes <= elapsedMinutes;
            const result = resultOf(event, labels);
            const time = minutes !== null ? `${event.approx ? "~" : ""}${primary(minutes)}` : null;
            const kind = event.detail ?? (event.kind === "earnings" ? labels.earnings : labels.economic);
            const logos = event.kind === "earnings" ? event.members ?? [] : [];
            /* İmdeki logo pencerenin EN BÜYÜK şirketi, boyu piyasa değerinin
               kademesinden (`leadMember`, `capTier`; lib/flow-axis.ts). */
            const face = leadMember(logos);
            return (
              <Fragment key={event.id}>
                {flag === undefined && layout.loose[0] === event.id && (
                  <li className={styles.trayLabel} aria-hidden="true"><span>{labels.timeUnknown}</span></li>
                )}
                <li
                  className={styles.item}
                  data-event-id={event.id}
                  data-open={open || undefined}
                  data-past={past || undefined}
                  data-kind={event.kind}
                  data-status={status}
                  data-lead={leadId === event.id || undefined}
                  data-loose={flag ? undefined : true}
                  data-flip={flag?.flip || undefined}
                  data-approx={event.approx || undefined}
                  data-follow={flag && flag.clusterIndex > 0 ? true : undefined}
                  style={flag ? ({ "--at": pct(flag.at), "--r": flag.row, "--room": pct(flag.room) } as CSSProperties) : undefined}
                >
                  <button
                    type="button"
                    className={styles.flag}
                    onClick={() => onPick(event.id)}
                    aria-expanded={renderDetail ? open : undefined}
                    aria-controls={renderDetail && open && detailId ? detailId(event.id) : undefined}
                    title={event.title}
                  >
                    <span className={styles.marker} data-imp={event.importance} data-logo={face ? true : undefined} data-cap={face ? capTier(face.marketCap) : undefined} aria-hidden="true">
                      {face
                        ? <LogoTile symbol={face.symbol} logoUrl={face.logoUrl} size="sm" className={styles.markerLogo} />
                        : event.kind === "earnings" ? <Buildings size={15} /> : <ChartLineUp size={15} weight={event.importance === "high" ? "bold" : "regular"} />}
                      {logos.length > 1 && <small className="numeral">+{logos.length - 1}</small>}
                      {done && (
                        <i className={styles.badge} data-dir={result.dir}>
                          {result.dir ? <DirIcon dir={result.dir} size={9} /> : <Check size={9} weight="bold" />}
                        </i>
                      )}
                    </span>
                    <span className={styles.when}>
                      {time ? <b className="numeral">{time}</b> : <b className={styles.noTime}>{labels.timeUnknown}</b>}
                      {time && <small>{tags.primary}</small>}
                      {result.value && <span className={`numeral ${styles.figure}`} data-dir={result.dir}>{result.value}</span>}
                    </span>
                    <strong className={styles.title}>{event.title}</strong>
                    {/* Tür, önem ve durum: dar düzende künye satırı, geniş
                        düzende yalnız ekran okuyucuya (imin biçimi söylüyor). */}
                    <span className={styles.kind}>
                      <em>{kind}</em>
                      <span className={styles.imp} data-imp={event.importance}>
                        <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
                        <span className="sr-only">{labels.axis.importance[event.importance]}</span>
                      </span>
                      {status !== "scheduled" && !done
                        ? <span className={styles.state} data-status={status}>{labels[status]}</span>
                        : <span className="sr-only">{labels[status]}</span>}
                    </span>
                    {(result.value || result.pending || result.verdict || result.beats) && (
                      <span className={styles.result}>
                        {result.value && result.valueLabel && <span className={styles.value}><small>{result.valueLabel}</small><b className="numeral">{result.value}</b></span>}
                        {!result.value && result.pending && <span className={styles.value} data-pending><small>{result.pendingLabel}</small><b className="numeral">{result.pending}</b></span>}
                        {result.verdict && result.dir && (
                          <span className={styles.pill} data-dir={result.dir}><DirIcon dir={result.dir} size={12} />{result.verdict}</span>
                        )}
                        {result.beats && <span className={styles.pill}>{result.beats}</span>}
                      </span>
                    )}
                    {pickHint && <span className="sr-only">{pickHint}</span>}
                    {renderDetail && <CaretDown size={15} weight="bold" aria-hidden className={styles.caret} />}
                  </button>
                  {renderDetail && open && (
                    <div id={detailId?.(event.id)} className={styles.detail} data-flow-detail="" data-dir={done ? result.dir ?? "done" : status === "scheduled" ? undefined : "due"}>
                      {/* Kartın başlığı: geniş düzende bayrak başlığı kırpabilir,
                          tam adı burada; iki saat (okurun ve öteki), önem ve
                          durum sözle. Dar düzende ad satırda zaten tam. */}
                      <div className={styles.detailHead}>
                        <strong>{event.title}</strong>
                        <p>
                          <span>{kind}</span>
                          {minutes !== null && <span className="numeral">{time} {tags.primary} · {event.approx ? "~" : ""}{secondary(minutes)} {tags.secondary}</span>}
                          <span className={styles.impTag}>
                            <span className={styles.imp} data-imp={event.importance} aria-hidden="true"><i /><i /><i /></span>
                            {labels.axis.importance[event.importance]}
                          </span>
                          <span className={styles.state} data-status={status}>{labels[status]}</span>
                        </p>
                      </div>
                      {renderDetail(event)}
                    </div>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
