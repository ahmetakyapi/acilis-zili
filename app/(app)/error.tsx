"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button, Panel } from "@/components/ui/primitives";

/**
 * Sayfa çöktüğünde görünen ekran.
 *
 * Bunun olmadığı hâlde üretimde çıplak bir "Application error" yazısı
 * görünüyordu. Burada üç şey var ve üçü de bilinçli:
 *   1. Tekrar dene — çoğu hata sağlayıcı zaman aşımı, ikinci deneme tutar.
 *      Düğme `reset()`e DEĞİL, `router.refresh()` + `reset()` çiftine bağlı:
 *      Next'in `reset()`i yalnızca hata durumunu temizliyor, ağa çıkmıyor.
 *      Sunucuda doğan bir hatada durumu temizlemek aynı RSC yükünü yeniden
 *      çizmek demek — hata anında geri geliyordu. Denemenin kendisi
 *      olmuyordu, oysa ekranın metni "tekrar denemek yeter" diyor.
 *   2. Ana sayfaya dön — tekrar denemek çalışmıyorsa çıkış yolu.
 *   3. Hata kimliği — Next üretimde mesajı gizler ama `digest` verir;
 *      kullanıcının okuyup iletebileceği tek şey odur.
 *
 * Mesajın kendisi kasten gösterilmiyor: sunucu hatalarının metni sızıntı
 * yüzeyidir (dosya yolu, sorgu, sağlayıcı yanıtı taşıyabilir).
 *
 * METİNLER BURADA, SÖZLÜKTE DEĞİL — ve bu bilinçli. Hata sınırı bir istemci
 * bileşeni: `getI18n()` await edemez, sözlüğü prop olarak alması için de
 * üstündeki layout'un onu her çizimde geçirmesi gerekirdi. Dil `<html lang>`
 * özniteliğinden okunuyor; o özniteliği kök layout zaten okuyucunun diliyle
 * basıyor. Site iki dilli ve en kırılgan anında dilini kaybetmemeli.
 */

const COPY = {
  tr: {
    title: "Bir Şeyler Ters Gitti",
    body: "Bu ekran yüklenemedi. Çoğu zaman geçici bir veri sağlayıcı sorunudur; tekrar denemek genellikle yeter.",
    retry: "Tekrar Dene",
    home: "Bugün ekranına dön",
    digest: "Sorun sürerse bu kimliği bildir:",
  },
  en: {
    title: "Something Went Wrong",
    body: "This screen failed to load. It is usually a temporary data provider issue; trying again is normally enough.",
    retry: "Try Again",
    home: "Back to Today",
    digest: "If it keeps happening, report this id:",
  },
} as const;

function copyForDocument() {
  /* Sunucu çiziminde `document` yok; varsayılan Türkçe. İlk boyamadan sonra
     istemcide doğru dile geçiyor — hata ekranı zaten yalnızca istemcide
     görünüyor. */
  if (typeof document === "undefined") return COPY.tr;
  return document.documentElement.lang === "en" ? COPY.en : COPY.tr;
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = copyForDocument();

  const router = useRouter();
  /* Gerekçe dosyanın başındaki notta (madde 1). */
  const tekrarDene = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  useEffect(() => {
    // Sunucu tarafı zaten kaydediyor; bu, tarayıcı konsolunda izi bırakır.
    console.error("Sayfa hatası:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-14 text-center sm:py-24">
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-xl bg-down-wash text-down"
      >
        <WarningCircle weight="duotone" size={30} />
      </span>

      <div className="flex flex-col gap-2.5">
        <h1 className="text-title font-bold tracking-[-0.025em] text-strong">
          {copy.title}
        </h1>
        <p className="text-base leading-relaxed text-body">{copy.body}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button type="button" onClick={tekrarDene}>
          <ArrowClockwise weight="bold" size={15} />
          {copy.retry}
        </Button>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
        >
          {copy.home}
        </Link>
      </div>

      {error.digest && (
        <Panel className="w-full px-4 py-3">
          <p className="text-tiny text-muted">
            {copy.digest}{" "}
            <code className="numeral rounded-xs bg-surface-elevated px-1.5 py-0.5 font-bold text-strong">
              {error.digest}
            </code>
          </p>
        </Panel>
      )}
    </div>
  );
}
