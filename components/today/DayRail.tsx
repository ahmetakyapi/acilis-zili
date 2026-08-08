"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SESSION_BOUNDS } from "@/lib/market-hours";

/**
 * Gün Şeridi — ürünün imzası.
 *
 * Seans günü tek bir yatay eksendir: 04:00'te başlar, 09:30'da zil çalar,
 * 16:00'da kapanır, 20:00'de biter. Günün ekonomik olayları ve bilanço
 * açıklamaları bu eksene kendi saatlerinde asılır; canlı işaretçi şerit
 * üzerinde gerçek zamanda kayar.
 *
 * İKİ KAT: yapı üstte, içerik altta. AÇILIŞ/KAPANIŞ eksenin ÜSTÜNDE durur
 * (günün iskeleti), olaylar eksenin ALTINDA kart olarak asılır. Eski düzen
 * ikisini de aynı alt banda koyuyordu ve çakışma yönetimi (HANDOFF §5,
 * BOUND_COLLISION_MINUTES) sürekli yama istiyordu; katları ayırmak sorunu
 * kökten kaldırdı.
 *
 * OLAYLAR KART, METİN DEĞİL. Çıplak metin etiketleri boşlukta asılı
 * duruyordu ve bir bilanço grubunun bilanço olduğu okunmuyordu ("COP · PH ·
 * HWM" neyin nesi?). Kartlar yüzey + hairline (gölge yok, globals'taki yüzey
 * felsefesi); bilanço kartı logo kümesi ve BİLANÇO plakası taşır, veri kartı
 * önem derecesini sol kenar şeridiyle söyler. Kart noktasına ince bir
 * çizgiyle bağlanır — hangi etiketin hangi ana ait olduğu tartışmasız.
 *
 * Mobilde tamamen ayrı bir düzen render edilir (dikey timeline), aynı
 * bileşeni responsive yapmaya çalışmak yerine.
 */

export type RailEvent = {
  id: string;
  /** ET "HH:mm" */
  timeEt: string;
  title: string;
  importance: "high" | "medium" | "low";
  /** Ekonomik veri mi, bilanço mu — kart buna göre kurulur. */
  kind?: "event" | "earnings";
  /** Kullanıcının takip listesinde mi? Accent dolu nokta alır. */
  watched?: boolean;
  /**
   * Saat YAKLAŞIK mı — başına "~" konur.
   *
   * Bilanço satırlarında saat gerçek bir açıklama anı değil: sağlayıcı
   * yalnızca "açılış öncesi / kapanış sonrası" diyor, dakika vermiyor. Bu
   * yüzden kayıtlar seans sınırlarının yakınına oturtuluyor. Ekranda kesin
   * saat gibi yazınca okuyucu haklı olarak "gerçekten o dakikada mı?" diye
   * soruyor — cevap hayır, işaret bunu söylüyor.
   */
  approx?: boolean;
  /** Alt satırda görünen sessiz bilgi — "42B · bekl. 65B", "açılış öncesi". */
  detail?: string;
  /** Bilanço kartındaki logo kümesi — başlıktaki sembollerle aynı sırada. */
  logos?: { symbol: string; logoUrl: string | null }[];
};

type DayRailProps = {
  events: RailEvent[];
  /** ET gün içi dakika — sunucudan gelir, istemcide canlı güncellenir. */
  initialNowMinutes: number;
  /** Bugün seans var mı? Kapalı günde işaretçi ve zil vurgusu sönük kalır. */
  tradingDay: boolean;
  /** Yarım günlerde 13:00 (780). */
  closeMinutes: number;
  /**
   * Ekranda yazılan saatlere geçmek için ET dakikasına eklenen farklar.
   *
   * Eksenin KENDİSİ hep ET dakikasıyla konumlanır — seans 09:30'da başlar,
   * olaylar ET saatiyle gelir, canlı işaretçi New York saatini okur. Değişen
   * yalnızca etiketlerdeki rakam: Türkçe okuyan biri "16:30" görür, altında
   * künyesiyle "09:30 NY" durur. İngilizcede sıra tersine döner. Fark ABD yaz
   * saatiyle kaydığı için sabit değil, o günün tarihiyle sunucuda hesaplanıp
   * geliyor (lib/session-clock.ts).
   */
  offsets: { primary: number; secondary: number };
  /** Saatlerin yanına yazılan künye — { primary: "TR", secondary: "NY" }. */
  tags: { primary: string; secondary: string };
  labels: {
    bell: string;
    close: string;
    now: string;
    /** Kalın mavi bandın adı — "Piyasa Saatleri". */
    marketHours: string;
    noEvents: string;
    /** Bilanço kartındaki tür plakası — "bilanço" (CSS büyük harfe çevirir). */
    earnings: string;
  };
};

