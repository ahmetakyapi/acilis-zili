import type { ReactNode } from "react";
import { AVATAR_DEFAULT_COLOR, type AvatarColor, type AvatarKey } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * Profil ikonları — sitenin kendi çizimi (26 Eylül, ikinci sürüm).
 *
 * TEK DÜZEN. İlk sürümde ikonlar aynı ızgarada ama farklı KÜTLEDEYDİ: boğa
 * kutunun ortasında küçük, ayı neredeyse kenara dayanıyor, mum ve baykuş
 * ötekilerin iki katı ayrıntı taşıyordu; yan yana dizilince aynı aileden
 * gibi durmuyorlardı. Şimdi her çizim aynı kurala uyuyor:
 *
 * - 40'lık kutuda, ortadaki 24–26'lık alana oturur (optik olarak eşit
 *   kütle; daire biçimli olanlar köşeli olanlardan bir tık büyük).
 * - Tek bir DOLGU düzlemi (beyazın %26'sı), üstünde 2,4'lük kontur,
 *   yuvarlak uç ve köşe.
 * - En çok iki TAM nokta (göz, tokmak, burun): ayrıntı sınırlı, küçük
 *   boyda da okunuyor.
 *
 * Karo marka işaretinin dilinde: üstte parlaklık, altında çapraz degrade,
 * içte ince bir kenar (`--mark-edge`). Rengi okuyucu seçiyor
 * (`--avatar-*`), çizgi her renkte `--mark-ink`.
 *
 * Bu dosya "use client" DEĞİL: yalnızca SVG ve bir kutu basıyor; hem sunucu
 * bileşenlerinde (/menu) hem istemcide (hesap menüsü, seçici) kullanılıyor.
 */

const FILL = { fill: "currentColor", fillOpacity: 0.26 } as const;
const SOLID = { fill: "currentColor", stroke: "none" } as const;

/** Aynı yolu önce dolgu, sonra kontur olarak basar — ikonların ortak kalıbı. */
function Plane({ d }: { d: string }) {
  return (
    <>
      <path d={d} {...FILL} />
      <path d={d} />
    </>
  );
}

function Disc({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} {...FILL} />
      <circle cx={cx} cy={cy} r={r} />
    </>
  );
}

