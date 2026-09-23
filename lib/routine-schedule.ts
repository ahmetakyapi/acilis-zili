import { BRIEF_PUBLISH_TR, weekAnchor } from "./data";
import { addEtDays, getMarketStatus, todayEt, type MarketHoliday } from "./market-hours";
import { TR_ZONE, formatInZone, zoneDateKey, zoneWallTime } from "./session-clock";
import { SLOT_RANK, TECHNICAL_SLOTS, currentSlot, slotInstant, type TechnicalSlot } from "./technical";

/**
 * Rutinlerin ve günlük senkronun TAKVİMİ — "şu an ne yazılmış olmalıydı".
 *
 * ÜÇ EKRAN, ÜÇ AYRI TAKVİM VARDI (23 Eylül denetimi). Sistem sayfası ET
 * gününü TR saatiyle karşılaştırıyordu (kaçırılan bülten her gece
 * 00:00–07:00 TR arası yeniden "bekleniyor"du), İçerik ızgarası hafta
 * sonunu muaf sayıyordu (rutin her gün yazıyor, ölçüldü: 03 Ağu–23 Eyl
 * arası 52 günün 52'si hafta sonu dahil dolu), haftalık kontrol yanlış
 * pazartesiyi bekliyordu (kayıt KAPSADIĞI haftaya çapalı, yazıldığı güne
 * değil) ve teknik rutin hiç sorulmuyordu. Beklenti artık tek yerde;
 * `getHealthChecks` (Sistem, Özet) ve `getPublishRhythm` (İçerik) buradan
 * okuyor, testleri `tests/routine-schedule.test.ts`te.
 *
 * DÜZ MODÜL, `"use client"` DEĞİL ve saf: şimdiki an her fonksiyona
 * parametre olarak geliyor, testler saati kendisi veriyor. Saatlerin
 * kaynağı değişmiyor — bülten saatleri `BRIEF_PUBLISH_TR` (lib/data.ts),
 * teknik nöbetler `SLOT_UTC`/`currentSlot` (lib/technical.ts). Burada
 * yalnızca "ne zaman gecikmiş sayılır" kuralı var.
 */

/**
 * Rutine tanınan pay. claude.ai görevi dakikasında başlamıyor ve bir
 * koşum on beş dakika sürebiliyor (teknik 15:45 nöbeti, docs/claude-rutinler.md);
 * payı sıfır tutmak her gün 16:10 ile 16:25 arasında yanlış alarm demekti.
 */
export const ROUTINE_GRACE_MINUTES = 30;

/**
 * Günlük senkron (`/api/cron/daily`) — hafta içi 10:30 UTC.
 *
 * Sunucu crontab'ında `CRON_TZ=UTC` ile `30 10 * * 1-5` (deploy/cron-daily.sh,
 * deploy/bootstrap.sh). UTC'ye çakılı olduğu için TR karşılığı yıl boyu
 * 13:30; ET karşılığı mevsimle kayıyor. Crontab değişirse burası da değişir.
 */
export const DAILY_CRON_UTC = { hour: 10, minute: 30 } as const;

/** Senkrona tanınan pay — uç kendi bütçesini 100 saniyeyle sınırlıyor. */
export const CRON_GRACE_MINUTES = 15;

const MINUTE = 60_000;

/** Beklentinin sonucu: yazılmış, pay içinde bekleniyor, gecikmiş. */
export type RoutineState = "ok" | "waiting" | "late";

/** O anın İstanbul takvim günü, "YYYY-MM-DD". */
export function trDateOf(now: Date): string {
  return zoneDateKey(now, TR_ZONE);
}

/* ---------------------------------------------------------------------------
   Günlük bülten — her gün 16:10 TR
   --------------------------------------------------------------------------- */

/**
 * Şu an VAR OLMASI GEREKEN en yeni günlük bülten.
 *
 * Rutin 16:10 TR'de yazıyor ve kaydın tarihi o anın ET günü
 * (`saveBrief` → `todayEt()`); 16:10 TR yıl boyu 09:10 ya da 08:10 ET,
 * yani TR günüyle AYNI takvim günü. Beklenen gün bu yüzden TR saatinden
 * çıkıyor: 16:10 geçtiyse bugün, geçmediyse dün.
 *
 * ESKİ HATA: karşılaştırma ET günü ile TR saatini karıştırıyordu. 25 Eylül
 * 01:00 TR'de New York hâlâ 24 Eylül'de; "bugün" 24 sayılıp "01:00 < 16:10"
 * diye kaçırılan 24 Eylül bülteni "bekleniyor" okunuyordu — alarm her gece
 * yedi saat (kışın sekiz) susuyordu.
 */
export function expectedDailyBrief(now: Date): string {
  const trDate = trDateOf(now);
  const due = zoneWallTime(trDate, BRIEF_PUBLISH_TR.daily, TR_ZONE);
  return now >= due ? trDate : addEtDays(trDate, -1);
}

