"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SpotlightCard } from "@/components/motion/PremiumMotion";
import { DataStamp, type DataStampLabels } from "@/components/ui/primitives";
import { Sparkline } from "@/components/ui/Sparkline";
import type { Locale } from "@/lib/i18n/config";
import type { MarketSession } from "@/lib/market-hours";
import { cn, directionOf, directionText, formatPercent, formatPrice } from "@/lib/utils";
import type { IndexFeed, IndexQuote } from "./index-feed";
import { INDEX_EVENT, type IndexTickerPatch } from "./index-event";
import styles from "./TodayExperience.module.css";

/* SAYI ENDEKSİN SEVİYESİ DEĞİL, FONUN FİYATI — gerekçenin tamamı
   `app/(app)/page.tsx` → IndexStrip başında. Sembol her genişlikte görünür. */
const INDEX_LABEL: Record<string, string> = {
  QQQ: "Nasdaq 100",
  SPY: "S&P 500",
  DIA: "Dow Jones",
  IWM: "Russell 2000",
};

/** Seans içinde kartların tazelenme aralığı. */
const POLL_MS = 60_000;
/** Başarısız turdan sonraki en uzun bekleme. */
const MAX_BACKOFF_MS = 300_000;


type Bars = Record<string, { time: number; value: number }[]>;

export type IndexLiveLabels = {
  noData: string;
  preMarket: string;
  afterHours: string;
  lastClose: string;
  data: DataStampLabels;
};

/**
 * Kahramanın endeks kartları — CANLI YAPRAK.
 *
 * Kartlar sunucuda çiziliyordu ve bir sonraki seans sınırına kadar
 * (`SessionRefresh`) yerinde duruyordu: seans açıkken açık bir sekme altı
 * buçuk saat boyunca yükleme anının fiyatlarını gösteriyor, yanında geri
 * sayım her saniye tikliyor ve gün akışı otuz saniyede bir yokluyordu.
 * Damga dürüsttü ("15:06 Güncellendi") ama canlı bir saatin yanında
 * yaşlanıyordu. Sayfa yanlış yerde canlıydı.
 *
 * İlk çizim sunucunun paketiyle BİREBİR aynı (aynı bileşen, aynı dizeler);
 * seans açıkken ya da uzatılmış seansta, sekme görünürken dakikada bir
 * `/api/endeks` okunuyor (gün akışının geri çekilme deseni). Kapalıyken
 * hiç istek yok. Değişen sayının zemini yön rengiyle bir kez yanıp
 * sönüyor; azaltılmış harekette yalnızca sayı değişiyor (CSS).
 *
 * Alt şerit aynı paketi okuyor: her tazelemede biçimlenmiş dizeler bir
 * pencere olayıyla şeride iletiliyor, iki yüzey aynı anda iki farklı fiyat
 * gösteremiyor.
 */
