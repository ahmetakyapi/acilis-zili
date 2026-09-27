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
          {result.data.map((group) => (
            <AdminRow key={`${group.kind}:${group.route}:${group.fingerprint}`}>
              <AdminCell rowHeader>
                <code className="text-small">{group.route}</code>
              </AdminCell>
              <AdminCell>
                <span className="line-clamp-2 break-words">{group.message}</span>
                {group.digest && (
                  <span className="mt-0.5 block text-tiny text-muted">
                    Kimlik <code className="numeral">{group.digest}</code>
                  </span>
                )}
              </AdminCell>
              <AdminCell>{group.kind === "server" ? "Sunucu" : "Tarayıcı"}</AdminCell>
              <AdminCell numeral>
                {group.count.toLocaleString("tr-TR")}
                <span className="block text-tiny text-muted">
                  {group.days === 1 ? "Tek Gün" : `${group.days} Günde`}
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
