"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkle } from "@phosphor-icons/react";
import { startRouteProgress } from "@/components/layout/RouteProgress";
import { ChipStrip } from "@/components/ui/ChipStrip";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import type { ScreenQueryLabels } from "@/lib/i18n/dictionaries/screen-query";
import styles from "./ScreenQueryBox.module.css";

type Status =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "error"; message: string }
  /* Çeviri bitti: `sentence` hangi cümlenin notu olduğunu söyler — adresteki
     cümle değişince not da düşer (geri tuşu, çip kaldırma). */
  | { kind: "done"; sentence: string; unsupported: string[]; dropped: string[]; nothing: boolean };

type Response =
  | { ok: true; query: string | null; unsupported: string[]; dropped: string[] }
  | { ok: false; reason: string };

/**
 * Düz cümleyle tarama kutusu (24 Ekim) — /tarama'nın seçim şeridinde.
 *
 * Kutu SONUÇ GÖSTERMEZ: cümleyi uca gönderir, gelen adres sorgusuna gider;
 * tablo ve etkin süzgeç çipleri sunucuda ADRESTEN çizilir
 * (app/(app)/tarama/page.tsx). Bu yüzden paylaşılan bağlantı da geri tuşu da
 * aynı ekranı kurar. Kutunun kendi durumu yalnız son çevirinin notu
 * (desteklenmeyen parçalar) ve o not adresteki cümleye bağlı: başka bir
 * cümleye ya da elle süzgece geçilince düşer.
 *
 * Hata ya da bütçe dolu: tek satır mesaj, başka hiçbir şey değişmez — elle
 * süzgeçler kesintisiz çalışır.
 *
 * ÖRNEKLER YALNIZ GEREKİNCE (24 Ekim düzeltmesi). Seçim şeridinde üç çip
 * satırı üst üste duruyordu (örnekler, etkin süzgeçler, hazır süzgeçler) ve
 * örnek satırı sağda "Temel…" diye uyarısız kesiliyordu. Örnekler artık
 * kutu BOŞKEN ya da odak kutunun içindeyken açık; cümle yazılıp odak
 * çıkınca marka eğrisiyle kapanır (hareketi azaltana anında). Satır sektör
 * şeridinin kalıbında (`ChipStrip`: kenar solması + yön düğmeleri), yani
 * taşan örnek görünür biçimde "devamı var" der. Kapalıyken `inert`: gizli
 * çipler odak sırasına girmez.
 */
