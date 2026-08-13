import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /**
       * "user" | "admin". Yalnızca ARAYÜZ kararları için: yönetim
       * bağlantısının menüde görünüp görünmeyeceği gibi. Yetki kontrolü
       * buna DEĞİL veritabanına bakar — token yetki alındıktan sonra bir
       * gün daha yaşayabiliyor. Bkz. lib/admin.ts
       */
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}
