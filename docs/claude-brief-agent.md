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

## Kurulum (tek seferlik)

`BRIEF_SECRET` değerini `.env.local` dosyasından al (Vercel'de de aynı değer
tanımlı olmalı).

Claude Code'da şu komutu ver:

```
/schedule her gün 09:00'da çalışsın: ~/acilis-zili/docs/claude-brief-agent.md
dosyasındaki "GÜNLÜK GÖREV" bölümünü uygula
```

(Ya da klasik crontab: `0 9 * * 1-5 claude -p "$(cat ~/acilis-zili/docs/claude-brief-agent.md)"`)

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
