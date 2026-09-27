import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";

export type DataExportLabels = {
  title: string;
  hint: string;
  json: string;
  csv: string;
};

/** İki biçimin adresi — uç `app/api/hesap/verilerim/route.ts`. */
const EXPORT_HREF = {
  json: "/api/hesap/verilerim?bicim=json",
  csv: "/api/hesap/verilerim?bicim=csv",
} as const;

const LINK_CLASS =
  "inline-flex min-h-11 w-fit items-center gap-2 text-base font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-10";

/**
 * Verilerimi İndir — Ayarlar → Verilerin paneli (28 Eylül).
 *
 * KVKK veri taşınabilirliği; içerik ve gerekçe lib/account-export-format.ts.
 * KVKK bağlantısının ALTINDA, ayrı bir panelde değil: ikisi de "verilerin"
 * sorusunun cevabı, biri metni biri verinin kendisini veriyor. Başlık h3 —
 * panelin h2'si "Verilerin".
 *
 * Bağlantılar düz `<a>`: `LocaleLink` İngilizce okuyucuda `/en` öneki
 * ekliyor ve API yolları öneksiz (proxy `api/`e dokunmuyor). `download`
 * dosyayı sayfadan ayrılmadan indiriyor; dosya adı yanıtın kendi
 * `Content-Disposition` başlığından geliyor. Sunucu bileşeni: etkileşim
 * yok, istemciye kod inmiyor.
 */
export function DataExportLinks({ labels }: { labels: DataExportLabels }) {
  return (
    <div className="mt-1 flex flex-col gap-2 border-t border-line-soft pt-3">
      <h3 className="text-base font-semibold text-strong">{labels.title}</h3>
      <p className="text-small leading-relaxed text-body">{labels.hint}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <a href={EXPORT_HREF.json} download className={LINK_CLASS}>
          <DownloadSimple weight="duotone" size={16} aria-hidden />
          {labels.json}
        </a>
        <a href={EXPORT_HREF.csv} download className={LINK_CLASS}>
          <DownloadSimple weight="duotone" size={16} aria-hidden />
          {labels.csv}
        </a>
      </div>
    </div>
  );
}
