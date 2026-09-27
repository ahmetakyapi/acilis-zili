import type { Instrumentation } from "next";

/**
 * Sunucu hatalarının kaydı (28 Eylül).
 *
 * Next her yakalanmamış sunucu hatasında (sayfa çizimi, rota ucu, sunucu
 * eylemi) bunu çağırıyor; `notFound()` ve `redirect()` gibi akış
 * denetimleri buraya düşmüyor. Hata okuyucuya zaten hata sınırında
 * gösterildi — burada yalnızca izi `app_errors`a işleniyor ki okuyucunun
 * ekranında gördüğü kimlik (`digest`) panelde aranabilsin.
 *
 * ROTA ŞABLONU, ADRES DEĞİL: `routePath` "/hisse/[symbol]" veriyor, gerçek
 * adres (sorgu dizesiyle birlikte) hiç yazılmıyor. İstek başlıkları da
 * okunmuyor — IP ve tarayıcı künyesi tabloya girmez (lib/schema.ts →
 * appErrors).
 *
 * YALNIZCA NODE ÇALIŞMA ZAMANI. Veritabanı sürücüsü ve `node:crypto`
 * orada; modül dinamik yükleniyor ki başka bir çalışma zamanının
 * paketine sızmasın. Kayıt `recordError` içinde her koşulda sessiz.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  /* Geliştirmede kayıt yok: yerel `.env.local` çoğu zaman üretim
     veritabanını gösteriyor ve yarım yazılmış bir bileşenin hataları
     panele düşmemeli (aynı kural sayfa ölçümünde, lib/analytics.ts →
     shouldRecord). */
  if (process.env.NODE_ENV !== "production") return;
  const [{ recordError }, { describeError }] = await Promise.all([
    import("./lib/error-log"),
    import("./lib/error-log-core"),
  ]);
  const { message, stack, digest } = describeError(error);
  await recordError({ kind: "server", route: context.routePath, digest, message, stack });
};
