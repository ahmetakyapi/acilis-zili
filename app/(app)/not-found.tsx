import Link from "next/link";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { BellMark } from "@/components/brand/BellMark";
import { Panel } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { missingMetadata } from "@/lib/page-meta";

/**
 * 404 — uygulama kabuğunun içinde.
 *
 * Varsayılan Next sayfası İngilizce ve kabuksuzdu; Türkçe bir üründe
 * "This page could not be found" ekranı kabul edilebilir değil. Buradan
 * çıkış yolu var: dört ana ekrana doğrudan bağlantı, çünkü 404'e düşen
 * biri çoğunlukla eski bir bağlantıdan geliyor ve aradığı şey hâlâ sitede.
 */

/* Künye SABİT DEĞİL: başlık dil ne olursa olsun Türkçe yazılıyordu ve
   İngilizce gezinen okuyucunun sekmesinde "Sayfa bulunamadı" duruyordu. */
export async function generateMetadata() {
  const { locale } = await getI18n();
  return missingMetadata(locale);
}

export default async function NotFound() {
  const { t } = await getI18n();

  const shortcuts = [
    { href: "/", label: t.nav.today },
    { href: "/piyasalar", label: t.nav.markets },
    { href: "/rehber", label: t.nav.guide },
    { href: "/menu", label: t.nav.menu },
  ];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-14 text-center sm:py-24">
      <BellMark size={60} />

      <div className="flex flex-col gap-2.5">
        <p className="tote display-ink text-[54px] leading-none">404</p>
        <h1 className="text-[19px] font-bold tracking-[-0.02em] text-strong">
          {t.errors.notFoundTitle}
        </h1>
        <p className="text-[14px] leading-relaxed text-body">
          {t.errors.notFoundHint}
        </p>
      </div>

      <Panel className="w-full">
        <p className="plate px-4 pb-2.5 pt-3.5 text-left text-[10px] tracking-[0.09em] sm:px-5">
          {t.errors.shortcuts}
        </p>
        <ul>
          {shortcuts.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-[46px] items-center gap-2 border-t border-line px-4 py-2.5 text-left text-[14px] font-semibold text-strong transition-colors hover:bg-primary-tint sm:px-5"
              >
                {item.label}
                <ArrowRight
                  weight="bold"
                  size={13}
                  className="ml-auto shrink-0 text-primary"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
        <MagnifyingGlass weight="bold" size={13} aria-hidden />
        {t.errors.searchHint}
      </p>
    </div>
  );
}
