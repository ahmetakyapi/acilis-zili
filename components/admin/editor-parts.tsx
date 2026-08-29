"use client";

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  ArrowCounterClockwise,
  ClockCounterClockwise,
  Eye,
} from "@phosphor-icons/react/dist/ssr";
import type { EditorState, StoryRevision } from "@/app/actions/content";
import { cn } from "@/lib/utils";

/**
 * Panelin iki editörünün (mercek yazısı ve bülten) ortak parçaları.
 *
 * NEDEN AYRI DOSYA: iki editör aynı iskeleti taşıyor — durum şeridi, yapışkan
 * önizleme paneli, sürüm geçmişi, alan sarmalayıcısı. İkisi ayrı yazılsaydı
 * her düzeltme iki yerde yapılmak zorunda kalır ve ikisi er geç birbirinden
 * ayrı düşerdi; farkları GERÇEK olan yerler (hangi alanlar var, metin hangi
 * çiziciyle önizleniyor) editörlerin kendisinde kalıyor.
 */

/** Ortak girdi görünümü — iki editördeki bütün kutular bunu giyiyor. */
export const girdi =
  "w-full rounded-(--radius-md) border border-line bg-surface px-3 py-2.5 text-base text-strong outline-none transition-colors focus:border-line-focus";

export function Alan({
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

/** Kaydetme sonucunun şeridi — hata kırmızı zeminde, başarı yeşil. */
export function DurumSeridi({
  state,
  basarili,
}: {
  state: EditorState;
  basarili: string;
}) {
  if (!state.error && !state.ok) return null;
  return (
    <p
      role="status"
      className={cn(
        "rounded-(--radius-md) border px-4 py-3 text-base",
        state.error
          ? "border-down/40 bg-down-wash text-strong"
          : "border-up/40 bg-up-wash text-strong",
      )}
    >
      {state.error ?? basarili}
    </p>
  );
}

/**
 * Önizleme durumu — çizim SUNUCUDA yapılıyor, bu kanca yalnızca ne zaman
 * istendiğini yönetiyor.
 *
 * KENDİLİĞİNDEN TAZELENİYOR ama her tuş vuruşunda değil: çizim sunucuya
 * gidiyor ve yazarken saniyede birkaç tur atmak hem gereksiz hem de yazının
 * ortasında sürekli kıpırdayan bir panel demek. 700 ms sessizlik bekleniyor —
 * yazar durduğunda önizleme yetişiyor, yazarken ekran sabit kalıyor.
 * İlk çizim de buradan geliyor: "Önizle'ye bas" diyen boş bir kutu,
 * önizlemenin kendisi kadar iş yaptırıyordu.
 *
 * `ciz` SABİT OLMALI (server action referansı ya da `useCallback`): her
 * çizimde yeni bir işlev gelirse etki her render'da yeniden kurulur ve
 * zamanlayıcı hiç dolmaz.
 */
export function useOnizleme(
  body: string,
  ciz: (metin: string) => Promise<ReactNode>,
) {
  const [preview, setPreview] = useState<ReactNode>(null);
  const [previewOf, setPreviewOf] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();

  const onizle = useCallback(
    (metin: string) => {
      startPreview(async () => {
        const cizim = await ciz(metin);
        setPreview(cizim);
        setPreviewOf(metin);
      });
    },
    [ciz],
  );

  useEffect(() => {
    if (body === previewOf) return;
    const zamanlayici = window.setTimeout(() => onizle(body), 700);
    return () => window.clearTimeout(zamanlayici);
  }, [body, previewOf, onizle]);

  return {
    preview,
    previewing,
    guncel: body === previewOf,
    /** Metin değişti ama ekrandaki çizim eski taslağa ait. */
    bayat: preview !== null && previewOf !== body,
    onizle,
    unut: useCallback(() => {
      setPreview(null);
      setPreviewOf(null);
    }, []),
  };
}

/**
 * Yapışkan önizleme paneli.
 *
 * GENİŞ EKRANDA YAPIŞKAN: gövde yirmi küsur satır ve aşağı inildikçe
 * önizleme ekrandan çıkıyordu — yazarken bakılacak şey görünmüyorsa
 * önizleme değil, ikinci bir sayfa olur.
 */
export function OnizlemePaneli({
  preview,
  previewing,
  bayat,
  guncel,
  yenile,
}: {
  preview: ReactNode;
  previewing: boolean;
  bayat: boolean;
  guncel: boolean;
  yenile: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-6 xl:self-start">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small font-semibold text-strong">Önizleme</p>
        {/* Düğme bir GEREKLİLİK değil, bir kısayol: önizleme kendiliğinden
            tazeleniyor, bu yalnızca beklemeden görmek isteyene. Durum da
            burada okunuyor. */}
        <button
          type="button"
          onClick={yenile}
          disabled={previewing || guncel}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) border border-line bg-surface px-3.5 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong disabled:opacity-50 sm:min-h-9"
        >
          <Eye weight="duotone" size={16} />
          {previewing ? "Çiziliyor…" : bayat ? "Şimdi Yenile" : "Güncel"}
        </button>
      </div>

      {/* Bayat önizleme SÖYLENİYOR: metin değişti ama ekrandaki çizim eski
          taslağa ait. Sessiz kalsa okuyucu düzeltmesinin işe yaramadığını
          sanırdı. */}
      {bayat && !previewing && (
        <p className="rounded-(--radius-md) border border-line bg-surface-elevated px-3 py-2 text-tiny text-muted">
          Yazmayı bırakınca önizleme kendiliğinden tazelenir.
        </p>
      )}

      <div className="min-h-64 rounded-(--radius-lg) border border-line bg-surface-solid p-4 sm:p-5">
        {preview ?? (
          <p className="py-10 text-center text-base text-muted">
            Önizleme hazırlanıyor…
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Sürüm geçmişi.
 *
 * GERİ YÜKLEME AYNI FORMUN İÇİNDEN BAŞKA BİR EYLEME gidiyor (`formAction`):
 * ayrı bir `<form>` açmak iç içe form demekti, ana forma ikinci bir submit
 * düğmesi koymak da Enter'a basıldığında hangisinin çalışacağını belirsiz
 * bırakırdı. Geri yükleme gövdeyi DEĞİL sürüm kimliğini yolluyor.
 */
export function SurumGecmisi({
  revisions,
  restoreAction,
  restoring,
  restoreState,
}: {
  revisions: StoryRevision[];
  restoreAction: (formData: FormData) => void;
  restoring: boolean;
  restoreState: EditorState;
}) {
  const [acik, setAcik] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        className="inline-flex min-h-11 w-fit items-center gap-2 text-base font-semibold text-strong transition-colors hover:text-primary sm:min-h-9"
      >
        <ClockCounterClockwise weight="duotone" size={17} />
        Sürüm Geçmişi
        <span className="numeral rounded-full bg-surface-elevated px-2 py-0.5 text-tiny font-bold text-muted">
          {revisions.length}
        </span>
      </button>

      {acik &&
        (revisions.length === 0 ? (
          <p className="text-small text-muted">
            Bu metnin önceki bir hâli kaydedilmemiş. Geçmiş, ilk üzerine
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
  );
}
