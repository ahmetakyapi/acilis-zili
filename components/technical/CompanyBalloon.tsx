import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, verdictPillClass, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatMoneyCompact, formatPercent, formatPrice } from "@/lib/utils";
import styles from "./CompanyBalloon.module.css";

/**
 * Şirket balonu — dağılım logolarının üstünde açılan kimlik okuması.
 *
 * SİTEDE TEK BALON VAR ve dağılım logolarında. 22 Eylül'e kadar /teknik
 * kartlarının başlığında açılıyordu; kart kimliği (sembol, ad, görüş,
 * fiyat) zaten kendisi gösteriyor, balon aynı bilgiyi ikinci kez veriyordu.
 * Logo ise yalnızca bir resim: okuyucu hangi hissenin nerede olduğunu
 * ararken balon ona adı, sektörü ve fiyatı veriyor.
 *
 * SUNUCUDA ÇİZİLİYOR (`"use client"` YOK). Sektör 71 KB'lık endeks
 * tohumundan geliyor (`companySector`, server-only); bileşen istemcide
 * çizilseydi ya tohum tarayıcıya inerdi ya da sektör ayrı bir prop
 * yolculuğu isterdi. `PulseCompanyLink` bunu hazır bir `ReactNode` olarak
 * alıp yalnızca konumlandırıyor. Bedeli ölçüldü ve kabul edildi: on beş
 * balonun hazır işaretlemesi RSC yüküyle dokunmatik ekranlara da iniyor ve
 * sayfa başına ~1,6-2,0 KB gzip tutuyor (/ 1.981 B, /teknik 1.602 B, 22
 * Eylül); düz bir veri prop'u + istemci görünümü sektör ve biçim
 * mantığını sunucuda tutardı ama iki dosyaya bölünmüş bir sözleşme
 * getirirdi, bu kadar küçük bir kazanç için tek sunucu bileşeni daha sade.
 *
 * EYLEM DÜĞMESİ YOK. Balon `pointer-events:none` — bir hedef değil, bir
 * okuma; içinde "Analizi Oku" gibi bir bağlantı tıklanamaz ama tıklanır
 * gibi dururdu. Bağlantı logonun kendisi. Trend/RSI çipleri de yok: hemen
 * alttaki kartlar onları zaten taşıyor.
 */
export function CompanyBalloon({
  symbol,
  name,
  logoUrl,
  verdict,
  sector,
  marketCap,
  currency,
  price,
  changePct,
  priceLabel,
  foot,
  locale,
  t,
}: {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  /** `pending`: takipte ama güncel yayını yok — nötr hap. */
  verdict: VerdictKey | "pending";
  sector: string | null;
  marketCap: number | null;
  currency: string | null;
  price: number | null;
  changePct: number | null;
  priceLabel: string;
  /** Alt künye: yayın damgası ya da bekleyenin cümlesi. */
  foot: string;
  locale: Locale;
  t: Dictionary;
}) {
  /* Satır YOKSA BASILMIYOR, tire konmuyor: sektörü bilinmeyen ya da
     piyasa değeri karşılaştırılamayan (dolar dışı, ör. TSM) bir şirkette
     boş bir "—" okuyucuya bir şey söylemiyor, yalnızca yer kaplıyor. */
  const facts = sector !== null || marketCap !== null || price !== null;
  return (
    <div className={styles.body}>
      <div className={styles.head}>
        <LogoTile symbol={symbol} logoUrl={logoUrl} size="sm" />
        <span className={styles.who}>
          <strong className="numeral">{symbol}</strong>
          {name && name !== symbol && <span>{name}</span>}
        </span>
        <span
          className={cn(
            styles.pill,
            verdict === "pending" ? "bg-surface-sunken text-muted" : verdictPillClass(verdict),
          )}
        >
          {verdict === "pending" ? t.technical.pendingLabel : verdictLabel(verdict, t)}
        </span>
      </div>

      {facts && (
        <dl className={styles.facts}>
          {sector !== null && (
            <div>
              <dt>{t.companies.sector}</dt>
              <dd>{sector}</dd>
            </div>
          )}
          {marketCap !== null && (
            <div>
              <dt>{t.market.marketCap}</dt>
              <dd className="numeral">{formatMoneyCompact(marketCap, locale, currency)}</dd>
            </div>
          )}
          {price !== null && (
            <div>
              <dt>{priceLabel}</dt>
              <dd className={styles.price}>
                <b className="numeral">{formatPrice(price, locale, { currency: true })}</b>
                {changePct !== null && (
                  <em className={cn("numeral", directionText(directionOf(changePct)))}>
                    {formatPercent(changePct, locale)}
                  </em>
                )}
              </dd>
            </div>
          )}
        </dl>
      )}

      <p className={styles.foot}>{foot}</p>
    </div>
  );
}
