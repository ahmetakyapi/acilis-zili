---
name: ajan-dagitimi
description: Birden çok bağımsız işi paralel alt ajanlara worktree izolasyonuyla dağıtır ve çıktılarını ana dala güvenle birleştirir. Üç ya da daha fazla ayrı dosya grubuna dokunan bir tur (görsel tur, denetim bulguları, toplu düzeltme) planlarken kullan.
---

# Paralel Ajan Dağıtımı

## 1. Böl

İşleri DOSYA kümesine göre grupla; iki ajan aynı dosyaya dokunmasın. Ortak
dosya varsa (sözlükler `lib/i18n/dictionaries/{tr,en}.ts`, `lib/content-write.ts`)
ya sıraya koy ya da sahibini tek ajana ver. Belgeler (`docs/`, README) ayrı
bir ajana gidebilir: kodla çakışmaz.

## 2. Brif (her ajana)

Alt ajan bağlamı görmez; brif tek kaynağıdır. Her brifte:

1. **Taban:** worktree eski bir commit'ten açılabilir (8 Kasım: kopyalar 19
   commit gerideydi, iki birleştirmede çakışma çıktı). İlk komut
   `git fetch origin main && git merge --ff-only origin/main` ve
   `git log --oneline -1` beklenen SHA ya da sonrası; değilse dur.
2. Kök `CLAUDE.md`yi ve ilgili `.claude/rules/*.md` dosyasını adıyla okut;
   karar yorumları silinmez.
3. Kapsam: dokunacağı dosyalar ve DOKUNMAYACAKLARI (öteki ajanların alanı).
4. Kanıt: `npm ci`, `npm run build`, `npm run check`; görselse `olcum`
   skill'i. Commit ATMA, push ETME.
5. Teslim: değişen dosyalar, gerekçe, ölçüm/test, check özeti.

Dört ajana aynı on paragrafı yazma: ortak kısım ajan tanımındadır
(`.claude/agents/` — görsel işte `ekran-tasarimcisi`, denetimde
`gorsel-denetci`); tanımı olmayan işte ortak brifi scratchpad'e TEK dosya
yaz, her ajana yolunu ver. Brif yalnız o ajana özgü olanı taşır: kapsam,
port, bulgular.

Herkesin dokunmak isteyeceği dosyalar (`app/globals.css`,
`components/ui/primitives.tsx`, `components/motion/`, sözlükler) tur
boyunca ana oturumundur: ajan yamayı raporunda önerir. Sözlükte her ajan
yalnız kendi ad alanına ekler, var olanı yeniden sıralamaz.

Ürün kararı gerekiyorsa brifte ver (ör. "panelden düzeltilen yedek yedek
kalır"); ajan karar vermek zorunda kalırsa raporuna yazar.

## 3. Birleştir

Ajan bitince (bildirim gelir, bekleme döngüsü kurma):

```bash
W=.claude/worktrees/agent-<id>
git -C $W add -A
git -C $W diff --cached <taban-sha> > /tmp/<konu>.patch
git apply --3way /tmp/<konu>.patch && git reset -q
npm run typecheck
```

Çakışmada iki tarafın NİYETİNİ birleştir (yenisi eskisini sessizce
geri almasın). Kapsam dışına taşan değişikliği oku, kabul ya da geri al ve
kullanıcıya söyle.

## 4. Ajan Çıktısına Güven

Rapor iddiadır; birleştirmeden sonra birleşik hâli bir kez daha ölç ve test
et. Raporda "kapsam dışı bıraktım" denen tek satırlık bağlantıları
(ör. sayfanın yeni prop'u geçirmesi) sen tamamla.

Ardından `yayin` skill'i.

## 5. Ders

- 14 Kasım: sekiz ajan aynı anda `npm ci && npm run build` koşunca 15 GB
  bellek doldu (çekirdek süreç öldürdü, ana oturumun typecheck'i 300 saniyeyi
  aştı). Derleyen ajan sayısı aynı anda EN ÇOK DÖRT; salt okunur denetim
  ajanları (derleme yok) bu sayıya girmez. Fazlası sıraya: ilk dalga bitince
  ikinci dalga.
- 14 Kasım: worktree `origin/main`den açılır; güncel iş daldaysa brife
  "ilk komut `git fetch origin <dal> && git merge --ff-only origin/<dal>`"
  yaz (dal itilmiş olmalı).
