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
 */
export async function sendAlertEmail(userId: string, alert: AlertEmailInput & { alertId: string }): Promise<void> {
  const recipient = await deliverableRecipient(userId, "alerts");
  if (!recipient) return;
  const copy = getDictionary(recipient.locale).emailNotify;
  const result = await sendNotificationEmail(
    recipient,
    "alert",
    `alert:${alert.alertId}:${alert.firedAt.toISOString()}`,
    (r) => alertEmailMessage(r, alert, copy),
  );
  if (result === "budget" || result === "failed") {
    console.error(`[e-posta] alarm postası gitmedi: ${result}`);
  }
}
