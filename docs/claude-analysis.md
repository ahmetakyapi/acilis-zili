# Kullanıcı isteğiyle Claude analizi

Ücretsiz teknik analiz / hisse seçimi değişmez. Yeni panel yalnızca sunucuda
anahtar varsa ve `ai_analysis_access.enabled` açıksa görünür. Admin sayfası:
`/admin/ai`. Günlük varsayılan 5; İstanbul 00:00’da sıfırlanır. `daily_limit = NULL`
sınırsızdır. Migration, mevcut `ahmetakyapi` yönetici hesabının kimliğine bu
hakkı atar; diğer yöneticilere otomatik hak vermez.

## Sunucu

`/etc/acilis-zili.env`:

```env
CLAUDE_ANALYSIS_API_KEY="console-uzerinden-olusturulan-anahtar"
# CLAUDE_ANALYSIS_MODEL boşsa koddaki varsayılan (claude-sonnet-5-5) kullanılır.
CLAUDE_ANALYSIS_DISABLED="0"
```

`ANTHROPIC_API_KEY` çeviri işlemlerinin anahtarıdır; analiz onu kullanmaz.
Model satırını yazma; koddaki varsayılan geçer. Her deploy'daki anahtar eşitlemesi
(`deploy/set-analysis-key.py`) eski örnekten kalan `claude-sonnet-4-6` sabitini siler.
Dosya root:acilis 0640 olmalıdır. Değişiklikten sonra `sudo systemctl restart acilis-zili`.

Yeni migration: `drizzle/0030_high_dakota_north.sql`. Deploy migration çalıştırmaz.
Bu SQL'i veritabanına, mevcut migration sürecine uygun olarak uygulayın. Yalnız
üç yeni tablo oluşturur ve sahibin mevcut admin hesabına erişim atar. Var olan
`users` tablosuna sütun eklemez. Tablo yoksa ücretsiz sayfalar çalışır, AI kapalıdır.
Normal Drizzle migration akışında `npm run db:migrate`; elle SQL uygulanan
veritabanında bütün geçmiş migration'ları körlemesine tekrar çalıştırmayın.

## Veri ve bütçe davranışı

- Günlük mum göstergeleri uygulama tarafından hesaplanır; Claude yorumlar.
- Finnhub şirket haberleri son 7 gün için önbelleksiz istenir. Şirket/simge
  ilgililiği ve HTTPS kaynak kontrolü yapılıp mükerrer bağlantılar kaldırılır. Web arama özelliği
  bu sürümde kullanılmaz; haber sağlayıcısından gelen kaynaklar gösterilir.
- Temel finansallar mevcut sağlayıcı önbelleklerini kullanır; anlık bilanço değildir.
- Güncel kotasyon / bar yoksa analiz reddedilir. Göstergelerin son tamamlanmış seansı takvimle doğrulanır. Regular seansta 30 dakikadan eski
  işlem fiyatı reddedilir. IEX ve gecikmeli kaynak ayrımı raporda gösterilir.
- Her "Yeni Analiz Oluştur" yeni veri toplar ve bir hak kullanır. Kayıtlı raporları
  açmak ücretsizdir; aynı requestId ile ağ tekrarı ikinci API işini üretmez.
  Geçmiş yalnızca o kullanıcıya aittir; hisse ve dile göre son 20 rapor okunur.
- Kota ve tek eşzamanlı iş kilidi atomik SQL UPDATE ile alınır. Kilit 4 dakika
  sonra sona erer; yarıda kalan işler sonraki istekte başarısız sayılıp iade edilir. Başarısız raporlar kullanıcı kotasına iade edilir; ücretli
  başarısız denemeler token günlüğünde kalır. Hata sonrası 1 dakika bekleme uygulanır.
