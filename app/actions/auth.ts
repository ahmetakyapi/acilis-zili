"use server";

import { compare, hash } from "bcryptjs";
import { eq, or, sql } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DB_UNAVAILABLE, auth, signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { users, watchlists } from "@/lib/schema";
import { getDictionary, getLocale } from "@/lib/i18n";
import {
  AUTH_WINDOW_MS,
  DELETE_ACCOUNT_LIMIT,
  SIGN_IN_LIMIT,
  SIGN_UP_LIMIT,
  peekRateLimit,
  rateLimit,
  requestKey,
} from "@/lib/rate-limit";

export type AuthFormState = {
  error?: string;
  field?: "username" | "email" | "password" | "passwordConfirm" | "form";
};

/* --------------------------------------------------------------------------
   Oran sınırı

   Giriş ve kayıt uçlarında hiçbir tavan yoktu: aynı adresten dakikada
   binlerce şifre denemesi ya da binlerce hesap açılışı mümkündü. bcrypt'in
   maliyeti (12 tur) tek başına bir yavaşlatıcı ama ücretsiz bir koruma
   değil — her deneme sunucu işlemcisi harcıyor.

   Sınır bilinçli olarak cömert: yanlış şifreyi üç kez yazan gerçek bir
   kullanıcı hiç fark etmez, kaba kuvvet denemesi ilk dakikada durur.
   Sınırlayıcının dağıtık olmadığı ve neyi çözüp neyi çözmediği
   lib/rate-limit.ts başında yazılı.
   -------------------------------------------------------------------------- */
/* Sınırlar lib/rate-limit.ts'te: aynı sayaç `authorize()` kapısında da
   okunuyor ve iki ayrı sabit er geç birbirinden ayrı düşerdi. */

/**
 * Giriş sonrası dönülecek adres.
 *
 * `devam` parametresi proxy tarafından yazılıyordu ama hiç OKUNMUYORDU:
 * korumalı bir sayfadan giriş yapan kullanıcı işini bitirdiğinde ana
 * sayfaya düşüyordu. Artık okunuyor — ama körlemesine değil.
 *
 * Doğrulama şart: kullanıcıdan gelen bir adrese sorgusuz yönlendirmek açık
 * yönlendirme (open redirect) açığıdır ve kimlik avında kullanılır. Kabul
 * edilen tek biçim, tek eğik çizgiyle başlayan göreli yol. `//baska.site`
 * ve `/\baska.site` protokole göreli adreslerdir ve dışarı çıkarlar; bu
 * yüzden ikinci karakter de kontrol ediliyor.
 */
function safeRedirectTarget(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);

const signUpSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

/**
 * Postgres hata gövdesi — Drizzle onu bir kat sarıyor.
 *
 * `DrizzleQueryError` kendi mesajını yazıp asıl hatayı `cause` altına
 * koyuyor; `code` ve `constraint` orada. Üst seviyede aranırsa benzersizlik
 * ihlali (23505) hiç görülmez ve kullanıcı "kullanıcı adı alınmış" yerine
 * "bir şeyler ters gitti" okur. İki seviye de bakılıyor ki sürücü sarmayı
 * bırakırsa da çalışsın.
 */
function pgError(error: unknown): { code?: string; constraint?: string } | null {
  const seen = new Set<unknown>();
  let node: unknown = error;
  while (node && typeof node === "object" && !seen.has(node)) {
    seen.add(node);
    const candidate = node as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") {
      return {
        code: candidate.code,
        constraint:
          typeof candidate.constraint === "string" ? candidate.constraint : undefined,
      };
    }
    node = candidate.cause;
  }
  return null;
}

/**
 * Hata zincirinde bir işaret aranıyor mu?
 *
 * next-auth fırlatılan hatayı `CallbackRouteError` içine alıyor ve asıl
 * hatayı `cause.err` altına koyuyor — yani `String(error.cause)` "[object
 * Object]" verir, mesaj kaybolur. Zincir sonuna kadar geziliyor.
 */
