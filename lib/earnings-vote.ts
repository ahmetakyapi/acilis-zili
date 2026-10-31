import { epsSurprise } from "@/lib/earnings-week";
import { closeMinutesFor, daysBetweenEt, etDateTimeToUtc, type MarketHoliday } from "@/lib/market-hours";
import { clockOf } from "@/lib/session-clock";

/**
 * "Beklentiyi Geçer mi?" oylaması — SAF mantık (kilit anı, sonuç, isabet).
 * Okuma/yazma `lib/earnings-vote-data.ts`, eylem `app/actions/earnings-vote.ts`.
 *
 * NE OYLANIYOR. Bilançosu yaklaşan şirketin açıklayacağı hisse başı kârın
 * (EPS) piyasa beklentisini GEÇİP GEÇMEYECEĞİ — iki seçenek, tek tık. Fiyat
 * yönü, "al/sat" ya da hedef sorulmuyor: soru bilançonun kendisiyle ilgili
 * ve cevabı açıklama gecesi takvim satırına düşen gerçekleşen rakamla
 * kendiliğinden belli oluyor. Yatırım tavsiyesi değil; ekranda da yazılı.
 *
 * KİMLİK ÇEYREK, TARİH DEĞİL. Sağlayıcı rapor tarihini sık revize ediyor
 * (lib/data.ts → `guncelBilanco`: 566 sembol-çeyrek çifti birden çok
 * tarihte duruyordu) ve tarihe bağlanan bir oy, tarih kayınca sahipsiz
 * kalırdı. Anahtar sağlayıcının mali çeyreği ("2026Q3"); çeyreği bilinmeyen
 * satırda tarih ("d2026-11-19") — o satırın gruplanacak başka anahtarı yok.
 *
 * TARİH ANAHTARI KAYABİLİR (24 Ekim düzeltmesi). Çeyreği bilinmeyen satırın
 * tarihi kayınca anahtarı da değişiyor ("d2026-11-19" → "d2026-11-24") ve
 * aynı rapora ikinci bir oy verilebiliyordu; dağılım da iki anahtara
 * bölünüyordu. Kural: tarih anahtarlı bir oy, aynı sembolün
 * ±`VOTE_SAME_REPORT_DAYS` içindeki raporunun oyudur (`sameReportVote`).
 * Okumada dağılım ve okurun oyu bu kuralla birleşiyor (`boardFor`), yazmada
 * okurun eski tarih anahtarlı oyu yeni anahtara TAŞINIYOR (eylem
 * `staleVoteRange` aralığındaki eski satırı siliyor, yenisini yazıyor) —
 * bir okurun bir rapora tek oyu kalıyor.
 */

/**
 * "Aynı rapor" penceresi — elle düzeltme katmanının ölçütüyle aynı sayı
 * (`lib/earnings-overrides.ts` → `SAME_REPORT_DAYS`; o modül veritabanına
 * bağlı olduğu için saf mantık buraya alamıyor). Çeyreklik raporlar ~90
 * gün arayla; 45 gün iki raporu karıştırmaz.
 */
export const VOTE_SAME_REPORT_DAYS = 45;

export const VOTE_CHOICES = ["beat", "miss"] as const;
export type VoteChoice = (typeof VOTE_CHOICES)[number];

export function isVoteChoice(value: unknown): value is VoteChoice {
  return value === "beat" || value === "miss";
}

/** Anahtarın biçimi — eylemin girdi doğrulaması da bunu kullanıyor. */
export const VOTE_PERIOD_PATTERN = /^(\d{4}Q[1-4]|d\d{4}-\d{2}-\d{2})$/;

type PeriodSource = { year: number | null; quarter: number | null; reportDate: string };

export function votePeriodKey(row: PeriodSource): string {
  if (row.year !== null && row.quarter !== null && row.quarter >= 1 && row.quarter <= 4) {
    return `${row.year}Q${row.quarter}`;
  }
  return `d${row.reportDate}`;
}

/** Tarih anahtarının tarihi ("d2026-11-19" → "2026-11-19"); çeyrek anahtarında null. */
export function periodDate(period: string): string | null {
  return /^d(\d{4}-\d{2}-\d{2})$/.exec(period)?.[1] ?? null;
}

