import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getAdmin, type AdminSession } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { BellMark } from "@/components/brand/BellMark";
import { RouteProgress } from "@/components/layout/RouteProgress";
import { Panel } from "@/components/ui/primitives";

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
 *
 * KABUK SİTENİN DİLİNDE (23 Eylül denetimi). Panel sitenin yeniden
 * tasarımına hiç girmemişti: 1180 piksellik kendi çerçevesi, her sekmede
 * aynı "Yönetim" h1'i taşıyan mavi geçişli bir bant ve kaydırınca kaybolan
 * sekmeler. Şimdi:
 *   - çerçeve sitenin çerçevesi (1400, 18/24/40 kanal) — yoğun tablolar
 *     1440'ta 188 piksel genişliyor;
 *   - üstte ince bir kimlik satırı (marka, kullanıcı, siteye dönüş);
 *   - sekmeler yapışkan ve opak bir bantta: uzun sayfalarda (Trafik 2.354,
 *     Yazılar 2.950 piksel) bölüm değiştirmek için başa dönmek gerekmiyor;
 *   - her bölüm kendi `PageHeader`ını ve `h1`ini basıyor (sayfalarda).
 */

export const metadata: Metadata = {
  /* Mutlak başlık: kökün şablonu dile göre marka ekliyor ve İngilizce
     çerezle "Yönetim · Opening Bell" çıkıyordu. Bölümler kendi başlığını
     aynı kalıpla veriyor. */
  title: { absolute: "Yönetim · Açılış Zili" },
  /* Panel arama motorlarına kapalı. Zaten 404 dönüyor ama başlık ve adres
     bir yerde sızarsa dizine girmesin. */
  robots: { index: false, follow: false },
};

/** Sitenin içerik çerçevesi ve kanalı — AppShell'deki sabitlerle aynı ölçü. */
const FRAME = "mx-auto w-full max-w-[1400px]";
const GUTTER = [
  "pl-[max(env(safe-area-inset-left),18px)] pr-[max(env(safe-area-inset-right),18px)]",
  "sm:pl-[max(env(safe-area-inset-left),24px)] sm:pr-[max(env(safe-area-inset-right),24px)]",
  "xl:pl-[max(env(safe-area-inset-left),40px)] xl:pr-[max(env(safe-area-inset-right),40px)]",
].join(" ");

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* VERİTABANI HATASI PANELİN İÇİNDE KALIR. Yönetici kontrolü bir sorgu ve
     layout'un kendi hatası `error.tsx`e ulaşmıyor: Neon'daki bir kesinti
     yöneticiyi kabuksuz, çıkışsız küresel hata ekranına düşürüyordu. Sorgu
     yalnızca token'ı zaten "admin" diyen istekte koşuyor (lib/admin.ts);
     hata ekranını da yalnızca o istek görüyor, yani panelin varlığı
     başkasına sızmıyor. */
  let admin: AdminSession | null = null;
  let failed = false;
  try {
    admin = await getAdmin();
  } catch {
    const session = await auth().catch(() => null);
    if (session?.user?.role !== "admin") notFound();
    failed = true;
  }
  if (!admin && !failed) notFound();

  return (
    /* PANEL TÜRKÇE — `lang` bunu söylüyor. Sayfanın dili çereze bağlı ve
       İngilizce çerezle gezen bir yönetici `<html lang="en">` altında Türkçe
       metin okuyordu: ekran okuyucu yanlış sesletiyor, `uppercase` etiketler
       İngilizce kuralıyla büyüyüp "İÇERİK" yerine "ICERIK" üretiyordu. */
    /* `data-admin-shell`: yönetim kabuğunun işareti (editör ve çapa
       bileşenleri ona atıf yapıyor). */
    <div lang="tr" data-admin-shell className="flex min-h-dvh flex-col">
      {/* YÖNETİMİN KAYDIRMA PAYI KENDİ BANDINA GÖRE (23 Eylül). Sitenin üst
          payı 76 piksel (64 piksellik uygulama çubuğu + nefes); yönetimde o
          çubuk yok, yapışkan olan yalnızca 44 piksellik sekme bandı (ölçüldü,
          1440 ve 390). Pay bant + 12 piksel; bant güvenli alanı kendi
          taşıdığı için pay da taşıyor.
          Kural globals.css'te `html:has([data-admin-shell])` idi ve SİTENİN
          TAMAMINI yavaşlatıyordu (24 Eylül, ölçüldü): kökte duran bir
          `:has()` belgenin her yerindeki her DOM değişikliğinde yeniden
          değerlendiriliyor ve belgenin tümünün stilini baştan hesaplatıyor.
          Ana sayfada geri sayım her saniye bir rakam eklediği için 4x
          yavaşlatılmış CPU'da her saniye ~100 ms'lik 1.216 öğelik bir stil
          hesabı çıkıyordu. Kural artık yalnızca yönetim sayfalarında var. */}
      <style>{`html{scroll-padding-top:calc(env(safe-area-inset-top) + 56px)}`}</style>
      <Suspense fallback={null}>
        <RouteProgress label="Yükleniyor" />
      </Suspense>

      {/* KİMLİK SATIRI. Panelden çıkışın tek yolu burada ve 44 piksel:
          bağlantı bir dönem 59 × 15 piksellik bir hedefti. */}
      <div
        className={cn(
          FRAME,
          GUTTER,
          "flex items-center justify-between gap-4 pt-[max(env(safe-area-inset-top),14px)] pb-2",
        )}
      >
        <Link href="/admin" className="flex min-h-11 items-center gap-2.5">
          <BellMark size={26} />
          <span className="text-lead font-bold tracking-[-0.02em] text-strong">
            Yönetim
          </span>
        </Link>
        <p className="flex min-w-0 items-center gap-x-1.5 text-small text-muted">
          {admin && (
            <>
              <span className="truncate font-semibold text-body">{admin.username}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center text-primary hover:text-primary-hover"
          >
            Siteye Dön
          </Link>
        </p>
      </div>

      {/* YAPIŞKAN, OPAK SEKME BANDI. Bant sayfanın zemininde ve pencerenin
          bir ucundan öbür ucuna; kayan içerik altından geçerken görünmüyor.
          Yönetimde uygulama çubuğu yok, üst pay yalnızca güvenli alan. */}
      <div className="sticky top-0 z-30 border-b border-line bg-(--page-bg) pt-[env(safe-area-inset-top)]">
        <div className={cn(FRAME, GUTTER)}>
          <AdminTabs />
        </div>
      </div>

      {/* İçerik bir YER İŞARETİ içinde: panelde `<main>` yoktu, yani ekran
          okuyucu "ana içerik" diye bir bölgeye atlayamıyordu. */}
      <main
        className={cn(
          FRAME,
          GUTTER,
          "flex flex-1 flex-col gap-6 pt-6 pb-[max(env(safe-area-inset-bottom),32px)] sm:pt-8",
        )}
      >
        {failed ? (
          <Panel className="flex flex-col items-start gap-3 p-6">
            <h1 className="text-title font-bold text-strong">Panel Açılamadı</h1>
            <p className="text-base leading-relaxed text-body">
              Yönetici kaydı veritabanından okunamadı. Bağlantı çoğu zaman
              geçici olarak düşmüştür; sayfayı yenilemek genellikle yeter.
            </p>
            <Link href="/admin" className="inline-flex min-h-11 items-center text-base font-semibold text-primary hover:text-primary-hover">
              Yeniden Dene
            </Link>
          </Panel>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
