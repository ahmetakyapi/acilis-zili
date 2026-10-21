import { NextResponse } from "next/server";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { percentAlerts, priceAlerts, symbols as symbolsTable } from "@/lib/schema";
import { getStatus } from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import type { Quote } from "@/lib/providers/types";
import { isDirection, sessionReadings } from "@/lib/price-alerts";
import { isPercentDirection } from "@/lib/percent-alerts";
import {
  alertPayload,
  findHits,
  findPercentHits,
  percentPayload,
  type PendingAlert,
  type PendingPercentAlert,
} from "@/lib/alert-sweep";
import { getDictionary } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { notifyUser } from "@/lib/notifications";

/**
 * Alarm taraması — `deploy/cron-alerts.sh` seans boyunca beş dakikada bir
 * çağırır. Gerekçe `lib/alert-sweep.ts`. İki tür tek turda: fiyat hedefi
 * (price_alerts) ve günlük yüzde değişim (percent_alerts, 15 Ekim) — ikisi
 * de AYNI kotasyon paketini okur, yoksa aynı sembolün iki farklı fiyatı
 * iki ayrı alarmı değerlendirirdi (CLAUDE.md → aynı sayı aynı kaynaktan).
 *
 * Üç kapı, üçü de veri dürüstlüğünden:
 * - Piyasa KAPALIYKEN hiçbir şey yapılmıyor: fiyat değişmiyor, yeni bir
 *   tetik olamaz; kapanış fiyatıyla tetiklenecek olan zaten son açık
 *   pencerede tetiklendi.
 * - Paket BAYATSA (sağlayıcı düştü, Neon önbelleğindeki önceki seans)
 *   hiçbir şey yazılmıyor — yazma katmanı bayat kotasyon kullanmaz
 *   (CLAUDE.md "Veri dürüstlüğü" 4). Bayat fiyatla tetiklenen alarm,
 *   okuyucunun telefonuna yanlış bir haber gönderirdi.
 * - Tetik yazması `triggeredAt IS NULL` koşullu ve `returning`li: üst üste
 *   binen iki koşumdan işaretlenen alarm için ikinci bildirim gitmiyor.
 *   Yüzde alarmında `changePct` null olan sembol atlanıyor (null "sıfır"
 *   değil "önceki kapanış bilinmiyor").
 *
 * 16 Ekim'de üç kapı daha:
 * - SEMBOL kendi seansını kanıtlar (`sessionReadings`): paket güncel olsa da
 *   henüz işlem görmemiş hissenin kotasyonu dünün yüzdesini taşıyordu ve
 *   yüzde alarmı sabah dünkü hareketle tetikleniyordu.
 * - Bilinen ve bilinmeyen semboller AYRI paketlerde: uydurma sembolleri
 *   ayıklama bütçesi (8 deneme) tükenince paket düşüyor, herkesin alarmı
 *   atlanıyordu. Bilinmeyen grup düşerse yalnız kendisi düşer.
 * - Yüzde alarmı `createdAt <= şimdi` olunca bakılır: aynı seansta yeniden
 *   kurulan alarm ertesi seansa ertelenir (app/actions/alerts.ts →
 *   rearmPercentAlert), aynı hareket için ikinci bildirim gitmez.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tetik kuyruğunun eşzamanlı işçisi ve yeni tetik sahiplenme tavanı —
 * gerekçe GET içinde. 55 sn: tavanda başlamış en uzun tetik (push 10 +
 * posta 10 + 2 + 10 ≈ 32 sn) de biterse yanıt betiğin 90 sn'sine yetişir.
 */