export function IndexLive({
  symbols,
  initial,
  bars,
  domain,
  openAt,
  session,
  locale,
  labels,
}: {
  symbols: readonly string[];
  initial: Extract<IndexFeed, { ok: true }>;
  bars: Bars;
  domain: [number, number];
  openAt: number;
  session: MarketSession;
  locale: Locale;
  labels: IndexLiveLabels;
}) {
  const [feed, setFeed] = useState(initial);
  /* Her sembolün kaçıncı değişimi — anahtar değişince sayı yeniden
     bağlanıyor ve yanıp sönme bir kez daha oynuyor. */
  const [flash, setFlash] = useState<Record<string, { n: number; tone: "up" | "down" }>>({});
  /* Yoklamayla gelen noktalar: sunucunun barlarından SONRAKİ son işlemler.
     Kıvılcım çizgisi aynı seans ekseninde her tazelemede bir nokta uzuyor;
     sayfa açıldığından beri geçen kısım boş kalmıyor. */
  const [trail, setTrail] = useState<Bars>({});
  const previous = useRef(initial);

  // Sunucu tazelemesi (SessionRefresh) yeni bir ilk paket getirirse o kazanır.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      previous.current = initial;
      setFeed(initial);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initial]);

  useEffect(() => {
    if (session === "closed") return;
    let timer = 0;
    let failures = 0;
    let active = true;
    let controller: AbortController | null = null;
    async function poll() {
      window.clearTimeout(timer);
      if (!active || document.hidden || controller) return;
      controller = new AbortController();
      let delay = POLL_MS;
      try {
        const response = await fetch("/api/endeks", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        const next: IndexFeed = await response.json();
        if (!next.ok || !active) throw new Error("unavailable");
        const changed: Record<string, "up" | "down"> = {};
        for (const symbol of symbols) {
          const before = previous.current.quotes[symbol];
          const after = next.quotes[symbol];
          if (before && after && after.price !== before.price) {
            changed[symbol] = after.price > before.price ? "up" : "down";
          }
        }
        previous.current = next;
        setFeed(next);
        setTrail((current) => {
          const out = { ...current };
          for (const symbol of symbols) {
            const quote = next.quotes[symbol];
            if (!quote?.tradedAt) continue;
            const time = Math.round(Date.parse(quote.tradedAt) / 1000);
            const list = out[symbol] ?? [];
            if (list.length && list[list.length - 1]!.time >= time) continue;
            out[symbol] = [...list, { time, value: quote.price }];
          }
          return out;
        });
        if (Object.keys(changed).length) {
          setFlash((current) => {
            const out = { ...current };
            for (const [symbol, tone] of Object.entries(changed)) {
              out[symbol] = { n: (current[symbol]?.n ?? 0) + 1, tone };
            }
            return out;
          });
        }
        failures = 0;
      } catch {
        if (!active) return;
        // Son onaylı değerler yerinde kalır; damga yaşlarını söylemeye devam eder.
        failures++;
        delay = Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** failures);
      } finally {
        controller = null;
        if (active && !document.hidden) timer = window.setTimeout(poll, delay);
      }
    }
    function onVisibility() {
      window.clearTimeout(timer);
      if (!document.hidden) void poll();
    }
    timer = window.setTimeout(poll, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session, symbols]);

  /* Şeride giden dizeler kartınkiyle aynı biçimleyiciden. */
  useEffect(() => {
    const patch: IndexTickerPatch = {};
    for (const symbol of symbols) {
      const quote = feed.quotes[symbol];
      if (!quote) continue;
      patch[symbol] = {
        value: formatPrice(quote.price, locale),
        change: formatPercent(quote.changePct, locale),
        changePct: quote.changePct,
      };
    }
    window.dispatchEvent(new CustomEvent<IndexTickerPatch>(INDEX_EVENT, { detail: patch }));
  }, [feed, locale, symbols]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Önceki yan kolon ölçümünde 1024'te dört sütunlu düzenin
          kartları 84 piksele düşüyor ve başlıklar "N…", "S&…", "Do…" diye
          kırpılıyordu. Kartlar her genişlikte 2×2 kalıyor. */}
      <div data-motion-stagger className={styles.indexGrid}>
        {symbols.map((symbol) => {
          const quote = feed.quotes[symbol];
          if (!quote) {
            return (
              <div key={symbol} className={styles.indexCard}>
                <p className="text-small font-semibold text-strong">{INDEX_LABEL[symbol] ?? symbol}</p>
                <p className="text-tiny text-muted">{symbol}</p>
                <p className="mt-1 text-small text-muted">{labels.noData}</p>
              </div>
            );
          }
          return (
            <IndexCard
              key={symbol}
              symbol={symbol}
              quote={quote}
              stale={feed.stale}
              bars={[
                ...(bars[symbol] ?? []),
                ...(trail[symbol] ?? []).filter(
                  (point) => point.time > ((bars[symbol] ?? []).at(-1)?.time ?? 0),
                ),
              ]}
              domain={domain}
              openAt={openAt}
              locale={locale}
              labels={labels}
              flash={flash[symbol]}
            />
          );
        })}
      </div>
      <DataStamp
        labels={labels.data}
        source={feed.source}
        at={feed.fetchedAt}
        stale={feed.stale}
        locale={locale}
      />
    </div>
  );
}

