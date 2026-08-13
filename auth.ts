import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { AUTH_WINDOW_MS, SIGN_IN_LIMIT, rateLimit } from "@/lib/rate-limit";

/**
 * Kullanıcı adı + şifre ile giriş.
 * Şifre doğrulaması burada yapılır; Auth.js kendi hash'lemesini yapmaz.
 *
 * KABA KUVVET SAYACI BURADA, formda değil.
 *
 * Sınır bir dönem yalnızca `signInAction` içindeydi (app/actions/auth.ts) ve
 * o hiç uğranmadan geçilebiliyordu: `app/api/auth/[...nextauth]/route.ts`
 * Auth.js handler'larını dışa açıyor, yani `POST /api/auth/callback/credentials`
 * doğrudan çağrılabiliyor ve doğrudan buraya giriyordu. Bir betik csrf
 * çerezini bir kez alıp aynı hesaba sınırsız şifre denemesi yapabilirdi —
 * üstelik her denemede bcrypt çalıştığı için sunucu işlemcisini de tüketerek.
 *
 * Sayaç artık İKİ yolun da geçmek zorunda olduğu tek noktada. Form tarafı
 * sayacı yalnızca OKUYOR (`peekRateLimit`) ki doğru mesajı gösterebilsin ama
 * hakkı iki kez tüketmesin.
 *
 * HESAP BAZLI KİLİT BİLEREK YOK: kullanıcı adına sayaç koymak, o adı bilen
 * herkese "istediğin hesabı kilitle" imkânı verir. Sınır IP başına.
 */
/**
 * Giriş sayacının anahtarı — IP başına.
 *
 * İki farklı yoldan gelinebiliyor ve ikisinde istek nesnesi aynı değil:
 * doğrudan `/api/auth/callback/credentials` çağrısında Auth.js gerçek
 * `Request`i veriyor, form akışında (`signIn()` sunucu tarafından
 * çağrılıyor) o nesne uydurulmuş olabiliyor ve `x-forwarded-for` taşımıyor.
 * Başlık istekte yoksa istek bağlamındaki başlıklara düşülüyor; ikisi de
 * yoksa tek bir ortak kovaya düşmemek için sabit bir ad kullanılıyor —
 * o durumda sınır paylaşılır ama sahte bir güvenlik iddiası da yok.
 */
async function signInKey(request: unknown): Promise<string> {
  const fromRequest =
    request instanceof Request
      ? request.headers.get("x-forwarded-for")
      : null;
  if (fromRequest) return `signin:${fromRequest.split(",")[0]?.trim()}`;

  try {
    const store = await headers();
    const forwarded = store.get("x-forwarded-for");
    if (forwarded) return `signin:${forwarded.split(",")[0]?.trim()}`;
  } catch {
    /* İstek bağlamı yoksa (beklenmiyor) aşağıdaki ortak kovaya düşülür. */
  }
  return "signin:bilinmeyen";
}

/**
 * Veritabanına ulaşılamadığında fırlatılan işaret.
 *
 * next-auth her `authorize` hatasını `AuthError`a sarıyor ve form tarafı
 * onu "kimlik bilgisi hatalı" diye okuyordu. Bu dize iki katmanın
 * anlaşmasıdır — `app/actions/auth.ts` onu arayıp mesajı ayırıyor.
 */
export const DB_UNAVAILABLE = "az:db-unavailable";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Oturum 180 gün yaşar ve aktif kullanımda kayarak yenilenir —
  // kullanıcı her ziyarette yeniden giriş yapmak zorunda kalmaz.
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 180,
    updateAge: 60 * 60 * 24,
  },
  pages: {
    signIn: "/giris",
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Kullanıcı adı", type: "text" },
        password: { label: "Şifre", type: "password" },
      },
      authorize: async (credentials, request) => {
        /* Sayaç şifre karşılaştırmasından ÖNCE: bcrypt maliyeti (cost 12)
           tam olarak saldırganın tüketmek istediği kaynak. */
        const limited = rateLimit(
          await signInKey(request),
          SIGN_IN_LIMIT,
          AUTH_WINDOW_MS,
        );
        if (!limited.allowed) return null;

        const username = String(credentials?.username ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!username || !password) return null;

        /* VERİTABANI HATASI "ŞİFRE HATALI" DEĞİLDİR. Sorgu try/catch'sizdi;
           Neon erişilemediğinde fırlatılan hata next-auth tarafından
           `AuthError`a sarılıyor ve form dalı kullanıcıya "kullanıcı adı veya
           şifre hatalı" diyordu. Okuyucu şifresini değiştirmeye çalışıyor,
           oysa sorun onda değil. Ayrı bir hata fırlatılıyor; `signInAction`
           onu tanıyıp genel hata mesajını gösteriyor. */
        let user: typeof users.$inferSelect | undefined;
        try {
          [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1);
        } catch {
          throw new Error(DB_UNAVAILABLE);
        }

        if (!user) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        /* Rol token'a giriş anında yazılır ve oturum boyunca orada kalır.
           GÖRÜNÜM İÇİN yeterli, YETKİ İÇİN değil: yetkisi alınan bir hesabın
           token'ı yenilenene kadar (updateAge: 1 gün) hâlâ "admin" yazıyor
           olabilir. Kapıyı tutan kontrol veritabanına bakar — lib/admin.ts */
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      /* `token.role` tip olarak dar değil: JWT'nin dizin imzası ona `unknown`
         benzeri bir tip veriyor ve `?? "user"` bunu düzeltmiyor. Daraltma
         açıkça yapılıyor — hem tip doğru oluyor hem de token'da beklenmedik
         bir şey varsa rol sessizce "user"a düşüyor. */
      session.user.role = typeof token.role === "string" ? token.role : "user";
      return session;
    },
  },
});
