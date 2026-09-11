import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { TECHNICAL_SYMBOLS, technicalHref } from "@/lib/technical";

/**
 * Listede olmayan sembol — `/teknik/aapl`.
 *
 * 404 kasıtlı (bkz. sayfanın `isTechnicalSymbol` yorumu) ama segmentte bu
 * dosya yokken genel ekran basılıyordu: "Bu sayfa bulunamadı, bağlantı eski
 * olabilir." Okuyucu bir hissenin teknik analizini arıyordu ve ekran ona
 * adresin yanlış olduğunu söylüyordu; doğrusu "bu hisse takip edilmiyor".
 * Bu durum için yazılmış iki anahtar (`notListed`, `notListedHint`) da hiç
 * kullanılmıyordu.
 *
 * Çıkış yolu listedeki on iki hisse ve dizinin kendisi. Sembol `params`'tan
 * okunamıyor (not-found bileşeni parametre almıyor), şirket sayfasına bu
 * yüzden bağlanılmıyor.
 */
export default async function TechnicalNotFound() {
  const { t } = await getI18n();

  return (
    <EmptyState
      titleAs="h1"
      title={t.technical.notListed}
      hint={t.technical.notListedHint}
      action={
        <div className="flex flex-col items-center gap-3">
          <div className="flex max-w-md flex-wrap justify-center gap-1.5">
            {TECHNICAL_SYMBOLS.map((symbol) => (
              <Link
                key={symbol}
                href={technicalHref(symbol)}
                prefetch={false}
                className="rounded-md border border-line px-2.5 py-1 text-small font-semibold text-strong hover:border-primary-faint hover:text-primary"
              >
                {symbol}
              </Link>
            ))}
          </div>
          <Link href="/teknik" className="text-sm font-semibold text-primary hover:underline">
            {t.technical.allStocks}
          </Link>
        </div>
      }
    />
  );
}
