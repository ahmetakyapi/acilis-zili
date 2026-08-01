# Günün Özetini Kendi Claude'unla Yazdırma

Site, özeti **veritabanından okur** — kimin yazdığıyla ilgilenmez. Bu rehber,
kendi Claude aboneliğinle (Claude Code) her sabah özeti yazdırıp siteye
göndermeyi anlatır. **API anahtarı ve ek ücret gerekmez**; yazı senin
aboneliğinin kotasından çıkar.

## Nasıl çalışır

```
Senin Claude'un (cron 09:00 TR)
  1. GET  /api/brief/context   → günün ham verisi (JSON)
  2. yazıyı yazar
  3. POST /api/brief           → siteye kaydeder
Site → sadece DB'den okur. Sunucu cron'u (13:30 TR) gün için kayıt
varsa DOKUNMAZ — senin yazın esastır; sen göndermezsen kural tabanlı
özet yedek olarak devreye girer.
```

Saat notu: 09:00 TR = 02:00 ET — New York'ta aynı takvim günüdür, yazı
doğru güne kaydedilir.

## Kurulu rutin (2026-08-01)

Bu görev **claude.ai bulut rutini** olarak kuruldu — yerel makineye bağımlı
değildir, bilgisayar kapalıyken de çalışır:

- **Rutin:** "Açılış Zili — Sabah Bülteni" (`trig_011z3UdZH7p3kv1Lkm9eFS5M`)
- **Zamanlama:** her gün 06:00 UTC = 09:00 TR · Model: Sonnet 5
- **Yönetim:** https://claude.ai/code/routines — durdurma/silme buradan
- Bulut ajanı yerel dosya okuyamadığı için `BRIEF_SECRET` rutinin prompt'una
  gömülüdür; secret'ı değiştirirsen rutini de güncelle.
