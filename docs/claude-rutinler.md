# Zamanlanmış Görevler — Kurulum Sayfası

Sitenin bütün yazılı içeriği **claude.ai zamanlanmış görevleri** tarafından
üretilir. Sunucuda model çağrısı yoktur, API anahtarı yoktur, ek ücret yoktur.
Site yalnızca veritabanından okur.

> **Bu görevler koddan kurulamaz.** Claude Code'un elindeki zamanlayıcı
> oturum ömürlüdür (oturum kapanınca silinir, 7 günde biter) ve
> claude.ai'deki listeye yazmaz. Aşağıdaki üç görevin
> **https://claude.ai/scheduled-task** adresinden elle kurulması gerekir.
> Her biri için gereken tek şey: zamanlama + prompt.

## Üç görev

| # | Görev | Zamanlama (TR) | Cron (UTC) | Ne yazar |
|---|---|---|---|---|
| 1 | Günlük Bülten | her gün 09:00 | `0 6 * * *` | Ana sayfadaki "Günün Özeti" |
| 2 | Haftalık Bülten | her Pazartesi 09:30 | `30 6 * * 1` | /bulten → Haftalık |
| 3 | Piyasa Dosyası | her gün 21:00 | `0 18 * * *` | /dosyalar |

Hepsinde ortak üç şart:

1. **Ağ erişimi:** Ortam ayarlarında `acilis-zili.vercel.app` alan adına izin
   verilmiş olmalı. Verilmezse proxy 403 döner ve görev başlamadan düşer.
2. **Secret:** `BRIEF_SECRET` değeri prompt'un içine yazılmalı — bulut ajanı
   yerel `.env.local` dosyasını okuyamaz. Değeri Vercel → Settings →
   Environment Variables altında.
3. **Model:** Sonnet 5 yeterli; dosya görevi için Opus daha iyi yazar.

---

## 1 · Günlük Bülten — her gün 09:00 TR

Prompt olarak `docs/claude-brief-agent.md` dosyasının **GÜNLÜK GÖREV**
bölümünün tamamını yapıştır. Özet akışı:

```
GET  /api/brief/context                 → günün ham verisi
POST /api/brief  { headline, body_md }  → siteye kaydeder
```

09:00 TR = 02:00 ET, New York'ta aynı takvim günü — yazı doğru güne düşer.

---

## 2 · Haftalık Bülten — her Pazartesi 09:30 TR

Prompt olarak `docs/claude-brief-agent.md` dosyasının **HAFTALIK GÖREV**
bölümünü yapıştır.

```
GET  /api/brief/context?period=weekly
POST /api/brief  { period: "weekly", date: <yanıttaki brief_date> }
```

`date` alanı **haftanın Pazartesisi** olmalı; context yanıtındaki
`brief_date` alanı zaten onu verir, elle hesaplama.

---

## 3 · Piyasa Dosyası — her gün 21:00 TR

Prompt olarak `docs/claude-dosya-ajani.md` dosyasının **AKŞAM GÖREVİ**
bölümünün tamamını yapıştır.

```
GET  /api/dosya/context   → mevcut dosyalar + haber akışı
(gün dosyalık değilse hiçbir şey gönderme)
POST /api/dosya  { slug, title, dek, body_md, event_date, symbols, sources }
```

Bu görev **çoğu gün hiçbir şey yazmaz** ve yazmaması normaldir. Sıradan bir
seans dosyalık değildir; zorlanan bir dosya, dosya olmamasından kötüdür.

---

## Tek seferlik işler

Bunlar rutin değil; kurulumda bir kez elle çalıştırılır (claude.ai'de yeni
bir sohbet açıp ilgili bölümü yapıştırmak yeterli):

- **Bülten arşivini bir ay geriye doldur** —
  `docs/claude-brief-agent.md` → "TEK SEFERLİK: ARŞİVİ 1 AY GERİYE DOLDUR"
- **Dosya arşivini bir ay geriye doldur** —
  `docs/claude-dosya-ajani.md` → "TEK SEFERLİK: SON BİR AYI DOLDUR"

## Çalıştığını nasıl anlarsın

| Görev | Kontrol |
|---|---|
| Günlük | Ana sayfadaki Günün Özeti kartında sağ üstte "Claude · SS:DD" damgası |
| Haftalık | /bulten?tur=haftalik listesinde bu haftanın kaydı |
| Dosya | /dosyalar listesinin başında yeni bir dosya |

Bir görev sessizce başarısız olduysa ilk bakılacak yer ağ izni, ikincisi
secret'ın prompt'ta güncel olup olmadığıdır.