/** O günün bülteninin yazılması gereken an — 16:10 TR. */
export function dailyBriefDueAt(day: string): Date {
  return zoneWallTime(day, BRIEF_PUBLISH_TR.daily, TR_ZONE);
}

/**
 * Günlük bültenin durumu.
 *
 * `ok`: beklenen gün (ya da daha yenisi) yazılmış. `waiting`: bugünün
 * 16:10'u geçti ama pay dolmadı, dünkü yerinde. `late`: pay doldu ya da
 * daha eski bir gün eksik.
 */
export function dailyBriefState(
  latest: string | null,
  now: Date,
): { state: RoutineState; expected: string } {
  const expected = expectedDailyBrief(now);
  if (latest && latest >= expected) return { state: "ok", expected };
  const graceEnds = dailyBriefDueAt(expected).getTime() + ROUTINE_GRACE_MINUTES * MINUTE;
  const onlyToday = latest !== null && latest >= addEtDays(expected, -1);
  if (onlyToday && now.getTime() < graceEnds) return { state: "waiting", expected };
  return { state: "late", expected };
}

/* ---------------------------------------------------------------------------
   Haftalık bülten — pazartesi 09:30 TR, BİTEN haftayı anlatır
   --------------------------------------------------------------------------- */

/**
 * Şu an var olması gereken en yeni haftalık kaydın ÇAPASI.
 *
 * Kayıt kapsadığı haftanın pazartesisine çapalı: rutin pazartesi 09:30'da
 * yedi gün önceki tarihle bağlamı çekiyor (docs/claude-rutinler.md § 2,
 * `LAST_WEEK`) ve yazma ucu onu `weekAnchor` ile o haftanın pazartesisine
 * indiriyor. 21 Eylül pazartesi yazılan bülten 14 Eylül çapasını taşıyor.
 *
 * ESKİ HATA: panel bu haftanın pazartesisini (`weekAnchor(bugün)`)
 * bekliyordu, yani iki gün önce yazılmış bülteni "2026-09-21 haftasının
 * kaydı yok" diye gösteriyordu ve satır HİÇBİR ZAMAN sağlıklıya dönemezdi.
 */
export function expectedWeeklyAnchor(now: Date): string {
  const monday = weekAnchor(trDateOf(now));
  const due = zoneWallTime(monday, BRIEF_PUBLISH_TR.weekly, TR_ZONE);
  return addEtDays(monday, now >= due ? -7 : -14);
}

/** Haftalık kaydın YAZILDIĞI pazartesi — çapanın bir hafta sonrası. */
export function weeklyWriteDay(anchor: string): string {
  return addEtDays(anchor, 7);
}

/** Çapası verilen haftalık kaydın yazılması gereken an — ertesi pazartesi 09:30 TR. */
export function weeklyBriefDueAt(anchor: string): Date {
  return zoneWallTime(weeklyWriteDay(anchor), BRIEF_PUBLISH_TR.weekly, TR_ZONE);
}

/** Haftalık bültenin durumu — günlükle aynı üç hâl. */
export function weeklyBriefState(
  latest: string | null,
  now: Date,
): { state: RoutineState; expected: string } {
  const expected = expectedWeeklyAnchor(now);
  if (latest && latest >= expected) return { state: "ok", expected };
  const graceEnds = weeklyBriefDueAt(expected).getTime() + ROUTINE_GRACE_MINUTES * MINUTE;
  const onlyThisWeek = latest !== null && latest >= addEtDays(expected, -7);
  if (onlyThisWeek && now.getTime() < graceEnds) return { state: "waiting", expected };
  return { state: "late", expected };
}

/* ---------------------------------------------------------------------------
   Teknik analiz — işlem günleri 15:45, 19:45, 21:45 TR
   --------------------------------------------------------------------------- */

export type TechnicalDue = { sessionDate: string; slot: TechnicalSlot };

/**
 * Bir işlem gününde hangi nöbetler bekleniyor.
 *
 * KURAL KODUN KENDİSİNDEN: nöbetin anında `currentSlot` o nöbeti veriyor
 * mu. Rutin yazacağı slotu bağlam ucundan aynı fonksiyonla alıyor
 * (`/api/teknik/context`); yarım günde (13:00 ET kapanış) 18:45 UTC'de
 * seans kapanmış oluyor, slot `null` dönüyor ve rutin kapanış öncesi
 * yazmıyor. Burada da beklenmiyor — ikinci bir kural yazılmadı.
 */
export function expectedSlots(
  sessionDate: string,
  holidays: MarketHoliday[],
): TechnicalSlot[] {
  return TECHNICAL_SLOTS.filter((slot) => {
    const at = slotInstant(sessionDate, slot);
    return currentSlot(getMarketStatus(at, holidays)) === slot;
  });
}

