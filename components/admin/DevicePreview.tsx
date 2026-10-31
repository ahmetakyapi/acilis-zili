"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowClockwise, ArrowSquareOut, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/primitives";
import { LoadingMark } from "@/components/ui/LoadingState";
import { PREVIEW_DEVICES } from "@/lib/preview";
import styles from "./DevicePreview.module.css";

/**
 * Cihaz önizlemesi — telefon ve masaüstü yan yana (31 Ekim).
 *
 * Çerçeve sayfayı cihazın GERÇEK ölçüsünde (390 × 844, 1440 × 900) çiziyor
 * ve CSS `transform: scale` ile küçültüyor; sayfanın medya sorguları gerçek
 * cihazdaki gibi çalışıyor. Hangi sayfanın, hangi tema ve dilde açılacağı
 * ADRESTE (sunucu sayfası `src`i kuruyor): geri tuşu ve paylaşılan bağlantı
 * aynı önizlemeyi açıyor.
 *
 * İKİ CİHAZ AYNI HATTA BİTER. Geniş ekranda telefonun ölçeği, iki çerçevenin
 * toplam boyu eşit olacak biçimde sahnenin genişliğinden hesaplanıyor
 * (`fitSide`): ölçek sabit olsaydı telefon masaüstünün altında 120–200
 * piksel kısa ya da uzun kalırdı ("yan yana ölçüler aynı hatta biter",
 * CLAUDE.md "Ekran Düzeni"). Dar ekranda cihazlar alt alta ve her biri
 * sahnenin genişliğine sığdırılıyor.
 *
 * ÇERÇEVE `sandbox`LI: betik ve aynı köken açık (sayfa ancak böyle çalışır),
 * FORM ve ÜST PENCEREYİ YÖNLENDİRME kapalı — önizlemede bir buton yanlışlıkla
 * bir yazma eylemi tetiklemesin ya da yönetimden çıkarmasın. Güvenlik kararı
 * `lib/preview.ts` başında.
 */

/** Çerçeve payları — DevicePreview.module.css ile aynı ölçüler. */
const PHONE_PAD_X = 20; // 9 + 9 dolgu + 2 kenar
const PHONE_PAD_Y = 54; // 30 + 22 dolgu + 2 kenar
const BROWSER_PAD_Y = 43; // 40 çubuk + 1 çizgi + 2 kenar
const BROWSER_PAD_Y_PHONE = 33; // dar ekranda çubuk 30
const BROWSER_BORDER = 2;
const GAP = 24;
/** Bu iç genişliğin altında cihazlar alt alta. */
const SIDE_MIN = 860;
const PHONE_SCALE = { min: 0.4, max: 0.86 } as const;
const NARROW_MEDIA = 640;

type Fit = {
  layout: "side" | "stack";
  phone: number;
  desktop: number;
};

const { phone: PHONE, desktop: DESKTOP } = PREVIEW_DEVICES;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Yan yana: telefonun toplam boyu masaüstününkine eşit.
 *   PHONE.h·s + PAD_Y = BAR + (DESKTOP.h / DESKTOP.w) · (W − GAP − PHONE.w·s − PAD_X − kenar)
 * denkleminin `s` için çözümü; masaüstü ölçeği kalan genişlikten.
 */
function fit(width: number, narrow: boolean): Fit {
  const ratio = DESKTOP.height / DESKTOP.width;
  const bar = narrow ? BROWSER_PAD_Y_PHONE : BROWSER_PAD_Y;
  if (width >= SIDE_MIN) {
    const s = clamp(
      (bar - PHONE_PAD_Y + ratio * (width - GAP - PHONE_PAD_X - BROWSER_BORDER)) /
        (PHONE.height + ratio * PHONE.width),
      PHONE_SCALE.min,
      PHONE_SCALE.max,
    );
    const desktopWidth = width - GAP - (PHONE.width * s + PHONE_PAD_X) - BROWSER_BORDER;
    return { layout: "side", phone: s, desktop: desktopWidth / DESKTOP.width };
  }
  return {
    layout: "stack",
    phone: clamp((width - PHONE_PAD_X) / PHONE.width, PHONE_SCALE.min, PHONE_SCALE.max),
    desktop: (width - BROWSER_BORDER) / DESKTOP.width,
  };
}

const percent = (s: number) => `%${Math.round(s * 100)}`;
const seconds = (ms: number) =>
  `${(ms / 1000).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Saniyede Açıldı`;

type DeviceKey = "phone" | "desktop";

