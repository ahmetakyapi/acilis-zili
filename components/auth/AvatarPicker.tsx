"use client";

import { useActionState, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { setAvatarAction, type AvatarActionState } from "@/app/actions/avatar";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { AVATAR_KEYS, type AvatarKey } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import styles from "./AvatarPicker.module.css";

/**
 * Profil ikonu seçici (Ayarlar → Profil İkonu).
 *
 * Her karo formun kendi gönderim düğmesi (`name="icon"`): JavaScript
 * yokken de çalışıyor. Seçim TIKLAMA ANINDA görünüyor; sunucu cevabı
 * gecikse bile okuyucu seçtiğini görüyor. Kayıt düşerse seçim son
 * KAYDEDİLEN ikona geri dönüyor, yani yalan bir durum ekranda kalmıyor.
 * İlk seçenek baş harfler: ikon seçmek bir zorunluluk değil.
 */
export function AvatarPicker({
  initial,
  initials,
  labels,
}: {
  initial: AvatarKey | null;
  initials: string;
  labels: {
    initials: string;
    saved: string;
    failed: string;
    names: Record<AvatarKey, string>;
  };
}) {
  const [picked, setPicked] = useState<AvatarKey | null>(initial);
  const saved = useRef<AvatarKey | null>(initial);
  const [state, formAction, pending] = useActionState<AvatarActionState, FormData>(
    async (prev: AvatarActionState, formData: FormData) => {
      const next = await setAvatarAction(prev, formData);
      const value = formData.get("icon");
      if (next.status === "saved") {
        saved.current = value ? (value as AvatarKey) : null;
      } else {
        setPicked(saved.current);
      }
      return next;
    },
    { status: "idle" },
  );

  const option = (key: AvatarKey | null) => {
    const active = picked === key;
    return (
      <button
        key={key ?? "initials"}
        type="submit"
        name="icon"
        value={key ?? ""}
        onClick={() => setPicked(key)}
        aria-pressed={active}
        aria-label={key ? labels.names[key] : labels.initials}
        title={key ? labels.names[key] : labels.initials}
        className={styles.option}
        data-active={active || undefined}
      >
        {key ? (
          <AvatarTile icon={key} className={styles.tile} />
        ) : (
          <span aria-hidden className={cn(styles.tile, styles.initials)}>
            {initials || "?"}
          </span>
        )}
        {active && (
          <span aria-hidden className={styles.check}>
            <Check weight="bold" size={11} />
          </span>
        )}
      </button>
    );
  };

  return (
    <form action={formAction} aria-busy={pending}>
      <div className={styles.grid} data-motion-stagger>
        {option(null)}
        {AVATAR_KEYS.map((key) => option(key))}
      </div>
      {/* Canlı bölge: ekran okuyucu kaydın sonucunu duyuyor. */}
      <p role="status" className={styles.status} data-state={state.status}>
        {state.status === "saved" ? labels.saved : state.status === "failed" ? labels.failed : ""}
      </p>
    </form>
  );
}
