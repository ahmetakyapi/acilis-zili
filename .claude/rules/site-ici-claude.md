---
paths:
  - "lib/stock-insights.ts"
  - "lib/ai-*.ts"
  - "lib/claude-*.ts"
  - "lib/advice-guard.ts"
  - "lib/translate.ts"
  - "lib/weekly-commentary.ts"
  - "app/api/ai/**"
  - "app/(app)/claude/**"
  - "components/ai/**"
---

<!-- Yol kapsamlı kural: eşleşen bir dosya okunduğunda/düzenlendiğinde yüklenir. Kaynak: kök CLAUDE.md'den taşındı (8 Kasım 2026); kural metni aynen korundu. -->

## Site İçi Claude

Rutinlerden ayrı, sunucunun kendi Claude çağrıları. Anahtar
`lib/claude-key.ts` (`ANTHROPIC_API_KEY`, yoksa `CLAUDE_ANALYSIS_API_KEY`).

- **Notlar** (`app/api/ai/*`; hisse sayfası "Bu Hafta Neden Hareket Etti",
  bilanço/haber/karşılaştırma/portföy/takip notları, Bu Hisseye Sor, düz
  cümleyle tarama): hepsi tek kapıdan, `callClaude` (`lib/stock-insights.ts`)
  + ortak günlük bütçe (`lib/claude-budget.ts`; istemci ve üye başına sayaç,
  anonime tavanın %80'i). SDK'yı doğrudan çağıran yalnız üç bilinçli yol var:
  analiz (`lib/ai-analysis.ts`), çeviri yedeği (`lib/translate.ts`), pazar
  özeti yorumu (`lib/weekly-commentary.ts`). Dördüncüyü açma.
- **Bunlar yazma katmanıdır:** yalnız tamamlanmış seans ve biçimlenmiş sayı
  verilir; çıktıdaki her sayı girdide geçmek zorunda (`lib/ai-grounding.ts`),
  geçmeyen metin HİÇ basılmaz. Kişiye ya da hisseye yön veren metin (portföy,
  risk, takip, Bu Hisseye Sor) bir de tavsiye denetiminden geçer
  (`lib/advice-guard.ts`: al/sat yönlendirmesi = SPK'ya göre yatırım
  danışmanlığı). Not istemciden istenir, botlara açılmaz.
- **Claude analizi** (`/claude/[symbol]`, `lib/ai-analysis*.ts`,
  `/admin/ai`): yetki + günlük kota + tek eşzamanlı iş kilidi, başarısız işte
  hak iadesi, Zod şemalı JSON çıktı. Ayrıntı ve model notları
  `docs/claude-analysis.md`; kullanıcı adı/e-posta/portföy modele gitmez.
- Model değiştirirken: Sonnet 5.5 ve sonrası `temperature` almaz, `thinking`
  yalnız `adaptive`.
