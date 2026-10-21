/**
 * SEC'e giden isteklerin ORTAK sırası (20 Ekim).
 *
 * SEC'in adil erişim kuralı saniyede 10 istek; aşan adres "Request Rate
 * Threshold Exceeded" ile yaklaşık on dakika engelleniyor. Aralık yalnız
 * 13F senkronunda vardı (`sec-13f.ts`); Bugünün Akışı'nın 8-K yoklaması ve
 * Form 4 görevleri sırasızdı. Yoğun bir bilanço gününde akış gösterilen her
 * şirket için aynı anda istek açıyordu (20-30 şirket, dakikada bir) — engel
 * gelirse 8-K hızlandırıcısı tam gerektiği gün, 13F ve Form 4 de onunla
 * birlikte düşerdi.
 *
 * ÇALIŞMA ZAMANI BAŞINA BİR SIRA, SÜREÇ BAŞINA DEĞİL (20 Ekim). Engel adrese
 * konuyor ama `nextSlot` bir modül değişkeni ve Turbopack üretim derlemesi
 * modülü her çalışma zamanına ayrı yüklüyor (ölçüm `lib/day-flow-data.ts`
 * → `loadSharedDayFlow`): sayfalar (Form 4, SSR gün akışı, hisse seçimi)
 * bir sıra, rota uçları (`/api/day-flow` yoklaması, 13F'i koşan
 * `/api/cron/daily`) öteki. 8-K yoklaması İKİSİNDE de koşuyor (SSR akışı ve
 * `/api/day-flow`), yani yoğun bir bilanço akşamında iki sıra aynı anda
 * dolu — ender bir çakışma değil.
 *
 * HIZ İKİYE BÖLÜNDÜ (20 Ekim). İlk sürüm sıra başına ≤ 8/sn veriyordu ve iki
 * sıra birlikte ~16/sn'ye çıkabiliyordu; bu yalnız belgelenmişti. Aralık
 * artık 275 ms: ardışık beş istek en az 1,1 saniyeye yayılıyor, yani
 * HERHANGİ bir saniyede sıra başına en çok 4, iki çalışma zamanı birlikte
 * en çok 8 — sınırın (10) altında. 250 ms ortalamada aynı 4/sn'ydi ama
 * kapalı bir saniyeye (0, 250 … 1000) beş istek sığdırıyordu ve iki sıra
 * birlikte sınıra (10) tam dayanıyordu; 25 ms'lik fark zamanlayıcının
 * 100 ms'ye dek geç düşmesini de karşılıyor (geç çıkan istek ardındakine
 * yaklaşır, beşliyi bir saniyeye sıkıştıramaz). Ölçüm
 * `tests/provider-limits.test.ts`. `globalThis`e asılmış tek sıra 8/sn'yi
 * tek başına kullanırdı ama iki çalışma zamanının aynı süreçte aynı
 * `globalThis`i gördüğü varsayımına dayanırdı; bölünmüş hız yalnız sıra
 * sayısına (iki) dayanıyor. Bedeli soğuk turda bekleme: 13F arka plan işi,
 * 8-K yoklamasını akış 3 sn sonra bırakıyor, Form 4 ve hisse seçimi sayfayı
 * bütçelerinden (aşağıda) uzun bekletmiyor. Üçüncü bir çalışma zamanı
 * SEC'e çıkarsa bu pay yeniden hesaplanır.
 *
 * YER AYIRTMA, bekleyip yazma değil: eski kapı `lastSecCall`ı beklemeden
 * SONRA yazıyordu; aynı anda gelen çağrıların hepsi aynı boşluğu hesaplayıp
 * birlikte çıkıyordu (13F sıralı koştuğu için orada görünmüyordu). Burada her
 * çağrı kendi zamanını eşzamanlı olarak alıyor.
 *
 * AĞA ÇIKABİLEN YOLDA çağrılır: önbellekten dönecek bir okumayı sıraya
 * sokmak sayfayı boşuna bekletir. 13F ve 8-K yoklaması önbelleksiz (her
 * çağrı ağa çıkar; 8-K önce kendi süreç hafızasına bakar). Hisse seçiminin
 * `companyconcept` okuması `unstable_cache` içinde: geri çağrı yalnız ağa
 * çıkacağı zaman koşar ve sıraya orada girer (`loadConcept`,
 * `sec-edgar.ts`). Form 4 tek ayrık durum: dosya isteği Next'in veri
 * önbelleğinden de dönebilir ve isabet `fetch` dönmeden bilinmiyor.
 * Hafızayı ıskalayan her dosya sıraya girer, o yüzden bütçeyle (aşağıda).
 *
 * BEKLEME BÜTÇESİ (20 Ekim). Sıranın tavanı yoktu ve ayrılan boşluk,
 * çağıran vazgeçse de yaşıyordu. Dağıtımdan sonra (süreç hafızası boş) bir
 * tarayıcı soğuk hisse sayfalarını saniyede ~0,4'ten hızlı açarsa (sayfa
 * başına 10'a dek Form 4 dosyası) sıra boşaldığından hızlı doluyor; gün
 * akışının 8-K yoklaması ve 13F de arkasında bekliyordu. Çizim yolundaki
 * çağıran `maxWaitMs` verir (Form 4 dosyası, hisse seçiminin kavram
 * okuması): sıra daha uzunsa boşluk AYRILMAZ, `false` döner ve çağıran boş
 * sonuçla (saklamadan) çıkar. 8-K yoklaması ve 13F bütçesiz:
 * ilkinin sırası akışta gösterilen şirket sayısıyla sınırlı (çağıran yine
 * 3 sn sonra beklemeyi bırakır, `loadDayFlow`), ikincisi arka plan işi.
 *
 * BİLEREK SIRASIZ OKUMALAR. Veri önbelleğindeki seyrek okumalar sıraya
 * girmiyor: `company_tickers.json` (`sec-edgar.ts` 24 sa, `sec-form4.ts` 7
 * gün; ikisinde de modül hafızası önde) ve N-PORT (`getNportHoldings`,
 * `lib/providers/etf-holdings.ts`; 6 saatlik `unstable_cache` içinde, fon
 * başına 6 saatte iki istek). Bunları sıraya sokmak güvenlik katmaz, sayfa
 * çizimine gecikme ekler. `companyconcept` bu listedeydi ve "sembol başına
 * en çok iki kavram" diye seyrek sayılıyordu; hızlı bakış ~16 sembolü aynı
 * anda çizdiği için tek çizim ~16 eşzamanlı istekti (20 Ekim, yukarıda).
 */

/** İki istek arası en az bu kadar: herhangi bir saniyede sıra başına ≤ 4,
    iki çalışma zamanı birlikte ≤ 8 — sınırın (10) altında (gerekçe yukarıda). */
export const SEC_MIN_GAP_MS = 275;

let nextSlot = 0;

/** Sıradaki boşluğu ayırır ve o ana kadar bekler; `true` döner. `maxWaitMs`
    verilmişse ve sıra ondan uzunsa boşluk ayırmadan hemen `false` döner. */
export async function secTurn(maxWaitMs?: number): Promise<boolean> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  const wait = slot - now;
  if (maxWaitMs !== undefined && wait > maxWaitMs) return false;
  nextSlot = slot + SEC_MIN_GAP_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  return true;
}