/**
 * Bir oy anahtarı, rapor tarihi `reportDate` olan `target` anahtarının
 * oyu mu? Aynı anahtar her zaman; tarih anahtarı pencere içindeyse.
 * İki ÇEYREK anahtarı asla birleşmez — çeyrek tarihten bağımsız kimlik.
 */
export function sameReportVote(period: string, target: string, reportDate: string): boolean {
  if (period === target) return true;
  const date = periodDate(period);
  return date !== null && Math.abs(daysBetweenEt(date, reportDate)) <= VOTE_SAME_REPORT_DAYS;
}

/** Tahta anahtarı — sembol + çeyrek. Sunucu ile istemci aynı dizeyi kurar. */
export function voteBoardKey(symbol: string, period: string): string {
  return `${symbol}:${period}`;
}

/**
 * OYUN KAPANDIĞI AN.
 *
 * Kural: açıklama anına kadar açık. Ama sağlayıcı DAKİKA vermiyor, yalnız
 * pencereyi (bmo/amc/dmh) — ve açıklamadan sonra açık kalan bir oy, sonucu
 * görmüş birinin "tahmini" olurdu. Bu yüzden kilit, açıklamanın OLABİLECEĞİ
 * en erken ana kuruluyor:
 *
 *   amc (kapanış sonrası) — o günün kapanış zili: 16:00 ET, yarım günde
 *       13:00 ET. Kapanış sonrası raporlar zilin ardından geliyor; zilden
 *       önce gelen kapanış sonrası rapor yok. TR karşılığı ABD yaz saatine
 *       göre kayıyor (yazın 23:00, kışın 24:00); hesap `etDateTimeToUtc`ta.
 *   bmo (açılış öncesi) — rapor 06:00 ile 09:00 ET arasında herhangi bir
 *       yerde olabiliyor; tek bir saat seçmek uydurma kesinlik olurdu
 *       (CLAUDE.md "Veri dürüstlüğü" 1). Gün başı: 00:00 ET (TR 07:00/08:00).
 *   dmh (seans içi) ve bilinmeyen — pencere ya belirsiz ya hiç yok; gün başı.
 *
 * Gün başı ET'nin gün başı, çünkü rapor tarihi ET takvimiyle yazılı.
 */
export function voteLockAt(
  reportDate: string,
  hour: string | null,
  holidays: readonly MarketHoliday[],
): Date {
  if (hour === "amc") {
    return etDateTimeToUtc(reportDate, clockOf(closeMinutesFor(reportDate, [...holidays])));
  }
  return etDateTimeToUtc(reportDate, null);
}

/**
 * Gerçekleşen sonuç — sitenin geri kalanıyla AYNI eşik.
 *
 * Haftalık takvimin "Beklentiyi Aştı / Kaçırdı" sütunu `epsSurprise`i
 * kullanıyor (yarım sentin altındaki fark "beklentiye denk"); oylamanın
 * sonucu başka bir eşikle hesaplansaydı aynı bilanço iki ekranda iki farklı
 * sonuç söyleyebilirdi (CLAUDE.md "Veri dürüstlüğü" 3).
 *
 * `inline` (denk) bir kazanan çıkarmıyor: "geçer" diyen de "kaçırır" diyen
 * de haklı sayılmıyor, isabet hesabına girmiyor.
 */
export type VoteOutcome = "beat" | "miss" | "inline";

export function voteOutcome(
  epsActual: number | null | undefined,
  epsEstimate: number | null | undefined,
): VoteOutcome | null {
  return epsSurprise(epsActual, epsEstimate)?.direction ?? null;
}

/**
 * open — oy verilebilir; locked — kapandı, sonuç henüz yok ("sonuç
 * bekleniyor"); resolved — gerçekleşen EPS takvime düştü.
 *
 * Sonuç kilitten ÖNCE gelmişse de (sağlayıcı tarihi geriden yazdıysa)
 * resolved: gerçekleşen rakamı görünür hâle gelmiş bir soruya oy açık
 * kalamaz.
 */
export type VotePhase = "open" | "locked" | "resolved";

