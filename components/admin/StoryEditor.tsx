"use client";

import {
  useActionState,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  ClockCounterClockwise,
  Eye,
  FloppyDisk,
} from "@phosphor-icons/react/dist/ssr";
import {
  restoreStoryRevision,
  saveStoryFromAdmin,
  type EditorState,
  type StoryRevision,
} from "@/app/actions/content";
import { previewStoryBody } from "@/app/actions/content-preview";
import { cn } from "@/lib/utils";

/**
 * Mercek yazısı editörü.
 *
 * ÖNİZLEME SUNUCUDAN GELİYOR. Buton, taslak metni bir sunucu eylemine
 * yolluyor ve eylem `ArticleBody`yi SUNUCUDA çizip JSX döndürüyor; istemciye
 * yalnızca çizilmiş yük iniyor. Gerekçesi `content-preview.tsx`te: markdown
 * çözümleyicisini panele indirmek ~30KB ve ikinci bir çizici yazmak iki
 * farklı markdown yorumu demekti. Böylece önizleme, yayındaki çizimin
 * KENDİSİ — bir `:::` bloğu burada nasıl görünüyorsa sitede de öyle.
 *
 * ÖNİZLEME OTOMATİK TAZELENMİYOR, düğmeyle. Her tuş vuruşunda sunucuya
 * gitmek uzun bir metinde saniyede birkaç tur demek; yazarken beklemek de
 * istemiyoruz. Düğme metnin değiştiğini biliyor ve bunu söylüyor.
 *
 * SLUG DÜZENLENMİYOR. Panelin işi var olan yazıyı düzeltmek; yeni yazı
 * rutinin işi. Slug'ı serbest bırakmak yanlışlıkla ikinci bir kayıt açmanın
 * en kolay yolu olurdu — alan gizli ve salt okunur olarak gösteriliyor.
 */

export type StoryDraft = {
  slug: string;
  locale: string;
  title: string;
  dek: string;
  bodyMd: string;
  eventDate: string;
  symbols: string[];
  sources: { label: string; url?: string }[];
  readMinutes: number;
  updatedAt: string | null;
};

const BOS: EditorState = {};

/**
 * `:::` blok ailesi — yazının görsel dili metinden çiziliyor, yani bu
 * kısayollar süs değil, editörün asıl işi. Sözdizimi
 * `docs/claude-rutinler.md` § 3'te; yeni blok eklenirse ORASI da güncellenir.
 */
const BLOKLAR = [
  { ad: "sayilar", ornek: "::: sayilar Rakamlarla\n- 4,2 Mr $ | Toplam tutar\n:::" },
  { ad: "bar", ornek: "::: bar Karşılaştırma\n- Etiket | 58,4\n:::" },
  { ad: "pay", ornek: "::: pay Pazar Payı\n- Şirket | 42\n:::" },
  { ad: "akis", ornek: "::: akis Zincir\n- Adım\n:::" },
  { ad: "zaman", ornek: "::: zaman Kronoloji\n- 12 Ağustos | Olay\n:::" },
  { ad: "grafik", ornek: "::: grafik NVDA | 3M | Açıklama\n:::" },
  { ad: "ornek", ornek: "::: ornek Hesap\n**Adım:** açıklama\n:::" },
  { ad: "dikkat", ornek: "::: dikkat Uyarı\nMetin\n:::" },
  { ad: "ozet", ornek: "::: ozet Ders\nMetin\n:::" },
  { ad: "tanim", ornek: "::: tanim Terim\n**Terim:** açıklama\n:::" },
] as const;