export function ScreenQueryBox({
  labels,
  sentence,
  fieldLabels,
  scrollLabels,
}: {
  labels: ScreenQueryLabels;
  /** Adresteki `cumle` — yoksa null. */
  sentence: string | null;
  fieldLabels: Record<string, string>;
  scrollLabels: { prev: string; next: string };
}) {
  const router = useRouter();
  const { href } = useLocaleHref();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [navigating, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(!sentence);
  const [focused, setFocused] = useState(false);
  /* Safari düğmeye tıklayınca odağı düğmeye vermiyor: alanın `blur`u
     `relatedTarget` boş gelir ve örnekler tıklamanın ORTASINDA kapanırdı.
     Kutunun içinde başlayan işaretçi basışı sürerken blur sayılmaz. */
  const pointerInside = useRef(false);

  /* Adresten gelen cümle alan ODAKTA DEĞİLKEN yazılır — CompanySearch
     kalıbı: yazan okurun değeri ezilmez, geri tuşu alanı da geri alır. */
  useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement !== el) {
      el.value = sentence ?? "";
      setEmpty(!el.value.trim());
    }
  }, [sentence]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function translate(raw: string) {
    const q = raw.replace(/\s+/g, " ").trim();
    if (q.length < 3) {
      setStatus({ kind: "error", message: labels.errors.short });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: "pending" });
    let data: Response;
    try {
      const res = await fetch("/api/ai/tarama-cumlesi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
        signal: controller.signal,
      });
      data = (await res.json()) as Response;
    } catch (error) {
      if (controller.signal.aborted) return;
      data = { ok: false, reason: error instanceof Error ? error.message : "network" };
    }
    if (controller.signal.aborted) return;
    if (!data.ok) {
      const message =
        data.reason === "rate" ? labels.errors.rate : data.reason === "short" ? labels.errors.short : labels.errors.unavailable;
      setStatus({ kind: "error", message });
      return;
    }
    setStatus({
      kind: "done",
      sentence: q,
      unsupported: data.unsupported,
      dropped: data.dropped.map((field) => fieldLabels[field] ?? field),
      nothing: data.query === null,
    });
    if (data.query === null) return;
    const target = href(`/tarama?${data.query}`);
    startRouteProgress(target);
    startTransition(() => router.push(target, { scroll: false }));
  }

  const pending = status.kind === "pending" || navigating;
  /* Not yalnız adresteki cümleye aitse (ya da çeviri süzgeç üretmediyse). */
  const note = status.kind === "done" && (status.nothing || status.sentence === sentence) ? status : null;
  const examplesOpen = empty || focused;

  return (
    <div
      ref={boxRef}
      className={styles.box}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (pointerInside.current) return;
        if (!boxRef.current?.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onPointerDown={() => {
        pointerInside.current = true;
        const release = () => {
          pointerInside.current = false;
          window.removeEventListener("pointerup", release);
          window.removeEventListener("pointercancel", release);
        };
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
      }}
    >
      <form
        role="search"
        className={styles.field}
        onSubmit={(event) => {
          event.preventDefault();
          void translate(inputRef.current?.value ?? "");
        }}
      >
        <Sparkle aria-hidden size={17} weight="duotone" className={styles.mark} />
        <label className="sr-only" htmlFor="screen-query">
          {labels.label}
        </label>
        <input
          ref={inputRef}
          id="screen-query"
          name="cumle"
          type="text"
          defaultValue={sentence ?? ""}
          placeholder={labels.placeholder}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="go"
          onChange={(event) => setEmpty(!event.target.value.trim())}
          aria-describedby="screen-query-status"
        />
        <button type="submit" aria-label={labels.submit} title={labels.submit} disabled={pending}>
          <ArrowRight aria-hidden size={16} weight="bold" />
        </button>
      </form>

      <div id="screen-query-status" aria-live="polite" className={styles.status}>
        {pending ? (
          <p className={styles.pending}>{labels.pending}</p>
        ) : status.kind === "error" ? (
          <p>{status.message}</p>
        ) : (
          <>
            {/* Paylaşılan bağlantıda da (not yok, cümle adreste) çipler
                çeviridir — künye bunu söyler. */}
            {note?.nothing ? <p>{labels.nothing}</p> : sentence ? <p>{labels.translated}</p> : null}
            {note && note.unsupported.length > 0 && (
              <p className={styles.unsupported}>{labels.unsupported.replace("{list}", note.unsupported.join(", "))}</p>
            )}
            {note && note.dropped.length > 0 && (
              <p className={styles.unsupported}>{labels.dropped.replace("{list}", note.dropped.join(", "))}</p>
            )}
          </>
        )}
      </div>

      {labels.examples.length > 0 && (
        <div className={styles.examplesShell} data-open={examplesOpen || undefined} inert={!examplesOpen}>
          <div className={styles.examples}>
            <span className={styles.examplesLabel}>{labels.examplesLabel}</span>
            <ChipStrip activeKey={null} scrollLabels={scrollLabels} className={`scroll-x ${styles.exampleRow}`}>
              {labels.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className={styles.example}
                  disabled={pending}
                  onClick={() => {
                    if (inputRef.current) inputRef.current.value = example;
                    setEmpty(false);
                    void translate(example);
                  }}
                >
                  {example}
                </button>
              ))}
            </ChipStrip>
          </div>
        </div>
      )}
    </div>
  );
}