function mentions(error: unknown, marker: string): boolean {
  const seen = new Set<unknown>();
  const stack: unknown[] = [error];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    const candidate = node as { message?: unknown; cause?: unknown; err?: unknown };
    if (typeof candidate.message === "string" && candidate.message.includes(marker)) {
      return true;
    }
    stack.push(candidate.cause, candidate.err);
  }
  return false;
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = getDictionary(locale).auth.errors;

  const limited = rateLimit(
    await requestKey("signup"),
    SIGN_UP_LIMIT,
    AUTH_WINDOW_MS,
  );
  if (!limited.allowed) {
    return { error: t.tooManyAttempts, field: "form" };
  }

  const rawUsername = String(formData.get("username") ?? "");
  const rawEmail = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!usernameSchema.safeParse(rawUsername).success) {
    return { error: t.usernameFormat, field: "username" };
  }
  if (!z.string().email().safeParse(rawEmail.trim().toLowerCase()).success) {
    return { error: t.emailFormat, field: "email" };
  }
  if (password.length < 8) {
    return { error: t.passwordLength, field: "password" };
  }
  if (password !== passwordConfirm) {
    return { error: t.passwordMismatch, field: "passwordConfirm" };
  }

  const parsed = signUpSchema.parse({
    username: rawUsername,
    email: rawEmail,
    password,
  });

  const existing = await db
    .select({ username: users.username, email: users.email })
    .from(users)
    .where(
      or(eq(users.username, parsed.username), eq(users.email, parsed.email)),
    )
    .limit(1);

  /* E-POSTA ÇAKIŞMASI "BU ADRES KAYITLI" DEMİYOR.
     Mesaj eskiden ayrıktı ve uç bir üyelik doğrulayıcısına dönüşüyordu:
     elindeki adres listesini buraya sokan biri hangilerinin siteye üye
     olduğunu öğrenebiliyordu (10 dakikada 5 deneme sınırı listeyi yavaşlatır,
     durdurmaz). Kişisel veri sızıntısı ve hedefli kimlik avının girdisi.
     Kullanıcı adı ayrık kalabilir: o zaten profil sayfalarında görünen bir
     kimlik ve formun çalışması için hangi alanın dolu olduğu söylenmeli.

     TAM ÇÖZÜM DEĞİL, bilerek: adres kayıtlı DEĞİLSE hesap gerçekten açılıyor
     ve saldırgan bunu yan etkiden anlayabilir. Bunu kapatmak kaydı e-posta
     doğrulamasına bağlamayı gerektiriyor (iki durumda da "adrese bir posta
     gönderildi" demek) — o ayrı bir iş, bir posta sağlayıcısı istiyor. */
  if (existing.length > 0) {
    return existing[0].username === parsed.username
      ? { error: t.usernameTaken, field: "username" }
      : { error: t.emailTaken, field: "form" };
  }

  const passwordHash = await hash(parsed.password, 12);

  /* HESAP VE İLK LİSTE TEK İFADEDE — ikisi de olur ya da hiçbiri.
     Önce `insert users`, sonra ayrı bir `insert watchlists` vardı. İkincisi
     patladığında (Neon'un HTTP bağlantısı isteğin ortasında düşebiliyor)
     ortaya listesiz bir hesap çıkıyordu ve daha kötüsü, kullanıcı "bir şeyler
     ters gitti" görüp yeniden denediğinde bu kez "kullanıcı adı alınmış"
     diyorduk — kendi yarım kaydına takılıyordu. Kurtarma yolu da yoktu.

     neon-http sürücüsü etkileşimli işlem (transaction) açmıyor: her sorgu
     ayrı bir HTTP isteği. Postgres'te tek ifade zaten atomiktir, o yüzden
     iki INSERT tek CTE'ye alındı. Ham SQL yazmanın gerekçesi bu; sütun
     adları şemayla elle eşleşiyor. */
  const listName = locale === "tr" ? "Takip listem" : "My watchlist";
  try {
    await db.execute(sql`
      with yeni_kullanici as (
        insert into ${users} (username, email, password_hash, locale)
        values (${parsed.username}, ${parsed.email}, ${passwordHash}, ${locale})
        returning id
      ), ilk_liste as (
        insert into ${watchlists} (user_id, name, color, sort_order)
        select id, ${listName}, 'primary', 0 from yeni_kullanici
      )
      select id from yeni_kullanici
    `);
  } catch (error) {
    /* Yukarıdaki varlık kontrolü ile bu ekleme arasında saniyenin küçük bir
       diliminde aynı adla ikinci bir kayıt gelebilir; benzersizlik indeksi
       onu burada durduruyor. Kullanıcıya "bir şeyler ters gitti" demek yerine
       gerçek nedeni söylüyoruz — hangi alan olduğunu indeks adı taşıyor. */
    const pg = pgError(error);
    const constraint = pg?.constraint ?? "";
    if (pg?.code === "23505") {
      return constraint.includes("email")
        ? { error: t.emailTaken, field: "form" }
        : { error: t.usernameTaken, field: "username" };
    }
    return { error: t.generic, field: "form" };
  }

  await signIn("credentials", {
    username: parsed.username,
    password: parsed.password,
    redirect: false,
  });

  const target = safeRedirectTarget(formData.get("devam"));
  redirect(target === "/" ? "/favoriler" : target);
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = getDictionary(locale).auth.errors;

  /* Sayaç BURADA ARTMIYOR, yalnızca okunuyor. Gerçek sayaç `authorize()`
     içinde (auth.ts) — orası iki yolun da geçmek zorunda olduğu tek nokta.
     Buradaki okuma yalnızca doğru mesajı göstermek için: sınır dolduğunda
     kullanıcı "şifre hatalı" değil "çok fazla deneme" görüyor. */
  const limited = peekRateLimit(await requestKey("signin"), SIGN_IN_LIMIT);
  if (!limited.allowed) {
    return { error: t.tooManyAttempts, field: "form" };
  }

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: t.invalidCredentials, field: "form" };
  }

  try {
    await signIn("credentials", { username, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      /* Veritabanı hatası ile yanlış şifre AYRI ŞEYLER. İkisi de aynı
         mesajı verdiğinde okuyucu şifresini değiştirmeye çalışıyor, oysa
         sorun onda değil. İşaret `auth.ts` ile paylaşılıyor. */
      if (mentions(error, DB_UNAVAILABLE)) {
        return { error: t.generic, field: "form" };
      }
      return { error: t.invalidCredentials, field: "form" };
    }
    throw error;
  }

  redirect(safeRedirectTarget(formData.get("devam")));
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/* --------------------------------------------------------------------------
   Hesap silme

   KVKK m. 11 silme hakkının çalışan karşılığı. Ekranda bir onay kutusu değil,
   kullanıcı adını yazdırma var: yanlışlıkla tıklanması mümkün olmayan tek
   desen bu. Şifre de isteniyor — oturum çerezi ele geçirilmiş bir tarayıcı
   hesabı silememeli.

   Silme gerçekten siliyor: users satırı gidince watchlists ve
   watchlist_items ON DELETE CASCADE ile birlikte düşüyor. Yumuşak silme
   (soft delete) bilinçli olarak yok — "sildim" demek, silmek demektir.
   -------------------------------------------------------------------------- */

export type DeleteAccountState = { error?: string };

export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const locale = await getLocale();
  const t = getDictionary(locale).settings;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: t.deleteNotSignedIn };

  /* ŞİFRE DENEMESİ BURADA DA SAYILIYOR. Uç her çağrıda bcrypt (cost 12)
     çalıştırıyordu ve hiçbir tavanı yoktu. Şifre sorulmasının gerekçesi
     "oturum çerezi ele geçirilmiş bir tarayıcı hesabı silememeli" — ama
     sayaç olmadan çerezi ele geçiren saldırgan tam da buradan sınırsız
     deneme yapabiliyordu, yani koruma kendi tehdit modeline karşı
     çalışmıyordu. Üstelik her istek ~250 ms işlemci yakıyor.

     Anahtar IP DEĞİL kullanıcı: silme zaten oturuma bağlı, saldırgan IP
     değiştirerek kaçamasın. */
  const limited = rateLimit(
    `delete-account:${userId}`,
    DELETE_ACCOUNT_LIMIT,
    AUTH_WINDOW_MS,
  );
  if (!limited.allowed) return { error: t.deleteTooMany };

  const confirmation = String(formData.get("confirm") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { error: t.deleteNotSignedIn };
  if (confirmation !== user.username) return { error: t.deleteConfirmMismatch };
  if (!password || !(await compare(password, user.passwordHash))) {
    return { error: t.deleteWrongPassword };
  }

  await db.delete(users).where(eq(users.id, userId));

  // signOut yönlendirmeyi kendi atar; buradan sonrası çalışmaz.
  await signOut({ redirectTo: "/" });
  return {};
}
