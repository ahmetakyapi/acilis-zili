"use server";

import { compare, hash } from "bcryptjs";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { DB_UNAVAILABLE, auth, signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { passwordResets, users, watchlists } from "@/lib/schema";
import { emailConfigured, sendEmail } from "@/lib/email";
import { hashResetToken, issueResetToken, resetEmail, resetTokenOwner } from "@/lib/password-reset";
import { withLocale } from "@/lib/i18n/routing";
import { SITE_URL } from "@/lib/site";
import { getDictionary, getLocale } from "@/lib/i18n";
import { normalizeUsername } from "@/lib/utils";
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
  /** Başarı notu — şifre sıfırlama isteği "gönderildi" diyor (form yerinde kalıyor). */
  notice?: string;
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
 * edilen tek biçim, tek eğik çizgiyle başlayan göreli yol.
 *
 * ÖN EK ELEMEK YETMEDİ. Önce yalnızca `//` ve `/\` ön ekleri eleniyordu;
 * `.trim()` de baş ve sondaki boşluğu attığı için ARADAKİ sekme hayatta
 * kalıyordu. Sonuç: `/<TAB>/evil.com` iki denetimden de geçiyordu ama
 * tarayıcı onu çözerken WHATWG kuralı gereği sekme, satır başı ve satır
 * sonunu AYRIŞTIRMADAN ÖNCE siliyor — geriye protokole göreli `//evil.com`
 * kalıyor ve kullanıcı https://evil.com'da açılıyordu. Açık yönlendirme
 * kapatıldı sanılıyordu, kapanmamıştı.
 *
 * Doğru yol dizeyi elemek değil ÇÖZMEK: adres, sitenin kendi kökü taban
 * alınarak ayrıştırılıyor ve çıkan `origin` tabanla aynı değilse
 * reddediliyor. Tarayıcı hangi kuralla çözüyorsa doğrulama da o kuralla
 * çözüyor, yani aradaki fark kapanıyor. `startsWith("/")` denetimi
 * ayrıştırmadan ÖNCE duruyor: `https://evil.com` mutlak bir adres ve
 * ayrıştırıcı onu sorunsuz çözerdi, oysa buraya hiç girmemeli.
 */
const REDIRECT_BASE = "https://acilis-zili.local";

function safeRedirectTarget(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/")) return "/";
  try {
    const url = new URL(value, REDIRECT_BASE);
    if (url.origin !== REDIRECT_BASE) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

const usernameSchema = z
  .string()
  /* Küçültme `normalizeUsername` ile: düz `toLowerCase()` Türkçe "İ"yi
     bozuyor ve doğrulama patlıyordu (gerekçe lib/utils.ts'te). */
  .transform(normalizeUsername)
  .refine((value) => /^[a-z0-9_]{3,20}$/.test(value));

/**
 * Şifre kuralı — alt VE üst sınır, artı bariz zayıflar.
 *
 * Tek koşul `min(8)` idi: "12345678" ve "password" kabul ediliyordu, üst
 * sınır da yoktu. Üst sınır teknik bir zorunluluk: bcryptjs 72 baytın
 * ötesini SESSİZCE yok sayıyor, yani çok uzun bir şifre yazan kullanıcı
 * sandığından kısa bir sırra sahip oluyor ve bunu hiçbir yerde öğrenmiyordu.
 *
 * Zayıf şifre kontrolü liste tabanlı DEĞİL, kural tabanlı: kullanıcı adını
 * ya da e-postanın yerel kısmını içeren şifre reddediliyor. Bir milyonluk
 * sızıntı listesi taşımak bu ürünün ölçeğinde abartı; asıl yakalanmak
 * istenen "ahmet123" tipi şifre ve onu bu kural yakalıyor.
 */
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

const signUpSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(MIN_PASSWORD).max(MAX_PASSWORD),
});

function weakPassword(password: string, username: string, email: string) {
  const lower = password.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (username.length >= 3 && lower.includes(username.toLowerCase())) return true;
  if (local.length >= 3 && lower.includes(local)) return true;
  return false;
}

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
  if (password.length < MIN_PASSWORD) {
    return { error: t.passwordLength, field: "password" };
  }
  if (password.length > MAX_PASSWORD) {
    return { error: t.passwordTooLong, field: "password" };
  }
  if (password !== passwordConfirm) {
    return { error: t.passwordMismatch, field: "passwordConfirm" };
  }

  if (weakPassword(password, rawUsername, rawEmail)) {
    return { error: t.passwordWeak, field: "password" };
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

  const target = safeRedirectTarget(formData.get("devam"));

  /* HESAP AÇILDIKTAN SONRAKİ GİRİŞ SARILI. Bu çağrı çıplaktı ve aynı
     dosyadaki `signInAction` aynı çağrıyı try/catch ile sarıyordu — yani
     asimetri bir karar değil, unutmaydı.

     Fırlatabilir, üstelik kullanıcının hiçbir hatası olmadan: `authorize()`
     oran sınırını şifre karşılaştırmasından ÖNCE okuyor ve kayıt akışındaki
     bu `signIn` giriş formuyla AYNI kovayı tüketiyor. Aynı ağdan arka arkaya
     kayıt olan birkaç kişi kovayı doldurabiliyor.

     Fırlarsa kaybedilen şey yalnızca OTURUM: hesap açıldı, şifre çalışıyor.
     Kullanıcıyı "bir şeyler ters gitti" ekranına düşürmek yerine giriş
     sayfasına gönderiyoruz — oradaki akış oran sınırı mesajını zaten doğru
     gösteriyor ve `devam` korunduğu için okuyucu gitmek istediği yere
     varıyor. Yeni bir sözlük anahtarı da gerekmiyor.

     `redirect()` Next'te bir hata fırlatarak çalışır; catch bloğu içinde
     çağrılamaz, o yüzden bayrakla dışarı taşınıyor. */
  let oturumAcildi = true;
  try {
    await signIn("credentials", {
      username: parsed.username,
      password: parsed.password,
      redirect: false,
    });
  } catch {
    oturumAcildi = false;
  }

  if (!oturumAcildi) {
    redirect(`/giris?devam=${encodeURIComponent(target === "/" ? "/favoriler" : target)}`);
  }
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

  const username = normalizeUsername(String(formData.get("username") ?? ""));
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

   Silme gerçekten siliyor: users satırı gidince watchlists,
   watchlist_items, user_avatars, portfolio_positions, portfolio_sales, price_alerts, push_subscriptions ve password_resets ON DELETE CASCADE
   ile birlikte düşüyor. Kullanıcıya bağlı YENİ bir tablo da aynı kuralla
   kurulmalı — yoksa silinen hesabın verisi yetim kalır. Yumuşak silme
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

  const confirmation = normalizeUsername(String(formData.get("confirm") ?? ""));
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

/* --------------------------------------------------------------------------
   Şifre değiştirme (9 Ekim)

   Ayarlarda şifre değiştirmenin hiçbir yolu yoktu. Mevcut şifre soruluyor
   (oturum çerezi ele geçirilmiş bir tarayıcı şifreyi değiştirip hesabı
   ele geçiremesin) ve deneme sayılıyor — hesap silmeyle aynı tehdit modeli,
   aynı kova türü (kullanıcı başına).

   Kurallar kayıtla AYNI: 8–72 karakter (bcrypt 72 bayt ötesini sessizce
   yok sayıyor), kullanıcı adını ya da e-postanın yerel kısmını içermesin.
   Yeni şifre eskisiyle aynı olamaz.

   DİĞER OTURUMLAR AÇIK KALIYOR, bilerek ve ekranda yazılı. Oturumlar JWT;
   eski çerezleri geçersiz kılmak `users`a bir oturum sürümü sütunu
   eklemeyi gerektiriyor ve o sütun migration inene kadar her girişi
   kırardı (CLAUDE.md → "Migration'lar deploy'da UYGULANMAZ").
   -------------------------------------------------------------------------- */

const PASSWORD_CHANGE_LIMIT = 5;

export type ChangePasswordState = {
  status: "idle" | "saved" | "error";
  error?: string;
  field?: "current" | "next" | "confirm" | "form";
};

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const P = t.passwordChange;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: "error", error: P.signedOut, field: "form" };

  const limited = rateLimit(`change-password:${userId}`, PASSWORD_CHANGE_LIMIT, AUTH_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: P.tooMany, field: "form" };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < MIN_PASSWORD) return { status: "error", error: t.auth.errors.passwordLength, field: "next" };
  if (next.length > MAX_PASSWORD) return { status: "error", error: t.auth.errors.passwordTooLong, field: "next" };
  if (next !== confirm) return { status: "error", error: t.auth.errors.passwordMismatch, field: "confirm" };

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { status: "error", error: P.signedOut, field: "form" };
  if (!current || !(await compare(current, user.passwordHash))) {
    return { status: "error", error: P.wrongCurrent, field: "current" };
  }
  if (weakPassword(next, user.username, user.email)) {
    return { status: "error", error: t.auth.errors.passwordWeak, field: "next" };
  }
  if (await compare(next, user.passwordHash)) {
    return { status: "error", error: P.sameAsOld, field: "next" };
  }

  try {
    await db.update(users).set({ passwordHash: await hash(next, 12) }).where(eq(users.id, userId));
  } catch {
    return { status: "error", error: P.failed, field: "form" };
  }
  return { status: "saved" };
}

