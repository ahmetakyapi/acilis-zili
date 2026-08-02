# Açılış Zili — Claude Code notları

Kurallar ve mimari kararlar `README.md` ile `docs/` altında; kod içi
yorumlar da bir karar kaydı olarak yazılıyor, silme.

## Hızlı komutlar

```
npm run dev         # geliştirme (3000 doluysa 3001'e düşer)
npm run typecheck   # tsc --noEmit  ·  `npx tsc` ÇALIŞMAZ
npm run lint
npm run build       # route tipleri bozulursa önce `rm -rf .next`
npm run db:seed
```

## Bilinmesi gerekenler

- **Depo herkese açık.** `BRIEF_SECRET` ve `CRON_SECRET` asla commit'lenmez.
  Gerçek değerlerin bulunduğu `docs/rutinler.local.md` `*.local.md` deseniyle
  gitignore'da; commit öncesi staged diff'i secret'a karşı tara.
- **Tailwind v4** — `tailwind.config.ts` yok, tokenlar `app/globals.css`
  içindeki `@theme inline` bloğunda. Hardcoded renk yasak.
- **Tema** next-themes değil, `data-theme` + `az-theme` çerezi.
- **Arayüz metni** sözlükte: `lib/i18n/dictionaries/{tr,en}.ts`. `en`, `tr`
  tipinden türüyor — `tr`'ye anahtar eklersen `en` derlenmez, ikisini birlikte
  güncelle.
- **Rehber yazıları** depoda (`content/guide.ts`), **mercek yazıları**
  veritabanında (`stories` tablosu, `/api/mercek` üzerinden yazılır).
- **Yatay taşma** düzenli olarak kontrol edilir; `.tmp-shot.mjs` benzeri bir
  puppeteer koşumu route × genişlik matrisini tarar.
