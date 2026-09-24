"use client";

import { useOptimistic, useState, startTransition } from "react";
import { useFormStatus } from "react-dom";
import { Heart } from "@phosphor-icons/react";
import { toggleSymbolFavorite } from "@/app/actions/watchlist";
import { cn } from "@/lib/utils";
import styles from "./FavoriteToggle.module.css";

/** Saçılan noktaların açıları — altı nokta, altmışar derece, biraz kaydırılmış. */
const SPARKS = [15, 75, 135, 195, 255, 315];

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
  /* Kutlama TIKLAMAYA bağlı: sayfa açıldığında favori olan kalp oynamaz.
     Sayaç her tıklamada artıyor ve anahtar olarak kullanılıyor — art arda
     iki eklemede animasyon baştan oynuyor, yarıda kalan bir önceki
     kaldığı yerden devam etmiyor. */
  const [burst, setBurst] = useState<{ kind: "add" | "remove"; n: number } | null>(null);

  return (
    <button
      type="submit"
      /* `disabled` DEĞİL `aria-disabled`. Odaklı bir düğme `disabled`
         olduğu anda tarayıcı odağı `<body>`ye düşürüyor: klavyeyle kalbe
         gelip Enter'a basan okuyucu, istek dönene kadar sayfanın başında
         kalıyor ve Tab'a devam ettiğinde en baştan sıralanıyordu. Sunucu
         eylemi bittiğinde odağı geri koyacak bir şey de yok.
         `aria-disabled` durumu ekran okuyucuya söylüyor ama düğmeyi odak
         sırasında tutuyor; ikinci gönderimi `onClick` engelliyor. */
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        setBurst((prev) => ({
          kind: active ? "remove" : "add",
          n: (prev?.n ?? 0) + 1,
        }));
      }}
      aria-label={label}
      title={label}
      /* `aria-pressed` durumu ekran okuyucuya da söylüyor: ikonun dolu mu
         boş mu olduğu yalnızca görene bilgi veriyordu. */
      aria-pressed={active}
      className={cn(
        "tap-44 inline-flex size-8 items-center justify-center rounded-(--radius-sm) transition-colors",
        active
          ? "text-primary-ink hover:bg-primary-wash"
          : "text-muted hover:bg-surface-elevated hover:text-soft",
        /* Bekleme yalnızca ikinci tıklamayı engelliyor; ikon zaten iyimser
           olarak döndüğü için ayrıca soluklaştırmaya gerek yok — soluk bir
           kalp "olmadı" gibi okunurdu. */
        pending && "cursor-default",
      )}
    >
      <span
        key={burst?.n ?? 0}
        className={styles.heart}
        data-burst={burst?.kind}
        aria-hidden="true"
      >
        <span className={styles.ring} />
        {SPARKS.map((angle) => (
          <span
            key={angle}
            className={styles.spark}
            style={{ "--a": `${angle}deg` } as React.CSSProperties}
          />
        ))}
        <Heart className={styles.icon} weight={active ? "fill" : "duotone"} size={17} />
      </span>
    </button>
  );
}
