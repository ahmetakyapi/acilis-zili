"use client";

import { useState, useTransition } from "react";
import { interpretRiskDesk, type NoteActionResult } from "@/app/(app)/risk/actions";
import { Button } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import styles from "./RiskDesk.module.css";

/**
 * "Masayı Yorumla" (25 Ekim). Yorum KENDİLİĞİNDEN istenmez: Claude çağrısı
 * yalnız düğmeyle, oturumlu ve erişimi olan kullanıcının isteğiyle gider
 * (botlar sayfayı zaten göremiyor; eylem ayrıca reddeder). Aynı gün aynı
 * masa ikinci kez istenirse önbellekten gelir (lib/risk/note.ts).
 */

type T = Dictionary["riskDesk"]["note"];

export function DeskNote({ t, locale }: { t: T; locale: "tr" | "en" }) {
  const [result, setResult] = useState<NoteActionResult | null>(null);
  const [pending, start] = useTransition();
  const read = () =>
    start(async () => {
      try {
        setResult(await interpretRiskDesk());
      } catch {
        setResult({ ok: false, reason: "failed" });
      }
    });
  const failure =
    result && !result.ok
      ? result.reason === "off"
        ? t.off
        : result.reason === "rate"
          ? t.rate
          : result.reason === "budget"
            ? t.budget
            : result.reason === "empty"
              ? t.empty
              : t.failed
      : null;
  const time =
    result?.ok &&
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: locale === "en" ? "America/New_York" : "Europe/Istanbul",
    }).format(new Date(result.note.generatedAt));
  return (
    <div className={styles.note} aria-live="polite">
      {result?.ok ? (
        <div className={styles.noteText}>
          {result.note.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className={styles.ruleMeta}>{t.written.replace("{time}", String(time))}</p>
        </div>
      ) : (
        <div className={styles.builderActions}>
          <Button type="button" size="sm" onClick={read} disabled={pending}>
            {pending ? t.loading : t.button}
          </Button>
          {failure && <p className={styles.message}>{failure}</p>}
        </div>
      )}
      <p className={styles.foot}>{t.guard}</p>
    </div>
  );
}