export function votePhase(now: Date, lockAt: Date, outcome: VoteOutcome | null): VotePhase {
  if (outcome !== null) return "resolved";
  return now.getTime() < lockAt.getTime() ? "open" : "locked";
}

/**
 * EYLEMİN KİLİT KAPISI — `castEarningsVote` bunu çağırıyor, test de bunu
 * sınıyor (eylemin kendisi oturum ve veritabanı istiyor). Hedef satır
 * sunucuda takvimden okunmuş olmalı; istemcinin gönderdiği anahtar satırın
 * BUGÜNKÜ anahtarıyla aynı değilse (çeyrek değişti, tarih kaydı) oy
 * reddedilir — okur eski bir sayfadan oy veriyor, sayfa tazelenince doğru
 * anahtarla tekrar dener.
 */
export function voteGate(input: {
  row: CalendarLike | null;
  period: string;
  holidays: readonly MarketHoliday[];
  now: Date;
}): "open" | "locked" {
  const { row } = input;
  if (!row || votePeriodKey(row) !== input.period) return "locked";
  const phase = votePhase(
    input.now,
    voteLockAt(row.reportDate, row.hour?.trim() || null, input.holidays),
    voteOutcome(row.epsActual, row.epsEstimate),
  );
  return phase === "open" ? "open" : "locked";
}

/**
 * SÜRÜ ETKİSİ: oy açıkken dağılım yalnız OY VERMİŞ okura gösterilir.
 * Önce kalabalığın ne dediğini gören okur kendi tahminini değil kalabalığı
 * işaretler ve dağılım kendini besleyen bir sayıya döner. Kilitlendikten
 * sonra kimse oyunu değiştiremediği için dağılım herkese açılabilir.
 */
export function showDistribution(phase: VotePhase, mine: VoteChoice | null): boolean {
  return mine !== null || phase !== "open";
}

export type VoteTally = { beat: number; miss: number };

export function tallyTotal(tally: VoteTally): number {
  return tally.beat + tally.miss;
}

/**
 * Yüzdeler TOPLAMI 100 olacak şekilde: biri yuvarlanıyor, öteki kalan.
 * İkisini ayrı yuvarlamak 1/8'de "%13 · %88" verir, toplam 101 — tek bir
 * çubukta iki parçanın toplamı 100'ü aşınca çubuk da taşar.
 */
export function tallyShares(tally: VoteTally): { beat: number; miss: number } | null {
  const total = tallyTotal(tally);
  if (total === 0) return null;
  const beat = Math.round((tally.beat / total) * 100);
  return { beat, miss: 100 - beat };
}

/** Okurun oyu isabetli mi — denk ya da bekleyen sonuçta `null`. */
export function voteHit(choice: VoteChoice, outcome: VoteOutcome | null): boolean | null {
  if (outcome === null || outcome === "inline") return null;
  return choice === outcome;
}

/**
 * İsabet oranı — sonucu belli ve kazananı olan oylar üzerinden.
 *
 * `scored` paydası: beklenen sonuç (pending) ve denk sonuç (inline) payda
 * dışında, ikisi de ayrı sayılıyor ki künye "10 oyun 7'si isabetli" derken
 * kalan üçün nerede olduğu söylenebilsin.
 */
export type VoteAccuracy = { correct: number; scored: number; pending: number; inline: number };

export function voteAccuracy(
  rows: readonly { choice: VoteChoice; outcome: VoteOutcome | null }[],
): VoteAccuracy {
  const out: VoteAccuracy = { correct: 0, scored: 0, pending: 0, inline: 0 };
  for (const row of rows) {
    if (row.outcome === null) out.pending += 1;
    else if (row.outcome === "inline") out.inline += 1;
    else {
      out.scored += 1;
      if (row.choice === row.outcome) out.correct += 1;
    }
  }
  return out;
}

/**
 * Oran ancak bu kadar puanlanmış oyda yüzde olarak yazılır. Tek oyun
 * "%100 isabet"i bir başarı değil bir yazı-tura; sayı (1/1) yine yazılı.
 */
export const ACCURACY_MIN_FOR_PERCENT = 5;