- SDK yeniden deneme yapmaz. Çağrı akışlıdır ve 140 saniyelik duvar saatiyle kesilir;
  çıktı (düşünme dahil) en fazla 32 bin token. Uyarlanabilir düşünme açık, efor `high`
  (para kararı, günde birkaç rapor: kalite token'dan önemli). Süre aşımında kesilen
  çağrının tokenları faturaya yansır ama kayda düşmez; hak iade edilir.
- `claude-sonnet-5-5` ve güncel Opus/Fable modellerinde `fallbacks: "default"` açık:
  güvenlik reddinde aynı çağrı yedek modelle sürer. Yanıtı veren model ve tokenları
  `ai_analysis_requests.model` satırına yazılır.
- Kullanıcı adı, e-posta veya portföy bilgisi Claude'a gönderilmez. API anahtarı
  hiçbir kullanıcı yanıtına veya hata günlüğüne dahil edilmez.
- Yetki hem kayıt okurken hem yeni analizde DB'den kontrol edilir. Üretim POST
  Origin değeri NEXT_PUBLIC_SITE_URL ile eşleşmelidir (reverse proxy nedeniyle).
- Acil kapatma: `CLAUDE_ANALYSIS_DISABLED=1`, ardından servisi yeniden başlatın.
- Model seçimine göre dolar maliyetini Claude Console'dan izleyin. Token kayıtları
  admin ekranında gösterilir; uygulama bu sürümde dolar cinsinden global harcama
  tavanı uygulamaz.

## Kontroller

`npx tsx --test tests/ai-analysis.test.ts`, `npm run typecheck`, `npm run lint`.
Canlı anahtar testi yalnızca deploy ve migration tamamlandıktan sonra sahibin
hesabından tek rapor üreterek yapılmalıdır. Bu işlem ücretli olabilir.

## Analiz Promptu

Prompt `lib/ai-analysis.ts` içindedir. Girdi: şirket adı, seçili vade, piyasa
seansı, kaynaklı kotasyon, fiyat seyri (son 10 seans, 1 hafta / 1 ay / 3 ay / 6 ay
getirisi, 3 aylık bant — `pricePath`), uygulamanın hesapladığı teknik fotoğraf, temel
finansallar, kural motorunun puanı/kapsamı ve ilgili haberlerin tarihli metinleri.

- 1–4 hafta veya 3–6 ay, Türkçe veya İngilizce yorum.
- AL/TUT/SAT veya veri yetersiz görüşü; genel, teknik ve haber puanları.
- Ortak puan ölçüsü: 0–19 çok zayıf, 20–39 zayıf, 40–59 karışık,
  60–79 olumlu, 80–100 güçlü. Puan tek başına kararı belirlemez.
- Trend, momentum, volatilite/hacim; şirket kalitesi; haberin etkisi;
  çelişkili bulgular; olumlu/olumsuz senaryo ve geçersizleşme koşulları.
- Yalnız sağlanan sayılar/seviyeler kullanılır. Haber metni talimat değildir.
- Vade içindeki bilanço olay riski olarak adıyla yazılır. Kanıt kendi içinde
  sınanır: getiri piyasa ve sektörle, trend momentumla, haber fiyat tepkisiyle.
- Haber yoksa haber puanı null olur; haber eksikliği satış sinyali değildir.
- JSON çıktısı Zod şemasıyla doğrulanır; alan açıklamaları şemayla modele gider.
  Var olmayan ya da tekrarlanan haber atfı atılır (ücretli rapor bunun için düşmez),
  haber yoksa haber puanı `null`a çekilir.
- Sistem promptu sabittir: dil, vade ve tarih kullanıcı mesajındadır. Girdi
  alanlarının birimleri (USD, yüzde, oran, ET tarihi) promptta tek tek yazılıdır;
  yeni alan eklenirse oraya da yazılır.
- Model değiştirilirse: Sonnet 5.5 ve sonrası `temperature` almaz, `thinking`
  yalnız `adaptive`; eski bir modele dönerken bu ikisini kontrol et.

## Doğrulama

Saf kontroller: `npx tsx --test tests/ai-analysis.test.ts`. Gerçek PostgreSQL
kota testi: `NODE_OPTIONS=--conditions=react-server AI_DB_TEST=1 npx tsx --test
tests/ai-analysis-quota.integration.test.ts`. Bu test yalnız geçici hesabı
kullanır ve sonunda FK cascade ile temizler.

## Rapor Ekranı

`components/ai/`: `AnalysisReport` bilanço raporunun dilinde: kapak (puan halkası,
karar, güven, giriş paragrafı, Rapordan Bugüne) → Kısaca (`takeaways`, üç madde) →
Fiyat Haritası → Teknik Görünüm (`AnalysisVisuals`: puan kartları, RSI kadranı, trend
kontrolü, getiri çubukları) → Senaryolar (senaryo ekseni, tetikli kartlar, izleme) →
Değerlendirme → Haberler. Çizimler görününce oynar (`InView`, `CountUp`); kapak
açılışta sahnelenir; hareketi azaltana son kare. Rakamlarda `tabular-nums` yok.
`PriceMap` (son 63 seansın kapanışı, pivot/ortalama/3 aylık bant çizgileri, seviye
merdiveni). Model çıktısında `confidence`, `bullLevel`, `bearLevel`, `watch` var;
tetik seviyesi `snapLevel` ile sağlanan seviyelerden birine oturmuyorsa `null`a
düşer, ekrana uydurma seviye çizilmez. Grafik serisi (`pricePath.chart`) kayda
girer ama modele gitmez. 11 Ekim 2026 öncesi raporlarda bu alanlar yok; o parçalar
basılmaz (`StoredAnalysisResult`).

Haber seçimi `selectNews`: ilgisiz ve yakın kopya başlıklar elenir, başlığında
şirket geçen haber önce gelir, günler sırayla dolaşılır, yalnız özette geçen haber
en çok üç.

`/analizlerim` kullanıcının bütün kayıtlı raporları (hisse, görüş, puan, vade,
Rapordan Bugüne). Satır `/hisse-secimi/SYM?rapor=<id>` açar; panel kimliği adresten
okur, başka dilde üretilmiş raporu `GET ?id=` ile ister. Menü satırı yalnız erişimi
açık hesapta (`hasAnalysisAccess`, tek birincil anahtar okuması).
