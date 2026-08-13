"use client";

import { useOptimistic, startTransition } from "react";
import { useFormStatus } from "react-dom";
import { Heart } from "@phosphor-icons/react";
import { toggleSymbolFavorite } from "@/app/actions/watchlist";
import { cn } from "@/lib/utils";

/**
 * Favori kalbi — tıklamanın karşılığı ANINDA.
 *
 * Kalp düz bir `<form action={...}>` içindeydi: tıklamadan sonra ikon,
 * sunucu eylemi bitip sayfa ağacı yeniden çizilene kadar eski hâlinde
 * kalıyordu. Bu sayfa altı ayrı sağlayıcı ucuna gidiyor, yani bekleme
 * yüzlerce milisaniye. Kullanıcı tıklamanın işlediğini göremediği için
 * ikinci kez basıyor ve favoriyi geri çıkarıyordu — yani geri bildirim
 * eksikliği, işlemin kendisini bozuyordu.
 *
 * `useOptimistic` ikonu tıklama anında çeviriyor; sunucu cevabı gelince
 * gerçek durum onun yerini alıyor. Eylem başarısız olursa React iyimser
 * değeri geri sarıyor, yani yalan bir durum ekranda kalmıyor.
 */
export function FavoriteToggle({
  symbol,
  isFavorite,
  addLabel,
  removeLabel,
}: {
  symbol: string;
  isFavorite: boolean;
  addLabel: string;
  removeLabel: string;
}) {
  const [shown, setShown] = useOptimistic(isFavorite);

  return (
    <form
      action={async (formData: FormData) => {
        startTransition(() => setShown(!shown));
        await toggleSymbolFavorite(formData);
      }}
    >
      <input type="hidden" name="symbol" value={symbol} />
      <HeartButton
        active={shown}
        label={shown ? removeLabel : addLabel}
      />
    </form>
  );
}

/**
 * Düğme AYRI bir bileşen: `useFormStatus` yalnızca kendisini saran formun
 * ALTINDAKİ bir bileşenden okunabiliyor, formu render eden bileşenden değil.
 */
function HeartButton({ active, label }: { active: boolean; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      /* `aria-pressed` durumu ekran okuyucuya da söylüyor: ikonun dolu mu
         boş mu olduğu yalnızca görene bilgi veriyordu. */
      aria-pressed={active}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-(--radius-sm) transition-colors",
        active
          ? "text-primary hover:bg-primary-wash"
          : "text-muted hover:bg-surface-elevated hover:text-soft",
        /* Bekleme yalnızca ikinci tıklamayı engelliyor; ikon zaten iyimser
           olarak döndüğü için ayrıca soluklaştırmaya gerek yok — soluk bir
           kalp "olmadı" gibi okunurdu. */
        pending && "cursor-default",
      )}
    >
      <Heart weight={active ? "fill" : "duotone"} size={17} />
    </button>
  );
}
