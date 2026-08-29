"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  FloppyDisk,
} from "@phosphor-icons/react/dist/ssr";
import {
  restoreBriefRevision,
  saveBriefFromAdmin,
  type EditorState,
  type StoryRevision,
} from "@/app/actions/content";
import { previewBriefBody } from "@/app/actions/content-preview";
import {
  Alan,
  DurumSeridi,
  OnizlemePaneli,
  SurumGecmisi,
  girdi,
  useOnizleme,
} from "@/components/admin/editor-parts";
import { cn } from "@/lib/utils";

/**
 * Bülten editörü.
 *
 * MERCEKTEN AYRI BİR EDİTÖR, çünkü yazdığı şey ayrı: bülten `BriefBody`nin
 * mini biçimlendiricisiyle çiziliyor — tam markdown değil, `## Başlık`,
 * `- Madde` ve `**kalın**`tan ibaret bir alt küme, üstelik maddeleri
 * 01/02/03 diye numaralıyor. Mercek editörünün `:::` blok çubuğunu buraya
 * koymak, sitede hiç çizilmeyecek bir sözdizimi öneriyor olurdu.
 *
 * KİMLİK ÜÇ ALANDA VE DÜZENLENMİYOR: tarih, dil, dönem. Üçü birlikte kaydın
 * benzersiz anahtarı; serbest bırakmak bir düzeltmenin yanlışlıkla BAŞKA bir
 * günün bültenini ezmesinin en kolay yolu olurdu. Yeni bülten yazmak da
 * rutinin işi — panel var olanı düzeltiyor.
 *
 * Ortak iskelet (durum şeridi, önizleme paneli, sürüm geçmişi)
 * `editor-parts.tsx`te; oradaki yorum ikiliği neden reddettiğimizi anlatıyor.
 */

export type BriefDraft = {
  date: string;
  locale: string;
  period: "daily" | "weekly";
  headline: string;
  bodyMd: string;
  generatedBy: string;
  generatedAt: string;
};

const BOS: EditorState = {};

/**
 * Bültenin YAZIM KISAYOLLARI — `BriefBody`nin tanıdığı üç kalıp.
 *
 * Dördüncüsü yok ve olmamalı: biçimlendirici bu üçünü tanıyor, gerisini düz
 * paragraf sayıyor. Buraya tanınmayan bir kalıp koymak, editörde çalışıyor
 * görünüp sitede düz metne dönen bir kısayol demekti.
 */
const KALIPLAR = [
  { ad: "Bölüm Başlığı", ornek: "## Başlık" },
  { ad: "Madde", ornek: "- Madde metni" },
  { ad: "Kalın Giriş", ornek: "**Kalın giriş:** devamı" },
] as const;

/** Gövde sınırı — şemadaki `body_md` üst sınırıyla aynı sayı. */
const GOVDE_TAVANI = 8000;

