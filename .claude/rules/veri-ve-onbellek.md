---
paths:
  - "lib/**"
  - "app/**"
  - "components/**"
---

<!-- Yol kapsamlı kural: eşleşen bir dosya okunduğunda/düzenlendiğinde yüklenir. Kaynak: kök CLAUDE.md'den taşındı (8 Kasım 2026); kural metni aynen korundu. -->

## Veri Dürüstlüğü

1. **Uydurma kesinlik yok.** Dakika bilinmiyorsa `~` ve pencere adı
   ("~23:00 · Kapanış Sonrası").
2. **Eski veri büyük puntoyla gösterilmez**; küçük tarih kurtarmaz — metrik
   kalkar (Brent örneği: `lib/market-boards.ts`).
3. **Aynı sayı iki yerde duruyorsa aynı kaynaktan gelir** (başlıktaki kotasyon
   ile grafiğin son barı).
4. **Yüzde hangi seansı anlattığını KANITLAR.** Tek ölçü
   `status.sessionDate` (`lib/market-hours.ts`): kotasyon ancak
   `isSessionTrade` ise seansı anlatır. Gün yetmez, YAŞ da sorulur
   (`packCurrent`, `lib/providers/index.ts`; ölçü sağlayıcının `Date`
   başlığı) — güncel değilse bir kez önbelleksiz tekrar, sonra `stale: true`.
   Barlarda aynı kural: `cachedBarsUsable`. Açılış öncesi sağlayıcının gün
   barı dünkü seanstır.
5. **Ekran bayat veriyi künyesiyle gösterebilir; YAZMA katmanı hiç
   kullanmaz** (teknik, bülten, mercek uçları, site içi Claude notları) —
   sayı metne geçip kalıcı olur.
6. **Paket tazeliği sembolün tazeliği değil:** `packCurrent` paketteki EN
   YENİ işleme bakar; alarm gibi yazan yollar her sembolün kendi seansını
   ister (`sessionReadings`, `lib/price-alerts.ts`) — yoksa henüz işlem
   görmemiş hisse dünün yüzdesiyle alarm tetikliyordu.

## Saat: TR Önce

`lib/session-clock.ts` tek kaynak: TR'de birincil İstanbul, ikincil New York;
EN'de tersi. ABD yaz saati farkı kaydırdığı için sabit saat yazılmaz (açılış
yazın 16:30, kışın 17:30 TR). ET↔UTC aritmetiği yalnız `lib/market-hours.ts`'te.

## İstemci/Sunucu Sınırı ve Önbellek

- **`"use client"` modülden dışa aktarılan DEĞER sunucuya gerçek değer olarak
  gelmez** — sessizce istemci referansına döner. Paylaşılan sabitler düz
  modülde: `lib/chart-series.ts`, `lib/compare.ts`.
- Sunucu bileşeni istemci sağlayıcıya `children` olarak geçebilir; yalnız
  duruma BAĞLI hücreler istemcide (karşılaştırma ekranı).
- **Sığ adres güncellemesi uçuştaki gezinmeyi sessizce ÖLDÜRÜR** — gezinme
  sürerken kapan (`useRouteNavigating`, `components/layout/RouteProgress.tsx`).
- **Sığ güncelleme geçmiş girdisini tazelemez**: geri tuşu eski ağacı yükler.
  Adresten okunan durum prop'tan değil ADRESTEN başlatılır.
- **İstek içi önbellek = React `cache()`**, argümanı KİMLİKLE eşler; bu yüzden
  anahtar sıralanmış dize (`getQuotes` → `quotesForKey`, `getSymbolNames` →
  `symbolNamesForKey`). Aynı veriyi gösteren iki panel aynı listeyi sormalı,
  yoksa aynı hissenin iki farklı yüzdesi yan yana durabilir. Her fonksiyonun
  sarılı olduğunu varsayma (ör. `getSeries`, `lib/providers/fred.ts`, sarılı
  DEĞİL; tek koruma `fetch`in `revalidate`i). Kaynağa sor:
  `grep -rnE "= (React\.)?cache\(" lib components app`.
- **İstekler arası önbellek = `unstable_cache`**; hata önbelleğin DIŞINDA
  yakalanır ki düşen veritabanının boş sonucu saklanmasın
  (`grep -rn "unstable_cache(" lib`; örnek `loadSymbolTable`, `lib/data.ts`).
- **Önbellek dağıtımlar arası ORTAK** (20 Ekim; `shared/fetch-cache`,
  `deploy/update.sh`): anahtar geri çağrının metni + keyParts, yani dönen
  ŞEKİL değişip metin aynı kalırsa (çağırdığı yardımcı, şema sütun tipi)
  eski şekil yeni koda gider. Şekli değiştiren, o önbelleğin keyParts
  sürümünü artırır (ör. `lib/investor-data.ts` → `"investors-overview-v4"`);
  her anahtar sürümlü.
