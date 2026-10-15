"use client";

import { useActionState, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, CheckCircle, PaperPlaneTilt, Trash } from "@phosphor-icons/react";
import editorial from "@/components/article/ArticleEditorial.module.css";
import {
  deletePostAction,
  savePostAction,
  submitPostAction,
  withdrawPostAction,
  type PostActionState,
} from "@/app/actions/user-posts";
import { previewUserPostBody } from "@/app/actions/user-post-preview";
import { blokYaz, useCikisKorumasi, useImlec, useOnizleme } from "@/components/admin/editor-parts";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Button } from "@/components/ui/primitives";
import { BLOKLAR } from "@/lib/article-blocks";
import type { Dictionary } from "@/lib/i18n";
import type { OwnPost } from "@/lib/user-post-data";
import { cn } from "@/lib/utils";

type Labels = Dictionary["community"]["editor"];

const FIELD =
  "w-full rounded-(--radius-md) border border-line bg-page px-3 py-2 text-sm leading-relaxed text-strong outline-none focus:border-line-focus aria-invalid:border-down";

const IDLE: PostActionState = { status: "idle", at: 0 };

/**
 * Topluluk yazısı editörü — StoryEditor'ün halka açık, sade eşi.
 *
 * Aynı omurga, farklı kabuk: blok çipleri paylaşılan listeden
 * (lib/article-blocks.ts), imlece yazma `blokYaz` (geri alma yığını ve
 * kaydırma korunur), önizleme sunucuda çizilip JSX olarak gelir
 * (`previewUserPostBody`, 700 ms debounce — gerekçeler editor-parts'ta).
 * Admin editörünün yapışkan bant ölçüleri ve sürüm geçmişi BİLEREK yok:
 * bu ekran tek sütun, yukarıdan aşağı okunur — alanlar, çipler, gövde,
 * önizleme, eylemler.
 *
 * Form DENETİMLİ: React 19 form eylemi hata döndürünce denetimsiz alanları
 * sıfırlıyor (StoryEditor dersi). Çıkış koruması kirli metinde üç kapı
 * (useCikisKorumasi); önizlemedeki bağlantılar ölü (data-editor-preview).
 */
