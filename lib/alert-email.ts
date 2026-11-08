import { deliverableRecipient, sendNotificationEmail } from "@/lib/email-notify";
import { getDictionary } from "@/lib/i18n";
import { alertEmailMessage, type AlertEmailInput } from "@/lib/notify-emails";

/**
 * Alarm postası (16 Ekim) — tetik anında, gelen kutusu ve push'la AYNI
 * olaydan. `notifyUser` çağırır (lib/notifications.ts); tercih kapalıysa,
 * adres onaysızsa ya da günlük bütçe dolduysa sessizce gitmez.
 *
 * Tekrarsızlık anahtarı alarmın kimliği + tetik anı: yeniden kurulup ertesi
 * gün yine tetiklenen alarm yeni bir posta, aynı tetiğin ikinci denemesi değil.
 * Taramanın bildirim tekrarı (lib/alert-state.ts) bu anahtara dayanır: aynı
 * tetiğin ikinci denemesi postayı yeniden göndermez ("duplicate").
 *
 * Sonuç döner (8 Kasım): alarm durumu yalnız `"sent"`i teslim sayar;
 * `"skipped"` = tercih kapalı/adres onaysız, posta hiç denenmedi.
 */
export async function sendAlertEmail(
  userId: string,
  alert: AlertEmailInput & { alertId: string },
): Promise<Awaited<ReturnType<typeof sendNotificationEmail>> | "skipped"> {
  const recipient = await deliverableRecipient(userId, "alerts");
  if (!recipient) return "skipped";
  const copy = getDictionary(recipient.locale).emailNotify;
  const result = await sendNotificationEmail(
    recipient,
    "alert",
    `alert:${alert.alertId}:${alert.firedAt.toISOString()}`,
    (r) => alertEmailMessage(r, alert, copy),
  );
  if (result === "budget" || result === "failed" || result === "unknown") {
    console.error(`[e-posta] alarm postası gitmedi: ${result}`);
  }
  return result;
}