/* --------------------------------------------------------------------------
   Şifre sıfırlama (9 Ekim) — gerekçe lib/schema.ts → passwordResets.

   HESAP VAR MI SORUSUNA CEVAP YOK. İstek her geçerli adreste AYNI notu
   veriyor ("kayıtlı bir hesap varsa gelir"): aksi hâlde form, hangi
   e-postanın sitede hesabı olduğunu soran herkese söylerdi. E-posta
   gönderimi yanıttan SONRA (`after`), yani yanıt süresi de hesabın
   varlığını ele vermiyor.
   -------------------------------------------------------------------------- */

/** IP başına on dakikada beş istek; adres başına saatte üç e-posta. */
const RESET_REQUEST_LIMIT = 5;
const RESET_EMAIL_LIMIT = 3;
const RESET_SUBMIT_LIMIT = 10;

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const R = t.passwordReset;
  if (!emailConfigured()) return { error: R.failed, field: "form" };

  if (!rateLimit(await requestKey("pw-reset"), RESET_REQUEST_LIMIT, AUTH_WINDOW_MS).allowed) {
    return { error: R.tooMany, field: "form" };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return { error: t.auth.errors.emailFormat, field: "email" };
  }

  const sent: AuthFormState = { notice: R.requestSent };
  /* Adres başına tavan sessiz: aşıldığında da aynı not dönüyor, yalnızca
     yeni e-posta gitmiyor (birinin adresine posta yağdırılamasın). */
  if (!rateLimit(`pw-reset-mail:${email}`, RESET_EMAIL_LIMIT, 60 * 60_000).allowed) return sent;

  let user: { id: string; username: string; email: string } | undefined;
  try {
    [user] = await db
      .select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
  } catch {
    return { error: R.failed, field: "form" };
  }
  if (!user) return sent;

  const token = await issueResetToken(user.id);
  if (!token) return sent;
  const link = `${SITE_URL}${withLocale("/sifre-sifirla", locale)}?anahtar=${token}`;
  const message = resetEmail({ to: user.email, username: user.username, link, copy: R.mail });
  after(async () => {
    await sendEmail(message);
  });
  return sent;
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const R = t.passwordReset;

  if (!rateLimit(await requestKey("pw-reset-submit"), RESET_SUBMIT_LIMIT, AUTH_WINDOW_MS).allowed) {
    return { error: R.tooMany, field: "form" };
  }
  const token = String(formData.get("anahtar") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("passwordConfirm") ?? "");

  const userId = await resetTokenOwner(token);
  if (!userId) return { error: R.invalid, field: "form" };
  if (next.length < MIN_PASSWORD) return { error: t.auth.errors.passwordLength, field: "password" };
  if (next.length > MAX_PASSWORD) return { error: t.auth.errors.passwordTooLong, field: "password" };
  if (next !== confirm) return { error: t.auth.errors.passwordMismatch, field: "passwordConfirm" };

  try {
    const [user] = await db
      .select({ username: users.username, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return { error: R.invalid, field: "form" };
    if (weakPassword(next, user.username, user.email)) {
      return { error: t.auth.errors.passwordWeak, field: "password" };
    }
    const now = new Date();
    /* Şifre, bağlantının kullanıldı işareti ve hesabın öteki açık
       bağlantıları TEK işlemde: yarım kalmış bir sıfırlama, kullanılmış
       sayılmayan bir bağlantı bırakmasın. */
    await db.batch([
      db.update(users).set({ passwordHash: await hash(next, 12) }).where(eq(users.id, userId)),
      db
        .update(passwordResets)
        .set({ usedAt: now })
        .where(and(eq(passwordResets.tokenHash, hashResetToken(token)), isNull(passwordResets.usedAt))),
      db
        .delete(passwordResets)
        .where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt))),
    ]);
  } catch {
    return { error: R.failed, field: "form" };
  }
  redirect(withLocale("/giris?sifre=yenilendi", locale));
}
