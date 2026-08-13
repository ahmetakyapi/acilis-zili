import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";

/**
 * Kullanıcı adı + şifre ile giriş.
 * Şifre doğrulaması burada yapılır; Auth.js kendi hash'lemesini yapmaz.
 */
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
      authorize: async (credentials) => {
        const username = String(credentials?.username ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!username || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

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
