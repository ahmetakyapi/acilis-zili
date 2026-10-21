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
 *
 * ORIGIN DE YETMEDİ (20 Ekim). Ayrıştırıcı nokta parçalarını (`.`, `..`,
 * `%2e`) otorite SABİTLENDİKTEN SONRA siliyor: `/.//evil.com`,
 * `/%2e//evil.com`, `/a/..//evil.com` tabanın origin'ini koruyor ama yolu
 * `//evil.com` çıkıyordu — dönen dize yine protokole göreli bir adresti ve
 * `redirect()` onu olduğu gibi `Location`a yazıyordu. Çıkan yol da
 * denetleniyor: `//` ile başlıyorsa reddedilir. Ters eğik çizgi ayrıştırmada
 * zaten `/`e döndüğü için tek denetim iki biçimi de kapatıyor. Bu yüzden
 * fonksiyon "use server" dosyasından buraya taşındı: o dosya yalnız async
 * fonksiyon dışa verebiliyor, test edilemiyordu
 * (tests/safe-redirect.test.ts).
 */
const REDIRECT_BASE = "https://acilis-zili.local";

export function safeRedirectTarget(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/")) return "/";
  try {
    const url = new URL(value, REDIRECT_BASE);
    if (url.origin !== REDIRECT_BASE || url.pathname.startsWith("//")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
