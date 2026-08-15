import Link from "next/link";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { getStoriesForSymbol } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatEtDateShort } from "@/lib/utils";

/**
 * Bu şirket hakkında yazılmış mercek yazıları.
 *
 * NEDEN BURADA: mercek yazıları bir olayı anlatıyor ve o olayın öznesi
 * çoğunlukla tek bir şirket — ama okuyucu o yazıya ancak Mercek arşivine
 * gidip aramayı akıl ederse ulaşabiliyordu. Hisse sayfası ise okuyucunun
 * "bu şirkete ne oldu" diye baktığı yer; yazının tam olarak cevapladığı soru
 * bu. Bağlantı tersine zaten vardı (yazıdan hisseye), bu yönü eksikti.
 *
 * YAZISI OLMAYAN ŞİRKETTE HİÇBİR ŞEY BASILMAZ — boş bir panel "burada bir
 * şey olmalıydı" diye okunuyor. Kardeş panel (SymbolAnalyses) de aynı
 * kuralı uyguluyor.
 *
 * Dil düşüşü arşivdekiyle aynı: çevirisi olmayan yazı orijinal diliyle
 * gösteriliyor ve satır kendi dilini `lang` ile söylüyor.
 */
export async function SymbolStories({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const rows = await getStoriesForSymbol(symbol, locale, 3);
  if (rows.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        title={t.stories.title}
        action={<PanelLink href="/mercek">{t.common.showAll}</PanelLink>}
      />
      <ul>
        {rows.map((row) => (
          <li key={row.slug}>
            <Link
              href={`/mercek/${row.slug}`}
              prefetch={false}
              className="flex flex-col gap-1 border-t border-line px-4 py-3.5 transition-colors hover:bg-primary-tint sm:px-5"
            >
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span
                  lang={row.locale}
                  className="text-read font-bold leading-snug tracking-[-0.01em] text-strong"
                >
                  {row.title}
                </span>
                {row.locale !== locale && (
                  /* Çevirisi yok — okuyucu hangi dilde bir metne
                     tıkladığını önceden bilsin. */
                  <span className="rounded-full border border-line px-1.5 py-px text-micro font-bold uppercase tracking-[0.08em] text-muted">
                    {row.locale}
                  </span>
                )}
              </span>
              <span
                lang={row.locale}
                className="line-clamp-2 text-small leading-relaxed text-body"
              >
                {row.dek}
              </span>
              <span className="numeral text-tiny text-muted">
                {formatEtDateShort(row.eventDate, locale)}
                {row.readMinutes ? ` · ${row.readMinutes} ${t.stories.readMinutes}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
