"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/error-report";

/**
 * Son çare hata ekranı — kök düzen (layout) çöktüğünde devreye girer.
 *
 * Bu bileşen kendi <html> ve <body> etiketlerini basmak ZORUNDA, çünkü kök
 * düzen çalışmamış demektir. Aynı sebeple globals.css'in yüklendiğine de
 * güvenilemez: renkler ve tipografi burada satır içi yazılı. Tasarım
 * tokenlarının tekrarı bilinçli bir istisna, kopyala-yapıştır değil.
 *
 * KOYU TEMA DA BURADA. Bütün renkler yalnızca açık temaya göre sabitti:
 * gece kullanan okuyucu hata anında tam ekran beyaz bir sayfayla
 * karşılaşıyordu — hem rahatsız edici hem ürünün geri kalanıyla ilgisiz.
 * Çerez okunamayacağı için (bu, `<html>`in kendisi) işletim sistemi
 * tercihine bakılıyor: burada `prefers-color-scheme` doğru araç, çünkü
 * ürünün tema durumu zaten kaybolmuş.
 *
 * DİL DE SABİT DEĞİL. Site iki dilli ve en kırılgan anında dilini
 * kaybetmemeli; `navigator.language` burada tek elde kalan ipucu.
 */

const COPY = {
  tr: {
    lang: "tr",
    title: "Açılış Zili şu an açılamıyor",
    body: "Beklenmedik bir hata oluştu. Sayfayı yenilemeyi dene; sorun sürerse birazdan tekrar bak.",
    retry: "Tekrar Dene",
    digest: "Hata kimliği:",
  },
  en: {
    lang: "en",
    title: "Opening Bell can't load right now",
    body: "Something went wrong. Try reloading the page; if it keeps happening, check back shortly.",
    retry: "Try Again",
    digest: "Error id:",
  },
} as const;

/* globals.css'teki değerlerin birebir kopyası — yukarıdaki gerekçeyle. */
const CSS = `
  :root { color-scheme: light dark; }
  body { background: #f7f9fb; color: #54677c; }
  h1 { color: #101c2b; }
  .digest { color: #586a7c; }
  @media (prefers-color-scheme: dark) {
    body { background: #070d16; color: #94a7ba; }
    h1 { color: #eaf1f8; }
    .digest { color: #8497a9; }
  }
`;

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  /* Next bu prop'u geçiyor ama BURADA KULLANILMIYOR — gerekçesi düğmenin
     yanındaki notta. İmzada duruyor ki sözleşme okunur kalsın. */
  reset?: () => void;
}) {
  /* DİL SİTENİN, TARAYICININ DEĞİL (9 Ekim). Yalnızca `navigator.language`
     okunuyordu: tarayıcısı İngilizce olan TR okuyucu hata ekranını
     İngilizce, `/en`deki Türk tarayıcılı okuyucu Türkçe görüyordu. Sıra:
     adresin `/en` öneki (sitenin doğruluk kaynağı), sonra `az-locale`
     çerezi (proxy.ts, httpOnly değil), en son tarayıcı. Sunucuda üçü de
     yok; varsayılan Türkçe — ekran zaten yalnızca istemcide görünüyor. */
  const copy = (() => {
    if (typeof window === "undefined") return COPY.tr;
    const path = window.location.pathname;
    if (path === "/en" || path.startsWith("/en/")) return COPY.en;
    const cookie = document.cookie.match(/(?:^|;\s*)az-locale=(tr|en)/)?.[1];
    if (cookie) return cookie === "en" ? COPY.en : COPY.tr;
    return navigator.language?.startsWith("en") ? COPY.en : COPY.tr;
  })();

  /* Kök layout'un tarayıcıda çöktüğü an panelin hata listesine gidiyor
     (lib/error-report.ts); `digest`li sunucu hatasını instrumentation.ts
     zaten yazdı. Modül globals.css'e ya da sağlayıcılara dayanmıyor —
     kabuk çökmüşken de çalışmalı. */
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <html lang={copy.lang}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 24,
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: "-0.025em",
            }}
          >
            {copy.title}
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6 }}>
            {copy.body}
          </p>
          {/* SAYFAYI YENİDEN YÜKLER, `reset()` ÇAĞIRMAZ. Next'in `reset()`i
              yalnızca hata durumunu temizliyor, ağa çıkmıyor — ve burası kök
              hata sınırı, yani kök layout'un kendisi çökmüş demek. Durumu
              temizlemek aynı çökük ağacı yeniden çizmekten ibaret olurdu.
              Metnin verdiği söz de zaten bu: "Sayfayı yenilemeyi dene."
              `router.refresh()` burada kullanılamaz: bu bileşen kök layout'un
              YERİNE geçiyor, yani App Router bağlamının dışında. */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              height: 40,
              padding: "0 18px",
              borderRadius: 9,
              border: "none",
              background: "#0d74c4",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copy.retry}
          </button>
          {error.digest && (
            <p className="digest" style={{ marginTop: 18, fontSize: 11.5 }}>
              {copy.digest} {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