export function StoryEditor({
  draft,
  revisions,
}: {
  draft: StoryDraft;
  revisions: StoryRevision[];
}) {
  const [state, formAction, pending] = useActionState(
    saveStoryFromAdmin,
    BOS,
  );

  const [restoreState, restoreAction, restoring] = useActionState(
    restoreStoryRevision,
    BOS,
  );

  const [body, setBody] = useState(draft.bodyMd);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [gecmisAcik, setGecmisAcik] = useState(false);

  /* YÜKLENDİĞİ HÂLE DÖN. Kaydetmeden önce yapılan her değişikliği geri alan
     en ucuz yol: sayfa açıldığında gelen taslak zaten elimizde. Sunucuya
     gitmiyor, bir şey silmiyor — yalnızca formu başladığı yere koyuyor. */
  const kirli = body !== draft.bodyMd;
  const sifirla = () => {
    setBody(draft.bodyMd);
    setPreview(null);
    setPreviewOf(null);
  };

  /* Blok kısayolu imlecin OLDUĞU YERE yazıyor, metnin sonuna değil: yazar
     bir bloğu paragrafın arasına koymak istiyor ve sona eklenen bir blok
     her seferinde elle taşınmak zorunda kalırdı. */
  const blokEkle = (ornek: string) => {
    const el = bodyRef.current;
    const metin = body;
    const konum = el ? el.selectionStart : metin.length;
    const ayrac = konum > 0 && metin[konum - 1] !== "\n" ? "\n\n" : "";
    const yeni = metin.slice(0, konum) + ayrac + ornek + "\n" + metin.slice(konum);
    setBody(yeni);
    queueMicrotask(() => {
      el?.focus();
      const imlec = konum + ayrac.length + ornek.length + 1;
      el?.setSelectionRange(imlec, imlec);
    });
  };
  const [preview, setPreview] = useState<ReactNode>(null);
  const [previewOf, setPreviewOf] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();

  const stale = preview !== null && previewOf !== body;

  const onizle = () => {
    const anlik = body;
    startPreview(async () => {
      const cizim = await previewStoryBody(anlik, draft.locale);
      setPreview(cizim);
      setPreviewOf(anlik);
    });
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={draft.slug} />
      <input type="hidden" name="locale" value={draft.locale} />

      {/* ---- Durum şeridi ---- */}
      {(state.error || state.ok) && (
        <p
          role="status"
          className={cn(
            "rounded-(--radius-md) border px-4 py-3 text-base",
            state.error
              ? "border-down/40 bg-down-wash text-strong"
              : "border-up/40 bg-up-wash text-strong",
          )}
        >
          {state.error ?? "Kaydedildi. Yayındaki sayfa tazelendi."}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ================= Yazı alanları ================= */}
        <div className="flex flex-col gap-4">
          <Alan
            label="Başlık"
            hata={state.fieldErrors?.title}
            hint="Sayfanın H1'i ve listedeki kart başlığı."
          >
            <input
              name="title"
              defaultValue={draft.title}
              maxLength={160}
              className={girdi}
            />
          </Alan>

          <Alan
            label="Giriş Cümlesi"
            hata={state.fieldErrors?.dek}
            hint="Başlığın altındaki tek cümle; listede de bu görünüyor."
          >
            <textarea
              name="dek"
              defaultValue={draft.dek}
              rows={2}
              maxLength={400}
              className={cn(girdi, "resize-y leading-relaxed")}
            />
          </Alan>

          <div className="grid gap-4 sm:grid-cols-2">
            <Alan
              label="Olay Tarihi"
              hata={state.fieldErrors?.event_date}
              hint="Olayın yaşandığı gün (ET)."
            >
              <input
                type="date"
                name="event_date"
                defaultValue={draft.eventDate}
                className={cn(girdi, "numeral")}
              />
            </Alan>
            <Alan
              label="Semboller"
              hata={state.fieldErrors?.symbols}
              hint="Virgülle ayır: NVDA, MU"
            >
              <input
                name="symbols"
                defaultValue={draft.symbols.join(", ")}
                className={cn(girdi, "numeral")}
              />
            </Alan>
          </div>

          <Alan
            label="Kaynaklar"
            hata={state.fieldErrors?.sources}
            hint="Her satıra bir kaynak — Etiket | https://adres"
          >
            <textarea
              name="sources"
              defaultValue={draft.sources
                .map((s) => (s.url ? `${s.label} | ${s.url}` : s.label))
                .join("\n")}
              rows={3}
              className={cn(girdi, "resize-y font-mono text-small")}
            />
          </Alan>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-small font-semibold text-strong">Gövde</span>
              {/* YÜKLENDİĞİ HÂLE DÖN yalnızca değişiklik varken çiziliyor:
                  hiçbir şey değişmemişken duran bir "geri al" düğmesi, ne
                  yapacağı belirsiz bir düğmedir. */}
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

            {/* BLOK ÇUBUĞU. Yazının görseli metinden çiziliyor — `:::`
                blokları bu editörün asıl işi ve sözdizimini ezberden yazmak
                zorunda kalmak, aracı kullanılmaz yapardı. Kısayol imlecin
                olduğu yere örneği bırakıyor, yazar üstüne yazıyor. */}
            <div className="scroll-x -mx-1 flex gap-1.5 px-1 pb-1">
              {BLOKLAR.map((blok) => (
                <button
                  key={blok.ad}
                  type="button"
                  onClick={() => blokEkle(blok.ornek)}
                  title={`::: ${blok.ad} bloğu ekle`}
                  className="numeral inline-flex min-h-8 shrink-0 items-center rounded-full border border-line bg-surface px-2.5 text-tiny font-semibold text-body transition-colors hover:border-primary hover:text-primary"
                >
                  {blok.ad}
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
                  Markdown · yukarıdaki çipler `:::` bloğu ekler
                </span>
              )}
              <span className="numeral text-tiny text-muted">
                {body.trim().length.toLocaleString("tr-TR")} Karakter ·{" "}
                {Math.max(1, Math.round(body.trim().split(/\s+/).length / 160))}{" "}
                Dakikalık Okuma
              </span>
            </div>
          </div>
        </div>

        {/* ================= Önizleme ================= */}
        {/* Önizleme geniş ekranda YAPIŞKAN: gövde yirmi dört satır ve
            aşağı inildikçe önizleme ekrandan çıkıyordu — yazarken bakılacak
            şey görünmüyorsa önizleme değil, ikinci bir sayfa olur. */}
        <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-6 xl:self-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-small font-semibold text-strong">Önizleme</p>
            <button
              type="button"
              onClick={onizle}
              disabled={previewing}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) border border-line bg-surface px-3.5 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong disabled:opacity-60 sm:min-h-9"
            >
              <Eye weight="duotone" size={16} />
              {previewing
                ? "Çiziliyor…"
                : preview === null
                  ? "Önizle"
                  : "Yenile"}
            </button>
          </div>

          {/* Bayat önizleme SÖYLENİYOR: metin değişti ama ekrandaki çizim
              eski taslağa ait. Sessiz kalsa okuyucu düzeltmesinin işe
              yaramadığını sanırdı. */}
          {stale && (
            <p className="rounded-(--radius-md) border border-line bg-surface-elevated px-3 py-2 text-tiny text-muted">
              Gövde değişti — önizleme bir önceki hâli gösteriyor.
            </p>
          )}

          <div className="min-h-64 rounded-(--radius-lg) border border-line bg-surface-solid p-4 sm:p-5">
            {preview ?? (
              <p className="py-10 text-center text-base text-muted">
                Gövdenin sitede nasıl görüneceğini görmek için Önizle&apos;ye
                bas. Çizim sunucuda, yayındaki bileşenle yapılıyor.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ---- Eylem şeridi ---- */}
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
          href={`/mercek/${draft.slug}`}
          target="_blank"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) border border-line bg-surface px-4 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:min-h-10"
        >
          <ArrowSquareOut weight="duotone" size={16} />
          Yayındaki Hâli
        </Link>
        {/* Geçmiş VAR artık, o yüzden cümle de değişti: kaydetmek üzerine
            yazıyor ama önceki hâl saklanıyor ve aşağıdan geri alınabiliyor. */}
        <p className="text-tiny text-muted">
          Kaydetmek yayındaki metnin üzerine yazar; önceki hâli sürüm
          geçmişine düşer.
        </p>
      </div>

      {/* ================= Sürüm geçmişi ================= */}
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setGecmisAcik((a) => !a)}
          aria-expanded={gecmisAcik}
          className="inline-flex min-h-11 w-fit items-center gap-2 text-base font-semibold text-strong transition-colors hover:text-primary sm:min-h-9"
        >
          <ClockCounterClockwise weight="duotone" size={17} />
          Sürüm Geçmişi
          <span className="numeral rounded-full bg-surface-elevated px-2 py-0.5 text-tiny font-bold text-muted">
            {revisions.length}
          </span>
        </button>

        {gecmisAcik &&
          (revisions.length === 0 ? (
            <p className="text-small text-muted">
              Bu yazının önceki bir hâli kaydedilmemiş. Geçmiş, ilk üzerine
              yazmadan sonra birikmeye başlar.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {revisions.map((rev) => (
                <li
                  key={rev.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base text-strong">
                      {rev.title}
                    </span>
                    <span className="numeral block text-tiny text-muted">
                      {new Date(rev.replacedAt).toLocaleString("tr-TR")} ·{" "}
                      {rev.length.toLocaleString("tr-TR")} Karakter ·{" "}
                      {rev.replacedBy === "admin"
                        ? "Panelden Yazıldı"
                        : "Rutin Yazdı"}
                    </span>
                  </span>
                  {/* GERİ YÜKLEME AYRI BİR FORM: ana formun içinde ikinci bir
                      submit düğmesi, Enter'a basıldığında hangisinin
                      çalışacağını belirsiz bırakırdı. `formAction` ile aynı
                      formdan başka bir eyleme gitmek de gövdeyi taşırdı;
                      geri yükleme gövdeyi DEĞİL sürüm kimliğini yolluyor. */}
                  <button
                    type="submit"
                    name="revisionId"
                    value={rev.id}
                    formAction={restoreAction}
                    disabled={restoring}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-(--radius-md) border border-line bg-surface px-3.5 text-base font-semibold text-body transition-colors hover:border-primary hover:text-primary disabled:opacity-60 sm:min-h-9"
                  >
                    <ArrowCounterClockwise weight="bold" size={15} />
                    Bu Hâle Dön
                  </button>
                </li>
              ))}
            </ul>
          ))}

        {restoreState.error && (
          <p role="status" className="text-small font-semibold text-down">
            {restoreState.error}
          </p>
        )}
        {restoreState.ok && (
          <p role="status" className="text-small font-semibold text-up">
            Geri yüklendi. Sayfayı yenile — form hâlâ eski taslağı gösteriyor.
          </p>
        )}
      </div>
    </form>
  );
}

const girdi =
  "w-full rounded-(--radius-md) border border-line bg-surface px-3 py-2.5 text-base text-strong outline-none transition-colors focus:border-line-focus";

function Alan({
  label,
  hint,
  hata,
  children,
}: {
  label: string;
  hint?: string;
  hata?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-small font-semibold text-strong">{label}</span>
      {children}
      {/* Hata varsa ipucunun YERİNE geçiyor: ikisi alt alta durunca hangisinin
          okunacağı belirsizdi ve hata gri bir cümlenin altında kayboluyordu. */}
      {hata ? (
        <span className="text-tiny font-semibold text-down">{hata}</span>
      ) : hint ? (
        <span className="text-tiny text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
