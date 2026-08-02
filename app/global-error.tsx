"use client";

/**
 * Son çare hata ekranı — kök düzen (layout) çöktüğünde devreye girer.
 *
 * Bu bileşen kendi <html> ve <body> etiketlerini basmak ZORUNDA, çünkü kök
 * düzen çalışmamış demektir. Aynı sebeple globals.css'in yüklendiğine de
 * güvenilemez: renkler ve tipografi burada satır içi yazılı. Tasarım
 * tokenlarının tekrarı bilinçli bir istisna, kopyala-yapıştır değil.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f9fb",
          color: "#54677c",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "#101c2b",
            }}
          >
            Açılış Zili şu an açılamıyor
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6 }}>
            Beklenmedik bir hata oluştu. Sayfayı yenilemeyi dene; sorun
            sürerse birazdan tekrar bak.
          </p>
          <button
            type="button"
            onClick={reset}
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
            Tekrar Dene
          </button>
          {error.digest && (
            <p style={{ marginTop: 18, fontSize: 11.5, color: "#75879a" }}>
              Hata kimliği: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