export function accuracyPercent(accuracy: VoteAccuracy): number | null {
  if (accuracy.scored < ACCURACY_MIN_FOR_PERCENT) return null;
  return Math.round((accuracy.correct / accuracy.scored) * 100);
}

/**
 * Bir oyu takvim satırına bağlar: önce aynı çeyrek anahtarı, yoksa oyun
 * verildiği gün bilinen rapor tarihi. Satırlar `guncelBilanco`dan geçmiş
 * olmalı (revize tarihin ölü satırı aynı çeyreğin İKİNCİ satırı olurdu).
 * Aynı anahtarda birden çok satır kalırsa en yeni tarihli kazanır —
 * çeyrek anahtarı tarihten bağımsız, tarih ancak kaymış olabilir.
 */
export type CalendarLike = PeriodSource & {
  symbol: string;
  hour: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
};

export function matchVoteRow<T extends CalendarLike>(
  vote: { symbol: string; period: string; reportDate: string },
  rows: readonly T[],
): T | null {
  const same = rows.filter((row) => row.symbol === vote.symbol);
  const byPeriod = same
    .filter((row) => votePeriodKey(row) === vote.period)
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  if (byPeriod[0]) return byPeriod[0];
  const exact = same.find((row) => row.reportDate === vote.reportDate);
  if (exact) return exact;
  /* Tarih anahtarlı oyun tarihi sonradan kaymışsa: pencere içindeki EN
     YAKIN satır (yoksa oy sonsuza dek "sonuç bekliyor"da kalırdı). */
  const date = periodDate(vote.period);
  if (date === null) return null;
  return (
    same
      .map((row) => ({ row, gap: Math.abs(daysBetweenEt(date, row.reportDate)) }))
      .filter((item) => item.gap <= VOTE_SAME_REPORT_DAYS)
      .sort((a, b) => a.gap - b.gap)[0]?.row ?? null
  );
}

/**
 * Tahtadan bir satırın oyu ve dağılımı — tarih anahtarlı eski oylar
 * birleşerek (gerekçe dosya başında, "TARİH ANAHTARI KAYABİLİR"). Okurun
 * oyu önce satırın kendi anahtarından; yoksa pencere içindeki tarih
 * anahtarından.
 */
export function boardFor(
  board: { mine: Record<string, VoteChoice>; tallies: Record<string, VoteTally> },
  row: { symbol: string; reportDate: string } & PeriodSource,
): { mine: VoteChoice | null; tally: VoteTally | null } {
  const target = votePeriodKey(row);
  const prefix = `${row.symbol}:`;
  let mine: VoteChoice | null = board.mine[voteBoardKey(row.symbol, target)] ?? null;
  const merged = Object.entries(board.tallies).filter(
    ([key]) => key.startsWith(prefix) && sameReportVote(key.slice(prefix.length), target, row.reportDate),
  );
  const tally: VoteTally | null =
    merged.length === 0
      ? null
      : merged.reduce((sum, [, value]) => ({ beat: sum.beat + value.beat, miss: sum.miss + value.miss }), { beat: 0, miss: 0 });
  if (mine === null) {
    for (const [key, value] of Object.entries(board.mine)) {
      if (key.startsWith(prefix) && sameReportVote(key.slice(prefix.length), target, row.reportDate)) {
        mine = value;
        break;
      }
    }
  }
  return { mine, tally };
}

/**
 * Okurun TAŞINACAK eski oyları: aynı sembolde, yazılan anahtardan farklı,
 * tarih anahtarlı ve aynı rapora düşen satırlar. Eylem bunları siler,
 * yeni anahtarla tek satır yazar.
 */
export function staleVotePeriods(
  own: readonly { period: string }[],
  target: string,
  reportDate: string,
): string[] {
  return own
    .map((vote) => vote.period)
    .filter((period) => period !== target && periodDate(period) !== null && sameReportVote(period, target, reportDate));
}

/**
 * Bileşenin gördüğü hâl — sunucuda kurulur, istemciye düz veri gider.
 *
 * DAĞILIM SUNUCUDA SÜZÜLÜYOR: `showDistribution` yanlışsa `tally` hiç
 * gönderilmiyor. İstemcide gizlemek, sayıyı sayfanın kaynağında
 * bırakmak olurdu — sürü etkisine karşı kural kaynakta tutulmalı.
 */
