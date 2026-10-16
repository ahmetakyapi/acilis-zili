"use client";

import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions/auth";
import { unsubscribePushAction } from "@/app/actions/notifications";

/**
 * ÇIKIŞ + BU CİHAZIN BİLDİRİMİ (16 Ekim).
 *
 * Çıkış yalnız oturumu kapatıyordu; bu cihazın push aboneliği hesaba bağlı
 * kalıyordu. Ortak bir bilgisayarda çıkış yapan okuyucunun fiyat alarmları
 * (sembol, hedef fiyat) ve topluluk kararları o cihazda bildirim olarak
 * görünmeye devam ediyordu. Çıkıştan ÖNCE bu cihazın satırı sunucudan,
 * aboneliği tarayıcıdan kaldırılıyor. Tavanlı (2,5 sn): bir şey takılırsa
 * çıkış beklemez — o durumda bir sonraki girişte Ayarlar aboneliği yeni
 * hesaba taşır (components/notifications/PushSettings.tsx).
 */
async function dropThisDevice(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await unsubscribePushAction(subscription.endpoint);
  await subscription.unsubscribe();
}

export function SignOutForm({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <form
      className={className}
      action={async () => {
        await Promise.race([
          dropThisDevice().catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
        await signOutAction();
      }}
    >
      {children}
    </form>
  );
}
