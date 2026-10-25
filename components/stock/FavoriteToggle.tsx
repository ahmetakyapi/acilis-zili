"use client";

import { useEffect, useOptimistic, useState, startTransition } from "react";
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
  fullLabel,
  text,
}: {
  symbol: string;
  isFavorite: boolean;
  addLabel: string;
  removeLabel: string;
  /** Görünür yazı (17 Ekim, hisse başlığı): [eklenmemişken, eklenmişken]. */
  text?: readonly [string, string];
  /** Liste doluyken (200 sembol) kalbin altında beliren açıklama. */
  fullLabel?: string;
}) {
  const [shown, setShown] = useOptimistic(isFavorite);
  /* DOLU LİSTE SESSİZ DEĞİL (9 Ekim). Kalp iyimser olarak dolup eylem
     sonrası boşalıyordu ve okuyucu neden olduğunu göremiyordu. */
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const timer = window.setTimeout(() => setFull(false), 5000);
    return () => window.clearTimeout(timer);
  }, [full]);

  return (
    <form
      className="relative"
      action={async (formData: FormData) => {
        startTransition(() => setShown(!shown));
        const result = await toggleSymbolFavorite(formData);
        if (result?.full) setFull(true);
      }}
    >
      {full && fullLabel && (
        <span role="status" className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-line bg-overlay-surface px-3 py-2 text-small leading-snug text-body">
          {fullLabel}
        </span>
      )}
      <input type="hidden" name="symbol" value={symbol} />
      {/* ERİŞİLEBİLİR AD DURUMLA ÇELİŞMİYOR (20 Ekim). Ad, `aria-pressed`
          ile birlikte "Favorilerden Çıkar"a dönüyordu: ekran okuyucu
          "Favorilerden Çıkar, basılı" diyordu — iki ayrı durum iddiası.
          Görünür yazının adda geçmemesi de (İngilizcede "On Watchlist" ↔
          "Remove from Watchlist") sesli komutu kırıyordu (WCAG 2.5.3).
          Yazılı düğmede ad görünür yazının kendisi;
          yalnız ikonlu düğmede SABİT ekleme adı, durumu `aria-pressed`
          söylüyor (APG düğme deseni). İpucu (`title`) eylemi söylemeye
          devam ediyor. `aria-label` kalıyor: dar ekranda yazı gizli. */}
      <HeartButton
        active={shown}
        label={text ? text[shown ? 1 : 0] : addLabel}
        hint={shown ? removeLabel : addLabel}
        text={text ? text[shown ? 1 : 0] : undefined}
      />
    </form>
  );
}

/**
 * Düğme AYRI bir bileşen: `useFormStatus` yalnızca kendisini saran formun
 * ALTINDAKİ bir bileşenden okunabiliyor, formu render eden bileşenden değil.
 */
function HeartButton({ active, label, hint, text }: { active: boolean; label: string; hint: string; text?: string }) {
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
      title={hint}
      /* `aria-pressed` durumu ekran okuyucuya da söylüyor: ikonun dolu mu
         boş mu olduğu yalnızca görene bilgi veriyordu. */
      aria-pressed={active}
      data-labeled={text ? "" : undefined}
      className={cn(
        "tap-44 inline-flex size-8 items-center justify-center rounded-(--radius-sm) transition-colors",
        styles.hit,
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
      {text && <span data-action-text>{text}</span>}
    </button>
  );
}
