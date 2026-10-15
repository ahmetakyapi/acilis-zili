/**
 * Herkese açık profilin SÖZLEŞMESİ: alan sınırları ve kayıt tipi.
 *
 * `lib/avatars.ts` ile aynı kalıp: dosya "use client" DEĞİL, çünkü sunucu
 * eylemi (doğrulama), veri katmanı ve arayüz aynı sınırları okuyor —
 * istemci modülünden dışa aktarılan değer sunucuya gerçek değer olarak
 * gelmez (gerekçe lib/avatars.ts).
 *
 * VARSAYILAN GİZLİ. Profil satırı olmayan ya da `isPublic: false` duran
 * hesap /u/... adresinde YOKMUŞ gibi görünür (404). Görünürlük KVKK'da
 * açık rızaya bağlandı: anahtar Ayarlar'daki "Profilim Herkese Açık".
 */

/** Tanıtım yazısının üst sınırı — tek nefeslik metin, makale değil. */
export const BIO_MAX = 280;

/**
 * Kayıttaki hâl. `bio` boş dize değil `null` taşır (boş kutu kaydedilirse
 * null yazılır); bayraklar blok blok: profil açıkken bile takip listeleri
 * ve portföy dağılımı ayrı ayrı açılır.
 */
export type ProfileSettings = {
  bio: string | null;
  isPublic: boolean;
  showWatchlists: boolean;
  showPortfolio: boolean;
};

export const PROFILE_DEFAULTS: ProfileSettings = {
  bio: null,
  isPublic: false,
  showWatchlists: false,
  showPortfolio: false,
};

/**
 * Kullanıcı adının deseni — kayıttaki kuralın aynısı
 * (app/actions/auth.ts → usernameSchema). /u/[username] rotası parametreyi
 * sorguya vermeden önce bununla süzer: desene uymayan adres veritabanına
 * hiç gitmeden 404 olur.
 */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/**
 * Profil rozetleri — hepsi HESAPLANIR, hiçbir rozet tabloda durmaz.
 * Yalnızca herkese açık bilgiden türetilirler: katılım tarihi zaten
 * profilde yazıyor, sıra rozeti ("Erken Üye") ondan çıkıyor. Gizli
 * bloklardan (portföy var mı, alarm kaç tane) rozet TÜRETİLMEZ — rozet,
 * sahibinin açmadığı bir bilgiyi sızdırmamalı.
 */
export type ProfileBadge =
  | { kind: "early" }
  | { kind: "year"; n: number };

/** İlk kaç hesap "Erken Üye" sayılır. */
export const EARLY_MEMBER_RANK = 100;
