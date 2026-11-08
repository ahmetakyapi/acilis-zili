---
paths:
  - "lib/content-write.ts"
  - "lib/data.ts"
  - "lib/technical.ts"
  - "lib/kurallar.ts"
  - "app/api/**"
  - "app/actions/content.ts"
  - "app/admin/**"
  - "content/**"
  - "docs/claude-rutinler.md"
---

<!-- Yol kapsamlı kural: eşleşen bir dosya okunduğunda/düzenlendiğinde yüklenir. Kaynak: kök CLAUDE.md'den taşındı (8 Kasım 2026); kural metni aynen korundu. -->

## İçerik: Rutinler ve Yazma Yolu

- Yazılı içeriği claude.ai rutinleri üretir; promptlar `docs/claude-rutinler.md`
  (§ 1 günlük bülten, § 2 haftalık, § 3 mercek, § 4 bilanço analizi, § 5
  teknik, § 6 emekli, § 7 günün grafiği, § 8 görev kontrolü, § 9 haftalık
  kalite denetimi; dosya canlı rutinlerin anahtarsız kopyası). Rutinler koddan
  kurulmaz, claude.ai'de elle; prompt değişince sahibine "yeniden yapıştır"
  de ve `docs/ROUTEMAP.md`'ye açık iş olarak yaz.
- Rutin uçları `/api/{brief,mercek,analiz,teknik,hedef,grafik}` (+
  `/api/takvim/{beklenti,bilanco}`): POST yazar, GET geri okur, `/context`
  rutine girdi verir; hepsi `BRIEF_SECRET` (`lib/api-auth.ts` →
  `checkBearer`). Rutin sayı üretmez: göstergeleri uç hesaplar, rutin yorum
  yazar.
- **Uca alan eklemek = prompt da değişir:** yeni girdi/çıktı alanı
  `docs/claude-rutinler.md`'deki ilgili §'e yazılmadan iş bitmiş sayılmaz.
- **İçeriğin yazma yolu TEK: `lib/content-write.ts`** (şema, sürüm fotoğrafı,
  upsert) — `/api/mercek`, `/api/brief` ve panel eylemleri
  (`app/actions/content.ts`) oradan geçer. Yeni giriş de oradan geçer.
  Panel yeni kayıt ÜRETMEZ, var olanı düzeltir (`/admin/yazilar/...`);
  üzerine yazılan hâl `story_revisions`a düşer (bülten anahtarı
  `bulten:{tarih}:{dönem}`). Panelde **İçerik ÖLÇER, Yazılar DEĞİŞTİRİR**.
- **Panel dışından toplu düzeltme** (ör. ölü kaynak bağlantıları): geçici
  `.tmp-*.mts` betiği, satırı okuyup `storyInputSchema.parse` →
  `saveStory(input, "admin", row.updatedAt.toISOString())`. Doğrudan
  `UPDATE` yazma: sürüm denetimi ve fotoğraf atlanır. Önce kuru çalıştır,
  sonra `--apply`. Canlı veritabanıdır (kök CLAUDE.md → Yerelde).
- **Kırık Bağlantı Raporu** (`links.yml`, pazartesi; tek açık issue):
  lychee'nin hata saydığı adres `.github/scripts/links-recheck.py` ile
  yeniden denenir, kalanlar gerçekten kırıktır. Mercek kaynağı
  (`stories.sources`) ölmüşse sıra: aynı yazının yeni adresi → web.archive.org
  kopyası → adresi kaldır, etiketi bırak. Uydurma ya da başka yayının
  bağlantısı konmaz.
- Rehber depoda (`content/guide/`: meta + tr + en, eksik çeviri derlemeyi
  kırar); mercek veritabanında (`stories`, slug başına iki `locale`; çeviri
  yoksa orijinal "TR" rozetiyle).
- Bilanço analizi (`earnings_analyses`): sayılar HAM (8.97e9), metin dile
  göre. Bilançolar dört sekme (`/bilancolar`, `/hafta`, `/analizler`,
  `/takip`); sekme çubuğunu her sayfa kendi basar — detay sayfası sekmesiz.
- Teknik analiz (`technical_analyses`): satır YAYIN başına (metin
  `copy.{tr,en}`). Sembol listesi `lib/technical.ts` → `TECHNICAL_SYMBOLS`;
  nöbet saati değişirse `SLOT_ET` ile `currentSlot`/`LATEDAY_FROM_ET`
  birlikte (yoksa yeni koşu var olan nöbetin ÜSTÜNE yazar); `TECHNICAL_CRON`
  `SLOT_ET`ten türer, claude.ai'deki görev elle yeniden kurulur. Bülten saati
  `lib/data.ts` → `BRIEF_PUBLISH` (günlük 09:00 ET, haftalık 09:30 TR).