const RAIL_START = SESSION_BOUNDS.preMarketOpen; // 04:00
const RAIL_END = SESSION_BOUNDS.afterHoursClose; // 20:00
const RAIL_SPAN = RAIL_END - RAIL_START;

/* Dikey katlar, yukarıdan aşağıya:
     6-33    sınır etiketleri (AÇILIŞ / KAPANIŞ)
     46-63   "şimdi" rozeti — eksenin HEMEN ÜSTÜNDE, kendi bandında
     62-68   rozeti eksene bağlayan tırnak
     68-74   eksen
     79-92   eksenin iki ucundaki saatler + bandın adı
     110+    olay kartları

   Rozetin yeri üç kez değişti; üçünün de gerekçesi burada duruyor çünkü
   dördüncü bir deneme yapan biri aynı çıkmazlara girmesin.

   (1) Eksenin hemen üstünde, sınır etiketleriyle AYNI bantta: 42 piksellik
       etiket olay noktalarıyla açılış işaretinin arasına giriyor, ikisine
       de değiyordu.
   (2) Eksenin ALTINDA: sınır etiketleriyle çakışması bitti ama bu sefer
       olay kartlarının üstüne düşüp şeridin alt yarısını kapattı.
   (3) EN ÜSTTE, kendi şeridinde, eksene inen uzun çizgiyle: çizgi sınır
       etiketlerinin (AÇILIŞ · 16:30 TR · 09:30 NY) tam içinden geçiyordu.
       Çizgi kaldırılınca çakışma bitti ama rozet 46 piksel yukarıda,
       hiçbir şeye değmeden HAVADA kaldı — eksenle arasında koca bir sınır
       etiketi var ve ikisinin aynı x'te olduğu gözle kurulmuyordu.

   Şimdiki düzen (4): rozet sınır etiketlerinin ALTINDA, eksenin HEMEN
   ÜSTÜNDE, kendi dar bandında. Bandı kimseyle paylaşmadığı için hiçbir
   metnin içinden geçmiyor; eksene 6 piksellik bir tırnakla DEĞDİĞİ için de
   havada durmuyor. Sınır etiketiyle aynı x'e denk geldiğinde (şu an çoğu
   akşam olduğu gibi: 23:00 hem kapanış hem "şimdi") ikisi çakışmıyor, alt
   alta diziliyor — KAPANIŞ / saatler / ŞİMDİ / eksen. */
const BOUND_TOP = 6;
const NOW_TOP = 46;
const AXIS_TOP = 68;
const AXIS_HEIGHT = 6;
const AXIS_CENTER = AXIS_TOP + AXIS_HEIGHT / 2;
const EDGE_TOP = AXIS_TOP + AXIS_HEIGHT + 5;
const CHIP_TOP = 110;
/** Kartlar metin etiketlerinden geniş; çakışma eşiği de ona göre geniş. */
const COLLISION_MINUTES = 160;
/** Alt bant en fazla üç kademe; daha derini şeridi bir duvara çeviriyor. */
const MAX_ROW = 2;
/**
 * Olay kartlarının SABİT ölçüsü.
 *
 * Kart genişliği metne göre değişiyordu (`w-max`): tek kelimelik bir
 * başlık dar, iki satırlık bir başlık geniş bir kutu üretiyordu ve aynı
 * eksende üç farklı boyda kart yan yana duruyordu. Yükseklik de başlığın
 * bir mi iki satır sürdüğüne göre oynuyordu; alt alta gelen kademelerin
 * tabanı hizalanmıyordu.
 *
 * Sabit ölçüde başlık iki satırda kırpılır (`line-clamp-2` zaten vardı),
 * detay satırı kartın tabanına yaslanır. Şerit artık bir ızgara gibi
 * okunuyor.
 */
