import { Heart } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { FavoriteToggle } from "@/components/stock/FavoriteToggle";
import { getUserSymbols } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";

/**
 * Favori kalbi — sembol başına ekranların ortak yuvası.
 *
 * Kalp yalnızca hisse sayfasında ve bilanço raporunda vardı; teknik analiz
 * ve hisse seçimi detayları bir hisseyi TAKİBE ALMAYA karar verilen yerler
 * olduğu hâlde okuyucu önce hisse sayfasına gitmek zorundaydı (8 Ekim
 * denetimi). Girişsiz okuyucuya da görünüyor ve `devam` ile aynı ekrana
 * geri dönüyor (StockHeader'daki kalbin gerekçesi).
 *
 * `getUserSymbols` hata yutuyor (lib/data.ts): veritabanı düşükse kalp boş
 * görünür, sayfa etkilenmez.
 */
export async function FavoriteSlot({ symbol, back, t }: { symbol: string; back: string; t: Dictionary }) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <Link
        href={`/giris?devam=${encodeURIComponent(back)}`}
        aria-label={t.stock.addToWatchlist}
        title={t.stock.addToWatchlist}
        className="tap-44 inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-elevated hover:text-soft"
      >
        <Heart weight="duotone" size={17} />
      </Link>
    );
  }
  const symbols = await getUserSymbols(session.user.id);
  return (
    <FavoriteToggle
      symbol={symbol}
      isFavorite={symbols.includes(symbol)}
      addLabel={t.stock.addToWatchlist}
      removeLabel={t.stock.removeFromWatchlist}
      fullLabel={t.watchlist.heartFull}
    />
  );
}
