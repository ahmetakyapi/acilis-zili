import Link from "next/link";
import { ArticleBody } from "@/components/article/ArticleBody";
import { LEGAL_UPDATED, disclaimerMd, privacyMd } from "@/content/legal";
import { getI18n } from "@/lib/i18n";
import { formatEtDateLong } from "@/lib/utils";
import { pageMetadata } from "@/lib/page-meta";

/**
 * KVKK aydınlatma metni ve sorumluluk reddi.
 *
 * Tek sayfada iki metin: gizlilik ve sorumluluk reddi. Ayrı sayfalara
 * bölmedik çünkü ikisi de aynı soruyu cevaplıyor — "bu siteye ne kadar
 * güvenebilirim". Metin sütunu rehber yazılarıyla aynı genişlikte (720px);
 * yasal metnin okunmaz olmasının teknik bir sebebi yok.
 */

export const generateMetadata = pageMetadata({
  path: "/kvkk",
  tr: {
    title: "KVKK ve Gizlilik",
    description:
      "Açılış Zili'nde hangi kişisel veri neden işleniyor, nereye gidiyor ve hangi haklara sahipsin.",
  },
  en: {
    title: "Privacy",
    description:
      "What personal data Açılış Zili processes, why, where it goes and what rights you have.",
  },
});

export default async function PrivacyPage() {
  const { locale, t } = await getI18n();

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-7">
      <header className="flex flex-col gap-3">
        <p className="plate text-nano tracking-[0.09em] text-primary">
          {t.legal.eyebrow}
        </p>
        <h1 className="display-ink w-fit text-subdisplay font-bold leading-[1.12] tracking-[-0.035em] sm:text-display">
          {t.legal.privacyTitle}
        </h1>
        <p className="numeral text-small text-muted">
          {t.legal.updatedAt} {formatEtDateLong(LEGAL_UPDATED, locale)}
        </p>
      </header>

      <hr className="border-t border-line" aria-hidden />

      <ArticleBody markdown={privacyMd(locale)} locale={locale} />

      <hr className="mt-4 border-t border-line" aria-hidden />

      <section className="flex flex-col gap-7">
        <header className="flex flex-col gap-3">
          <p className="plate text-nano tracking-[0.09em] text-primary">
            {t.legal.disclaimerEyebrow}
          </p>
          <h2 className="display-ink w-fit text-heading font-bold leading-[1.14] tracking-[-0.035em] sm:text-subdisplay">
            {t.legal.disclaimerTitle}
          </h2>
        </header>
        <ArticleBody markdown={disclaimerMd(locale)} locale={locale} />
      </section>

      {/* İki bağlantı 18 piksellik metin kutularıydı — dokunma hedefi
          turlarında atlanmış son yer. `.tap-44` burada da yanlış araç:
          kap SARIYOR ve görünmez genişletme alt satırdaki bağlantıyı
          kapardı (aynı ölçüm kaynak künyelerinde yapıldı). Doğru araç
          gerçek yükseklik; dikey aralık da ona göre. */}
      <footer className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-5 text-small">
        <Link
          href="/ayarlar"
          className="inline-flex min-h-11 items-center font-semibold text-primary sm:min-h-8"
        >
          {t.legal.manageAccount}
        </Link>
        <a
          href="https://github.com/ahmetakyapi/acilis-zili/issues"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 items-center font-semibold text-primary sm:min-h-8"
        >
          {t.legal.contact}
        </a>
      </footer>
    </article>
  );
}
