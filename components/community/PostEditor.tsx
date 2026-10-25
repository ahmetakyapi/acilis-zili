"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle,
  Circle,
  FilePlus,
  FloppyDisk,
  PaperPlaneTilt,
  Trash,
} from "@phosphor-icons/react";
import editorial from "@/components/article/ArticleEditorial.module.css";
import {
  deletePostAction,
  savePostAction,
  submitPostAction,
  withdrawPostAction,
  type PostActionState,
} from "@/app/actions/user-posts";
import { previewUserPostBody } from "@/app/actions/user-post-preview";
import {
  blokYaz,
  useCikisKorumasi,
  useImlec,
  useOnizleme,
  useOnizlemeTakibi,
} from "@/components/admin/editor-parts";
import { TEMPLATE_ICONS } from "@/components/community/template-icons";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { BLOKLAR } from "@/lib/article-blocks";
import type { Dictionary } from "@/lib/i18n";
import { POST_TEMPLATES, type PostTemplate, type PostTemplateKey } from "@/lib/post-templates";
import type { OwnPost } from "@/lib/user-post-data";
import { cn } from "@/lib/utils";
import styles from "./PostEditor.module.css";

type Labels = Dictionary["community"]["editor"];
type TemplateLabels = Dictionary["community"]["templates"];

const FIELD =
  "w-full rounded-(--radius-md) border border-line bg-page px-3 py-2 text-sm leading-relaxed text-strong outline-none transition-colors focus:border-line-focus aria-invalid:border-down";

const IDLE: PostActionState = { status: "idle", at: 0 };
/** Kayıt şemasının alt sınırları (lib/user-posts.ts: başlık 10, giriş 20,
    gövde 200) — denetim listesi aynı sayıları söyler. */
const BODY_MIN = 200;

const imza = (title: string, dek: string, symbols: string, body: string) =>
  JSON.stringify([title.trim(), dek.trim(), symbols, body.trim()]);

/**
 * Topluluk yazısı editörü — StoryEditor'ün halka açık, sade eşi.
 *
 * Aynı omurga: blok çipleri paylaşılan listeden (lib/article-blocks.ts),
 * imlece yazma `blokYaz` (geri alma yığını ve kaydırma korunur), önizleme
 * sunucuda çizilip JSX olarak gelir (`previewUserPostBody`, 700 ms
 * debounce — gerekçeler editor-parts'ta).
 *
 * YENİDEN KURGU (15 Ekim; sahibi: "daha kolay, şablonlarla, yanda direkt
 * önizleme"). İlk sürüm tek sütundu: önizleme formun DİBİNDEYDİ ve yazan
 * kişi bloğun nasıl çizildiğini görmek için her seferinde 18 satırlık
 * gövdenin altına kayıyordu. Şimdi:
 * - Geniş ekranda iki kolon: solda yazı, sağda yapışkan önizleme (kendi
 *   içinde kayar, imleci izler — useOnizlemeTakibi). Önizleme gövdeyle
 *   yetinmez, kapağı da çizer (başlık, giriş, semboller): okuyucunun kartta
 *   ve sayfa başında göreceği her şey.
 * - Dar ekranda iki görünüm arasında anahtar (Yaz / Önizle): alt alta iki
 *   uzun bölüm, dar ekranda önizlemeyi formun 1500 piksel altına itiyordu.
 * - Şablonlar (lib/post-templates.ts) boş sayfa korkusunu alır ve blok
 *   dilini ÖRNEKLE öğretir. Yeni yazıda üst şeritte; `?sablon=` ile dolu açılır.
 * - Çiplerin ne çizdiği üzerine gelince yazar; denetim listesi gönderme
 *   şartlarını (200 karakter, köşeli parantezler) önceden gösterir — red
 *   gerekçesi sonradan değil.
 * - Kaydet ve diğer eylemler formun dibine yapışık şeritte, durumu tek
 *   yuvada söyleyerek (25 Ekim; ölçüler PostEditor.module.css).
 *
 * Form DENETİMLİ: React 19 form eylemi hata döndürünce denetimsiz alanları
 * sıfırlıyor (StoryEditor dersi). Çıkış koruması kirli metinde üç kapı
 * (useCikisKorumasi); önizlemedeki bağlantılar ölü (data-editor-preview).
 */
