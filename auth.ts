import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { normalizeUsername } from "@/lib/utils";
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

/**
 * Kullanıcı bulunamadığında karşılaştırılan SAHTE hash.
 *
 * KULLANICI ADI SAYIM ORAKÜLÜNÜ KAPATIR. `authorize()` kullanıcıyı
 * bulamayınca bcrypt karşılaştırmasına hiç girmeden dönüyordu; var olan
 * kullanıcıda ise cost 12 hash'i çalışıyordu. Aradaki fark birkaç
 * milisaniye ile ~216 ms (ölçüldü) — yani uzaktan tek istekle okunabilen
 * bir sinyal. Saldırgan kayıtlı kullanıcı adlarının listesini çıkarıp kaba
 * kuvveti yalnızca gerçek hesaplara yöneltebilirdi.
 *
 * Sır DEĞİL: rastgele bir dizenin hash'i, hiçbir hesaba ait değil ve
 * hiçbir zaman eşleşmiyor. Tek işi iki dalın aynı süreyi harcaması.
 */
const DUMMY_HASH =
  "$2b$12$TjyHOgtBI3ZBWBa7RFOzgOP1aMG93k3eLq6fu2uz46SbM.KGCAi7K";

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

        /* KULLANICI ADI YA DA E-POSTA. Giriş yalnızca kullanıcı adıyla
           yapılıyordu; e-posta kayıtta toplanıp hiçbir yerde
           kullanılmıyordu. Kullanıcı adını unutup e-postasını hatırlayan
           birinin girmesinin yolu yoktu ve şifre sıfırlama da olmadığı için
           hesap kalıcı olarak kayboluyordu. En azından ikinci kapı açık.

           Küçültme `normalizeUsername` ile ve kayıt tarafı da aynı
           fonksiyonu kullanıyor: Türkçe "İ" düz `toLowerCase()` ile
           bozuluyor, iki taraf aynı dönüşümü uygulamazsa eşleşme kırılır.
           E-posta da aynı fonksiyondan geçiyor — adreslerde Türkçe harf
           bulunmuyor, dönüşüm onlara dokunmuyor. */
        const identifier = normalizeUsername(String(credentials?.username ?? ""));
        const password = String(credentials?.password ?? "");

        if (!identifier || !password) return null;

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
            .where(
              or(eq(users.username, identifier), eq(users.email, identifier)),
            )
            .limit(1);
        } catch {
          throw new Error(DB_UNAVAILABLE);
        }

        if (!user) {
          /* Sonuç atılıyor; amaç zamanı eşitlemek. */
          await compare(password, DUMMY_HASH);
          return null;
        }

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        /* SON GİRİŞ DAMGASI. Panel üye SAYISINI biliyordu ama kaçının hâlâ
           kullandığını bilmiyordu.

           Yazma BEKLENMİYOR (`void` + `catch`): damga bir ölçü, girişin
           koşulu değil. Bekleseydik Neon'un yavaşladığı bir anda giriş de
           yavaşlardı; düşerse giriş yine olmalı, yalnızca o damga eksik
           kalır. Aynı sebeple hata yutuluyor. */
        void db
          .update(users)
          .set({ lastSeenAt: new Date() })
          .where(eq(users.id, user.id))
          .catch(() => {});

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
