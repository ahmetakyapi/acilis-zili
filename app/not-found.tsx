import Link from "next/link";
import { BellMark } from "@/components/brand/BellMark";
import { getI18n } from "@/lib/i18n";

/**
 * Kök 404 — uygulama kabuğunun DIŞINDA.
 *
 * `app/(app)/not-found.tsx` zaten vardı ama rota grupları adrese bir segment
 * eklemiyor: eşleşmeyen bir adrese giren okuyucu o dosyaya hiç ulaşmıyordu.
 * Next kendi varsayılanını gösteriyordu — "This page could not be found",
 * İngilizce, markasız, çıkışsız. Türkçe bir üründe kabul edilebilir değil ve
 * yetkisiz `/admin` isteği de tam olarak buraya düşüyor.
 *
 * Bu sayfa yalnızca kök düzeni miras alıyor (yazı tipi, tema, zemin); gezinme
 * çubuğu yok. O yüzden çıkış yolunu kendisi taşıyor: dört ana ekrana doğrudan
 * bağlantı. 404'e düşen biri çoğunlukla eski bir bağlantıdan geliyor ve
 * aradığı şey hâlâ sitede.
 */

export const metadata = {
  title: "Sayfa Bulunamadı",
  robots: { index: false, follow: false },
};

export default async function RootNotFound() {
  const { t } = await getI18n();

  const shortcuts = [
    { href: "/", label: t.nav.today },
    { href: "/piyasalar", label: t.nav.markets },
    { href: "/bilancolar", label: t.nav.earnings },
    { href: "/rehber", label: t.nav.guide },
  ];

  return (
    <main
      className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-6 px-[max(env(safe-area-inset-left),20px)] py-16 text-center"
      style={{ paddingRight: "max(env(safe-area-inset-right),20px)" }}
    >
      <BellMark size={56} />

      <div className="flex flex-col gap-2.5">
        <p className="tote display-ink text-[54px] leading-none">404</p>
        <h1 className="text-[19px] font-bold tracking-[-0.02em] text-strong">
          {t.errors.notFoundTitle}
        </h1>
        <p className="text-[14px] leading-relaxed text-body">
          {t.errors.notFoundHint}
        </p>
      </div>

      <nav
        aria-label={t.errors.shortcuts}
        className="w-full overflow-hidden rounded-2xl border border-line bg-surface"
      >
        <p className="plate px-4 pb-2.5 pt-3.5 text-left text-[10px] tracking-[0.09em]">
          {t.errors.shortcuts}
        </p>
        <ul>
          {shortcuts.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-[46px] items-center border-t border-line px-4 py-2.5 text-left text-[14px] font-semibold text-strong transition-colors hover:bg-primary-tint"
              >
                {item.label}
                <span aria-hidden className="ml-auto text-primary">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