export function PostEditor({
  post,
  ilkOnizleme,
  labels,
  templateLabels,
  locale,
  template = null,
}: {
  post: OwnPost | null;
  ilkOnizleme: ReactNode;
  labels: Labels;
  templateLabels: TemplateLabels;
  /** YAZININ dili (yeni yazıda arayüzünki) — çip ve şablon örnekleri buna göre. */
  locale: "tr" | "en";
  /** Yeni yazıda adresten gelen şablon (`?sablon=`); sayfa çözümler. */
  template?: PostTemplate | null;
}) {
  const start = template?.content[locale];
  const [state, action, saving] = useActionState<PostActionState, FormData>(savePostAction, IDLE);
  const [title, setTitle] = useState(post?.title ?? start?.title ?? "");
  const [dek, setDek] = useState(post?.dek ?? start?.dek ?? "");
  const [symbols, setSymbols] = useState(post ? post.symbols.join(", ") : (start?.symbols ?? ""));
  const [body, setBody] = useState(post?.bodyMd ?? start?.body ?? "");
  const [chosen, setChosen] = useState<PostTemplateKey | "blank" | null>(template?.key ?? null);
  const [view, setView] = useState<"write" | "preview">("write");
  const [hint, setHint] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imlec = useImlec();

  const suan = imza(title, dek, symbols, body);
  /* Taban: kaydedilmiş hâl ya da DOKUNULMAMIŞ şablon. Şablonla açılıp hiç
     yazmadan çıkan okuyucuya "kaydedilmemiş değişiklik" sorulmaz. */
  const [taban, setTaban] = useState(suan);
  /* Başarılı kayıt TABANI taşır; "status ok kaldı diye kirlilik sonsuza
     dek kapalı" tuzağına düşülmez (15 Ekim incelemesi). */
  const [acked, setAcked] = useState(0);
  if (state.status === "ok" && state.at !== acked) {
    setAcked(state.at);
    setTaban(suan);
  }
  const kirli = suan !== taban;
  useCikisKorumasi(kirli && (post !== null || body.trim().length > 0));

  /* `ilk` SABİT NESNE: useOnizleme "metin sunucununki mi" kararını nesne
     KİMLİĞİYLE veriyor; her render'da yeni nesne kurmak setState döngüsüne
     sokuyordu (15 Ekim incelemesi — bloker). */
  const [ilk] = useState(() => ({ metin: post?.bodyMd ?? start?.body ?? "", cizim: ilkOnizleme }));
  /* Önizleme yazının diliyle çizilir (gerekçe `previewUserPostBody`);
     useOnizleme `ciz`in kimliğine bağlı, o yüzden sabit tutuluyor. */
  const ciz = useCallback((metin: string) => previewUserPostBody(metin, locale), [locale]);
  const onizleme = useOnizleme(body, ciz, ilk);
  const takip = useOnizlemeTakibi(bodyRef, previewRef);
  useEffect(() => takip(), [onizleme.cizilen, takip]);

  const applyTemplate = (key: PostTemplateKey | "blank") => {
    const next =
      key === "blank"
        ? { title: "", dek: "", symbols: "", body: "" }
        : POST_TEMPLATES.find((item) => item.key === key)!.content[locale];
    const hasText = [title, dek, body].some((value) => value.trim().length > 0);
    /* Dokunulmamış şablonun üstüne yazmak sormaz; okuyucunun metni sorar. */
    if (hasText && kirli && !window.confirm(labels.templateConfirm)) return;
    setTitle(next.title);
    setDek(next.dek);
    setSymbols(next.symbols);
    setBody(next.body);
    setChosen(key);
    setTaban(imza(next.title, next.dek, next.symbols, next.body));
    bodyRef.current?.focus({ preventScroll: true });
  };

  const fieldError = (name: NonNullable<PostActionState["field"]>) =>
    state.status === "error" && state.field === name ? true : undefined;
  const errorText =
    state.status === "error" ? labels.errors[state.error ?? "unavailable"] : null;

  /* Durum yuvasının tek kaynağı. Sıra: süren kayıt > hata > kirli metin >
     son kayıt > boşta. Kirliyken "Kuyruğa Gönder" basılmıyor (kaydedilmemiş
     metin gönderilmesin); bunun nedeni de aynı yuvada söyleniyor. */
  const canSubmit = post !== null && (post.status === "draft" || post.status === "rejected");
  const durum: { metin: string; ton: "ok" | "warn" | "idle" | "down" } = saving
    ? { metin: labels.saving, ton: "idle" }
    : errorText
      ? { metin: errorText, ton: "down" }
      : kirli
        ? { metin: canSubmit ? `${labels.statusUnsaved} · ${labels.saveFirst}` : labels.statusUnsaved, ton: "warn" }
        : state.status === "ok"
          ? { metin: post?.status === "published" ? labels.savedRequeued : labels.saved, ton: "ok" }
          : { metin: post ? labels.statusClean : labels.statusNew, ton: "idle" };

  const bodyLength = body.trim().length;
  const symbolList = symbols
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 12);
  const checks = [
    { ok: title.trim().length >= 10, text: labels.checkTitle, required: true },
    { ok: dek.trim().length >= 20, text: labels.checkDek, required: true },
    {
      ok: bodyLength >= BODY_MIN,
      text: labels.checkBody.replace("{n}", String(Math.min(bodyLength, BODY_MIN))),
      required: true,
    },
    /* Şablonun köşeli yer tutucuları: "[Şirket]" kalırsa moderasyon geri
       gönderir — önceden söylemek, bir tur beklemekten iyi. */
    { ok: !/\[[^\]\n]{1,40}\](?!\()/.test(`${title}\n${dek}\n${body}`), text: labels.checkBrackets, required: true },
    { ok: /^:::\s*\w+/m.test(body), text: labels.checkBlock, required: false },
  ];

  /* Adımlar: şablon/başlangıç → yazı kaydedilmiş ve yeterli → kuyrukta/yayında. */
  const stepDone = [
    post !== null || chosen !== null || bodyLength > 0,
    post !== null && !kirli && checks.every((check) => check.ok || !check.required),
    post?.status === "pending" || post?.status === "published",
  ];
  const current = stepDone.findIndex((done) => !done);

  const previewStatus =
    onizleme.durum === "ciziliyor"
      ? labels.previewDrawing
      : onizleme.durum === "degisti"
        ? labels.previewStale
        : onizleme.durum === "hata"
          ? labels.previewFailed
          : labels.previewFresh;

  return (
    <form action={action} className="flex flex-col gap-5">
      {post && <input type="hidden" name="id" value={post.id} />}

      {/* Seçim şeridi (ekran sırası 2): yazının üç adımı. Panel değil,
          başlığın altındaki ince künye katmanı. */}
      {/* Telefonda üç eşit hücre (390'da üçüncü adım bağlayıcısıyla birlikte
          ikinci satıra düşüyordu — ölçüldü); geniş ekranda çizgiyle bağlı. */}
      <ol aria-label={labels.stepsLabel} className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {labels.steps.map((step, index) => {
          const done = stepDone[index];
          const active = index === current;
          return (
            <li key={step} className="flex min-w-0 items-center gap-2">
              {index > 0 && <span aria-hidden className="hidden h-px w-8 bg-line sm:block" />}
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "inline-flex min-h-8 w-full min-w-0 items-center justify-center gap-1.5 rounded-full border px-2 py-1 text-center text-tiny font-semibold leading-tight transition-colors duration-300 ease-brand sm:w-auto sm:gap-2 sm:px-2.5 sm:text-small",
                  active
                    ? "border-line-strong bg-surface text-strong"
                    : done
                      ? "border-line-soft text-body"
                      : "border-transparent text-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "numeral grid size-5 shrink-0 place-items-center rounded-full text-micro font-bold",
                    done ? "bg-up/15 text-up" : active ? "bg-surface-sunken text-strong" : "bg-surface-sunken text-muted",
                  )}
                >
                  {done ? <Check weight="bold" size={11} /> : index + 1}
                </span>
                {step}
              </span>
            </li>
          );
        })}
      </ol>

      {post?.status === "rejected" && post.reviewNote && (
        <p role="alert" className="rounded-(--radius-md) border border-down/40 bg-down/5 px-3 py-2.5 text-small leading-relaxed text-body">
          <strong className="font-semibold text-strong">{labels.rejectedNote}</strong>{" "}
          {post.reviewNote}
        </p>
      )}

      {/* ŞABLONLAR — yalnız yeni yazıda. Seçili kart aria-pressed. */}
      {post === null && (
        <Panel>
          <PanelHeader title={labels.templatesTitle} />
          <p className="-mt-1 px-4 text-small leading-relaxed text-muted sm:px-5">{labels.templatesHint}</p>
          {/* Telefonda iki sütun, ipucu gizli: beş kart alt alta 480 piksel
              tutuyor ve yazı alanını ikinci ekrana itiyordu (ölçüldü, 390). */}
          <div className="grid grid-cols-2 gap-2 p-4 sm:p-5 lg:grid-cols-5">
            {[...POST_TEMPLATES.map((item) => item.key), "blank" as const].map((key) => {
              const TemplateIcon = key === "blank" ? FilePlus : TEMPLATE_ICONS[key];
              const text = key === "blank" ? { label: labels.blank, hint: labels.blankHint } : templateLabels[key];
              const selected = chosen === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => applyTemplate(key)}
                  className={cn(
                    "group flex min-h-11 items-center gap-2.5 rounded-(--radius-md) border p-2.5 text-left transition-colors duration-300 ease-brand sm:items-start sm:gap-3 sm:p-3",
                    key === "blank" && "max-sm:col-span-2",
                    selected
                      ? "border-primary bg-primary-tint"
                      : "border-line-soft bg-surface-sunken hover:border-primary-faint hover:bg-primary-tint",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-(--radius-sm) bg-surface transition-colors",
                      selected ? "text-primary" : "text-body group-hover:text-primary",
                    )}
                  >
                    <TemplateIcon size={18} weight="duotone" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-small font-semibold leading-snug text-strong sm:text-sm">{text.label}</span>
                    <span className="hidden text-small leading-snug text-muted sm:block">{text.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Dar ekranda görünüm anahtarı; geniş ekranda iki kolon birden. */}
      <div role="group" aria-label={labels.viewLabel} className="flex rounded-full border border-line bg-surface-sunken p-1 lg:hidden">
        {(["write", "preview"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={cn(
              "min-h-11 flex-1 rounded-full text-sm font-semibold transition-colors duration-300 ease-brand",
              view === key ? "bg-surface text-strong" : "text-muted hover:text-strong",
            )}
          >
            {key === "write" ? labels.viewWrite : labels.viewPreview}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* ---- Sol: yazı ---- */}
        <Panel className={cn(view === "preview" && "max-lg:hidden")}>
          <PanelHeader
            title={labels.writeTitle}
            meta={<span className="tabular-nums">{body.length.toLocaleString(locale === "tr" ? "tr-TR" : "en-US")}</span>}
          />
          <div className="flex flex-col gap-4 px-4 pb-5 sm:px-5">
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
                className={cn(FIELD, "text-base font-semibold")}
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

            <div className="flex flex-col gap-2">
              <label htmlFor="topluluk-govde" className="text-small font-semibold text-body">
                {labels.bodyLabel}
              </label>
              {/* Blok çipleri — belgedeki sözdizimini imlece yazar; üzerine
                  gelince ne çizdiğini alttaki satır söyler. */}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={labels.blocksLabel}>
                {BLOKLAR.map((blok) => (
                  <button
                    key={blok.ad}
                    type="button"
                    title={labels.blockHints[blok.ad]}
                    onMouseEnter={() => setHint(labels.blockHints[blok.ad] ?? null)}
                    onMouseLeave={() => setHint(null)}
                    onFocus={() => setHint(labels.blockHints[blok.ad] ?? null)}
                    onBlur={() => setHint(null)}
                    onClick={() => {
                      if (bodyRef.current) blokYaz(bodyRef.current, locale === "en" ? blok.en : blok.tr, imlec.konum.current);
                    }}
                    className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-3 text-tiny font-semibold text-body transition-colors hover:border-primary-faint hover:bg-primary-tint hover:text-strong sm:min-h-7"
                  >
                    {blok.etiket}
                  </button>
                ))}
              </div>
              <p className="min-h-[2lh] text-tiny leading-relaxed text-muted sm:min-h-[1lh]">
                {hint ?? labels.blocksIdle}
              </p>
              <textarea
                id="topluluk-govde"
                aria-describedby="topluluk-govde-ipucu"
                ref={bodyRef}
                name="body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onSelect={(event) => {
                  imlec.kaydet(event);
                  takip();
                }}
                onKeyUp={imlec.kaydet}
                onClick={imlec.kaydet}
                rows={20}
                required
                spellCheck={false}
                aria-invalid={fieldError("body")}
                placeholder={labels.bodyPlaceholder}
                className={cn(FIELD, "min-h-[420px] font-mono text-[13px] leading-relaxed")}
              />
              <span id="topluluk-govde-ipucu" className="flex flex-col gap-0.5 text-tiny leading-relaxed text-muted">
                <span className="font-mono">{labels.markdownHint}</span>
                <span>{labels.bodyHint}</span>
              </span>
            </div>

            {/* Denetim listesi — gönderme şartları önceden, hairline üstünde. */}
            <div className="flex flex-col gap-1.5 border-t border-line-soft pt-4">
              <h3 className="text-small font-semibold text-strong">{labels.checklistTitle}</h3>
              <ul className="flex flex-col gap-1">
                {checks.map((check) => (
                  <li
                    key={check.text}
                    className={cn("flex items-center gap-2 text-small", check.ok ? "text-body" : "text-muted")}
                  >
                    {check.ok ? (
                      <CheckCircle weight="fill" size={15} className="shrink-0 text-up" aria-hidden />
                    ) : (
                      <Circle size={15} className="shrink-0 text-muted" aria-hidden />
                    )}
                    <span className="tabular-nums">{check.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {post?.status === "published" && (
              <p className="text-tiny leading-relaxed text-muted">{labels.publishedEditNote}</p>
            )}
          </div>
        </Panel>

        {/* ---- Sağ: önizleme — yayındaki çizimin kendisi. Bağlantılar ölü
            (data-editor-preview, useCikisKorumasi yakalıyor). Stil sınıfı
            içe aktarma AĞAÇTA KALMALI: çizim sunucudan geliyor, CSS'i bu
            bileşen getiriyor (StoryEditor'daki kayıt). Geniş ekranda
            yapışkan; gövde kendi içinde kayar ve imleci izler.
            Boyu eylem şeridine yer bırakır (25 Ekim): üst nefes 20 + şerit
            payı 128 (piyasa şeridi 37 + 12 + şerit 66 + 12). Önceki hâlde
            panelin dibi piyasa şeridinin 7 piksel altında kalıyordu
            (1280×800, ölçüldü: dip 770, şerit 763). ---- */}
        <Panel
          aria-label={labels.previewLabel}
          className={cn(
            "flex flex-col lg:sticky lg:top-[calc(var(--app-bar-h)+20px)] lg:max-h-[calc(100dvh-var(--app-bar-h)-148px)]",
            view === "write" && "max-lg:hidden",
          )}
        >
          {/* role=status YOK: 700 ms'de bir "Çiziliyor/Güncel" duyurusu
              ekran okuyucuda gevezelik olurdu; durum görsel künye. */}
          <PanelHeader title={labels.previewLabel} meta={previewStatus} />
          <div
            ref={previewRef}
            data-editor-preview
            data-preview-style={editorial.prose}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-6"
          >
            {/* Kapak: okuyucunun kartta ve sayfa başında göreceği üçlü. */}
            <header className="flex flex-col gap-3 border-b border-line-soft pb-5">
              <p
                className={cn(
                  "text-2xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere] [text-wrap:balance]",
                  title.trim() ? "text-strong" : "text-muted",
                )}
              >
                {title.trim() || labels.previewUntitled}
              </p>
              {dek.trim() && <p className="text-base leading-relaxed text-body [overflow-wrap:anywhere]">{dek}</p>}
              {symbolList.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {symbolList.map((symbol) => (
                    <li
                      key={symbol}
                      className="numeral rounded-full border border-line bg-surface-sunken px-2 py-0.5 text-tiny font-semibold text-body"
                    >
                      {symbol}
                    </li>
                  ))}
                </ul>
              )}
            </header>
            <div className="pt-5">
              {onizleme.preview ?? <p className="text-small text-muted">{labels.previewEmpty}</p>}
            </div>
          </div>
          <p className="border-t border-line-soft px-4 py-3 text-tiny leading-relaxed text-muted sm:px-6">
            {labels.previewHint}
          </p>
        </Panel>
      </div>

      {/* ---- Eylem şeridi — formun son çocuğu, dibine yapışık (gerekçe ve
          ölçüler PostEditor.module.css). Tek durum yuvası: kaydediliyor,
          hata, kaydedilmemiş değişiklik, kaydedildi. ---- */}
      <div
        role="region"
        aria-label={labels.actionsLabel}
        data-post-actions
        data-many={post ? "" : undefined}
        className={styles.bar}
      >
        <Button
          type="submit"
          aria-disabled={saving}
          onClick={(event) => {
            if (saving) event.preventDefault();
          }}
          className="aria-disabled:opacity-45"
        >
          <FloppyDisk weight="duotone" size={16} aria-hidden />
          {saving ? labels.saving : labels.save}
        </Button>
        {post && (post.status === "draft" || post.status === "rejected") && !kirli && (
          <Button type="submit" variant="ghost" formAction={submitPostAction} formNoValidate>
            <PaperPlaneTilt weight="duotone" size={15} aria-hidden />
            {labels.submitReview}
          </Button>
        )}
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
            title={labels.delete}
            className="text-down hover:text-down max-sm:w-11 max-sm:px-0"
          >
            <Trash weight="duotone" size={15} aria-hidden />
            <span className="max-sm:sr-only">{labels.delete}</span>
          </Button>
        )}
        <p
          role="status"
          className={cn(
            styles.status,
            durum.ton === "down" ? "font-semibold text-down" : durum.ton === "idle" ? "text-muted" : "text-body",
          )}
        >
          {/* Başarının işareti onay işareti ve her kayıtta yeniden yaylanır
              (`check-pop`, anahtar kaydın anı) — EylemSeridi'yle aynı dil. */}
          {durum.ton === "ok" ? (
            <Check key={state.at} weight="bold" size={14} aria-hidden className="check-pop shrink-0 text-up" />
          ) : (
            durum.ton !== "down" && <span aria-hidden className={styles.dot} data-tone={durum.ton} />
          )}
          <span className="min-w-0">{durum.metin}</span>
        </p>
        {post?.status === "published" && (
          <Link
            href={`/topluluk/${post.slug}`}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-0"
          >
            {labels.viewPublished}
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        )}
      </div>
    </form>
  );
}
