import Link from "next/link";
import { ArticleBody } from "@/components/article/ArticleBody";
import { LEGAL_UPDATED, PRIVACY_MD, DISCLAIMER_MD } from "@/content/legal";
import { getI18n } from "@/lib/i18n";
import { formatEtDateLong } from "@/lib/utils";

/**
 * KVKK aydınlatma metni ve sorumluluk reddi.
 *
 * Tek sayfada iki metin: gizlilik ve sorumluluk reddi. Ayrı sayfalara
 * bölmedik çünkü ikisi de aynı soruyu cevaplıyor — "bu siteye ne kadar
 * güvenebilirim". Metin sütunu rehber yazılarıyla aynı genişlikte (720px);
 * yasal metnin okunmaz olmasının teknik bir sebebi yok.
 */

export const metadata = {
  title: "KVKK ve Gizlilik",
  description:
    "Açılış Zili'nde hangi kişisel veri neden işleniyor, nereye gidiyor ve hangi haklara sahipsin.",
};

export default async function PrivacyPage() {
  const { locale, t } = await getI18n();

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-7">
      <header className="flex flex-col gap-3">
        <p className="plate text-[10px] tracking-[0.09em] text-primary">
          {t.legal.eyebrow}
        </p>
        <h1 className="display-ink w-fit text-[30px] font-bold leading-[1.12] tracking-[-0.035em] sm:text-[38px]">
          {t.legal.privacyTitle}
        </h1>
        <p className="numeral text-[12px] text-muted">
          {t.legal.updatedAt} {formatEtDateLong(LEGAL_UPDATED, locale)}
        </p>
      </header>

      <hr className="border-t border-line" aria-hidden />

      <ArticleBody markdown={PRIVACY_MD} />

      <hr className="mt-4 border-t border-line" aria-hidden />

      <section className="flex flex-col gap-7">
        <header className="flex flex-col gap-3">
          <p className="plate text-[10px] tracking-[0.09em] text-primary">
            {t.legal.disclaimerEyebrow}
          </p>
          <h2 className="display-ink w-fit text-[26px] font-bold leading-[1.14] tracking-[-0.035em] sm:text-[32px]">
            {t.legal.disclaimerTitle}
          </h2>
        </header>
        <ArticleBody markdown={DISCLAIMER_MD} />
      </section>

      <footer className="mt-2 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-[12.5px]">
        <Link href="/ayarlar" className="font-semibold text-primary">
          {t.legal.manageAccount}
        </Link>
        <a
          href="https://github.com/ahmetakyapi/acilis-zili/issues"
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-primary"
        >
          {t.legal.contact}
        </a>
      </footer>
    </article>
  );
}
