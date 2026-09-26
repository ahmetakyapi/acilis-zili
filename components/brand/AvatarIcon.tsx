import type { ReactNode } from "react";
import { AVATAR_TONE, type AvatarKey, type AvatarTone } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * Profil ikonları — sitenin kendi çizimi (26 Eylül).
 *
 * Hepsi aynı ızgarada: 40'lık kutu, 2,2'lik çizgi, yuvarlak uç ve köşe.
 * İki katman var ve ikisi de `currentColor`: çizgi tam tonda, dolgu aynı
 * rengin %24'ü. Böylece renk karonun tonundan geliyor (hardcoded renk yok)
 * ve her ikon iki temada da aynı ağırlıkta duruyor. Konular sitenin
 * dünyasından: markanın zili, boğa ve ayı, mum grafiği, sabahın kahvesi,
 * akşam seansının baykuşu.
 *
 * Bu dosya "use client" DEĞİL: yalnızca SVG basıyor ve hem sunucu
 * bileşenlerinde (/menu) hem istemcide (hesap menüsü, seçici) kullanılıyor.
 */

const FILL = { fill: "currentColor", fillOpacity: 0.24 } as const;
const SOLID = { fill: "currentColor", stroke: "none" } as const;

const DRAWINGS: Record<AvatarKey, ReactNode> = {
  bell: (
    <>
      <path d="M12.5 27c1.7-1.6 2.5-3.4 2.5-6.5V18a5 5 0 0 1 10 0v2.5c0 3.1.8 4.9 2.5 6.5z" {...FILL} />
      <path d="M12.5 27c1.7-1.6 2.5-3.4 2.5-6.5V18a5 5 0 0 1 10 0v2.5c0 3.1.8 4.9 2.5 6.5z" />
      <path d="M20 10.5V13" />
      <circle cx="20" cy="30.5" r="2" {...SOLID} />
      <path d="M9.5 16.5a9 9 0 0 1 2.6-5M30.5 16.5a9 9 0 0 0-2.6-5" />
    </>
  ),
  bull: (
    <>
      <path d="M13 17h14v5.5a7 7 0 0 1-14 0z" {...FILL} />
      <path d="M13 17h14v5.5a7 7 0 0 1-14 0z" />
      <path d="M13 17c-3.2-.4-5-2.6-5.5-6.5M27 17c3.2-.4 5-2.6 5.5-6.5" />
      <circle cx="17" cy="20.5" r="1.1" {...SOLID} />
      <circle cx="23" cy="20.5" r="1.1" {...SOLID} />
      <path d="M17.5 25.5h5" />
    </>
  ),
  bear: (
    <>
      <circle cx="12.5" cy="14" r="3.4" {...FILL} />
      <circle cx="27.5" cy="14" r="3.4" {...FILL} />
      <circle cx="20" cy="22" r="9.5" {...FILL} />
      <circle cx="20" cy="22" r="9.5" />
      <path d="M10.2 16.2a3.4 3.4 0 1 1 4.6-4.6M29.8 16.2a3.4 3.4 0 1 0-4.6-4.6" />
      <ellipse cx="20" cy="25.5" rx="4.2" ry="3.2" />
      <circle cx="20" cy="24.6" r="1.2" {...SOLID} />
      <circle cx="16.4" cy="19.8" r="1.1" {...SOLID} />
      <circle cx="23.6" cy="19.8" r="1.1" {...SOLID} />
    </>
  ),
  candles: (
    <>
      <path d="M11.5 10.5v20M20 7.5v17M28.5 13.5v18" />
      <rect x="9" y="15" width="5" height="11" rx="1.2" {...FILL} />
      <rect x="9" y="15" width="5" height="11" rx="1.2" />
      <rect x="17.5" y="10.5" width="5" height="10" rx="1.2" {...SOLID} />
      <rect x="26" y="18" width="5" height="9" rx="1.2" {...FILL} />
      <rect x="26" y="18" width="5" height="9" rx="1.2" />
    </>
  ),
  rocket: (
    <>
      <path d="M20 7c5 4 6.3 10 5.2 17h-10.4C13.7 17 15 11 20 7z" {...FILL} />
      <path d="M20 7c5 4 6.3 10 5.2 17h-10.4C13.7 17 15 11 20 7z" />
      <circle cx="20" cy="16" r="2.4" />
      <path d="M15.2 19.5 11 24.5v3.2l4.3-2M24.8 19.5l4.2 5v3.2l-4.3-2" />
      <path d="M17.6 27.5c0 2.7 1.3 4.6 2.4 5.8 1.1-1.2 2.4-3.1 2.4-5.8" {...FILL} />
      <path d="M17.6 27.5c0 2.7 1.3 4.6 2.4 5.8 1.1-1.2 2.4-3.1 2.4-5.8" />
    </>
  ),
  compass: (
    <>
      <circle cx="20" cy="20" r="12" {...FILL} />
      <circle cx="20" cy="20" r="12" />
      <path d="M20 11.5l3.2 8.5h-6.4z" {...SOLID} />
      <path d="M20 11.5l3.2 8.5-3.2 8.5-3.2-8.5z" />
      <circle cx="20" cy="20" r="1.3" {...SOLID} />
    </>
  ),
  trend: (
    <>
      <path d="M12 26.5l6-6.2 4 3.2 8.5-9.5V29H12z" {...FILL} />
      <path d="M9 9.5V31h22" />
      <path d="M12 26.5l6-6.2 4 3.2 8.5-9.5" />
      <path d="M25.5 14h5v5" />
    </>
  ),
  coffee: (
    <>
      <path d="M10 15.5h16v5.5a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z" {...FILL} />
      <path d="M10 15.5h16v5.5a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z" />
      <path d="M26 17.5h1.5a3 3 0 0 1 0 6H26" />
      <path d="M14.5 7c-1.4 1.6 1.4 2.8 0 4.6M19.5 7c-1.4 1.6 1.4 2.8 0 4.6" />
      <path d="M9 32h19" />
    </>
  ),
  owl: (
    <>
      <path d="M11 15.5c0-3.8 3.6-6.5 9-6.5s9 2.7 9 6.5V24a9 9 0 0 1-18 0z" {...FILL} />
      <path d="M11 15.5c0-3.8 3.6-6.5 9-6.5s9 2.7 9 6.5V24a9 9 0 0 1-18 0z" />
      <path d="M11.5 11 10 7.5l4 2M28.5 11 30 7.5l-4 2" />
      <circle cx="16" cy="18" r="3.3" />
      <circle cx="24" cy="18" r="3.3" />
      <circle cx="16" cy="18" r="1.3" {...SOLID} />
      <circle cx="24" cy="18" r="1.3" {...SOLID} />
      <path d="M19 22.2h2L20 24z" {...SOLID} />
      <path d="M16 28.5l2 1 2-1 2 1 2-1" />
    </>
  ),
  diamond: (
    <>
      <path d="M12.5 10.5h15l5 6.5H7.5z" {...SOLID} fillOpacity={0.5} />
      <path d="M12.5 10.5h15l5 6.5L20 32.5 7.5 17z" {...FILL} />
      <path d="M12.5 10.5h15l5 6.5L20 32.5 7.5 17z" />
      <path d="M7.5 17h25M16.5 10.5 14.5 17 20 32.5 25.5 17l-2-6.5" />
    </>
  ),
  bolt: (
    <>
      <path d="M22.5 6.5 11 22.5h8l-2 11 12-16.5h-8z" {...FILL} />
      <path d="M22.5 6.5 11 22.5h8l-2 11 12-16.5h-8z" />
    </>
  ),
  shield: (
    <>
      <path d="M20 7.5l11 4.2V19c0 7-4.8 11.8-11 13.8C13.8 30.8 9 26 9 19v-7.3z" {...FILL} />
      <path d="M20 7.5l11 4.2V19c0 7-4.8 11.8-11 13.8C13.8 30.8 9 26 9 19v-7.3z" />
      <path d="M15 20l3.6 3.6L25.5 16" />
    </>
  ),
};

/** Karonun zemini tondan; çizgi her tonda `--on-primary` (iki temada da
    zeminle kontrast tutuyor). */
const TONE_CLASS: Record<AvatarTone, string> = {
  primary: "bg-primary",
  brass: "bg-brass",
  ink: "bg-strong",
};

/** Yalnızca çizim — karosuz; karo `AvatarTile`de. */
export function AvatarGlyph({ icon, className }: { icon: AvatarKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {DRAWINGS[icon]}
    </svg>
  );
}

/**
 * Profil karosu — kabın boyunu ve köşesini ÇAĞRI YERİ veriyor (`className`):
 * başlık düğmesi daire, panel künyesi yumuşak kare. Çizim karonun %78'i;
 * kenarda nefes payı kalıyor.
 */
export function AvatarTile({ icon, className }: { icon: AvatarKey; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden text-on-primary",
        TONE_CLASS[AVATAR_TONE[icon]],
        className,
      )}
    >
      <AvatarGlyph icon={icon} className="size-[78%]" />
    </span>
  );
}
