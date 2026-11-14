import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { VerdictPill } from "@/components/ui/VerdictPill";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, type VerdictKey } from "@/lib/analysis";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { MarketStatus } from "@/lib/market-hours";
import type { Quote } from "@/lib/providers/types";
import { technicalHref } from "@/lib/technical";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import styles from "./MoreSymbols.module.css";

export type MoreSymbolEntry = {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  /** Son yayının görüşü; henüz analizi yoksa null. */
  verdict: VerdictKey | null;
  changePct: number | null;
};

/**
 * Detay sayfasının çıkışı: öteki şirketler.
 *
 * Sayfanın sonunda okuyucunun elinde tek bir hissenin görüşü var ve gidecek
 * yeri yoktu — dipnottaki "Bütün Hisseler" bağlantısı onu LİSTEYE, yani bir
 * ara durağa gönderiyordu. Oysa liste on iki karttan ibaret; o kartların
 * kendisi buraya sığıyor. Okuyucu MRVL'yi bitirince NVDA'ya tek dokunuşla
 * geçiyor, geriye dönüp listeyi bulmak zorunda kalmıyor.
 *
 * Kartta üç şey var ve üçü de "bir sonrakine geçmeli miyim" sorusunun
 * cevabı: kim (logo + ad), ne diyor (görüş rozeti), bugün ne yapıyor
 * (değişim). Seviyeler ve metin kasten yok — onlar kendi sayfasının işi,
 * burada olsalardı kart listedeki kartın kopyası olurdu.
 *
 * Analizi henüz olmayan sembol de basılıyor, rozetsiz: liste TECHNICAL_SYMBOLS
 * ve o listenin tamamı okuyucunun gidebileceği yer. Rozetin yokluğu zaten
 * "bu hissede henüz yayın yok" diyor.
 *
 * KART IZGARASINDAN SIKI SATIR LİSTESİNE (14 Kasım 2026, görsel tur). On beş
 * kart `auto-fill` ızgarada 1440'ta altı sütuna diziliyor, son satır üç
 * kartta kalıp sağ yarıyı boş bırakıyordu; 178 piksellik kartta şirket adı
 * iki-üç satıra kırılıyor, hap ile yüzde arasında ad kadar boşluk açılıyordu
 * (kartlar en uzun ada göre geriliyor). Bu bölüm sayfanın ÇIKIŞI, yani
 * ikincil içerik: kutulu panel ve on beş küçük kutu yerine açık bölüm
 * (üstte kıl çizgi, bölüm başlığı) ve tek satırlık kayıtlar: logo, sembol
 * ve tek satırda kesilen ad, görüş hapı, değişim. Üç bilgi aynı ("kim, ne
 * diyor, bugün ne yapıyor"); hap ve yüzde artık kolon boyunca tek hatta.
 * Ölçüm (15 şirket; önce canlı): 1440'ta 3 kolon × 5 satır, artık yok,
 * bölüm 470 → 342 piksel; 390'da 2 sütun kart × 8 satır 1.068 → tek kolon
 * 15 satır 860 piksel, satır 52 piksel (dokunma hedefi ≥ 44), ad kesilmesi
 * yalnız `text-overflow` ile. Satırın hover zemini 8 piksel dışa taşar
 * (eksi kenar payı); sayfa taşması 390 ve 360'ta 0.
 */
export function MoreSymbols({
  entries,
  cards,
  locale,
  t,
}: {
  entries: readonly MoreSymbolEntry[];
  /** Şirket kartı — sayfanın kendi paketi (kartın yüzdesi karttakiyle aynı). */
  cards: { quotes: Record<string, Quote> | null; stale: boolean; names: Record<string, SymbolMeta>; status: MarketStatus };
  locale: Locale;
  t: Dictionary;
}) {
  if (entries.length === 0) return null;

  return (
    <section id="technical-more" className={styles.root}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t.technical.moreSymbols}</h2>
        <Link href="/teknik-analiz" className={cn("tap-44", styles.all)}>
          {t.technical.allStocks} ↗
        </Link>
      </div>
      <CompanyCards symbols={entries.map((entry) => entry.symbol)} {...cards} />
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.symbol} className={styles.item}>
            <Link
              href={technicalHref(entry.symbol)}
              prefetch={false}
              className={styles.row}
              data-cc={entry.symbol}
            >
              <LogoTile symbol={entry.symbol} logoUrl={entry.logoUrl} size="md" />
              <span className={styles.identity}>
                <strong className="numeral">{entry.symbol}</strong>
                <span>{entry.name ?? entry.symbol}</span>
              </span>
              {entry.verdict ? (
                <VerdictPill verdict={entry.verdict} label={verdictLabel(entry.verdict, t)} size="xs" />
              ) : (
                <span className={styles.soon}>{t.technical.noEditionYet}</span>
              )}
              <span className={cn("numeral", styles.change, entry.changePct !== null ? directionText(directionOf(entry.changePct)) : undefined)}>
                {entry.changePct !== null ? formatPercent(entry.changePct, locale) : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