const SWEEP_WORKERS = 6;
const SWEEP_BUDGET_MS = 55_000;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const status = await getStatus();
  if (status.session === "closed") return NextResponse.json({ skipped: "closed" });
  const now = new Date();

  let pending: PendingAlert[];
  try {
    const rows = await db
      .select({
        id: priceAlerts.id,
        userId: priceAlerts.userId,
        symbol: priceAlerts.symbol,
        direction: priceAlerts.direction,
        target: priceAlerts.target,
      })
      .from(priceAlerts)
      .where(isNull(priceAlerts.triggeredAt));
    pending = rows.flatMap((row) =>
      isDirection(row.direction) && Number.isFinite(Number(row.target))
        ? [{ ...row, direction: row.direction, target: Number(row.target) }]
        : [],
    );
  } catch (error) {
    /* Veritabanı düştü (tablo 0026'dan beri var). 200 dönerken bu koşum
       "tetik yok" ile ayırt edilemiyordu ve günlüğe hiçbir şey düşmüyordu;
       503 ile cron-alerts.sh hata yolundan yazar (16 Ekim). */
    console.error("[alarm] bekleyen alarmlar okunamadı", error);
    return NextResponse.json({ error: "db" }, { status: 503 });
  }

  /* Yüzde alarmları AYRI try/catch: tablo (migration 0033) fiyat
     alarmlarından sonra geldi ve yokluğu fiyat taramasını durdurmamalı. */
  let pendingPct: PendingPercentAlert[] = [];
  try {
    const rows = await db
      .select({
        id: percentAlerts.id,
        userId: percentAlerts.userId,
        symbol: percentAlerts.symbol,
        direction: percentAlerts.direction,
        thresholdPct: percentAlerts.thresholdPct,
      })
      .from(percentAlerts)
      .where(and(isNull(percentAlerts.triggeredAt), lte(percentAlerts.createdAt, now)));
    pendingPct = rows.flatMap((row) =>
      isPercentDirection(row.direction) && Number.isFinite(Number(row.thresholdPct))
        ? [{ ...row, direction: row.direction, thresholdPct: Number(row.thresholdPct) }]
        : [],
    );
  } catch (error) {
    console.error("[alarm] yüzde alarmları okunamadı", error);
    pendingPct = [];
  }

  if (pending.length === 0 && pendingPct.length === 0) return NextResponse.json({ pending: 0 });

  const symbols = [
    ...new Set([...pending.map((alert) => alert.symbol), ...pendingPct.map((alert) => alert.symbol)]),
  ];
  /* Bilinen semboller (evren tablosu) ve bilinmeyenler AYRI paketlerde —
     gerekçe başlıkta. Bir sembol iki türün alarmında da olsa TEK pakette:
     aynı sayı aynı kaynaktan. Sorgu düşerse hepsi tek grupta (eski hâl). */
  let known = new Set<string>();
  try {
    const rows = await db
      .select({ symbol: symbolsTable.symbol })
      .from(symbolsTable)
      .where(inArray(symbolsTable.symbol, symbols));
    known = new Set(rows.map((row) => row.symbol));
  } catch {
    /* evren tablosu okunamadı — tek grup */
  }
  const groups = [symbols.filter((s) => known.has(s)), symbols.filter((s) => !known.has(s))].filter(
    (group) => group.length > 0,
  );
  const data: Record<string, Quote | undefined> = {};
  let usable = 0;
  for (const group of groups) {
    const pack = await getQuotes(group, status);
    if (!pack.ok || pack.stale) continue;
    usable += 1;
    Object.assign(data, pack.data);
  }
  if (usable === 0) {
    return NextResponse.json({ pending: pending.length + pendingPct.length, skipped: "stale" });
  }

  /* Paket güncel olsa da her sembol KENDİ seansını kanıtlar — gerekçe
     lib/price-alerts.ts → sessionReadings. */
  const { prices, changes } = sessionReadings(data, status);
  const hits = findHits(pending, prices);
  const pctHits = findPercentHits(pendingPct, changes);

  /* HESAP BAŞINA KUYRUK, ALTI İŞÇİ (20 Ekim). Tetikler tek tek, sırayla
     işleniyordu: her biri sahiplenme + gelen kutusu + push (cihaz başına 10
     sn tavan) + alarm postası (10 sn; düşerse 2 sn ara ve bir tekrar). Sert
     bir düşüşte çok sayıda tetik dakikalar sürebiliyor, sondaki okuyucu geç
     haber alıyordu; asılı kalan bir push ucu kaydeden tek hesap (uç adres
     okuyucudan geliyor) her tetiğinde 10 saniye yakıp ARKASINDAKİ herkesi
     bekletiyordu. Şimdi tetikler hesaba göre gruplanır, altı işçi hesap
     kuyruğunu boşaltır: bir hesabın tetikleri kendi içinde sırayla (alarm
     postasının kullanıcı tavanı say-sonra-yaz, yarışmasın), yavaş hesap
     yalnız kendi işçisini tutar. Neon HTTP sürücüsü durumsuz; altı
     eşzamanlı sorgu güvenli. Günlük posta bütçesi de say-sonra-yaz: aynı
     anda sahiplenen işçiler onu en çok beş posta aşabilir — kabul edildi
     (bütçenin servis kotasına karşı payı lib/email-notify.ts → dailyBudget).

     SÜRE TAVANI (`SWEEP_BUDGET_MS`): `maxDuration` VPS'te uygulanmıyor,
     betik 90 sn'de bırakıyor, sonraki tarama beş dakika sonra. Tavandan
     sonra YENİ tetik sahiplenilmez: alarm `triggeredAt IS NULL` kalır ve
     sonraki tarama onu taze fiyatla yeniden değerlendirir. Bedeli bilerek
     kabul edildi: o arada geri dönen kısa bir kesişim kaçabilir — aksi
     hâlde koşular üst üste biniyordu. Sahiplenilmiş tetiğin bildirimi her
     zaman tamamlanır; ertelenen sayı yanıtta `deferred`. */
  let triggered = 0;
  let delivered = 0;
  let deferred = 0;
  const byUser = new Map<string, (() => Promise<void>)[]>();
  const enqueue = (userId: string, job: () => Promise<void>) => {
    const jobs = byUser.get(userId);
    if (jobs) jobs.push(job);
    else byUser.set(userId, [job]);
  };
  for (const hit of hits) enqueue(hit.userId, async () => {
    const claimed = await db
      .update(priceAlerts)
      .set({ triggeredAt: now, triggeredPrice: String(hit.price) })
      .where(and(eq(priceAlerts.id, hit.id), isNull(priceAlerts.triggeredAt)))
      .returning({ id: priceAlerts.id })
      .catch((error) => {
        console.error("[alarm] tetik yazılamadı", error);
        return [];
      });
    if (claimed.length === 0) return;
    triggered += 1;
    /* Gelen kutusu + push tek girişten (lib/notifications.ts): bildirimi
       açmamış okuyucu da tetiği başlıktaki zilde görür. Tek hesabın hatası
       taramayı durdurmaz (`.catch`, 20 Ekim): bozuk push anahtarlı bir satır
       fırlatıp sonraki bütün tetikleri ve yüzde döngüsünü atlatıyordu —
       gerekçe lib/push.ts → deliverPush. Önce bekle, SONRA topla (20 Ekim):
       `delivered += await …` sol yanı bekleme ÖNCESİ okur; altı işçi
       eşzamanlıyken üst üste binen iki tetikten biri sayaçtan düşüyordu. */
    const sent = await notifyUser(
      hit.userId,
      "alert",
      (locale) => {
        const p = alertPayload(hit, locale, getDictionary(locale).notifications);
        return { title: p.title, body: p.body, path: `/hisse/${hit.symbol}`, tag: p.tag };
      },
      withLocale,
      { alertId: hit.id, kind: "price", symbol: hit.symbol, direction: hit.direction, target: hit.target, price: hit.price, firedAt: now },
    ).catch(() => 0);
    delivered += sent;
  });
  for (const hit of pctHits) enqueue(hit.userId, async () => {
    const claimed = await db
      .update(percentAlerts)
      .set({ triggeredAt: now, triggeredPct: String(hit.changePct) })
      .where(and(eq(percentAlerts.id, hit.id), isNull(percentAlerts.triggeredAt)))
      .returning({ id: percentAlerts.id })
      .catch((error) => {
        console.error("[alarm] tetik yazılamadı", error);
        return [];
      });
    if (claimed.length === 0) return;
    triggered += 1;
    /* Önce bekle, sonra topla — gerekçe fiyat tetiğinde. */
    const sent = await notifyUser(
      hit.userId,
      "percent",
      (locale) => {
        const p = percentPayload(hit, locale, getDictionary(locale).notifications);
        return { title: p.title, body: p.body, path: `/hisse/${hit.symbol}`, tag: p.tag };
      },
      withLocale,
      { alertId: hit.id, kind: "percent", symbol: hit.symbol, direction: hit.direction, thresholdPct: hit.thresholdPct, changePct: hit.changePct, firedAt: now },
    ).catch(() => 0);
    delivered += sent;
  });

  const accounts = [...byUser.values()];
  await Promise.all(
    Array.from({ length: SWEEP_WORKERS }, async () => {
      for (let jobs = accounts.shift(); jobs; jobs = accounts.shift()) {
        for (const job of jobs) {
          if (Date.now() - now.getTime() > SWEEP_BUDGET_MS) {
            deferred += 1;
            continue;
          }
          await job().catch((error) => console.error("[alarm] tetik işlenemedi", error));
        }
      }
    }),
  );

  return NextResponse.json({
    pending: pending.length,
    pendingPercent: pendingPct.length,
    symbols: symbols.length,
    triggered,
    delivered,
    deferred,
  });
}
