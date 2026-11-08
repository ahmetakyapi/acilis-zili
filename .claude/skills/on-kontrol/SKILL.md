---
name: on-kontrol
description: Sorunları kullanıcıdan ÖNCE bulur — kırmızı GitHub koşuları, bekleyen ya da duran migration, düşen claude.ai rutinleri, dal ve worktree artıkları, eskiyen kural/skill atıfları. Büyük bir işe başlamadan, yayından (`yayin`) önce ve kullanıcı "run failed", "düştü", "çalışmıyor" dediğinde kullan.
---

# Ön Kontrol

Amaç: kullanıcı GitHub'dan "run failed" bildirimi almadan önce görmek.
Her adım salt okunur; bulguyu tek tabloda raporla, düzeltmeyi ayrı yap.

## 1. GitHub Koşuları (bütün iş akışları, yalnız Deploy değil)

```bash
curl -s "https://api.github.com/repos/ahmetakyapi/acilis-zili/actions/runs?per_page=20" \
 | python3 -c "import json,sys;[print(r['name'],r['head_sha'][:7],r['event'],r['conclusion'],r['created_at']) for r in json.load(sys.stdin)['workflow_runs'] if r['conclusion'] not in ('success','skipped',None)]"
```

Her kırmızı koşu için önce günlük (`get_job_logs`, `failed_only`): kod mu
(verify), sunucu mu (deploy adımı), yoksa TASARIM GEREĞİ bir durdurma mı?
Tasarım gereği durdurma kırmızı görünmemeli; görünüyorsa iş akışını düzelt
(8 Kasım: Migrate DB `check` güvenlik durdurmasında kırmızıydı, artık
uyarı + yeşil). Kullanıcının elle tetiklediği ya da senin tetiklediğin
koşu da sayılır.

## 2. Migration

- `docs/ROUTEMAP.md`'de bekleyen migration var mı?
- "Migrate DB" `check` (her zaman yeşil biter): özette `bekleyen`,
  `eşleşmeyen kayıt` ya da `DUR` var mı? `DUR` varsa `diagnose` (salt
  okunur şema karşılaştırması) koş; `apply` ancak şema farkı yalnız
  bekleyen migration'ın tablolarıysa ve eşleşmeyen kaydın özeti
  `accept_stray` ile bilinçli verilirse. Veri silen/değiştiren düzeltme
  sahibine sorulur.
- Ders (8 Kasım): eşleşmeyen kayıt bir hata değil, ORTAK veritabanındaki
  başka bir projenin migration'ıydı (diagnose: `memleket_*`, `oyz_*`,
  `app_state*`). Önce diagnose, sonra karar; kör apply ya da kayıt silme yok.

## 3. Rutinler (claude.ai)

`list_triggers` (recurring: true) — prompt metnini ASLA basma (anahtar
içerir); yalnız `name`, `cron_expression`, `last_run.status`,
`failure_reason`. Beklenen cron'lar `docs/claude-rutinler.md` başındaki
tabloda. `FAILED` + `USAGE_LIMIT_REACHED` → Görev Kontrolü telafi etti mi
bak; içerik eksikse (ör. Günün Grafiği) site yedeği yazdı mı kontrol et.
API ile kurulmuş rutinleri bu oturum düzenleyemez: sahibine adım ver.

## 4. Depo ve Dal

```bash
git fetch -q origin main && git status -sb | head -1
git log --oneline origin/main..HEAD | head      # main'e gitmemiş commit
git stash list | head                           # unutulmuş stash
ls .claude/worktrees 2>/dev/null | wc -l        # bitmiş ajan kopyaları
```

`main` geçmişine WIP ya da birleştirme commit'i sızmasın: `main`e yalnız
toplanmış commit'ler gider (`yayin`).

## 5. Agentic Dosyaların Tazeliği

`npx tsx --test tests/agentic-files.test.ts` — CLAUDE.md, kurallar ve
skill'lerdeki her dosya yolu var mı, kural `paths:` kalıpları eşleşiyor mu,
CLAUDE.md ≤200 satır mı (CI da koşar). Kırmızıysa atfı düzelt, testi
gevşetme.

## 6. Rapor ve Ders

Tek tablo: alan · durum · bulgu · yapılacak. Bu turda yaşanan bir tuzak
(yanlış varsayım, kırmızı koşu, çakışma) varsa ilgili skill'e TEK SATIR
ders ekle (tarih + ne olmuş + kuralı); aynı tuzak ikinci kez yaşanmasın.
