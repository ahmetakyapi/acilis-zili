---
paths:
  - "lib/i18n/**"
  - "lib/site.ts"
  - "app/**"
---

<!-- Yol kapsamlı kural: eşleşen bir dosya okunduğunda/düzenlendiğinde yüklenir. Kaynak: kök CLAUDE.md'den taşındı (8 Kasım 2026); kural metni aynen korundu. -->

## Arayüz Metni ve Diller

- **Tailwind v4**: `tailwind.config.ts` yok, tokenlar `app/globals.css` →
  `@theme inline`.
- **Arayüz metni** `lib/i18n/dictionaries/{tr,en}.ts`; `en`, `typeof tr` —
  `tr`'ye eklenen anahtar `en`'i derletmez, ikisi birlikte. **Her özellik
  kendi ad alanında** (`glossary`, `stockDepth`, `lira`…; büyük özellikler
  aynı dizinde kendi dosyasında); var olana anahtar serpiştirme.
- **Çevirisi eksik olabilen içerik** (mercek, analiz, bülten, teknik): aynı
  dil listesi hem `pageAlternates`e hem `articleOpenGraph`a (`availableLocales`)
  gider; site haritası da yalnız o dilleri yazar. Canonical, hreflang ve
  `og:locale` metnin dilini söyler, arayüzünkini değil (`lib/site.ts`).