export function BriefEditor({
  draft,
  revisions,
  otekiDil,
}: {
  draft: BriefDraft;
  revisions: StoryRevision[];
  /** Aynı bültenin öteki dildeki kaydı varsa adresi; yoksa düğme çizilmiyor. */
  otekiDil: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveBriefFromAdmin, BOS);
  const [restoreState, restoreAction, restoring] = useActionState(
    restoreBriefRevision,
    BOS,
  );

  const [body, setBody] = useState(draft.bodyMd);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  /* Server action referansı sabit — `useOnizleme` bunu şart koşuyor. */
  const onizleme = useOnizleme(body, previewBriefBody);

  const kirli = body !== draft.bodyMd;
  const sifirla = () => {
    setBody(draft.bodyMd);
    onizleme.unut();
  };

  /* Kısayol imlecin OLDUĞU SATIRA yazıyor: bülten kısa ve yeni madde çoğu
     zaman listenin ortasına giriyor. */
  const kalipEkle = (ornek: string) => {
    const el = bodyRef.current;
    const konum = el ? el.selectionStart : body.length;
    const ayrac = konum > 0 && body[konum - 1] !== "\n" ? "\n\n" : "";
    const yeni = body.slice(0, konum) + ayrac + ornek + "\n" + body.slice(konum);
    setBody(yeni);
    queueMicrotask(() => {
      el?.focus();
      const imlec = konum + ayrac.length + ornek.length + 1;
      el?.setSelectionRange(imlec, imlec);
    });
  };

  const maddeSayisi = body
    .split("\n")
    .filter((satir) => satir.trim().startsWith("- ")).length;
  const kalan = GOVDE_TAVANI - body.trim().length;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="date" value={draft.date} />
      <input type="hidden" name="locale" value={draft.locale} />
      <input type="hidden" name="period" value={draft.period} />

      <DurumSeridi
        state={state}
        basarili="Kaydedildi. Bülten sayfası ve ana sayfa tazelendi."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Alan
            label="Manşet"
            hata={state.fieldErrors?.headline}
            hint="Bülten sayfasının başlığı; ana sayfadaki özet kartında da bu görünüyor."
          >
            <input
              name="headline"
              defaultValue={draft.headline}
              maxLength={200}
              className={cn(girdi, "text-lead font-semibold")}
            />
          </Alan>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-small font-semibold text-strong">
                Gövde
              </span>
              {kirli && (
                <button
                  type="button"
                  onClick={sifirla}
                  className="inline-flex min-h-8 items-center gap-1.5 text-tiny font-semibold text-primary transition-colors hover:text-primary-hover"
                >
                  <ArrowCounterClockwise weight="bold" size={13} />
                  Yüklendiği Hâle Dön
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {KALIPLAR.map((kalip) => (
                <button
                  key={kalip.ad}
                  type="button"
                  onClick={() => kalipEkle(kalip.ornek)}
                  title={kalip.ornek}
                  className="inline-flex min-h-8 items-center rounded-full border border-line bg-surface px-2.5 text-tiny font-semibold text-body transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary"
                >
                  {kalip.ad}
                </button>
              ))}
            </div>

            <textarea
              ref={bodyRef}
              name="body_md"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={24}
              spellCheck={false}
              className={cn(
                girdi,
                "resize-y font-mono text-small leading-[1.7] tracking-[0]",
              )}
            />

            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              {state.fieldErrors?.body_md ? (
                <span className="text-tiny font-semibold text-down">
                  {state.fieldErrors.body_md}
                </span>
              ) : (
                <span className="text-tiny text-muted">
                  Boş satır paragrafları ayırır; maddeler 01, 02 diye
                  numaralanır
                </span>
              )}
              {/* TAVAN YAKINSA SAYAÇ UYARIYOR. Sekiz bin karakterlik sınır
                  şemada ve aşan bir metin kaydedilmiyor; bunu kaydet
                  düğmesine basınca öğrenmek, yazılmış bir bülteni yeniden
                  kısaltmak demekti. */}
              <span
                className={cn(
                  "numeral text-tiny",
                  kalan < 0
                    ? "font-semibold text-down"
                    : kalan < 500
                      ? "font-semibold text-body"
                      : "text-muted",
                )}
              >
                {body.trim().length.toLocaleString("tr-TR")} /{" "}
                {GOVDE_TAVANI.toLocaleString("tr-TR")} Karakter ·{" "}
                {maddeSayisi.toLocaleString("tr-TR")} Madde
              </span>
            </div>
          </div>
        </div>

        <OnizlemePaneli
          preview={onizleme.preview}
          previewing={onizleme.previewing}
          bayat={onizleme.bayat}
          guncel={onizleme.guncel}
          yenile={() => onizleme.onizle(body)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) bg-primary px-5 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60 sm:min-h-10"
        >
          <FloppyDisk weight="duotone" size={17} />
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <Link
          href={`/bulten?${draft.period === "weekly" ? "tur=haftalik&" : ""}tarih=${draft.date}`}
          target="_blank"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) border border-line bg-surface px-4 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:min-h-10"
        >
          <ArrowSquareOut weight="duotone" size={16} />
          Yayındaki Hâli
        </Link>
        {otekiDil && (
          <Link
            href={otekiDil}
            className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-line bg-surface px-4 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:min-h-10"
          >
            {draft.locale === "en" ? "Türkçesine Geç" : "İngilizcesine Geç"}
          </Link>
        )}
        <p className="text-tiny text-muted">
          Kaydetmek yayındaki metnin üzerine yazar; önceki hâli sürüm
          geçmişine düşer. Künye değişmez — bülteni yine rutin yazdı.
        </p>
      </div>

      <SurumGecmisi
        revisions={revisions}
        restoreAction={restoreAction}
        restoring={restoring}
        restoreState={restoreState}
      />
    </form>
  );
}