export function DevicePreview({
  src,
  display,
  title,
  host,
}: {
  /** Çerçevenin adresi — `previewSrc` ile kurulmuş. */
  src: string;
  /** Adres çubuğunda görünen yol (önizleme parametreleri olmadan). */
  display: string;
  /** Çerçevelerin erişilebilir adı. */
  title: string;
  /** Adres çubuğundaki alan adı — `SITE_URL`den (lib/site.ts). */
  host: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [sizing, setSizing] = useState<Fit | null>(null);
  const [round, setRound] = useState(0);
  const started = useRef(0);
  /* Süreler TURUN anahtarıyla saklanıyor: adres ya da yenileme değişince
     eski turun süresi kendiliğinden geçersiz (etkide sıfırlamaya gerek yok). */
  const roundKey = `${src}#${round}`;
  const [measured, setMeasured] = useState<{ key: string } & Record<DeviceKey, number | null>>({
    key: "",
    phone: null,
    desktop: null,
  });
  const timing = measured.key === roundKey ? measured : { phone: null, desktop: null };

  /* Yeni tur: sayaç başlar. */
  useEffect(() => {
    started.current = performance.now();
  }, [roundKey]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const inner =
        el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setSizing(fit(inner, window.innerWidth < NARROW_MEDIA));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const loaded = useCallback(
    (device: DeviceKey) => () => {
      const ms = performance.now() - started.current;
      setMeasured((prev) => {
        const base = prev.key === roundKey ? prev : { key: roundKey, phone: null, desktop: null };
        return base[device] === null ? { ...base, [device]: ms } : base;
      });
    },
    [roundKey],
  );

  const frame = (device: DeviceKey, scale: number) => {
    const size = PREVIEW_DEVICES[device];
    return (
      <div className={styles.screen}>
        <iframe
          key={roundKey}
          src={src}
          title={`${title} · ${device === "phone" ? "Telefon" : "Masaüstü"}`}
          className={styles.frame}
          data-loaded={timing[device] !== null ? "" : undefined}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          onLoad={loaded(device)}
          style={{ "--w": size.width, "--h": size.height, "--s": scale } as React.CSSProperties}
        />
        {timing[device] === null && (
          <div className={styles.loading}>
            <LoadingMark compact label={device === "phone" ? "Telefon Açılıyor" : "Masaüstü Açılıyor"} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Araç satırı: ne açık, yenile, yeni sekme. Tema ve dil seçimi
          adreste, sunucu sayfasının seçim şeridinde. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 basis-full truncate text-small text-muted sm:flex-1 sm:basis-0">
          <span className="font-semibold text-body">Açık Sayfa</span> ·{" "}
          <span className="font-mono">{display}</span>
        </p>
        <button
          type="button"
          onClick={() => setRound((r) => r + 1)}
          className={buttonClass({ variant: "ghost" })}
        >
          <ArrowClockwise weight="bold" size={16} aria-hidden />
          Yenile
        </button>
        <a
          href={display}
          target="_blank"
          rel="noopener"
          className={buttonClass({ variant: "ghost" })}
        >
          <ArrowSquareOut weight="duotone" size={16} aria-hidden />
          Yeni Sekmede Aç
        </a>
      </div>

      <div
        ref={stage}
        className={styles.stage}
        data-layout={sizing?.layout ?? "side"}
        style={{ minHeight: sizing ? undefined : 480 }}
      >
        {sizing && (
          <>
            <figure className={styles.device} data-device="phone">
              <figcaption className={styles.caption}>
                <b>Telefon</b>
                <span>
                  {PHONE.width} × {PHONE.height}
                </span>
                <span>{percent(sizing.phone)} Ölçek</span>
                {timing.phone !== null && <span>{seconds(timing.phone)}</span>}
              </figcaption>
              <div
                className={styles.phone}
                style={{ "--w": PHONE.width, "--h": PHONE.height, "--s": sizing.phone } as React.CSSProperties}
              >
                {frame("phone", sizing.phone)}
              </div>
            </figure>

            <figure className={styles.device} data-device="desktop">
              <figcaption className={styles.caption}>
                <b>Masaüstü</b>
                <span>
                  {DESKTOP.width} × {DESKTOP.height}
                </span>
                <span>{percent(sizing.desktop)} Ölçek</span>
                {timing.desktop !== null && <span>{seconds(timing.desktop)}</span>}
              </figcaption>
              <div
                className={styles.browser}
                style={{ "--w": DESKTOP.width, "--h": DESKTOP.height, "--s": sizing.desktop } as React.CSSProperties}
              >
                <div className={styles.bar} aria-hidden>
                  <span className={styles.dots}>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className={styles.address}>
                    <LockSimple weight="bold" size={11} />
                    <span>
                      <b>{host}</b>
                      {display === "/" ? "" : display}
                    </span>
                  </span>
                  <span className={styles.barMeta}>{DESKTOP.width} px</span>
                </div>
                {frame("desktop", sizing.desktop)}
              </div>
            </figure>
          </>
        )}
      </div>
    </div>
  );
}
