"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button, Panel } from "@/components/ui/primitives";

/**
 * Yönetim ekranı çöktüğünde.
 *
 * `app/(app)/error.tsx` bu segmenti KAPSAMIYOR: `/admin` kendi kök
 * layout'unun altında, uygulama kabuğunun rota grubunda değil. Yani buradaki
 * bir hata doğrudan `global-error.tsx`e düşüyordu ve o ekran kabuksuz,
 * çıkışsız bir sayfa — yönetim ekranının yarısı çalışırken tamamını
 * kaybediyorduk.
 *
 * Burada olması gereken fark: yönetici, hatayı okumaya yetkili tek kişi.
 * Yine de mesaj gövdesi gösterilmiyor — `digest` yeterli ve sunucu hata
 * metinleri sorgu/dosya yolu taşıyabiliyor. Fark, çıkış yolunun yönetim
 * ekranına dönmesi: buradan ana siteye atmak yanlış olurdu.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Yönetim ekranı hatası:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-14 text-center sm:py-20">
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-xl bg-down-wash text-down"
      >
        <WarningCircle weight="duotone" size={30} />
      </span>

      <div className="flex flex-col gap-2.5">
        <h1 className="text-[21px] font-bold tracking-[-0.025em] text-strong">
          Panel Yüklenemedi
        </h1>
        <p className="text-[14px] leading-relaxed text-body">
          Bu ekranın verisi çekilemedi. Çoğu zaman veritabanı bağlantısı
          geçici olarak düşmüştür; tekrar denemek genellikle yeter.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button type="button" onClick={reset}>
          <ArrowClockwise weight="bold" size={15} />
          Tekrar Dene
        </Button>
        <Link
          href="/admin"
          className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 text-[13.5px] font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
        >
          Panele dön
        </Link>
      </div>

      {error.digest && (
        <Panel className="w-full px-4 py-3">
          <p className="text-[11.5px] text-muted">
            Sunucu kaydında bu kimlikle duruyor:{" "}
            <code className="numeral rounded-xs bg-surface-elevated px-1.5 py-0.5 font-bold text-strong">
              {error.digest}
            </code>
          </p>
        </Panel>
      )}
    </div>
  );
}
