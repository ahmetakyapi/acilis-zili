"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button, Panel } from "@/components/ui/primitives";

/**
 * Sayfa çöktüğünde görünen ekran.
 *
 * Bunun olmadığı hâlde üretimde çıplak bir "Application error" yazısı
 * görünüyordu. Burada üç şey var ve üçü de bilinçli:
 *   1. Tekrar dene — çoğu hata sağlayıcı zaman aşımı, ikinci deneme tutar.
 *   2. Ana sayfaya dön — tekrar denemek çalışmıyorsa çıkış yolu.
 *   3. Hata kimliği — Next üretimde mesajı gizler ama `digest` verir;
 *      kullanıcının okuyup iletebileceği tek şey odur.
 *
 * Mesajın kendisi kasten gösterilmiyor: sunucu hatalarının metni sızıntı
 * yüzeyidir (dosya yolu, sorgu, sağlayıcı yanıtı taşıyabilir).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sunucu tarafı zaten kaydediyor; bu, tarayıcı konsolunda izi bırakır.
    console.error("Sayfa hatası:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-14 text-center sm:py-24">
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-[18px] bg-down-wash text-down"
      >
        <WarningCircle weight="duotone" size={30} />
      </span>

      <div className="flex flex-col gap-2.5">
        <h1 className="text-[21px] font-bold tracking-[-0.025em] text-strong">
          Bir şeyler ters gitti
        </h1>
        <p className="text-[14px] leading-relaxed text-body">
          Bu ekran yüklenemedi. Çoğu zaman geçici bir veri sağlayıcı sorunudur;
          tekrar denemek genellikle yeter.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button type="button" onClick={reset}>
          <ArrowClockwise weight="bold" size={15} />
          Tekrar Dene
        </Button>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-[9px] border border-line bg-surface px-4 text-[13.5px] font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
        >
          Bugün ekranına dön
        </Link>
      </div>

      {error.digest && (
        <Panel className="w-full px-4 py-3">
          <p className="text-[11.5px] text-muted">
            Sorun sürerse bu kimliği bildir:{" "}
            <code className="numeral rounded-[5px] bg-surface-elevated px-1.5 py-0.5 font-bold text-strong">
              {error.digest}
            </code>
          </p>
        </Panel>
      )}
    </div>
  );
}