const DRAWINGS: Record<AvatarKey, ReactNode> = {
  bell: (
    <>
      <Plane d="M12.8 27.4c1.6-1.7 2.3-3.6 2.3-6.8V18a4.9 4.9 0 0 1 9.8 0v2.6c0 3.2.7 5.1 2.3 6.8z" />
      <path d="M20 10.6v2.5M10.4 15.4a9.6 9.6 0 0 1 2.5-4.5M29.6 15.4a9.6 9.6 0 0 0-2.5-4.5" />
      <circle cx="20" cy="30.9" r="1.9" {...SOLID} />
    </>
  ),
  bull: (
    <>
      <Plane d="M14.3 15.6h11.4c.9 0 1.6.8 1.4 1.7l-1.8 8.4a5.4 5.4 0 0 1-5.3 4.3 5.4 5.4 0 0 1-5.3-4.3l-1.8-8.4c-.2-.9.5-1.7 1.4-1.7z" />
      <path d="M14.3 15.6c-3.2-.5-5-2.9-5.2-6.2M25.7 15.6c3.2-.5 5-2.9 5.2-6.2M17.8 26.4h4.4" />
      <circle cx="17.1" cy="20.3" r="1.2" {...SOLID} />
      <circle cx="22.9" cy="20.3" r="1.2" {...SOLID} />
    </>
  ),
  bear: (
    <>
      <path d="M11.6 16.3a3.3 3.3 0 1 1 4.7-4.4M28.4 16.3a3.3 3.3 0 1 0-4.7-4.4" />
      <Disc cx={20} cy={21.4} r={8.9} />
      <ellipse cx="20" cy="25" rx="3.6" ry="2.7" />
      <circle cx="16.6" cy="19.5" r="1.2" {...SOLID} />
      <circle cx="23.4" cy="19.5" r="1.2" {...SOLID} />
    </>
  ),
  candles: (
    <>
      <path d="M12.5 11.5v18M20 8.5v16M27.5 13.5v17" />
      <rect x="10.2" y="15" width="4.6" height="10" rx="1.3" {...FILL} />
      <rect x="10.2" y="15" width="4.6" height="10" rx="1.3" />
      <rect x="17.7" y="11" width="4.6" height="10" rx="1.3" {...SOLID} />
      <rect x="25.2" y="17.5" width="4.6" height="9" rx="1.3" {...FILL} />
      <rect x="25.2" y="17.5" width="4.6" height="9" rx="1.3" />
    </>
  ),
  rocket: (
    <>
      <Plane d="M20 8.5c4.7 3.6 5.9 9.3 4.9 15.6h-9.8c-1-6.3.2-12 4.9-15.6z" />
      <circle cx="20" cy="16.4" r="2.2" />
      <path d="M15.4 19.7l-3.7 4.6v3l3.7-1.8M24.6 19.7l3.7 4.6v3l-3.7-1.8" />
      <path d="M18 27.6c0 2.3.9 3.9 2 5 1.1-1.1 2-2.7 2-5z" {...SOLID} />
    </>
  ),
  compass: (
    <>
      <Disc cx={20} cy={20} r={11.6} />
      <path d="M20 12l3 8h-6z" {...SOLID} />
      <path d="M17 20h6l-3 8z" />
    </>
  ),
  trend: (
    <>
      <Plane d="M9.8 26.2l6.4-6.9 4.4 3.4 9.6-10.4v14.9H9.8z" />
      <path d="M24.6 12.3h5.6v5.6M9.8 31h20.4" />
    </>
  ),
  coffee: (
    <>
      <Plane d="M11 15.8h15v5.4a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7z" />
      <path d="M26 18h1.3a3 3 0 0 1 0 6H26M15.6 8.4c-1.3 1.5 1.3 2.7 0 4.4M20.6 8.4c-1.3 1.5 1.3 2.7 0 4.4M10 31.6h17.8" />
    </>
  ),
  owl: (
    <>
      <Plane d="M12 16.2c0-4 3.4-6.8 8-6.8s8 2.8 8 6.8v8a8 8 0 0 1-16 0z" />
      <path d="M13.3 11.4 11.9 8l3.8 1.8M26.7 11.4 28.1 8l-3.8 1.8" />
      <circle cx="16.6" cy="18.2" r="2.9" />
      <circle cx="23.4" cy="18.2" r="2.9" />
      <circle cx="16.6" cy="18.2" r="1.1" {...SOLID} />
      <circle cx="23.4" cy="18.2" r="1.1" {...SOLID} />
    </>
  ),
  diamond: (
    <>
      <Plane d="M13.2 11h13.6l5 6.4L20 31 8.2 17.4z" />
      <path d="M8.2 17.4h23.6M16.6 11l-2.2 6.4L20 31l5.6-13.6-2.2-6.4" />
    </>
  ),
  bolt: <Plane d="M22.4 8 12 22.4h7.2L17.6 32 28 17.6h-7.2z" />,
  shield: (
    <>
      <Plane d="M20 8.4l10 3.8v7c0 6.6-4.4 11-10 12.8-5.6-1.8-10-6.2-10-12.8v-7z" />
      <path d="M15.3 20.2l3.4 3.4 6.1-6.6" />
    </>
  ),
  crown: (
    <>
      <Plane d="M9.6 15.2l5.1 5 5.3-8.2 5.3 8.2 5.1-5-2.3 13.3H11.9z" />
      <circle cx="20" cy="10.4" r="1.6" {...SOLID} />
      <path d="M12.6 31.4h14.8" />
    </>
  ),
  globe: (
    <>
      <Disc cx={20} cy={20} r={11.6} />
      <ellipse cx="20" cy="20" rx="4.9" ry="11.6" />
      <path d="M8.4 20h23.2M10.4 14h19.2M10.4 26h19.2" />
    </>
  ),
  target: (
    <>
      <Disc cx={20} cy={20} r={11.6} />
      <circle cx="20" cy="20" r="6.6" />
      <circle cx="20" cy="20" r="2.3" {...SOLID} />
    </>
  ),
  star: (
    <Plane d="M20 9l3.06 7.59 8.16.56-6.27 5.26 1.99 7.94L20 26l-6.94 4.35 1.99-7.94-6.27-5.26 8.16-.56z" />
  ),
};

/** Yalnızca çizim — karosuz; karo `AvatarTile`de. */
export function AvatarGlyph({ icon, className }: { icon: AvatarKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
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
 * Profil karosu. İkon yoksa baş harfler aynı karoda, aynı renkte; kabın
 * boyunu ve köşesini ÇAĞRI YERİ veriyor (`className`): başlık düğmesi
 * daire, panel künyesi yumuşak kare. Çizim karonun %76'sı.
 */
export function AvatarTile({
  icon,
  color,
  initials,
  className,
}: {
  icon: AvatarKey | null;
  color?: AvatarColor | null;
  /** İkon yoksa basılan harfler — çağıran dile göre büyütmüş olmalı. */
  initials?: string;
  className?: string;
}) {
  const tone = color ?? (icon ? AVATAR_DEFAULT_COLOR[icon] : "blue");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden text-(--mark-ink)",
        className,
      )}
      style={{
        backgroundImage: `var(--avatar-gloss), var(--avatar-${tone})`,
        boxShadow: "inset 0 0 0 1px var(--mark-edge)",
      }}
    >
      {icon ? (
        <AvatarGlyph icon={icon} className="size-[76%]" />
      ) : (
        <span className="text-[0.95em] font-bold tracking-[-0.02em]">{initials || "?"}</span>
      )}
    </span>
  );
}
