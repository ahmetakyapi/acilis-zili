import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ButtonLink, LogoTile } from "@/components/ui/primitives";
import { VerdictPill } from "@/components/ui/VerdictPill";
import type { VerdictKey } from "@/lib/analysis";
import css from "./CompanyEarnings.module.css";

/**
 * KÜNYE ŞERİDİ — `/bilancolar/[symbol]` başlık kartının son satırı
 * (`PageHeader strip=`; 10 Kasım, görsel kalite turu).
 *
 * Şerit sayfada satır içi yazılıydı: logo, sembol, ad ve sağ uçta "Hisse
 * Sayfası". Ad başlıkta zaten yazdığı için satır yeni bir şey söylemiyor,
 * düğme 1100 piksel ötede kopuk duruyordu (ölçüm ve gerekçe
 * `CompanyEarnings.module.css` → "KÜNYE ÖLÇÜLERİ"). Araya şirketin sayfaya
 * ZATEN gelen künyeleri girdi; hiçbiri yeni sorgu değil:
 *   · piyasa değeri ve sektör — `getSymbolNames` (sayfanın kendi okuması),
 *   · son okunan çeyrek — analiz listesinin ilk satırı; görüş `VerdictPill`
 *     (tek hap bileşeni) ve analize bağlantı.
 * Olmayan künye basılmaz (profili gelmemiş sembolde değer yok, hiç analiz
 * okunmamış şirkette çeyrek yok); hiçbiri yoksa şerit eski hâliyle kalır.
 */
export function CompanyIdentity({
  symbol,
  name,
  logoUrl,
  facts,
  latest,
  stock,
}: {
  symbol: string;
  name: string;
  logoUrl?: string | null;
  /** Etiket–değer çiftleri; değeri olmayan çağırılmadan elenir. */
  facts: readonly { label: string; value: string }[];
  /** En yeni okunan çeyrek — yoksa null. */
  latest: {
    label: string;
    period: string;
    href: string;
    verdict: VerdictKey;
    verdictLabel: string;
    score: number | null;
  } | null;
  stock: { href: string; label: string };
}) {
  return (
    <div className={css.identity}>
      <div className={css.identityWho}>
        <LogoTile symbol={symbol} logoUrl={logoUrl} size="lg" />
        <div className="min-w-0">
          <p className={css.identitySymbol}>{symbol}</p>
          <p className="truncate text-small text-muted">{name}</p>
        </div>
      </div>
      {(facts.length > 0 || latest) && (
        <dl className={css.identityFacts}>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd className="figure">{fact.value}</dd>
            </div>
          ))}
          {latest && (
            <div>
              <dt>{latest.label}</dt>
              <dd>
                <Link href={latest.href} prefetch={false} className={css.identityRead}>
                  <span className="figure">{latest.period}</span>
                  <VerdictPill verdict={latest.verdict} label={latest.verdictLabel} score={latest.score} size="xs" />
                </Link>
              </dd>
            </div>
          )}
        </dl>
      )}
      <ButtonLink href={stock.href} size="sm" className={css.stockLink}>
        {stock.label}
        <ArrowUpRight size={14} weight="bold" aria-hidden />
      </ButtonLink>
    </div>
  );
}
