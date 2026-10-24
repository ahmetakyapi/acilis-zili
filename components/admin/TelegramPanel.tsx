import {
  AdminEmpty,
  AdminPanel,
  AdminPanelError,
  AdminPanelTitle,
  HealthList,
  HealthRow,
} from "@/components/admin/AdminUI";
import { adminStamp } from "@/lib/admin-format";
import { recentTelegramPosts, telegramChannels } from "@/lib/telegram";

/**
 * Telegram kanalı — son gönderimler (24 Ekim). Sistem ekranında, hatalar
 * panelinin altında: kanalın sağlığı "en son ne gitti" sorusu.
 *
 * Üç hâl, üçü de ADIYLA söylenir: kanal kapalı (ortam değişkeni yok), defter
 * tablosu yok (migration uygulanmamış — gönderici bu durumda HİÇ
 * göndermiyor, gerekçe lib/schema.ts → telegramPosts) ya da son satırlar.
 * "claimed" kalmış satır gönderim sırasında ya da hemen sonra düşmüş koşu:
 * mesaj gitmiş olabilir, tekrar denenmez — sarı.
 */

/** Panelde gösterilen satır sayısı. */
const TELEGRAM_PANEL_ROWS = 8;

const KIND_LABEL: Record<string, string> = {
  acilis: "Açılış",
  kapanis: "Kapanış",
  mercek: "Mercek",
  makro: "Makro Veri",
};

export async function TelegramPanel() {
  const channels = telegramChannels();
  const rows = channels.length > 0 ? await recentTelegramPosts(TELEGRAM_PANEL_ROWS) : [];
  const now = new Date();
  const hint =
    channels.length === 0
      ? "Kapalı · Ortam Değişkeni Tanımlı Değil"
      : `Kanal ${channels.map((channel) => channel.locale.toUpperCase()).join(" · ")} · Son ${TELEGRAM_PANEL_ROWS} Gönderim`;

  return (
    <AdminPanel id="telegram">
      <AdminPanelTitle hint={hint}>Telegram</AdminPanelTitle>
      {channels.length === 0 ? (
        <AdminEmpty
          title="Gönderici Uyuyor"
          hint="TELEGRAM_BOT_TOKEN ve TELEGRAM_CHANNEL_ID tanımlanınca beş dakikalık cron gönderime başlar."
        />
      ) : rows === null ? (
        <AdminPanelError>
          Gönderim defteri okunamadı. Tablo yoksa (telegram_posts) gönderici hiç göndermez; migration
          uygulanmalı.
        </AdminPanelError>
      ) : rows.length === 0 ? (
        <AdminEmpty title="Henüz Gönderim Yok" hint="İlk mesaj bir sonraki açılış ya da kapanış penceresinde gider." />
      ) : (
        <HealthList>
          {rows.map((row) => (
            <HealthRow
              key={row.id}
              tone={row.status === "sent" ? "ok" : "warn"}
              label={`${KIND_LABEL[row.kind] ?? row.kind} · ${row.locale.toUpperCase()}`}
              note={row.summary ?? row.dedupeKey}
              value={adminStamp(row.sentAt ?? row.createdAt, now)}
              status={row.status === "sent" ? "Gönderildi" : "Yarıda Kaldı"}
            />
          ))}
        </HealthList>
      )}
    </AdminPanel>
  );
}