const CARD_WIDTH = 208;
const CARD_HEIGHT = 84;
/** Kademeler arası nefes payı — kart yüksekliğinden türer. */
const ROW_OFFSET = CARD_HEIGHT + 14;
/**
 * Şeridin altındaki nefes payı.
 *
 * Eksen ve sınır saatleri, altındaki metne (boş gün cümlesi ya da bir sonraki
 * bölüm) neredeyse yapışıyordu. Pay TEK yerden veriliyor ki kartlı ve kartsız
 * hâl aynı boşlukla bitsin: kart sayısı değiştikçe şeridin yüksekliği
 * değişiyor ama alttaki boşluk sabit kalıyor, sonradan gelen kartlar bu
 * ilişkiyi bozmuyor.
 */
const RAIL_BOTTOM_PAD = 18;

/**
 * `.plate` görünümü, RENGİ SERBEST bırakarak.
 *
 * TUZAK (globals.css §Temel'de anlatılan tuzağın aynısı): `.plate` katmansız
 * bir kural ve `color: var(--text-muted)` taşıyor; Tailwind yardımcıları
 * `@layer utilities` içinde olduğu için `class="plate text-primary"` yazınca
 * RENK UYGULANMIYOR — plate kazanıyor. Şeritteki renkli küçük etiketler bu
 * yüzden gri basılıyordu. Burada plate'in yerine aynı biçim elle yazılıyor,
 * renk çağıran tarafta kalıyor.
 */
const PLATE = "font-bold uppercase leading-none";

function pct(minutes: number): number {
  const clamped = Math.max(RAIL_START, Math.min(RAIL_END, minutes));
  return ((clamped - RAIL_START) / RAIL_SPAN) * 100;
}

function parseTime(timeEt: string): number {
  const [h, m] = timeEt.split(":").map(Number);
  return h * 60 + m;
}