export function PostEditor({
  post,
  ilkOnizleme,
  labels,
  locale,
}: {
  post: OwnPost | null;
  ilkOnizleme: ReactNode;
  labels: Labels;
  /** YAZININ dili (yeni yazıda arayüzünki) — çip örnekleri buna göre. */
  locale: "tr" | "en";
}) {
  const [state, action, saving] = useActionState<PostActionState, FormData>(savePostAction, IDLE);
  const [title, setTitle] = useState(post?.title ?? "");
  const [dek, setDek] = useState(post?.dek ?? "");
  const [symbols, setSymbols] = useState((post?.symbols ?? []).join(", "));
  const [body, setBody] = useState(post?.bodyMd ?? "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imlec = useImlec();

  const suan = JSON.stringify([title.trim(), dek.trim(), symbols, body.trim()]);
  const [taban, setTaban] = useState(() =>
    JSON.stringify([
      (post?.title ?? "").trim(),
      (post?.dek ?? "").trim(),
      (post?.symbols ?? []).join(", "),
      (post?.bodyMd ?? "").trim(),
    ]),
  );
  /* Başarılı kayıt TABANI taşır; "status ok kaldı diye kirlilik sonsuza
     dek kapalı" tuzağına düşülmez (15 Ekim incelemesi). */
  const [acked, setAcked] = useState(0);
  if (state.status === "ok" && state.at !== acked) {
    setAcked(state.at);
    setTaban(suan);
  }
  const kirli = suan !== taban;
  useCikisKorumasi(kirli);

  /* `ilk` SABİT NESNE: useOnizleme "metin sunucununki mi" kararını nesne
     KİMLİĞİYLE veriyor; her render'da yeni nesne kurmak setState döngüsüne
     sokuyordu (15 Ekim incelemesi — bloker). */
  const [ilk] = useState(() => ({ metin: post?.bodyMd ?? "", cizim: ilkOnizleme }));
  const onizleme = useOnizleme(body, previewUserPostBody, ilk);

  const fieldError = (name: NonNullable<PostActionState["field"]>) =>
    state.status === "error" && state.field === name ? true : undefined;
  const errorText =
    state.status === "error" ? labels.errors[state.error ?? "unavailable"] : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      {post && <input type="hidden" name="id" value={post.id} />}

      {post?.status === "rejected" && post.reviewNote && (
        <p role="alert" className="rounded-(--radius-md) border border-down/40 bg-down/5 px-3 py-2.5 text-small leading-relaxed text-body">
          <strong className="font-semibold text-strong">{labels.rejectedNote}</strong>{" "}
          {post.reviewNote}
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-small font-semibold text-body">{labels.titleLabel}</span>
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={160}
          required
          aria-invalid={fieldError("title")}
          placeholder={labels.titlePlaceholder}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-small font-semibold text-body">{labels.dekLabel}</span>
        <textarea
          name="dek"
          value={dek}
          onChange={(event) => setDek(event.target.value)}
          maxLength={400}
          rows={2}
          required
          aria-invalid={fieldError("dek")}
          placeholder={labels.dekPlaceholder}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-small font-semibold text-body">{labels.symbolsLabel}</span>
        <input
          name="symbols"
          value={symbols}
          onChange={(event) => setSymbols(event.target.value)}
          aria-invalid={fieldError("symbols")}
          placeholder={labels.symbolsPlaceholder}
          className={cn("numeral", FIELD)}
        />
        <span className="text-tiny leading-relaxed text-muted">{labels.symbolsHint}</span>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-3">
          <label htmlFor="topluluk-govde" className="text-small font-semibold text-body">
            {labels.bodyLabel}
          </label>
          <span className="text-tiny tabular-nums text-muted" aria-hidden>
            {body.length.toLocaleString("tr-TR")}
          </span>
        </span>
        {/* Blok çipleri — belgedeki sözdizimini imlece yazar. */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={labels.blocksLabel}>
          {BLOKLAR.map((blok) => (
            <button
              key={blok.ad}
              type="button"
              onClick={() => {
                if (bodyRef.current) blokYaz(bodyRef.current, locale === "en" ? blok.en : blok.tr, imlec.konum.current);
              }}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-3 text-tiny font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:min-h-7"
            >
              {blok.etiket}
              <span className="font-mono text-micro text-muted">{blok.ad}</span>
            </button>
          ))}
        </div>
        <textarea
          id="topluluk-govde"
          aria-describedby="topluluk-govde-ipucu"
          ref={bodyRef}
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onSelect={imlec.kaydet}
          onKeyUp={imlec.kaydet}
          onClick={imlec.kaydet}
          rows={18}
          required
          aria-invalid={fieldError("body")}
          placeholder={labels.bodyPlaceholder}
          className={cn(FIELD, "min-h-[360px] font-mono text-[13px] leading-relaxed")}
        />
        <span id="topluluk-govde-ipucu" className="text-tiny leading-relaxed text-muted">{labels.bodyHint}</span>
      </div>

      {errorText && (
        <p role="alert" className="text-small font-medium text-down">
          {errorText}
        </p>
      )}
      <p role="status" className={state.status === "ok" ? "flex items-start gap-2 text-small leading-relaxed text-body" : "sr-only"}>
        {state.status === "ok" && (
          <>
            <CheckCircle weight="fill" size={16} className="mt-0.5 shrink-0 text-up" aria-hidden />
            {post?.status === "published" ? labels.savedRequeued : labels.saved}
          </>
        )}
      </p>

      {post?.status === "published" && (
        <p className="text-tiny leading-relaxed text-muted">{labels.publishedEditNote}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
        <Button
          type="submit"
          aria-disabled={saving}
          onClick={(event) => {
            if (saving) event.preventDefault();
          }}
          className="aria-disabled:opacity-45"
        >
          {saving ? labels.saving : labels.save}
        </Button>
        {post && (post.status === "draft" || post.status === "rejected") &&
          (kirli ? (
            <span className="text-tiny text-muted">{labels.saveFirst}</span>
          ) : (
            <Button type="submit" variant="ghost" formAction={submitPostAction} formNoValidate>
              <PaperPlaneTilt weight="duotone" size={15} />
              {labels.submitReview}
            </Button>
          ))}
        {post && post.status === "pending" && (
          <Button type="submit" variant="ghost" formAction={withdrawPostAction} formNoValidate>
            {labels.withdraw}
          </Button>
        )}
        {post && (
          <Button
            type="submit"
            variant="ghost"
            formAction={deletePostAction}
            formNoValidate
            onClick={(event) => {
              if (!window.confirm(labels.deleteConfirm)) event.preventDefault();
            }}
            className="text-down hover:text-down"
          >
            <Trash weight="duotone" size={15} />
            {labels.delete}
          </Button>
        )}
        {post?.status === "published" && (
          <Link
            href={`/topluluk/${post.slug}`}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-0"
          >
            {labels.viewPublished}
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        )}
      </div>

      {/* Önizleme — yayındaki çizimin kendisi. Bağlantılar ölü
          (data-editor-preview, useCikisKorumasi yakalıyor). Stil sınıfı
          içe aktarma AĞAÇTA KALMALI: çizim sunucudan geliyor, CSS'i bu
          bileşen getiriyor (StoryEditor'daki kayıt). */}
      <section
        data-editor-preview
        data-preview-style={editorial.prose}
        aria-label={labels.previewLabel}
        className="flex flex-col gap-2 border-t border-line-soft pt-4"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-strong">{labels.previewLabel}</h2>
          {/* role=status YOK: 700 ms'de bir "Çiziliyor/Güncel" duyurusu
              ekran okuyucuda gevezelik olurdu; durum görsel künye. */}
          <span className="text-tiny text-muted">
            {onizleme.durum === "ciziliyor"
              ? labels.previewDrawing
              : onizleme.durum === "degisti"
                ? labels.previewStale
                : onizleme.durum === "hata"
                  ? labels.previewFailed
                  : labels.previewFresh}
          </span>
        </div>
        <div className="rounded-(--radius-lg) border border-line bg-surface px-4 py-5 sm:px-6">
          {onizleme.preview ?? <p className="text-small text-muted">{labels.previewEmpty}</p>}
        </div>
      </section>
    </form>
  );
}