- **Ağ şartı:** Bulut ortamının egress politikası `acilis-zili.vercel.app`
  alan adına izin vermek ZORUNDA — aksi hâlde proxy 403 döner ve görev
  başlamadan düşer (2026-08-01'de yaşandı). İzin, claude.ai'de ortam
  (environment) ayarlarındaki ağ erişimi bölümünden verilir.

Aşağıdaki GÜNLÜK GÖREV bölümü referanstır (rutinin prompt'unun kaynağı);
elle tek seferlik çalıştırmak istersen bu dosyayı Claude'a verip
"uygula" demen yeterli — SECRET'ı `.env.local`'den okur.

---

## GÜNLÜK GÖREV

Sen bir piyasa bülteni editörüsün. Aşağıdaki adımları uygula:

1. Veriyi çek (SECRET'ı `~/acilis-zili/.env.local` içindeki `BRIEF_SECRET`'tan oku):

```bash
curl -s -H "Authorization: Bearer $BRIEF_SECRET" \
  https://acilis-zili.vercel.app/api/brief/context
```

2. Bu veriye dayanarak **Türkçe** bir sabah brifingi yaz:
   - Başlık: ≤ 70 karakter, günün en önemli olayını taşır, clickbait değil.
   - Gövde: 6-10 cümle, markdown. Şu sırayla: bugünün kritik verileri
     (saatleri ET + TR olarak), öne çıkan bilançolar (kim, ne zaman, EPS
     beklentisi), dünkü endeks kapanışlarının bağlamı, haftanın kalanında
     bizi bekleyen yüksek önemli olaylar.
   - SADECE verilen verideki bilgiyi kullan. Tahmin, fiyat hedefi, yatırım
     tavsiyesi yazma. Veri boşsa o cümleyi atla.
   - Sakin, profesyonel ton; abartı ve ünlem yok. Finans terimleri (CPI,
     FOMC, EPS) orijinal kalır.

3. Siteye gönder:

```bash
curl -s -X POST https://acilis-zili.vercel.app/api/brief \
  -H "Authorization: Bearer $BRIEF_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"headline": "<başlık>", "body_md": "<gövde>", "locale": "tr"}'
```

4. Yanıtta `"ok": true` gördüğünü doğrula; göremezsen hatayı bildir.
İstersen aynı akışla `"locale": "en"` için İngilizce sürüm de gönder.

---

## HAFTALIK GÖREV (her Pazartesi)

Aynı köprü, dönemi `weekly` olan bir kayıt yazar. Sunucuda haftalık üretim
YOKTUR — bu yazı da senin aboneliğinden çıkar.

Rutin kurulumu: claude.ai bulut rutini, **haftada bir, Pazartesi 07:00 UTC
(10:00 TR)**. Günlük rutinin bir saat sonrasına konması bilinçli — ikisi aynı
anda koşup aynı bağlamı iki kez çekmesin.

1. Biten haftanın verisini çek (`date`, geçen haftadan herhangi bir gün
   olabilir; uç, o günü kapsayan haftanın Pazartesi–Cuma paketini döner):

```bash
LAST_WEEK=$(date -u -d '7 days ago' +%F)   # macOS: date -u -v-7d +%F
curl -s -H "Authorization: Bearer $BRIEF_SECRET" \
  "https://acilis-zili.vercel.app/api/brief/context?period=weekly&date=$LAST_WEEK"
```

2. Yanıttaki `brief_date` (dönemin Pazartesisi) ve `range_et` alanlarını not
   et. `retrospective: true` gelir — metin GEÇMİŞ zamanda yazılır.

3. **Türkçe** hafta özeti yaz:
   - Başlık: ≤ 70 karakter, haftanın ana temasını taşır.
   - Gövde: 8-12 cümle, 2-3 paragraf. Haftanın makro gündemi (gerçekleşen
     değerlerle), öne çıkan bilançolar (beklenti vs açıklanan) ve
     endekslerin **haftalık** getirisi birlikte okunur.
   - `indices[].change_pct` burada HAFTALIK değişimdir, günlük değil.
   - Gelecek hakkında tahmin yok; bu bir arşiv kaydı.

4. Gönder — `date` alanına **`brief_date`** değerini yaz:

```bash
curl -s -X POST https://acilis-zili.vercel.app/api/brief \
  -H "Authorization: Bearer $BRIEF_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"period":"weekly","date":"<brief_date>","locale":"tr","headline":"<başlık>","body_md":"<gövde>"}'
```

---

## TEK SEFERLİK: ARŞİVİ 1 AY GERİYE DOLDUR

Site arşivi (`/bulten`) yalnızca yazılmış günleri gösterir. Geçmişi bir kez
doldurmak için aynı iki ucu tarih tarih dolaş.

**Kural:** veri gelmeyen günü ATLA. Piyasa kapalıysa (hafta sonu, tatil)
`indices[].change_pct` boş gelir ve `economic_events` ile `earnings` de
boşsa o gün için yazı yazma — uydurma kayıt açmaktansa boşluk kalsın.

```bash
# Son 30 günün her biri için (macOS: date -u -v-${i}d +%F)
for i in $(seq 30 -1 1); do
  D=$(date -u -d "$i days ago" +%F)
  curl -s -H "Authorization: Bearer $BRIEF_SECRET" \
    "https://acilis-zili.vercel.app/api/brief/context?date=$D"
  # → yaz, sonra POST /api/brief  {"date":"$D","locale":"tr", ...}
done
```

Haftalıklar için aynı döngüyü `?period=weekly&date=...` ile son ~4 Pazartesi
üzerinde çalıştır; `brief_date` tekrar edeceği için aynı hafta iki kez
yazılmaz (uç `onConflictDoUpdate` ile üzerine yazar).

Geçmiş günlerde uç `retrospective: true` döner: metin "açıklanacak" değil
"açıklandı" diliyle, o günün gerçekleşen değerleri ve o günün endeks
kapanışlarıyla yazılır — bugünün fiyatıyla değil.
