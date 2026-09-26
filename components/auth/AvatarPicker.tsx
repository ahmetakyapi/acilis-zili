"use client";

import { useActionState, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { setAvatarAction, type AvatarActionState } from "@/app/actions/avatar";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import {
  AVATAR_COLORS,
  AVATAR_KEYS,
  type Avatar,
  type AvatarColor,
  type AvatarKey,
} from "@/lib/avatars";
import styles from "./AvatarPicker.module.css";

/**
 * Profil karosu seçici (Ayarlar → Profil İkonu).
 *
 * Üç katman, yukarıdan aşağı: ÖNİZLEME (büyük karo ve ad; seçim burada
 * sonuçlanıyor), RENK şeridi, İKON ızgarası. Izgaradaki bütün ikonlar seçili
 * renkte çiziliyor: okuyucu rengi değiştirdiğinde on altı karonun hepsi
 * birlikte dönüyor ve sonucu seçmeden görüyor.
 *
 * Seçim TIKLAMA ANINDA görünüyor; kayıt düşerse son KAYDEDİLEN hâle dönüyor
 * ve canlı bölge sonucu söylüyor. Tek form, iki tür düğme: gerekçesi
 * `setAvatarAction` üzerinde.
 */
export function AvatarPicker({
  initial,
  initials,
  username,
  labels,
}: {
  initial: Avatar;
  initials: string;
  username: string;
  labels: {
    initials: string;
    icon: string;
    color: string;
    saved: string;
    failed: string;
    names: Record<AvatarKey, string>;
    colors: Record<AvatarColor, string>;
  };
}) {
  const [picked, setPicked] = useState<Avatar>(initial);
  const saved = useRef<Avatar>(initial);
  const [state, formAction, pending] = useActionState<AvatarActionState, FormData>(
    async (prev, formData) => {
      const next = await setAvatarAction(prev, formData);
      if (next.status === "saved") {
        const icon = formData.has("next-icon") ? formData.get("next-icon") : formData.get("icon");
        const color = formData.has("next-color") ? formData.get("next-color") : formData.get("color");
        saved.current = {
          icon: icon ? (icon as AvatarKey) : null,
          color: color as AvatarColor,
        };
      } else {
        setPicked(saved.current);
      }
      return next;
    },
    { status: "idle" },
  );

  const iconOption = (key: AvatarKey | null) => {
    const active = picked.icon === key;
    const name = key ? labels.names[key] : labels.initials;
    return (
      <button
        key={key ?? "initials"}
        type="submit"
        name="next-icon"
        value={key ?? ""}
        onClick={() => setPicked((p) => ({ ...p, icon: key }))}
        aria-pressed={active}
        aria-label={name}
        title={name}
        className={styles.option}
        data-active={active || undefined}
      >
        <AvatarTile icon={key} color={picked.color} initials={initials} className={styles.tile} />
        {active && (
          <span aria-hidden className={styles.check}>
            <Check weight="bold" size={11} />
          </span>
        )}
      </button>
    );
  };

  return (
    <form action={formAction} aria-busy={pending} className={styles.picker}>
      <input type="hidden" name="icon" value={picked.icon ?? ""} />
      <input type="hidden" name="color" value={picked.color} />

      {/* ÖNİZLEME — karo başlıkta nasıl duracaksa öyle; değiştikçe yerine
          yaylanarak oturuyor (anahtar seçimden türüyor). */}
      <div className={styles.preview}>
        <AvatarTile
          key={`${picked.icon ?? "initials"}:${picked.color}`}
          icon={picked.icon}
          color={picked.color}
          initials={initials}
          className={styles.previewTile}
        />
        <div className="min-w-0">
          <p className="truncate text-read font-bold tracking-[-0.01em] text-strong">{username}</p>
          <p className="mt-0.5 text-small text-muted">
            {picked.icon ? labels.names[picked.icon] : labels.initials} · {labels.colors[picked.color]}
          </p>
        </div>
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{labels.color}</legend>
        <div className={styles.swatches}>
          {AVATAR_COLORS.map((color) => {
            const active = picked.color === color;
            return (
              <button
                key={color}
                type="submit"
                name="next-color"
                value={color}
                onClick={() => setPicked((p) => ({ ...p, color }))}
                aria-pressed={active}
                aria-label={labels.colors[color]}
                title={labels.colors[color]}
                className={styles.swatch}
                data-active={active || undefined}
                style={{ backgroundImage: `var(--avatar-gloss), var(--avatar-${color})` }}
              >
                {active && <Check aria-hidden weight="bold" size={13} />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{labels.icon}</legend>
        <div className={styles.grid} data-motion-stagger>
          {iconOption(null)}
          {AVATAR_KEYS.map((key) => iconOption(key))}
        </div>
      </fieldset>

      {/* Canlı bölge: ekran okuyucu kaydın sonucunu duyuyor. */}
      <p role="status" className={styles.status} data-state={state.status}>
        {state.status === "saved" ? labels.saved : state.status === "failed" ? labels.failed : ""}
      </p>
    </form>
  );
}
