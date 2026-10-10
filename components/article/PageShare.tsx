import { ShareButton } from "@/components/article/ShareButton";
import type { Dictionary, Locale } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/site";

/**
 * EKRANIN PAYLAŞ DÜĞMESİ (30 Eylül, sahibinin isteği: "böyle ekranlara hep
 * paylaş ekleyelim, arkadaşıma göndereceğim").
 *
 * `ShareButton` yazılar için kurulmuştu ve her çağrı yeri adresi, etiketi
 * ve paneli ayrı ayrı kuruyordu. Ekranlar çoğaldıkça aynı üç satır her
 * sayfaya kopyalanacaktı; burada tek yerde: yol dilin canonical adresine
 * çevriliyor (`absoluteUrl` — `?sembol=` gibi süzgeç kalıntısı taşımaz),
 * panel başlığı "Bu Sayfayı Paylaş". Yazılar kendi başlıklarını
 * ("Bu Yazıyı Paylaş") doğrudan `ShareButton` ile vermeye devam ediyor.
 *
 * YERİ HER EKRANDA AYNI: kapağın açıklama cümlesinden sonra, sola yaslı.
 * Panel de o yüzden sola açılıyor.
 * 10 Ekim: dizin kapaklarında sahibinin tercihi başlığın sağı; bu kullanım
 * `compactOnMobile` + `align="right"` ile telefonda 44px ikon hedefi sunar.
 * Önceki detay kapaklarının açıklama altı yerleşimi varsayılan kalır.
 */
export function PageShare({
  path,
  title,
  locale,
  t,
  className,
  compact,
  compactOnMobile = false,
  align = "left",
}: {
  /** Dil öneksiz yol — "/yatirimcilar/warren-buffett". */
  path: string;
  /** Paylaşım metnindeki kısa başlık. */
  title: string;
  locale: Locale;
  t: Dictionary;
  className?: string;
  /** Simge biçimi — hisse başlığındaki kalbin yanı. */
  compact?: boolean;
  /** Dar başlık satırında yalnız ikon, geniş ekranda ikon ve metin. */
  compactOnMobile?: boolean;
  align?: "left" | "right";
}) {
  return (
    <ShareButton
      url={absoluteUrl(path, locale)}
      title={title}
      labels={{ ...t.share, title: t.share.pageTitle }}
      align={align}
      compact={compact}
      compactOnMobile={compactOnMobile}
      className={className}
    />
  );
}
