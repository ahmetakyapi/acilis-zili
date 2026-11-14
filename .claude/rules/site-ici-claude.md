---
paths:
  - "lib/stock-insights.ts"
  - "lib/ai-*.ts"
  - "lib/claude-*.ts"
  - "lib/advice-guard.ts"
  - "lib/portfolio-scan*.ts"
  - "lib/portfolio-advisor*.ts"
  - "lib/portfolio-earnings-desk*.ts"
  - "lib/portfolio-question*.ts"
  - "lib/portfolio-weekly*.ts"
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
- **Tek istisna: site sahibinin Kişisel Planı** (10 Kasım, sahibinin isteği:
  "bu sadece bana özgü… buradan kâr al, buradan zarar kes"). Günlük portföy
  taramasında (`lib/portfolio-scan.ts`) yalnız `role = admin` oturumunda
  model al/sat/azalt görüşü ve kâr al / zarar kes seviyesi yazar; tavsiye
  denetimi orada kapalı, sayı denetimi açık, seviyeler YALNIZ sunucunun
  verdiği listeden (teknik analiz seviyeleri, üç aylık bant, maliyet —
  `planLevels`). Üyelere asla açılmaz; önbellek anahtarı ayrı ("plan").
  Aynı istisna (11 Kasım) şu yollarda da, aynı kurallarla: kişisel danışman
  (`lib/portfolio-advisor*.ts`, /portfoy/analiz, yalnız sahip; hedef ağırlık
  yalnız `REFERENCE_WEIGHTS`ten), Bilanço Masası
  (`lib/portfolio-earnings-desk*.ts`), Portföyüne Sor
  (`lib/portfolio-question*.ts`; senaryo hesabını sunucu yapar) ve pazar
  postasındaki portföy karnesi (`lib/portfolio-weekly*.ts`; alıcının rolü).
- **Claude analizi** (`/claude/[symbol]`, `lib/ai-analysis*.ts`,
  `/admin/ai`): yetki + günlük kota + tek eşzamanlı iş kilidi, başarısız işte
  hak iadesi, Zod şemalı JSON çıktı. Ayrıntı ve model notları
  `docs/claude-analysis.md`; kullanıcı adı/e-posta/portföy modele gitmez.
- Model değiştirirken: Sonnet 5.5 ve sonrası `temperature` almaz, `thinking`
  yalnız `adaptive`.
- **İstemin ortak kuralları tek kaynakta** (14 Kasım): "yalnız verilen veri",
  sayı yazımı, güvenilmeyen metin, tavsiye çizgisi ve dil
  `lib/claude-prompt-rules.ts`ten gelir; yeni istem bunları yeniden yazmaz,
  örneği sayısız tutar. İstemi (ya da o dosyayı) değiştiren, etkilenen her
  çağrının `unstable_cache` anahtar sürümünü artırır
  (`tests/claude-prompt-rules.test.ts`).
- **Hazır soru ancak yanıtlanabilirse basılır**: çip, yanıtı taşıyan veri
  bloğu girdiye girecekse çıkar; tek şey sorar, küçük sayıyı yazıyla yazar,
  üyeye tavsiye istemez. Seçim saf modüllerde ve testli:
  `lib/stock-question-suggest.ts`, `lib/portfolio-question-suggest.ts`.
  Sözlüğe sabit soru listesi konmaz.
