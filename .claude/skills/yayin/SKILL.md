---
name: yayin
description: Biten işi iş alanı başına bütün commit'lere toplar, denetimleri koşar, main'e gönderir ve Deploy koşusunu yeşil görene kadar izler. Bir iş turunu bitirip canlıya alırken ya da kullanıcı "main'e al" dediğinde kullan.
---

# Yayın

Kurallar kök `CLAUDE.md` → Commit ve Yayın. Bu skill sırası:

## 1. Denetim

```bash
rm -rf .next && npm run build
npm run check
python3 -m unittest discover -s tests/deploy   # deploy/ ya da iş akışı değiştiyse
```

Staged diff'i sırlara karşı tara (depo herkese açık); rutin promptu
kopyalandıysa `grep -rnE "[0-9a-f]{64}" docs README.md` boş dönmeli.

## 2. Commit'leri Topla

Commit BÜTÜN hâlinde: iş alanı başına bir commit, gövdede her değişikliğin
gerekçesi ayrı paragraf. Durdurma kancası yüzünden dalda `WIP:` commit'leri
oluştuysa `main`e gitmeden topla:

```bash
git reset --soft <son-main-sha>    # çalışma ağacı ve index korunur
git reset -q                        # index'i boşalt, sonra alan alan ekle
git add <alan-1 dosyaları> && git commit   # ... her alan için
```

`main`e DALI DEĞİL toplanmış commit'leri gönder. Dal `main`in gerisinde
WIP taşıyorsa ve force push yasaksa dalı `git merge -s ours` ile
eşitleyebilirsin, ama o birleştirmeyi ASLA `main`e itme (8 Kasım'da WIP
satırları `main` geçmişine böyle sızdı):

```bash
git push origin <toplanmis-sha>:main     # yalnız fast-forward
```

`git push --force` ve `git reset --hard` yasak (`.claude/settings.json`).

## 3. Deploy'u İzle

Her `main` push'u bir sürümdür. Koşuyu BİTENE dek izle; bekleme döngüsü
tek arka plan komutu olsun:

```bash
until s=$(curl -s https://api.github.com/repos/ahmetakyapi/acilis-zili/actions/runs/<id> \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('status'),d.get('conclusion'))"); \
  [[ "$s" == completed* ]]; do sleep 30; done; echo "$s"
```

Koşu kimliği: `.../actions/workflows/deploy.yml/runs?per_page=1`. Düşerse
önce günlük: `verify` düştüyse kod (yerelde aynı komutlar geçmeliydi),
`deploy` adımı düştüyse sunucu (disk, ağ, servis). Yeşil görülmeden "bitti"
denmez.

## 4. Sonra

- Yalnız ekleyen migration varsa "Migrate DB" iş akışı: `check` → `apply`,
  `docs/ROUTEMAP.md`'deki sayıyı güncelle. Veri değiştiren migration sorulur.
- Rutin promptu değiştiyse sahibine "claude.ai'de yeniden yapıştır" de ve
  ROUTEMAP'e açık iş yaz. Yazım kuralı değiştiyse `content/kurallar/*.md`
  yeterli: rutin her koşuda `/api/kurallar` ile okur.