function IndexCard({
  symbol,
  quote,
  stale,
  bars,
  domain,
  openAt,
  locale,
  labels,
  flash,
}: {
  symbol: string;
  quote: IndexQuote;
  stale: boolean;
  bars: { time: number; value: number }[];
  domain: [number, number];
  openAt: number;
  locale: Locale;
  labels: IndexLiveLabels;
  flash?: { n: number; tone: "up" | "down" };
}) {
  /* YÜZDE HANGİ SEANSI ANLATIYOR (Veri dürüstlüğü 4). Açılış öncesinde
     "+%0,06" tam bir seansın hareketi gibi okunuyordu; künye onu adıyla
     söylüyor ("Açılış Öncesi"), Günün Hareketleri panelindeki kuralın
     aynısı. Bu seansa ait işlem YOKSA yüzde bir önceki seansı anlatıyor:
     yön rengi düşüyor, künye "Son Kapanış" diyor. */
  const lastClose = quote.basis === "lastClose";
  const tone = directionOf(quote.changePct);
  const note =
    quote.basis === "pre-market"
      ? labels.preMarket
      : quote.basis === "after-hours"
        ? labels.afterHours
        : lastClose
          ? labels.lastClose
          : null;
  /* KIVILCIM ÇİZGİSİ SAYIYLA AYNI SEANSI ANLATMALI — gerekçe
     `app/(app)/page.tsx` → IndexStrip. Çizgi paket önbellekten geldiyse ya
     da bu seansta işlem yoksa hiç çizilmiyor. Çizginin son noktası
     kotasyonun kendisi: barlar da kotasyon da 15 dakika gecikmeli ama
     bar beş dakikalık bir kapanış, kotasyon son işlem. Son nokta fiyat
     olunca çizginin ucu kesik çizginin tam olarak yüzdenin söylediği
     tarafında biter. */
  const tradedSec = quote.tradedAt ? Math.round(Date.parse(quote.tradedAt) / 1000) : null;
  const points =
    tradedSec !== null && (bars.length === 0 || tradedSec > bars[bars.length - 1].time)
      ? [...bars, { time: tradedSec, value: quote.price }]
      : bars;
  const sparkOk = !stale && !lastClose;
  const label = INDEX_LABEL[symbol] ?? symbol;
  return (
    <Link href={`/hisse/${symbol}`} className={styles.indexLink}>
      <SpotlightCard className={styles.indexCard}>
        <div className={styles.indexIdentity}>
          <span className="text-tiny font-semibold text-body">{label}</span>
          <span className="numeral shrink-0 text-tiny text-muted">{symbol}</span>
        </div>
        <div className={styles.indexQuote}>
          <p
            key={flash ? `f${flash.n}` : "f0"}
            data-flash={flash?.tone}
            className={styles.indexValue}
          >
            {formatPrice(quote.price, locale)}
          </p>
          <p
            className={cn(
              "numeral text-tiny font-semibold sm:text-small",
              lastClose ? "text-body" : directionText(tone),
            )}
          >
            {formatPercent(quote.changePct, locale)}
          </p>
          {note && <p className={styles.indexBasis}>{note}</p>}
        </div>
        {sparkOk && points.length > 1 && (
          <Sparkline
            points={points}
            title={`${label} · 1D`}
            tone={tone}
            height={40}
            baseline={quote.prevClose}
            domain={domain}
            split={openAt}
            className={styles.indexSpark}
          />
        )}
      </SpotlightCard>
    </Link>
  );
}
