---
paths:
  - "app/**"
  - "components/**"
  - "lib/i18n/**"
  - "content/**"
  - "docs/claude-rutinler.md"
---

<!-- Yol kapsamlı kural: eşleşen bir dosya okunduğunda/düzenlendiğinde yüklenir. Kaynak: kök CLAUDE.md'den taşındı (8 Kasım 2026); kural metni aynen korundu. -->

## Yazım: Title Case

**Cümle olmayan her metin Title Case** — künye ve birimler dahil:
- Sayfa/bölüm/panel/kart başlıkları, buton ve bağlantılar ("Tümünü Gör"),
  kategori/filtre/sekme/rozet, tablo başlıkları ve etiket sütunu, rehber ve
  mercekteki `##`/`###`, kısa vurgular ("Yatırım Tavsiyesi Değildir").
- Künyeler: "Olaydan Bugüne", "15 Dakika Gecikmeli", "0,05 Puan",
  "20:04 Güncellendi", "56 Analist". (Muaf tutuldukları dönem tutarsızlık üretti.)

Cümle düzeninde kalanlar: paragraflar, açıklama ve ipucu satırları; boş
durum/hata **mesajları** (başlıkları Title Case); `placeholder` ve
`aria-label` cümleleri; sayı + isim kalıbındaki kısa cümleler ("819 şirketin
60 tanesi"); geri sayımın birim ekleri (`17 sa 59 dk 53 sn`).

Bağlaç/edat (ve, ile, için, de/da, mi) başta değilse küçük: "Faiz, Tahvil ve
Getiri Eğrisi". **`title()` / `capitalize` KULLANMA** (`i → I` üretir, `İ`
değil); küçültürken `toLocaleLowerCase("tr-TR")`.
