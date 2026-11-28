import {
  AdminCell,
  AdminEmpty,
  AdminPanel,
  AdminPanelError,
  AdminPanelTitle,
  AdminRow,
  AdminTable,
} from "@/components/admin/AdminUI";
import { adminStamp } from "@/lib/admin-format";
import { ERROR_RETENTION_DAYS } from "@/lib/error-log-core";
import type { ErrorGroup, ErrorRead } from "@/lib/error-log";
import { mergeErrorGroups } from "@/lib/error-summary";

/**
 * Uygulama hataları — Sistem sekmesinin paneli, çapası `#hatalar`
 * (28 Eylül). Özet'in "Dikkat İsteyenler" satırı buraya iniyor.
 *
 * Satır bir HATA, bir olay değil: aynı rota ve aynı parmak izi (sunucuda
 * `digest`) pencere boyunca tek satır, toplam sayısı ve kaç günde
 * görüldüğüyle. `digest` okuyucunun hata ekranında gördüğü kimlik — "şu
 * kodu aldım" diyen bir bildirimi burada bulmak için satırda duruyor.
 *
 * Mesaj yazılırken örtülüp kırpıldı (lib/error-log-core.ts); yığın panelde
 * gösterilmiyor, veritabanında duruyor. Tablo yokken "hata yok" DENMİYOR:
 * okuma tablonun yokluğunu ayrıca söylüyor ve panel onu cümleyle yazıyor —
 * aksi unutulmuş bir migration'ı sakin bir güne çevirirdi.
 *
 * Tablo 760 pikselin altında kendi kabında kayıyor, rota sütunu sabit
 * ("Kaydırma saklanmaz", CLAUDE.md).
 *
 * SATIR TEK SATIR (28 Kasım, sahibinin isteği: "alt satıra kaymasın, daha
 * anlaşılabilir okunabilir dursun"). Ham mesaj iki satıra kadar basılıyor,
 * altında kimlik, görülme hücresinde gün sayısı ayrı satırdaydı; bir hata
 * 87–117 piksel tutuyordu ve aynı hata farklı kimliklerle üç kez alt alta
 * duruyordu. Artık mesaj kısa bir ada iniyor (lib/error-summary.ts), aynı
 * ada düşen gruplar birleşiyor, görülme ile gün yan yana. Satırın kendisi
 * bir `<details>` özeti: basınca ham mesaj ve kimlikler altında açılıyor —
 * "şu kodu aldım" diyen bildirim yine bulunuyor. Ölçüldü (geçici rota, 1024
 * ve 1440): her satır 45 piksel, eskiden 87–117.
 */
export function ErrorGroupsPanel({
  result,
  days,
  now,
}: {
  result: ErrorRead<ErrorGroup[]>;
  days: number;
  now: Date;
}) {
  return (
    <AdminPanel id="hatalar">
      <AdminPanelTitle
        hint={`Son ${days} Gün · Rota ve Hataya Göre Gruplu · ${ERROR_RETENTION_DAYS} Günde Silinir`}
      >
        Uygulama Hataları
      </AdminPanelTitle>
      {!result.ok ? (
        <AdminPanelError>
          {result.missingTable
            ? "Hata tablosu henüz kurulmadı; app_errors migration'ı uygulanınca kayıtlar burada görünür."
            : undefined}
        </AdminPanelError>
      ) : result.data.length === 0 ? (
        <AdminEmpty title={`Son ${days} günde kaydedilen hata yok.`} />
      ) : (
        <AdminTable
          head={["Rota", "Hata", "Tür", "Görülme", "Son"]}
          label="Uygulama hataları tablosu"
          minWidth={760}
          stickyFirst
          align="top"
        >
          {mergeErrorGroups(result.data).map((group) => (
            <AdminRow key={`${group.kind}:${group.route}:${group.fingerprint}`}>
              <AdminCell rowHeader>
                <code className="whitespace-nowrap text-small">{group.route}</code>
              </AdminCell>
              <AdminCell>
                <details className="group/err">
                  <summary className="flex cursor-pointer list-none items-baseline gap-2 [&::-webkit-details-marker]:hidden">
                    <span className="shrink-0 whitespace-nowrap font-semibold text-strong">{group.summary.title}</span>
                    {group.summary.detail && (
                      <span className="min-w-0 truncate text-small text-muted">{group.summary.detail}</span>
                    )}
                    <span
                      aria-hidden
                      className="ml-auto shrink-0 text-tiny text-primary transition-transform duration-200 ease-brand group-open/err:rotate-180"
                    >
                      ▾
                    </span>
                    <span className="sr-only">Ham mesajı göster</span>
                  </summary>
                  <div className="mt-2 flex flex-col gap-1.5 rounded-(--radius-sm) bg-surface-sunken px-3 py-2 text-small text-muted">
                    {group.messages.map((message) => (
                      <p key={message} className="break-words">
                        {message}
                      </p>
                    ))}
                    {group.digests.length > 0 && (
                      <p className="text-tiny">
                        {group.digests.length === 1 ? "Kimlik" : `${group.digests.length} Kimlik`}{" "}
                        <code className="numeral">{group.digests.join(" · ")}</code>
                      </p>
                    )}
                  </div>
                </details>
              </AdminCell>
              <AdminCell>{group.kind === "server" ? "Sunucu" : "Tarayıcı"}</AdminCell>
              <AdminCell numeral>
                <span className="whitespace-nowrap">
                  <span className="font-semibold text-strong">{group.count.toLocaleString("tr-TR")}</span>
                  <span className="text-small text-muted">
                    {" · "}
                    {group.days === 1 ? "Tek Gün" : `${group.days} Gün`}
                  </span>
                </span>
              </AdminCell>
              <AdminCell align="right">
                <span className="whitespace-nowrap">{adminStamp(group.lastAt, now)}</span>
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </AdminPanel>
  );
}
