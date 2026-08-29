"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  FloppyDisk,
} from "@phosphor-icons/react/dist/ssr";
import {
  restoreStoryRevision,
  saveStoryFromAdmin,
  type EditorState,
  type StoryRevision,
} from "@/app/actions/content";
import { previewStoryBody } from "@/app/actions/content-preview";
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
 * Mercek yazısı editörü.
 *
 * ÖNİZLEME SUNUCUDAN GELİYOR ve kendiliğinden tazeleniyor: taslak metin bir
 * sunucu eylemine gidiyor, eylem `ArticleBody`yi SUNUCUDA çizip JSX
 * döndürüyor; istemciye yalnızca çizilmiş yük iniyor. Gerekçesi
 * `content-preview.tsx`te: markdown çözümleyicisini panele indirmek ~30KB ve
 * ikinci bir çizici yazmak iki farklı markdown yorumu demekti. Böylece
 * önizleme, yayındaki çizimin KENDİSİ — bir `:::` bloğu burada nasıl
 * görünüyorsa sitede de öyle. Tazeleme ölçüsü `useOnizleme` içinde.
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
  {
    ad: "sayilar",
    ornek: "::: sayilar Rakamlarla\n- 4,2 Mr $ | Toplam tutar\n:::",
  },
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
  const [state, formAction, pending] = useActionState(saveStoryFromAdmin, BOS);

  const [restoreState, restoreAction, restoring] = useActionState(
    restoreStoryRevision,
    BOS,
  );

  const [body, setBody] = useState(draft.bodyMd);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const ciz = useCallback(
    (metin: string) => previewStoryBody(metin, draft.locale),
    [draft.locale],
  );
  const onizleme = useOnizleme(body, ciz);

  /* YÜKLENDİĞİ HÂLE DÖN. Kaydetmeden önce yapılan her değişikliği geri alan
     en ucuz yol: sayfa açıldığında gelen taslak zaten elimizde. Sunucuya
     gitmiyor, bir şey silmiyor — yalnızca formu başladığı yere koyuyor. */
  const kirli = body !== draft.bodyMd;
  const sifirla = () => {
    setBody(draft.bodyMd);
    onizleme.unut();
  };

  /* Blok kısayolu imlecin OLDUĞU YERE yazıyor, metnin sonuna değil: yazar
     bir bloğu paragrafın arasına koymak istiyor ve sona eklenen bir blok
     her seferinde elle taşınmak zorunda kalırdı. */
  const blokEkle = (ornek: string) => {
    const el = bodyRef.current;
    const metin = body;
    const konum = el ? el.selectionStart : metin.length;
    const ayrac = konum > 0 && metin[konum - 1] !== "\n" ? "\n\n" : "";
    const yeni =
      metin.slice(0, konum) + ayrac + ornek + "\n" + metin.slice(konum);
    setBody(yeni);
    queueMicrotask(() => {
      el?.focus();
      const imlec = konum + ayrac.length + ornek.length + 1;
      el?.setSelectionRange(imlec, imlec);
    });
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={draft.slug} />
      <input type="hidden" name="locale" value={draft.locale} />

      <DurumSeridi
        state={state}
        basarili="Kaydedildi. Yayındaki sayfa tazelendi."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ================= Yazı alanları ================= */}
        {/* SIRA İŞE GÖRE: başlık, giriş, sonra GÖVDE. Gövde bir dönem beş
            alanın altındaydı ve editörün asıl işi olduğu hâlde ekranın
            dışında başlıyordu — tarih ve kaynak gibi nadiren dokunulan
            alanlar, her açılışta üzerinden atlanan bir engel oluyordu.
            Künye alanları artık gövdenin ALTINDA. */}
        <div className="flex flex-col gap-5">
          <Alan
            label="Başlık"
            hata={state.fieldErrors?.title}
            hint="Sayfanın H1'i ve listedeki kart başlığı."
          >
            <input
              name="title"
              defaultValue={draft.title}
              maxLength={160}
              className={cn(girdi, "text-lead font-semibold")}
            />
          </Alan>

          <Alan
            label="Giriş Cümlesi"
            hata={state.fieldErrors?.dek}
            hint="Başlığın altındaki tek cümle; listede de bu görünüyor."
          >
            {/* Dört satır: iki satırda metin ortadan kesiliyordu ve giriş
                cümlesi tam olarak okunması gereken yer. */}
            <textarea
              name="dek"
              defaultValue={draft.dek}
              rows={4}
              maxLength={400}
              className={cn(girdi, "resize-y leading-relaxed")}
            />
          </Alan>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-small font-semibold text-strong">
                Gövde
              </span>
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

            {/* BLOK ÇUBUĞU SARIYOR, KAYMIYOR. Kayan şeritte son çipler
                sağdan kırpılıyordu ve kırpılmış bir düğme, var olmayan bir
                düğmedir. */}
            <div className="flex flex-wrap gap-1.5">
              {BLOKLAR.map((blok) => (
                <button
                  key={blok.ad}
                  type="button"
                  onClick={() => blokEkle(blok.ornek)}
                  title={`::: ${blok.ad} bloğu ekle`}
                  className="numeral inline-flex min-h-8 items-center rounded-full border border-line bg-surface px-2.5 text-tiny font-semibold text-body transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary"
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
              rows={26}
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

          {/* KÜNYE ALANLARI GÖVDENİN ALTINDA ve kendi kutusunda: tarih,
              sembol ve kaynak nadiren değişiyor, ama değiştiğinde bir arada
              bulunmaları gerekiyor. */}
          <div className="flex flex-col gap-4 rounded-(--radius-lg) border border-line bg-surface-elevated p-4">
            <p className="text-small font-semibold text-strong">Künye</p>
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
              {/* Altı satır: adresler uzun ve üç satırda liste ortadan
                  kesiliyordu. */}
              <textarea
                name="sources"
                defaultValue={draft.sources
                  .map((s) => (s.url ? `${s.label} | ${s.url}` : s.label))
                  .join("\n")}
                rows={6}
                className={cn(
                  girdi,
                  "resize-y font-mono text-small leading-relaxed",
                )}
              />
            </Alan>
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

      <SurumGecmisi
        revisions={revisions}
        restoreAction={restoreAction}
        restoring={restoring}
        restoreState={restoreState}
      />
    </form>
  );
}
