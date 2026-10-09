"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { reportClientError } from "@/lib/error-report";
import styles from "./Embed.module.css";

/**
 * GÖMÜLÜ PARÇANIN HATA EKRANI (9 Ekim).
 *
 * `/gomulu/*` kabuğun dışında ve kendi sınırı yoktu: çizim hatası doğrudan
 * `app/global-error.tsx`e düşüyor ve başka bir sitenin çerçevesinde tam
 * sayfalık "şu an açılamıyor" belgesi (kendi `<html>`iyle) basılıyordu.
 * Burada parçanın kendi kutusunda tek satırlık bir mesaj ve "Tekrar Dene";
 * gömen sitenin düzeni bozulmuyor.
 *
 * Dil `<html lang>`ten (gömülü layout okuyucunun diliyle basıyor), metinler
 * burada — gerekçe `app/(app)/error.tsx`.
 */
const COPY = {
  tr: { message: "Bu parça şu an yüklenemedi.", retry: "Tekrar Dene" },
  en: { message: "This widget couldn't load right now.", retry: "Try Again" },
};

export default function EmbedError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  /* Sınır yalnızca istemcide, hata anında çiziliyor; `document` hazır. */
  const [copy] = useState(() =>
    typeof document !== "undefined" && document.documentElement.lang === "en" ? COPY.en : COPY.tr,
  );
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <div className={styles.frame}>
      <section className={styles.widget} role="alert">
        <p className={styles.meta}>{copy.message}</p>
        <div className={styles.foot}>
          <button
            type="button"
            className={styles.credit}
            onClick={() =>
              startTransition(() => {
                router.refresh();
                reset();
              })
            }
          >
            {copy.retry}
          </button>
        </div>
      </section>
    </div>
  );
}
