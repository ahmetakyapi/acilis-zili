"use client";

import { useState, type ReactNode } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { cn } from "@/lib/utils";

/*
 * "YENİ" İŞARETİ İLK ÇİZİMDE KİLİTLİ (16 Ekim). /bildirimler açılınca
 * `MarkInboxRead` kutuyu okundu sayıyor ve eylemin `revalidatePath`i sayfayı
 * yeniden çiziyor: bütün öğeler okunmuş geliyor, "Yeni" rozetleri ve zemin
 * tonu açılıştan birkaç yüz milisaniye sonra sönüyordu — okuyucu hangisinin
 * yeni olduğunu göremiyordu. React aynı anahtarlı istemci bileşeninin
 * durumunu sunucu yenilemesinde koruyor; ilk değer kilit. Başlıktaki zil
 * yine sıfıra iner (o düzende, burada değil).
 */

export function InboxItemLink({
  href,
  isNew,
  className,
  children,
}: {
  href: string;
  isNew: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [fresh] = useState(isNew);
  return (
    <Link href={href} className={cn(className, fresh && "bg-primary-tint/60")} data-new={fresh || undefined}>
      {children}
    </Link>
  );
}

export function InboxNewBadge({ isNew, label }: { isNew: boolean; label: string }) {
  const [fresh] = useState(isNew);
  if (!fresh) return null;
  return (
    <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold leading-[18px] text-on-primary">{label}</span>
  );
}