export type VoteView = {
  symbol: string;
  period: string;
  reportDate: string;
  phase: VotePhase;
  /** Kilit anı, ISO — istemci "şu saatte kapanır" yazar. */
  lockAt: string;
  mine: VoteChoice | null;
  tally: VoteTally | null;
  outcome: VoteOutcome | null;
};

export function buildVoteView(input: {
  row: CalendarLike;
  holidays: readonly MarketHoliday[];
  now: Date;
  mine: VoteChoice | null;
  tally: VoteTally | null;
}): VoteView {
  const lockAt = voteLockAt(input.row.reportDate, input.row.hour?.trim() || null, input.holidays);
  const outcome = voteOutcome(input.row.epsActual, input.row.epsEstimate);
  const phase = votePhase(input.now, lockAt, outcome);
  return {
    symbol: input.row.symbol,
    period: votePeriodKey(input.row),
    reportDate: input.row.reportDate,
    phase,
    lockAt: lockAt.toISOString(),
    mine: input.mine,
    tally: showDistribution(phase, input.mine) ? (input.tally ?? { beat: 0, miss: 0 }) : null,
    outcome,
  };
}

/**
 * BEKLENTİ KARNESİ — hissenin son çeyreklerde EPS beklentisini kaç kez
 * geçtiği; oylama panelinde oyun yanında (24 Ekim görsel denetimi: okur
 * oy verirken şirketin geçmişini başka sayfada arıyordu).
 *
 * Kaynak hisse sayfasının Geçmiş Bilançolar tablosuyla aynı uç
 * (sağlayıcının earnings surprises listesi). Yön ise oylamanın SONUCUYLA
 * aynı eşikten (`voteOutcome` → `epsSurprise`): karnede "geçti" denen
 * çeyrek, oylamada da "geçti" sayılırdı. Denk çeyrek paydada, payda değil.
 * Gerçekleşeni ya da beklentisi eksik satır atlanır; `marks` eskiden
 * yeniye (çizgide soldan sağa okunur).
 */
export const BEAT_RECORD_QUARTERS = 4;

type BeatRow = { period: string; epsEstimate: number | null; epsActual: number | null };

/**
 * Karnenin ÇEYREK ÇEYREK hâli (31 Ekim): şirket sayfası karnede dört
 * çeyreği ayrı hücre olarak çiziyor (dönem, gerçekleşen ve beklenti
 * yazılı). Seçim ve sıra `beatRecord`la AYNI — sayım bu diziden çıkıyor,
 * yani hücreler ile "0/4" birbirini tutmak zorunda.
 */
export function beatQuarters<T extends BeatRow>(
  rows: readonly T[],
  limit = BEAT_RECORD_QUARTERS,
): { row: T; outcome: VoteOutcome }[] {
  /* AYNI DÖNEM İKİ KEZ (31 Ekim, /bilancolar/SHAZ): sağlayıcı iki çeyreği
     ikişer satırla döndürdü ve karne iki çeyreği "0/4" diye sayıyordu.
     Dönem başına tek satır, gerçekleşeni olan önce — hisse sayfasının
     tablosuyla aynı kural (`buildPastQuarters`, 25 Ekim). */
  const unique = new Map<string, T>();
  for (const row of rows) {
    const held = unique.get(row.period);
    if (!held || (held.epsActual === null && row.epsActual !== null)) unique.set(row.period, row);
  }
  return [...unique.values()]
    .sort((a, b) => b.period.localeCompare(a.period))
    .map((row) => ({ row, outcome: voteOutcome(row.epsActual, row.epsEstimate) }))
    .filter((item): item is { row: T; outcome: VoteOutcome } => item.outcome !== null)
    .slice(0, limit)
    .reverse();
}

export function beatRecord(
  rows: readonly BeatRow[],
  limit = BEAT_RECORD_QUARTERS,
): { beats: number; total: number; marks: VoteOutcome[] } | null {
  const marks = beatQuarters(rows, limit).map((item) => item.outcome);
  if (marks.length === 0) return null;
  return { beats: marks.filter((mark) => mark === "beat").length, total: marks.length, marks };
}
