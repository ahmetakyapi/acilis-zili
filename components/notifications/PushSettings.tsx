"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRinging, BellSlash, CheckCircle, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react";
import {
  sendTestPushAction,
  setEarningsReminderAction,
  subscribePushAction,
  unsubscribePushAction,
} from "@/app/actions/notifications";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";
import { deviceLabel } from "@/lib/push-device";

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
 *
 * AMA "AÇIK" SUNUCUYLA EŞİTLENEREK SÖYLENİR (16 Ekim). Durum yalnız
 * tarayıcıdan okunurken iki yalan mümkündü: (1) ortak bir cihazda A çıkıp B
 * girince tarayıcıdaki abonelik A'nın satırına bağlı kalıyor, panel B'ye
 * "Açık" diyor, bildirimler A'ya gidiyordu; (2) VAPID anahtarı değişince eski
 * abonelik ölü ama tarayıcıda duruyor. Panel açılınca anahtar karşılaştırılır
 * (uyuşmazsa abonelik bırakılır, "Kapalı") ve abonelik sessizce bu hesaba
 * yeniden yazılır — eylem upsert, aynı satırsa hiçbir şey değişmez.
 */

type State = "checking" | "unsupported" | "denied" | "off" | "on" | "busy" | "disabling";
type Flash = { kind: "ok" | "error"; text: string } | null;

/** VAPID genel anahtarı base64url → `applicationServerKey`in beklediği bayt dizisi. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Cihaz künyesi — tek kaynak lib/push-device.ts (yenileme ucu da okur). */
function deviceName(): string {
  return deviceLabel(navigator.userAgent);
}

/** Abonelik bu sunucunun BUGÜNKÜ anahtarıyla mı alınmış? Bilinmiyorsa evet say. */
function sameKey(subscription: PushSubscription, publicKey: string): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current);
  const b = keyBytes(publicKey);
  return a.length === b.length && a.every((value, i) => value === b[i]);
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
  earnings,
  labels,
}: {
  /** `null`: sunucuda VAPID anahtarı yok — panel yalnızca bunu söylüyor. */
  publicKey: string | null;
  devices: number;
  /** Bilanço hatırlatması tercihi; `null` tablo yok demek — anahtar basılmaz. */
  earnings: { enabled: boolean } | null;
  labels: Dictionary["notifications"];
}) {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [flash, setFlash] = useState<Flash>(null);
  const [testing, startTest] = useTransition();
  /* İyimser anahtar: tık anında döner, yazma düşerse geri sarar. */
  const [earningsOn, setEarningsOn] = useState(earnings?.enabled ?? false);
  const [savingPref, startPref] = useTransition();

  function toggleEarnings(next: boolean) {
    setFlash(null);
    setEarningsOn(next);
    startPref(async () => {
      const result = await setEarningsReminderAction(next);
      if (!result.ok) {
        setEarningsOn(!next);
        setFlash({ kind: "error", text: labels.earningsPrefFailed });
      }
    });
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.resolve();
      if (!supported()) return alive && setState("unsupported");
      if (Notification.permission === "denied") return alive && setState("denied");
      const subscription = await currentSubscription().catch(() => null);
      if (!subscription || Notification.permission !== "granted" || !publicKey) {
        if (alive) setState("off");
        return;
      }
      if (!sameKey(subscription, publicKey)) {
        await subscription.unsubscribe().catch(() => undefined);
        if (alive) setState("off");
        return;
      }
      const result = await subscribePushAction(subscription.toJSON(), deviceName()).catch(() => ({
        ok: false,
        changed: false,
      }));
      if (!alive) return;
      setState(result.ok ? "on" : "off");
      if (result.changed) router.refresh();
    })();
    return () => {
      alive = false;
    };
  }, [publicKey, router]);

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
      let existing = await registration.pushManager.getSubscription();
      if (existing && !sameKey(existing, publicKey)) {
        await existing.unsubscribe().catch(() => undefined);
        existing = null;
      }
      const subscription =
        existing ??
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

  /* ÖNCE TARAYICI (16 Ekim). Gerçek anahtar tarayıcıdaki abonelik: o
     bırakılınca push servisi bu cihaza hiçbir şey taşımaz, sunucudaki satır
     ilk gönderimde 410 alıp kendiliğinden silinir. Sıra tersken sunucu
     çağrısı düşünce (çevrimdışı, sürüm değişti) tarayıcı aboneliği yerinde
     kalıyor, ekran "Kapalı" derken bildirimler gelmeye devam ediyordu. */
  async function disable() {
    setFlash(null);
    setState("disabling");
    let subscription: PushSubscription | null = null;
    try {
      subscription = await currentSubscription();
      if (subscription && !(await subscription.unsubscribe())) throw new Error("unsubscribe");
    } catch {
      setState("on");
      setFlash({ kind: "error", text: labels.failed });
      return;
    }
    if (subscription) await unsubscribePushAction(subscription.endpoint).catch(() => undefined);
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
          {state === "on" || state === "disabling" ? (
            <>
              <span className="inline-flex items-center gap-1.5 pr-1 text-sm font-semibold text-up">
                <BellRinging weight="fill" size={16} />
                {labels.on}
              </span>
              <Button type="button" variant="ghost" onClick={test} aria-disabled={testing || state === "disabling" || undefined}>
                <PaperPlaneTilt weight="duotone" size={15} />
                {labels.test}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={state === "on" ? disable : undefined}
                aria-disabled={state === "disabling" || undefined}
              >
                <BellSlash weight="duotone" size={15} />
                {state === "disabling" ? labels.disabling : labels.disable}
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
              {(devices === 1 ? labels.devicesOne : labels.devices).replace("{n}", String(devices))}
            </span>
          )}
        </div>
      )}

      {/* BİLANÇO HATIRLATMASI (15 Ekim) — hesap genelinde, cihaz başına
          değil (gerekçe lib/schema.ts → notificationPrefs). Yalnızca tablo
          varken ve bildirim altyapısı kuruluyken basılır. */}
      {earnings && publicKey && state !== "unsupported" && (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 border-t border-line-soft pt-3 sm:min-h-0">
          <input
            type="checkbox"
            checked={earningsOn}
            disabled={savingPref}
            onChange={(event) => toggleEarnings(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-strong">{labels.earningsPref}</span>
            <span className="text-small leading-relaxed text-muted">{labels.earningsPrefHint}</span>
          </span>
        </label>
      )}

      {/* Canlı bölge HEP basılı, yalnız içeriği değişir: sonradan eklenen
          `role="status"` düğümünü NVDA/JAWS çoğu zaman okumuyordu. */}
      <p role="status" aria-live="polite" className={cn("items-start gap-2 text-small leading-relaxed text-body", flash ? "flex" : "sr-only")}>
        {flash ? (
          <>
            {flash.kind === "ok" ? (
              <CheckCircle weight="fill" size={16} className="mt-0.5 shrink-0 text-up" />
            ) : (
              <WarningCircle weight="fill" size={16} className="mt-0.5 shrink-0 text-down" />
            )}
            {flash.text}
          </>
        ) : state === "on" ? (
          labels.on
        ) : null}
      </p>
    </div>
  );
}