/**
 * Şu an yazılmış olması gereken en yeni nöbet — `null` bugün işlem yoksa.
 *
 * Nöbetin anı + pay geçtiyse o nöbet borç; bugünün hiçbiri dolmadıysa
 * önceki işlem gününün son nöbeti. Hafta sonu ve tam tatilde `null`:
 * "Planlı Değil" — cuma nöbetinin eksikliği cuma günü zaten söylendi.
 */
export function technicalDue(now: Date, holidays: MarketHoliday[]): TechnicalDue | null {
  const today = todayEt(now);
  if (!getMarketStatus(now, holidays).tradingToday) return null;
  let day = today;
  for (let i = 0; i < 14; i++) {
    if (getMarketStatus(slotInstant(day, "premarket"), holidays).tradingToday) {
      const due = expectedSlots(day, holidays)
        .filter((slot) => slotInstant(day, slot).getTime() + ROUTINE_GRACE_MINUTES * MINUTE <= now.getTime())
        .at(-1);
      if (due) return { sessionDate: day, slot: due };
    }
    day = addEtDays(day, -1);
  }
  return null;
}

/**
 * Teknik rutinin durumu. `latest` en yeni yayın günü ve o günün slotları.
 *
 * Borçlu nöbetten DAHA YENİ bir yayın da borcu kapatır: öğlen nöbeti
 * yazıldıysa sabahki eksik olsa bile rutin çalışıyor demektir ve sayfa
 * zaten en yeni yayını gösteriyor.
 */
export function technicalState(
  latest: { sessionDate: string; slots: readonly string[] } | null,
  now: Date,
  holidays: MarketHoliday[],
): { state: "ok" | "late" | "notScheduled"; due: TechnicalDue | null } {
  const due = technicalDue(now, holidays);
  if (!due) return { state: "notScheduled", due: null };
  if (!latest) return { state: "late", due };
  if (latest.sessionDate > due.sessionDate) return { state: "ok", due };
  const covered =
    latest.sessionDate === due.sessionDate &&
    latest.slots.some(
      (slot) => slot in SLOT_RANK && SLOT_RANK[slot as TechnicalSlot] >= SLOT_RANK[due.slot],
    );
  return { state: covered ? "ok" : "late", due };
}

/* ---------------------------------------------------------------------------
   Günlük senkron — hafta içi 10:30 UTC
   --------------------------------------------------------------------------- */

export type CronState = "ran" | "waiting" | "missed" | "notScheduled";

/** Verilen UTC gününün koşum anı. */
function cronSlotOn(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date, DAILY_CRON_UTC.hour, DAILY_CRON_UTC.minute));
}

function utcDayOf(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function isWeekdayUtc(day: string): boolean {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

/**
 * Koşumun TR saati — "13:30". Ekrana yazılan saat bu; sabit yazılmıyor,
 * o günün anından türetiliyor.
 */
export function cronDueTr(now: Date): string {
  return formatInZone(cronSlotOn(utcDayOf(now)), TR_ZONE);
}

/**
 * Pay dahil GEÇMİŞ en son koşum anı — sağlık satırları "son koşumdan beri
 * yazıldı mı" sorusunu buna göre soruyor. Hafta sonu cumaya bakar.
 */
export function lastCronDue(now: Date): Date {
  let day = utcDayOf(now);
  for (let i = 0; i < 8; i++) {
    const slot = cronSlotOn(day);
    if (isWeekdayUtc(day) && slot.getTime() + CRON_GRACE_MINUTES * MINUTE <= now.getTime()) {
      return slot;
    }
    day = addEtDays(day, -1);
  }
  return cronSlotOn(day);
}

/**
 * Senkron bugün koştu mu.
 *
 * `lastRun` senkronun YALNIZCA KENDİSİNİN yazdığı damgalardan geliyor
 * (bkz. lib/admin-data.ts → `getCronPulse`). Hafta sonu `notScheduled`.
 * Koşum saatinden önce `waiting` — ama bir önceki iş gününün koşumu da
 * yoksa `missed`: bekleyen bir koşum dünkü eksiği örtmez.
 */
export function cronState(lastRun: Date | null, now: Date): { state: CronState; dueTr: string } {
  const dueTr = cronDueTr(now);
  const day = utcDayOf(now);
  if (!isWeekdayUtc(day)) return { state: "notScheduled", dueTr };
  const slot = cronSlotOn(day);
  if (lastRun && lastRun >= slot) return { state: "ran", dueTr };
  if (now.getTime() < slot.getTime() + CRON_GRACE_MINUTES * MINUTE) {
    const previous = lastCronDue(now);
    return { state: lastRun && lastRun >= previous ? "waiting" : "missed", dueTr };
  }
  return { state: "missed", dueTr };
}