/** Gün taşmasını başa sarar: ABD'nin 20:00'si Türkiye'de ertesi gün 03:00. */
function formatMinutes(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(
    wrapped % 60,
  ).padStart(2, "0")}`;
}

/** ET duvar saatini dakikaya çevirir — istemci tarafı tik. */
function readEtMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/**
 * Kart hizası: ortada noktasına ortalanır, kenara düşerse içeri katlanır —
 * kart şeridin dışına taşamaz, bağ çizgisi yine tam noktada durur.
 */
function chipTransform(p: number): string {
  if (p < 8) return "translateX(-16px)";
  if (p > 92) return "translateX(calc(-100% + 16px))";
  return "translateX(-50%)";
}

export function DayRail({
  events,
  initialNowMinutes,
  tradingDay,
  closeMinutes,
  offsets,
  tags,
  labels,
}: DayRailProps) {
  const [nowMinutes, setNowMinutes] = useState(initialNowMinutes);

  /** ET dakikası → ekranda öne yazılan saat. */
  const shown = (minutes: number, approx = false) =>
    `${approx ? "~" : ""}${formatMinutes(minutes + offsets.primary)}`;
  /** Aynı anın diğer saati — künyesiyle birlikte alt satırda durur. */
  const other = (minutes: number) => formatMinutes(minutes + offsets.secondary);

  // Dakikada bir ET saatini yeniden hesapla — sunucuya gitmeden. İlk eşitleme
  // de zamanlayıcıdan geçer; effect gövdesinde senkron setState zincirleme
  // render'a yol açıyor.
  useEffect(() => {
    const sync = () => setNowMinutes(readEtMinutes());
    const first = window.setTimeout(sync, 0);
    const id = window.setInterval(sync, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const positioned = useMemo(() => {
    const sorted = [...events]
      .map((event) => ({ ...event, minutes: parseTime(event.timeEt) }))
      .sort((a, b) => a.minutes - b.minutes);

    /* Kartlar satır satır yerleştirilir: her kart, komşusuna çarpmadığı EN
       ÜST kademeye oturur. Sınır etiketleri artık eksenin üstünde kendi
       katında yaşadığı için buradaki hesap yalnızca kart-kart çakışması. */
    const occupied: number[][] = [];
    const clashes = (row: number, minutes: number) =>
      (occupied[row] ?? []).some(
        (slot) => Math.abs(slot - minutes) < COLLISION_MINUTES,
      );

    const result: ((typeof sorted)[number] & { row: number })[] = [];
    for (const event of sorted) {
      let row = 0;
      while (row < MAX_ROW && clashes(row, event.minutes)) row++;
      (occupied[row] ??= []).push(event.minutes);
      result.push({ ...event, row });
    }
    return result;
  }, [events]);

  const maxRow = positioned.reduce((max, event) => Math.max(max, event.row), 0);
  const empty = positioned.length === 0;
  const railHeight =
    (empty ? CHIP_TOP + 56 : CHIP_TOP + (maxRow + 1) * ROW_OFFSET) +
    RAIL_BOTTOM_PAD;

  const nowVisible = nowMinutes >= RAIL_START && nowMinutes <= RAIL_END;
  const marketLive =
    tradingDay &&
    nowMinutes >= SESSION_BOUNDS.regularOpen &&
    nowMinutes < closeMinutes;

  const openPct = pct(SESSION_BOUNDS.regularOpen);
  const closePct = pct(closeMinutes);

  return (
    <div className="select-none">
      {/* ================= Masaüstü: yatay eksen ================= */}
      <div
        className="relative hidden sm:block"
        style={{ height: railHeight }}
        aria-hidden
      >
        {/* ---- Kat 1: sınır etiketleri, eksenin üstünde ---- */}
        {[
          {
            key: "open",
            left: openPct,
            label: labels.bell,
            primary: shown(SESSION_BOUNDS.regularOpen),
            secondary: other(SESSION_BOUNDS.regularOpen),
          },
          {
            key: "close",
            left: closePct,
            label: labels.close,
            primary: shown(closeMinutes),
            secondary: other(closeMinutes),
          },
        ].map((bound) => (
          <div
            key={bound.key}
            /* z-10: "şimdi" çizgisi bu etiketlerin ALTINDAN geçsin. */
            className="absolute z-10 -translate-x-1/2 whitespace-nowrap text-center"
            style={{ left: `${bound.left}%`, top: BOUND_TOP }}
          >
            <div
              className={cn(PLATE, "text-[10.5px] tracking-[0.08em] text-body")}
            >
              {bound.label}
            </div>
            <div className="numeral mt-0.5 text-[10.5px] text-muted">
              <span className="font-semibold text-body">{bound.primary}</span>{" "}
              {tags.primary}
              <span aria-hidden className="mx-1">
                ·
              </span>
              <span className="font-semibold text-body">{bound.secondary}</span>{" "}
              {tags.secondary}
            </div>
          </div>
        ))}

        {/* ---- Kat 2: eksen ---- */}
        <div
          className="absolute inset-x-0 rounded-full bg-surface-elevated"
          style={{ top: AXIS_TOP, height: AXIS_HEIGHT }}
        />
        {/* Ana seans bir kademe kalın: günün gövdesi eksenin kendisinde de
            okunsun. */}
        <div
          className={cn(
            "absolute rounded-full",
            tradingDay ? "bg-primary/28" : "bg-bar",
          )}
          style={{
            left: `${openPct}%`,
            width: `${closePct - openPct}%`,
            top: AXIS_TOP - 2,
            height: AXIS_HEIGHT + 4,
          }}
        />
        {/* Sınır işaretleri — etiketlerin eksendeki çapası. */}
        {[openPct, closePct].map((left) => (
          <div
            key={left}
            className={cn(
              "absolute size-3.5 rounded-full border-[3px] bg-page",
              tradingDay ? "border-primary" : "border-flat",
            )}
            style={{
              left: `${left}%`,
              top: AXIS_CENTER - 7,
              transform: "translateX(-7px)",
            }}
          />
        ))}

        {/* ---- Eksenin uçları: şerit nerede başlıyor, nerede bitiyor ----
            Pencerenin kendisi paneli başlığında yazıyordu ve orada bir künye
            gibi kalıyordu; okuyucu "bu çizginin solu hangi saat" diye
            sorduğunda cevap ekranın öbür ucundaydı. Uç saatler artık kendi
            eksenlerinde. Sağdaki künyeyi de taşır: iki uç aynı dilimin iki
            ucu, saat dilimini iki kez yazmaya gerek yok. */}
        <div
          className="numeral absolute left-0 text-[10.5px] text-muted"
          style={{ top: EDGE_TOP }}
        >
          {shown(RAIL_START)}
        </div>
        <div
          className="numeral absolute right-0 text-[10.5px] text-muted"
          style={{ top: EDGE_TOP }}
        >
          {shown(RAIL_END)} {tags.primary}
        </div>

        {/* Bandın ADI, tam ortasında. Uçlardaki saatler bandın nerede
            başlayıp bittiğini söylüyordu ama bandın kendisinin ne olduğunu
            söyleyen bir şey yoktu: kalın mavi kısım "piyasa açıkken" demek,
            geri kalan gri kısım seans öncesi ve sonrası. */}
        <div
          className={cn(
            PLATE,
            "absolute -translate-x-1/2 whitespace-nowrap text-[9.5px] tracking-[0.09em]",
            tradingDay ? "text-primary" : "text-muted",
          )}
          style={{ left: `${(openPct + closePct) / 2}%`, top: EDGE_TOP }}
        >
          {labels.marketHours}
        </div>

        {/* Şu an — canlı işaretçi ve rozeti.
            Rozet eskiden yalnızca `title` özniteliğindeydi: yani ancak fareyi
            üstünde bekletirsen görünüyordu ve dokunmatik ekranda hiç
            görünmüyordu. Çizgi tek başına "bu ne" sorusunu doğuruyordu.

            Rozet DOLU basılıyor, soluk değil: bir kez soluk gri denendi ve
            eksenin arkasında kalmış gibi duruyordu — oysa sayfadaki tek
            canlı işaret bu. Piyasa kapalıyken rengi accent değil koyu
            mürekkep, ama ağırlığı aynı. */}
        {nowVisible && (
          <>
            <div
              className={cn(
                /* Piyasa kapalıyken rozet KOYU MÜREKKEPTİ ve sayfadaki tek
                   siyah yüzey oydu: göz önce oraya gidiyordu, oysa taşıdığı
                   bilgi "şu an" — vurgulu ama alarm değil. İki hâl de artık
                   mavi degrade, fark TONDA: açıkken canlı mavi, kapalıyken
                   daha derin ve sakin bir mavi. */
                "absolute z-20 whitespace-nowrap rounded-full bg-gradient-to-r px-2 py-[3.5px] text-[9.5px] font-bold uppercase leading-none tracking-[0.09em] text-on-primary",
                marketLive
                  ? "from-primary to-primary-soft"
                  : "from-primary-deep to-primary",
              )}
              style={{
                left: `${pct(nowMinutes)}%`,
                top: NOW_TOP,
                /* Kartlarla aynı katlama: gün başında ya da sonunda rozet
                   ortalanınca şeridin dışına sarkıyor. */
                transform: chipTransform(pct(nowMinutes)),
              }}
            >
              {labels.now}
            </div>
            {/* Rozeti eksene BAĞLAYAN tırnak. Kısa ama boşluk bırakmıyor:
                rozetin alt kenarından başlayıp eksenin içine giriyor
                (`AXIS_TOP + 2`), yani ikisi tek parça gibi okunuyor.
                Rozet havada dururken bu bağ yoktu ve aynı x'te olmaları
                gözle kurulmuyordu. */}
            <div
              className={cn(
                "absolute w-[3px] -translate-x-1/2 rounded-full",
                marketLive ? "bg-primary" : "bg-primary-deep",
              )}
              style={{
                left: `${pct(nowMinutes)}%`,
                top: NOW_TOP + 16,
                height: AXIS_TOP + 2 - (NOW_TOP + 16),
              }}
            />
          </>
        )}

        {/* ---- Kat 3: olay kartları, eksenin altında ---- */}
        {positioned.map((event) => {
          const p = pct(event.minutes);
          const left = `${p}%`;
          const high = event.importance === "high";
          const isEarnings = event.kind === "earnings";
          const chipTop = CHIP_TOP + event.row * ROW_OFFSET;
          const logos = (event.logos ?? []).filter((logo) => logo.logoUrl);
          return (
            <div key={event.id}>
              {/* Eksendeki nokta — durum rengiyle. */}
              <div
                className={cn(
                  "absolute rounded-full",
                  high
                    ? "size-3.5 bg-down"
                    : event.watched
                      ? "size-3.5 bg-primary"
                      : "size-3 border-2 border-muted bg-page",
                )}
                style={{
                  left,
                  top: AXIS_CENTER - (high || event.watched ? 7 : 6),
                  transform: `translateX(-${high || event.watched ? 7 : 6}px)`,
                }}
              />
              {/* Bağ çizgisi: kart hangi ana aitse oradan iner. */}
              <span
                className="absolute w-px bg-line-strong"
                style={{ left, top: AXIS_CENTER + 8, height: chipTop - AXIS_CENTER - 10 }}
              />
              {/* Kart — bağ çizgilerinin ÜSTÜNDE durur: komşu kartın çizgisi
                  kartın arkasından geçer, içinden değil. */}
              <div
                className={cn(
                  "absolute z-10 flex flex-col rounded-[12px] border border-line bg-surface-solid px-3 py-2.5 text-center",
                  high && "border-l-[3px] border-l-down",
                  !high && event.watched && "border-l-[3px] border-l-primary",
                )}
                style={{
                  left,
                  top: chipTop,
                  transform: chipTransform(p),
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                }}
              >
                <div
                  className={cn(
                    "numeral flex items-center justify-center gap-1.5 whitespace-nowrap text-[11.5px] font-bold leading-none",
                    high ? "text-down" : "text-strong",
                  )}
                >
                  {shown(event.minutes, event.approx)}
                  {isEarnings && (
                    <span className="text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-primary">
                      {labels.earnings}
                    </span>
                  )}
                </div>

                {isEarnings ? (
                  <div className="mt-1.5 flex items-center justify-center gap-1.5">
                    {logos.length > 0 && (
                      <span className="flex shrink-0 -space-x-1">
                        {logos.slice(0, 3).map((logo) => (
                          <Image
                            key={logo.symbol}
                            src={logo.logoUrl as string}
                            alt=""
                            width={18}
                            height={18}
                            className="size-[18px] rounded-full border border-line bg-white object-contain"
                          />
                        ))}
                      </span>
                    )}
                    <span className="numeral min-w-0 truncate text-[12px] font-bold text-strong">
                      {event.title}
                    </span>
                  </div>
                ) : (
                  <div className="mx-auto mt-1.5 line-clamp-2 max-w-full text-[12px] font-semibold leading-[16px] text-strong">
                    {event.title}
                  </div>
                )}

                {event.detail && (
                  <div className="mx-auto mt-auto max-w-full truncate pt-1 text-[11px] leading-none text-muted">
                    {event.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {empty && (
          <p
            className="absolute inset-x-0 text-center text-xs text-muted"
            style={{ top: CHIP_TOP + 16 }}
          >
            {labels.noEvents}
          </p>
        )}
      </div>

      {/* ================= Mobil: dikey timeline ================= */}
      <ul className="sm:hidden">
        {[
          ...positioned,
          ...(nowVisible
            ? [
                {
                  id: "__now",
                  minutes: nowMinutes,
                  timeEt: formatMinutes(nowMinutes),
                  title: labels.now,
                  importance: "low" as const,
                  row: 0,
                  kind: "now" as const,
                  detail: undefined,
                  watched: false,
                  approx: false,
                  logos: undefined,
                },
              ]
            : []),
          {
            id: "__open",
            minutes: SESSION_BOUNDS.regularOpen,
            timeEt: formatMinutes(SESSION_BOUNDS.regularOpen),
            title: labels.bell,
            importance: "low" as const,
            row: 0,
            kind: "bound" as const,
            // Soldaki sütun okuyucunun saatini yazıyor; diğeri alt satırda.
            detail: `${other(SESSION_BOUNDS.regularOpen)} ${tags.secondary}` as
              | string
              | undefined,
            watched: false,
            approx: false,
            logos: undefined,
          },
          {
            id: "__close",
            minutes: closeMinutes,
            timeEt: formatMinutes(closeMinutes),
            title: labels.close,
            importance: "low" as const,
            row: 0,
            kind: "bound" as const,
            detail: `${other(closeMinutes)} ${tags.secondary}` as
              | string
              | undefined,
            watched: false,
            approx: false,
            logos: undefined,
          },
        ]
          .sort((a, b) => a.minutes - b.minutes)
          .map((entry, index, list) => {
            const isNow = entry.kind === "now";
            const isBound = entry.kind === "bound";
            const high = entry.importance === "high";
            const last = index === list.length - 1;
            const logos = (entry.logos ?? []).filter((logo) => logo.logoUrl);
            return (
              <li key={entry.id} className="flex gap-0">
                <div
                  className={cn(
                    "numeral w-12 shrink-0 pt-px text-[12.5px]",
                    isNow
                      ? "font-bold text-primary"
                      : high
                        ? "font-bold text-down"
                        : isBound
                          ? "font-bold text-strong"
                          : "font-semibold text-body",
                  )}
                >
                  {shown(entry.minutes, entry.approx)}
                </div>
                <div className="relative w-5 shrink-0">
                  {isNow ? (
                    <span className="absolute inset-x-0 top-2 h-0.5 bg-primary" />
                  ) : (
                    <span
                      className={cn(
                        "absolute rounded-full",
                        high || entry.watched
                          ? "left-px top-1 size-3"
                          : "left-0.5 top-[5px] size-[9px]",
                        high
                          ? "bg-down"
                          : entry.watched
                            ? "bg-primary"
                            : isBound
                              ? "bg-strong"
                              : "border-2 border-muted bg-page",
                      )}
                    />
                  )}
                  {!last && (
                    <span className="absolute bottom-[-6px] left-1.5 top-4 w-px bg-line-strong" />
                  )}
                </div>
                <div className={cn("min-w-0", !last && "pb-3.5")}>
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-[13.5px]",
                      isNow
                        ? `${PLATE} text-[10.5px] tracking-[0.1em] text-primary`
                        : high
                          ? "font-bold text-strong"
                          : isBound
                            ? "font-bold tracking-[0.03em] text-strong"
                            : "font-medium text-strong",
                    )}
                  >
                    {logos.length > 0 && (
                      <span className="flex shrink-0 -space-x-1">
                        {logos.slice(0, 3).map((logo) => (
                          <Image
                            key={logo.symbol}
                            src={logo.logoUrl as string}
                            alt=""
                            width={16}
                            height={16}
                            className="size-4 rounded-full border border-line bg-white object-contain"
                          />
                        ))}
                      </span>
                    )}
                    <span className="min-w-0 truncate">{entry.title}</span>
                  </div>
                  {entry.detail && (
                    <div className="text-[11.5px] text-muted">{entry.detail}</div>
                  )}
                </div>
              </li>
            );
          })}
      </ul>

      {/* Not, çizelgenin ALTINDA durur: üstte olsaydı hemen ardından gelen
          açılış/kapanış satırlarını yalanlıyor gibi okunuyordu. */}
      {positioned.length === 0 && (
        <p className="mt-1 text-xs text-muted sm:hidden">{labels.noEvents}</p>
      )}
    </div>
  );
}
