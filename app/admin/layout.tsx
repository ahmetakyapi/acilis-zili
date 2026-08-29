import Link from "next/link";
import { notFound } from "next/navigation";
import { Kicker } from "@/components/ui/primitives";
import type { Metadata } from "next";
import { getAdmin } from "@/lib/admin";
import { AdminTabs } from "@/components/admin/AdminTabs";

/**
 * Yönetim paneli.
 *
 * SİTENİN KABUĞUNUN DIŞINDA, bilerek: `(app)` grubunun içine konsaydı
 * panelin üstünde piyasa şeridi, alt sekme çubuğu ve arama kutusu dururdu.
 * Bunların hiçbiri burada işe yaramaz ve şerit her yönetim sayfasında
 * sağlayıcıya kotasyon sorgusu attırırdı.
 *
 * YETKİSİZE 404. Yönlendirme ya da "yetkiniz yok" ekranı, olmayan bir şeyin
 * VAR OLDUĞUNU söyler. Panel giriş yapmış sıradan bir kullanıcı için de
 * mevcut olmayan bir adres; ayrı bir cevap vermenin tek işlevi keşfi
 * kolaylaştırmak olurdu.
 */

export const metadata: Metadata = {
  title: "Yönetim",
  /* Panel arama motorlarına kapalı. Zaten 404 dönüyor ama başlık ve adres
     bir yerde sızarsa dizine girmesin. */
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdmin();
  if (!admin) notFound();

  return (
    /* Güvenli alan kendi dolgusunda: sayfa `viewport-fit=cover` ile açılıyor
       ve çentik yan çevrildiğinde kenardan içeri giriyor. `px-` ile `pr-`
       birlikte yazılmıştı; ikisi aynı özgüllükte olduğu için hangisinin
       kazandığı üretilen CSS'in sırasına kalıyordu.

       PANEL TÜRKÇE — `lang` bunu söylüyor. Sayfanın dili çereze bağlı ve
       İngilizce çerezle gezen bir yönetici `<html lang="en">` altında Türkçe
       metin okuyordu: ekran okuyucu yanlış sesletiyor, `uppercase` etiketler
       İngilizce kuralıyla büyüyüp "İÇERİK" yerine "ICERIK" üretiyordu.

       Güvenli alan `sm:` kırılımında DÜŞMÜYOR: `sm:pl-6` yatay çentiği
       eziyordu ve telefon yan çevrildiğinde panel kenardan içeri giriyordu;
       `max()` her iki kırılımda da duruyor. */
    <div
      lang="tr"
      className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 py-6 pl-[max(env(safe-area-inset-left),18px)] pr-[max(env(safe-area-inset-right),18px)] pb-[max(env(safe-area-inset-bottom),24px)] sm:py-8 sm:pl-[max(env(safe-area-inset-left),24px)] sm:pr-[max(env(safe-area-inset-right),24px)]"
    >
      {/* BAŞLIK ALANI ACCENT ZEMİNDE. Panel bir araç ve sayfa başlığı düz
          zeminde yüzüyordu; ince bir mavi geçiş bandı ona bir "burası
          yönetim" kimliği veriyor. Yüzey sitenin kendi kalıbı (mercek
          şeridiyle aynı geçiş), yani panel siteden kopmuyor.
          CESARET BİR KEZ HARCANIYOR: sayfada bununla yarışan ikinci bir
          accent yüzey yok — sayı kutuları aynı ailenin daha soluk tonunda,
          gerisi nötr. */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-(--radius-xl) border border-primary-faint bg-[linear-gradient(160deg,var(--primary-wash),var(--primary-tint))] px-5 py-5 sm:px-7 sm:py-6">
        <div>
          {/* Üst etiket ve başlık artık sitenin kendi ilkelleriyle: panel de
              bir sayfa başlığı gibi görünsün. Etiket elle yazılmış
              10px/600/0,09em idi, `Kicker` 11px/700/0,1em veriyor — yani bir
              tık büyüyüp koyulaşıyor; bilinçli. Başlıktaki degrade mürekkep
              tokenlanmış, `@supports` korumalı ve solid fallback'li
              (globals.css), "Yönetim" de tek kelimelik display metni. */}
          <Kicker tone="primary">Açılış Zili</Kicker>
          <h1 className="display-ink mt-1 w-fit text-heading font-bold leading-none tracking-[-0.035em] sm:text-display">
            Yönetim
          </h1>
        </div>
        <p className="text-small text-muted">
          <span className="font-semibold text-body">{admin.username}</span> ·{" "}
          <Link href="/" className="text-primary hover:text-primary-hover">
            Siteye Dön
          </Link>
        </p>
      </header>

      <AdminTabs />

      {/* İçerik bir YER İŞARETİ içinde: panelde `<main>` yoktu, yani ekran
          okuyucu "ana içerik" diye bir bölgeye atlayamıyordu. */}
      <main>{children}</main>
    </div>
  );
}
