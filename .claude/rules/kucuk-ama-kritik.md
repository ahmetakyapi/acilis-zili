---
paths:
  - "app/**"
  - "components/**"
  - "lib/**"
---

<!-- Yol kapsamlı kural: eşleşen bir dosya okunduğunda/düzenlendiğinde yüklenir. Kaynak: kök CLAUDE.md'den taşındı (8 Kasım 2026); kural metni aynen korundu. -->

## Küçük ama Kritik

- Sayfa içi filtre/sıralama bağlantıları `scroll={false}`.
- **Katlama bastığın yerde açılır**: `components/layout/ExpandInPlace.tsx`
  (aç/kapa anında kaydırma çapası kapalı); yeni `sr-only` onay kutusu düğmenin
  hizasına (`.foldInput`, `components/ui/FoldToggle.module.css`).
- Karşılaştırma ekranı: sözleşme `lib/compare.ts`, istemci
  `components/markets/CompareLive.tsx`, bar ucu `app/api/karsilastir/route.ts`;
  aralık istemcide değişir.
- Grafikte dokunmatik okuma, aralık değişince temizlenir.
- Otomatik bağlantı (`lib/autolink.ts`): terim/sembol yalnız İLK geçişte;
  sembol yalnız `$NVDA` / `(NVDA)` kalıbında ve bilinen kümedeyse.
- ABD temettü stopajı W-8BEN ile bireyde **%20** (yoksa %30; %15 yalnız ≥%10
  oy hakkı olan kurum). Tek kaynak `lib/tax.ts` → `US_WITHHOLDING`.
- **iCloud kopyaları** (`alpaca 2.ts`, `routes.d 5.ts`) `.next/types`'a düşüp
  `TS6200` ile derlemeyi kırar; `typecheck`/`build` önce
  `scripts/clean-sync-dupes.mjs` koşar, `.gitignore` commit'i engeller.
  Kalıcı çözüm: iCloud Drive → "Masaüstü ve Belgeler Klasörleri" kapalı.
