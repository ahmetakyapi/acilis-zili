import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { fundMetaOf, INDEX_STRIP } from "@/db/seed/symbols";
import { describeSymbol } from "@/db/seed/descriptions";

/**
 * Fon künyesi — ETF'ler için profil kartının karşılığı.
 *
 * Sağlayıcı fonlar hakkında hiçbir şey döndürmediğinden içeriğin tamamı
 * yerel kayıttan gelir: ne izlediği, kim çıkardığı ve fiyatının yerel
 * endeksten nasıl ayrıştığı. Bu ayrım kartın altında açıkça yazılır.
 */
export async function FundCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const fund = fundMetaOf(symbol);
  if (!fund) return null;

  const about = await describeSymbol(symbol, locale);
  const rows: [string, React.ReactNode][] = [
    [t.stock.fundKind, fund.kind === "thematic" ? t.stock.fundKindActive : t.stock.fundKindLabel],
    [t.stock.fundTracks, locale === "tr" ? fund.tracksTr : fund.tracksEn],
    [t.stock.fundIssuer, fund.issuer],
  ];

  return (
    <Panel>
      {/* FON SAYFALARINDAN KARŞILAŞTIRMAYA SIFIR YOL VARDI. Hisse sayfası
          benzer şirketler panelinden karşılaştırmaya bağlanıyor ama ETF dalı
          o panelden önce dönüyor — oysa hazır setlerden biri tam olarak bu
          dört endeks fonu. */}
      <PanelHeader
        title={t.stock.fundProfile}
        action={
          /* Endeks fonu dört endeks fonuyla, sektör ve tema fonu ise kendisi +
             SPY + QQQ ile (4 Ekim): XLK'yı "piyasaya göre" okumak için. */
          <PanelLink
            href={`/karsilastir?semboller=${
              fund.kind === "us-index" || fund.kind === "country" ? INDEX_STRIP.join(",") : [symbol, "SPY", "QQQ"].join(",")
            }`}
          >
            {t.compare.addCta}
          </PanelLink>
        }
      />
      <div className="px-4 py-3 sm:px-5">
        {about && (
          <p className="border-b border-line-soft pb-3 text-base leading-relaxed text-body">
            {about}
          </p>
        )}
        <dl className="divide-y divide-line-soft">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-start justify-between gap-3 py-2"
            >
              <dt className="shrink-0 text-xs text-muted">{label}</dt>
              <dd className="text-right text-sm text-body">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-line-soft pt-2.5 text-tiny leading-relaxed text-muted">
          {fund.kind === "country"
            ? t.stock.fundNoteCountry
            : fund.kind === "sector"
              ? t.stock.fundNoteSector
              : fund.kind === "thematic"
                ? t.stock.fundNoteThematic
                : t.stock.fundNoteIndex}
        </p>
      </div>
    </Panel>
  );
}
