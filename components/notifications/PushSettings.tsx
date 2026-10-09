"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRinging, BellSlash, CheckCircle, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react";
import { sendTestPushAction, subscribePushAction, unsubscribePushAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";

/**
 * Ayarlar → Bildirimler. Gerekçe lib/push.ts ve public/sw.js.
 *
 * Service worker YALNIZCA burada, "Bu Cihazda Aç"a basınca kaydediliyor;
 * bildirim istemeyen okuyucunun tarayıcısına hiçbir şey kurulmuyor. İzin
 * isteği de aynı tıklamanın içinde — tarayıcılar kullanıcı hareketi
 * olmadan sorulan izni sessizce reddediyor (Safari hiç sormuyor).
 *
 * Durum tarayıcıdan okunuyor, sunucudan değil: aynı hesabın telefonu açık,
 * bilgisayarı kapalı olabilir. Sunucudaki sayı (`devices`) yalnızca künye.
 */

type State = "checking" | "unsupported" | "denied" | "off" | "on" | "busy";
type Flash = { kind: "ok" | "error"; text: string } | null;

/** VAPID genel anahtarı base64url → `applicationServerKey`in beklediği bayt dizisi. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Cihaz künyesi — listede hangi satırın hangi cihaz olduğunu söylemeye yeter. */
function deviceName(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? "iPad" : "iPhone") : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return [browser, os].filter(Boolean).join(" · ");
}

function supported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

export function PushSettings({
  publicKey,
  devices,
  labels,
}: {
  /** `null`: sunucuda VAPID anahtarı yok — panel yalnızca bunu söylüyor. */
  publicKey: string | null;
  devices: number;
  labels: Dictionary["notifications"];
}) {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [flash, setFlash] = useState<Flash>(null);
  const [testing, startTest] = useTransition();

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.resolve();
      if (!supported()) return alive && setState("unsupported");
      if (Notification.permission === "denied") return alive && setState("denied");
      const subscription = await currentSubscription().catch(() => null);
      if (alive) setState(subscription && Notification.permission === "granted" ? "on" : "off");
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    if (!publicKey) return;
    setFlash(null);
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const result = await subscribePushAction(subscription.toJSON(), deviceName());
      if (!result.ok) {
        await subscription.unsubscribe().catch(() => undefined);
        throw new Error("save");
      }
      setState("on");
      router.refresh();
    } catch {
      setState("off");
      setFlash({ kind: "error", text: labels.failed });
    }
  }

  async function disable() {
    setFlash(null);
    setState("busy");
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await unsubscribePushAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
    } catch {
      // Tarayıcı tarafı düşse de sunucudaki satır silindi; bir sonraki
      // gönderimde servis 410 dönerse o da temizlenir.
    }
    setState("off");
    router.refresh();
  }

  function test() {
    setFlash(null);
    startTest(async () => {
      const result = await sendTestPushAction();
      setFlash(result.ok ? { kind: "ok", text: labels.testSent } : { kind: "error", text: labels.testFailed });
    });
  }

  const note = (text: string) => (
    <p className="flex items-start gap-2 text-small leading-relaxed text-body">
      <WarningCircle weight="duotone" size={16} className="mt-0.5 shrink-0 text-muted" />
      {text}
    </p>
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base leading-relaxed text-body">{labels.hint}</p>

      {!publicKey ? (
        note(labels.unavailable)
      ) : state === "unsupported" ? (
        note(labels.unsupported)
      ) : state === "denied" ? (
        note(labels.denied)
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {state === "on" ? (
            <>
              <span className="inline-flex items-center gap-1.5 pr-1 text-sm font-semibold text-up">
                <BellRinging weight="fill" size={16} />
                {labels.on}
              </span>
              <Button type="button" variant="ghost" onClick={test} aria-disabled={testing || undefined}>
                <PaperPlaneTilt weight="duotone" size={15} />
                {labels.test}
              </Button>
              <Button type="button" variant="ghost" onClick={disable}>
                <BellSlash weight="duotone" size={15} />
                {labels.disable}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={state === "off" ? enable : undefined}
              aria-disabled={state !== "off" || undefined}
              className="w-fit"
            >
              <BellRinging weight="duotone" size={15} />
              {state === "busy" ? labels.enabling : labels.enable}
            </Button>
          )}
          {devices > 0 && (
            <span className="text-small text-muted tabular-nums">
              {labels.devices.replace("{n}", String(devices))}
            </span>
          )}
        </div>
      )}

      {flash && (
        <p role="status" className="flex items-start gap-2 text-small leading-relaxed text-body">
          {flash.kind === "ok" ? (
            <CheckCircle weight="fill" size={16} className="mt-0.5 shrink-0 text-up" />
          ) : (
            <WarningCircle weight="fill" size={16} className="mt-0.5 shrink-0 text-down" />
          )}
          {flash.text}
        </p>
      )}
    </div>
  );
}
