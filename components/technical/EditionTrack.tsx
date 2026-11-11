import type { Dictionary, Locale } from "@/lib/i18n";
import { todayEt } from "@/lib/market-hours";
import { formatInZone, secondaryZone, zoneTag } from "@/lib/session-clock";
import {
  SLOT_RANK,
  TECHNICAL_SLOTS,
  editionClock,
  isTechnicalSlot,
  slotInstant,
  slotLabel,
  type TechnicalSlot,
} from "@/lib/technical";
import { formatEtDateCompact, formatEtDateLong } from "@/lib/utils";
import { NextEditionIn } from "./NextEditionIn";
import styles from "./EditionTrack.module.css";

type NodeState = "past" | "current" | "next" | "idle";

type TrackNode = {
  key: string;
  slot: TechnicalSlot;
  at: Date;
  state: NodeState;
  /** Düğüm başka bir günde (hafta sonu, tatil sonrası sıradaki yayın). */
  otherDay: string | null;
};

/**
 * GÜNÜN YAYINLARI ŞERİDİ (8 Kasım, sahibinin isteği: "daha görsel, alanı
 * daha iyi kullanacak şekilde").
 *
 * Yerine geçtiği iki künye düz metindi: /teknik-analiz kapağında "Son Yayın ·
 * Kapanış Öncesi · 6 Kasım Cuma · 21:45 TR", "Sıradaki Yayın · …" ve
 * "Her işlem günü 15:45, 19:45 ve 21:45"; detay kapağında aynı iki satır
 * küçük bir tanım tablosuydu ve kalan süre ("1 g 2 sa Sonra") 1440'ta tek
 * başına ikinci satıra düşüyordu. Okuyucu üç saati ve hangisinde olduğunu
 * kafasında kuruyordu. Şimdi tek çizim: yayın gününün üç nöbeti bir ray
 * üstünde, saatleri TR önce (ikincil NY küçük, § Saat), bu yayın işaretli,
 * sıradaki yayın — başka bir güne düşüyorsa kesik çizgiyle ayrılmış
 * dördüncü düğüm olarak — işaretli. Kalan süre düğüme sığmadığı (390'da
 * düğüm ~80 piksel) için başlık satırının sağında, kendi yerinde: hiçbir
 * zaman ayrı satıra sarkmıyor.
 *
 * SAATLER TAKVİMDEN: `slotInstant` (SLOT_ET) o günün tarihiyle; sabit saat
 * yok, yaz saati New York karşılığını kendiliğinden kaydırıyor.
 *
 * DÜRÜSTLÜK: bu yayından önceki düğümler "geçti" diye çiziliyor, "yayımlandı"
 * diye değil — o nöbetlerin kaydını bu bileşen bilmiyor. Bu yayından sonra
 * aynı günde kalan ve sıradaki olmayan nöbet (yarım gün, geciken rutin)
 * içi boş ve soluk: iddia yok.
 */
export function EditionTrack({
  edition,
  next,
  variant,
  locale,
  t,
}: {
  /** Şeridin anlattığı yayın — /teknik-analiz'de en yeni yayın, detayda sayfanın yayını. */
  edition: { sessionDate: string; slot: string };
  next: { at: Date; slot: TechnicalSlot } | null;
  /** `latest`: dizin kapağı ("Son Yayın"); `current`: detay kapağı ("Bu Yayın"). */
  variant: "latest" | "current";
  locale: Locale;
  t: Dictionary;
}) {
  const copy = t.technical.editionTrack;
  const day = edition.sessionDate;
  const currentSlot: TechnicalSlot = isTechnicalSlot(edition.slot) ? edition.slot : "premarket";
  const nextDay = next ? todayEt(next.at) : null;
  const nodes: TrackNode[] = TECHNICAL_SLOTS.map((slot) => {
    const rank = SLOT_RANK[slot] - SLOT_RANK[currentSlot];
    const state: NodeState =
      rank < 0 ? "past" : rank === 0 ? "current" : next && nextDay === day && next.slot === slot ? "next" : "idle";
    return { key: slot, slot, at: slotInstant(day, slot), state, otherDay: null };
  });
  if (next && nextDay !== day) {
    nodes.push({ key: `next-${nextDay}`, slot: next.slot, at: next.at, state: "next", otherDay: nextDay });
  }
  const tag = (node: TrackNode) =>
    node.state === "current" ? (variant === "latest" ? copy.latest : copy.current) : node.state === "next" ? copy.next : null;
  const alt = secondaryZone(locale);
  const altTag = zoneTag(locale).secondary;

  return (
    <div className={styles.track} data-variant={variant}>
      <p className={styles.head}>
        <span className={styles.title}>{copy.label}</span>
        <span className={styles.day}>{formatEtDateLong(day, locale)}</span>
        {next && (
          <span className={styles.countdown}>
            {/* Kalan süre — gerekçe NextEditionIn (hidrasyonda eklenir). */}
            <NextEditionIn atIso={next.at.toISOString()} template={copy.nextIn} units={t.sessionBell.units} />
          </span>
        )}
      </p>
      <ol className={styles.rail} aria-label={copy.label} style={{ "--nodes": nodes.length } as React.CSSProperties}>
        {nodes.map((node, index) => {
          const following = nodes[index + 1];
          /* Bir düğümün sağındaki parça: sonraki düğüm geçmişteyse ya da bu
             yayınsa dolu (yayının ilerleyişi), başka güne geçiyorsa kesik. */
          const segment = !following
            ? undefined
            : following.otherDay
              ? "gap"
              : following.state === "past" || following.state === "current"
                ? "done"
                : "open";
          const label = tag(node);
          return (
            <li key={node.key} className={styles.node} data-state={node.state} data-segment={segment} aria-current={node.state === "current" ? "step" : undefined}>
              <span className={styles.dot} aria-hidden />
              <span className={styles.time}>{editionClock(node.at, locale)}</span>
              <span className={styles.slot}>{slotLabel(node.slot, t)}</span>
              {node.otherDay ? (
                <span className={styles.alt} data-date>{formatEtDateCompact(node.otherDay, locale)}</span>
              ) : (
                <span className={styles.alt}>
                  {formatInZone(node.at, alt)} {altTag}
                </span>
              )}
              {label && <span className={styles.tag}>{label}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
