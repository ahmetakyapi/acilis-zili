# Açılış Zili — Claude Code Notları

**Proje:** ABD borsasını Türk yatırımcıya Türkiye saatiyle anlatan iki dilli
(TR birincil, `/en` önekli EN) site — https://aciliszili.com. Next.js 16
(App Router) + React 19, Drizzle + Neon Postgres, NextAuth v5, Tailwind v4.
Tek VPS'te çalışır (`deploy/`). Yazılı içeriği claude.ai rutinleri üretir;
sitenin kendi Claude çağrıları ayrı ve sınırlıdır (`.claude/rules/site-ici-claude.md`).

**Bu dosyanın sözleşmesi.** Kararların gerekçesi kod içi yorumlarda yaşar;
oralar karar kaydıdır, silme. Burada yalnız **her oturumda bilmen
gerekenler**: kural + tek satır neden + gerekçenin durduğu dosya. Yalnız
belirli dizinlere ait kurallar `.claude/rules/`te (yol kapsamlı), çok
adımlı prosedürler `.claude/skills/`te; bu dosya 200 satırın altında kalır
(Claude Code önerisi: uzun dosya uyumu düşürür). Geçmiş
anlatısı, sayım ve liste buraya yazılmaz (eskir); kaynağa nasıl sorulacağı
yazılır. Bir kural değişince satırı güncelle, yanına yenisini ekleme.

| Ne arıyorsan | Nerede |
|---|---|
| Rotalar, mimari, veri modeli, ortam değişkenleri | `README.md` (tek rota listesi) |
| Neyin canlı, neyin yarım olduğu | `docs/ROUTEMAP.md` (rota DEĞİL durum tutar) |
| Rutin promptları (bülten, mercek, analiz, teknik, grafik) | `docs/claude-rutinler.md` |
| Kullanıcı isteğiyle Claude analizi | `docs/claude-analysis.md` |
| Sunucu, deploy, geri dönüş | `docs/deploy-vps.md`, `deploy/update.sh` |
| Video/kısa film (MP4: tanıtım, reklam, sosyal medya) — `cinecode` skill'i | `docs/film-kimligi.md` |
| Alan kuralları (dosyaya dokununca yüklenir) | `.claude/rules/*.md` (aşağıda özet) |
| Prosedürler: ön kontrol, ölçüm, görsel tur, ajan dağıtımı, yayın | `.claude/skills/*/SKILL.md` |
| Proje ajanları (ortak brif tanımında) | `.claude/agents/*.md` |
| Eski tasarım devri ve denetim kayıtları (kural DEĞİL) | `docs/arsiv/` |

## Oturum Başı

```bash
git config user.name "Ahmet Akyapı"
git config user.email "ahmetakyapii@gmail.com"
npm ci && npm run build          # temiz kopyada typecheck'ten ÖNCE build
```

- Commitler her zaman `Ahmet Akyapı <ahmetakyapii@gmail.com>` adına; yazarı
  yalnız "Claude" olan commit atılmaz. Claude, mesaj sonundaki
  `Co-Authored-By: Claude …` satırıyla ortak yazar (sahibinin tüm repolarında,
  9 Ekim 2026).
- **Neden önce `build`:** `PageProps`/`RouteContext` tipleri `.next/types`
  altına build sırasında üretilir; öncesinde typecheck "Cannot find name
  'PageProps'" verir (CI sırası da bu: `deploy.yml`).

## Komutlar

```
npm run dev                      # 3000 doluysa 3001'e düşer
npm run build                    # route tipleri bozulursa önce `rm -rf .next`
npm run typecheck                # `npx tsc` değil — önce iCloud kopyalarını temizler
npm run lint
npm test                         # birim testleri (tsx --test; tek dosya: npx tsx --test tests/<ad>.test.ts)
npm run check                    # typecheck + lint + test — commit öncesi tek komut (build'den sonra)
python3 -m unittest discover -s tests/deploy   # deploy/ ve .github/scripts/ betiklerinin testleri
npm run smoke                    # başsız Chrome: rota kodu, konsol hatası, yatay taşma, sıkışan hap
npm run db:generate              # şema değişti → YENİ migration; eskisini düzenleme
npm run db:migrate
npm run db:seed                  # takvim kapsamı azalınca uyarır; bir `stories` satırını da ezer
npm run db:seed:events           # yalnız ekonomik takvim — takvimi tazelemek için bu
npm run build:favicon            # .ico + PWA PNG'leri (elle üretme)
npm run build:email              # posta bant GIF'i (public/email/hero.gif, elle üretme)
```

`db:push` YOK (30 Ekim'de kaldırıldı): migration geçmişini atlayıp canlı
şemayı doğrudan değiştirir. Şema değişikliği yalnız `db:generate` + migration.

## Commit ve Yayın

- **Yayın:** `main`e push → `deploy.yml` (build + typecheck + lint + test)
  → SSH ile VPS'te `deploy/update.sh`. Test düşerse sürüm çıkmaz. Her push yeni sürümdür, belge değişikliği dahil.
  Duman testi ayrı iş akışı (`smoke.yml`), kapı değil.
- **`main`e push için onay SORULMAZ** (sahibinin isteği, 28 Ekim 2026: "artık
  oto alabilirsin"): denetimler temizse doğrudan `main`e gönder.
- Commit öncesi temiz: `build`, sonra `npm run check`; `deploy/` ya da
  iş akışı değiştiyse `python3 -m unittest discover -s tests/deploy` de (CI
  aynısını koşar). Yeni `lib/` mantığı testsiz girmez (`tests/<ad>.test.ts`).
  Görsel değişiklik tarayıcıda ÖLÇÜLMÜŞ olmalı — "sığıyor gibi duruyor"
  doğrulama değil.
- **Kırmızı deploy bırakılmaz** (sahibinin isteği, 6 Kasım 2026: "run failed
  aldık yine, artık almayalım"). `main`e push eden oturum `Deploy` koşusunu
  BİTENE dek izler (GitHub Actions, ~10 dk); düşerse önce işin günlüğü
  okunur, kök neden düzeltilir, aynı oturumda yeniden yayınlanır ve yeşil
  görülmeden "bitti" denmez. Ayrım: `verify` düştüyse kod (yerelde aynı
  komutlar geçmeliydi — sırası atlandı demektir); `deploy` adımı düştüyse
  sunucu (disk, ağ, servis) — kod değiştirmeden önce günlükteki hataya bak.
- **Disk dolması derleme hatası değildir.** Derlemeden önce
  `deploy/disk-guard.sh` yer açar (Turbopack önbellekleri → ortak
  `fetch-cache`in BÜYÜK kayıtları → npm önbelleği → üç günden eski önbellek)
  ya da derlemeye girmeden, neyin yer kapladığını basarak durur; o adım
  düşerse sunucuda yer açılmalı (`docs/deploy-vps.md` → "Disk doluyor").
  Gerekçe: 6 Kasım'da derleme "No space left on device" ile düştü; yükün
  34 GB'ı `shared/fetch-cache`ti. Önbellek budaması boyuta göre (Claude
  notları küçük ve ücretli, kalır), gece işi büyük kayıtları iki günde siler.
- **`update.sh` düzeltmesi bir deploy GECİKMELİ çalışır**: iş akışı sunucudaki
  CANLI sürümün `current/deploy/update.sh`ını koşturur. Bu deploy'da etkili
  olması gereken düzeltme, `deploy.yml`'de ayrı adım olarak bu commit'ten
  (stdin ile) koşturulur — örnek "Derleme için diskte yer aç".
- **Oturumda iki-üç commit**, konu başına bir tane. Tek başlıkta
  özetlenebiliyorsa tek commit; "görsel iyileştirme" ve "performans" gibi iki
  alan varsa iki. Her mikro düzeltmeye ya da ekrana ayrı commit YOK.
  **Commit BÜTÜN hâlinde, parça parça değil** (sahibinin isteği, 8 Kasım
  2026): bir iş alanı bitmeden ara commit atılmaz; dalda ara commit
  oluştuysa (ör. durdurma kancası istedi) `main`e gitmeden konu başına
  tek commit'e toplanır.
- **İş sürerken yeni istek gelirse ya da arka planda ajan çalışıyorsa
  commit'i ERTELE**; kuyruk boşalınca topla (bu uyarı beş kez geldi). "Konu"
  ekran değil İŞ ALANI: büyük görsel turda bile 2–4 commit. Mesele sayı, detay değil: gövdede her değişikliğin
  gerekçesi ayrı paragraf.
- Mesaj Türkçe, başlık ne değiştiğini söyler (`git log` kalıbına bak).
- **Depo herkese açık:** staged diff'i sırlara karşı tara (`.claude/rules/altyapi-ve-guvenlik.md`).
- **Commit kancası** (`.githooks/pre-commit`; `npm ci` `prepare` ile kurar):
  eklenen satırda sır, uygulama kodunda `console.log`/`debugger`/`TMP…`
  varsa commit'i durdurur. Ajanlar çalışırken alınan anlık commit bir
  denemenin `label="TMPTEST"` satırını canlıya çıkarmıştı (23 Eylül,
  `32e6d16d`); build/lint/test bunu yakalamaz. `--no-verify` yalnız
  bilinçli istisnada. Kanca `TODO`'yu yakalamaz: diff'e yine bak.

## Ajanlarla Çalışma

Proje ajanlarla, "vibe coding" usulü gelişiyor. Bu dosya `AGENTS.md` olarak
da okunur (sembolik bağ; Codex, Cursor, Gemini) — Claude'a özgü olmayan
kuralı buraya yaz, aracın adına değil.

- **Yanıt, ara not, alt ajan brifi ve commit Türkçe.** Okura görünen metinde
  "düğme" değil "buton"; teknoloji seçimi için "tech stack" ("yığın" değil);
  İngilizceden kelime kelime çeviri yok ("çıplak sayı" → "birimsiz sayı").
- **Tasarım/UX ara kararlarını kendin ver**, gerekçesini rapora yaz (sahibinin
  isteği, 25 Ekim: "sınırlarını zorla, sonra değiştiririz"). Yine SORULACAK:
  veri silen/değiştiren migration, ödeme/hesap/üçüncü taraf hizmet, bu
  dosyadaki kuralı değiştirmek.
- **Claude izinleri** `.claude/settings.json`'da (paylaşılan): denetim
  komutları izinli; `drizzle-kit push`, `git push --force` (lease dahil),
  `git reset --hard` yasak; `.env*` ve `docs/*.local.md` okunmaz (canlı
  veritabanı ve doldurulmuş promptlar). Bash kuralları komut METNİNİ eşler,
  güvenlik sınırı değildir. Kişisel ekler `settings.local.json`'a.
- **Alt ajan commit ATMAZ, push ETMEZ**; commit ana oturumun işi, ajanlar
  bitince. Paralel ajanlar aynı dosyayı düzenleyecekse ya sıraya koy ya da
  `isolation: worktree`.
- **Alt ajan brifi bu dosyayı okutur** ve ilgili §'i adıyla verir; ajan
  kuralı bilmeden "düzeltip" kod içi karar yorumunu silebilir. Ortak
  dosyalar (`app/globals.css`, `components/ui/primitives.tsx`, sözlükler)
  paralel turda ana oturumundur (`ajan-dagitimi`).
- **Bitti demeden önce kanıt:** değişen davranışın testi ya da ölçümü
  (`npm run check`, `npm run smoke`, `.tmp-*.mjs` ölçüm betiği). Görsel iş
  ekran görüntüsüyle değil sayıyla doğrulanır (`.claude/rules/arayuz.md` → Düzen; yöntem `olcum` skill'i).

## Alan Kuralları — `.claude/rules/`

Aşağıdaki kurallar ilgili dosyaya dokunulduğunda Claude Code'a kendiliğinden
yüklenir (`paths:` frontmatter). Kural metni orada; burada yalnız özü. Bu
dosyayı `AGENTS.md` olarak okuyan araçlar (Codex, Cursor, Gemini) ilgili
dosyayı işe başlamadan OKUR. Kural değişince orada güncellenir.

| Alan | Dosya | Özü |
|---|---|---|
| Title Case | `.claude/rules/yazim.md` | Cümle olmayan her metin Title Case; `title()`/`capitalize` yok, `toLocaleLowerCase("tr-TR")` |
| Arayüz | `.claude/rules/arayuz.md` | Ekran sırası (başlık → künye → görsel → ölçü → metin → künye → `DataStamp`), ölçmeden değiştirme, görsel dil (tonla derinlik, renk anlam taşır, ince grafik, `--ease-brand`, `VerdictPill`), `:::` blokları, mürekkep sahneleri ve zil |
| Veri ve önbellek | `.claude/rules/veri-ve-onbellek.md` | Uydurma kesinlik yok, yüzde seansını kanıtlar, yazma katmanı bayat veri kullanmaz; saat TR önce (`lib/session-clock.ts`, ET↔UTC yalnız `lib/market-hours.ts`); `"use client"` sınırı, `cache()`/`unstable_cache`, keyParts sürümü |
| İçerik | `.claude/rules/icerik-ve-rutinler.md` | Rutinler claude.ai'de; yazma yolu TEK `lib/content-write.ts`; uca alan = prompt da değişir; panel düzeltir, üretmez |
| Site içi Claude | `.claude/rules/site-ici-claude.md` | Tek kapı `callClaude` + ortak bütçe; çıktıdaki sayı girdide geçmeli; tavsiye denetimi; dördüncü SDK yolu açma |
| Altyapı | `.claude/rules/altyapi-ve-guvenlik.md` | Depo herkese açık, sır commit'lenmez; migration deploy'da uygulanmaz ("Migrate DB"), veri değiştiren migration sorulur; çerçeveleme, cron, push, e-posta tek kapı |
| Diller | `.claude/rules/diller.md` | Metin `lib/i18n/dictionaries/{tr,en}.ts`, ikisi birlikte, özellik başına ad alanı; çevirisi eksik içerikte dil listesi |
| Hareket | `.claude/rules/hareket.md` | Hareket veriyi çizen öğede, bir kez, sunucu son kareyi basar; yalnız kompozitör; yardımcı KATALOĞU (yenisini yazmadan önce bak) |
| Küçük ama kritik | `.claude/rules/kucuk-ama-kritik.md` | `scroll={false}`, katlama yerinde açılır, otomatik bağlantı, W-8BEN %20, iCloud kopyaları |

**Prosedürler skill'lerde** (`.claude/skills/`, çağrılınca yüklenir):
`on-kontrol` (kırmızı koşu, migration, rutin, dal artığı — işe ve yayına
başlamadan), `olcum` (geçici önizleme rotasıyla görsel ölçüm),
`gorsel-tur` (canlıyı dilimli oku → bulgu listesi → ekran başına ajan →
yeniden ölç), `ajan-dagitimi` (paralel worktree ajanları ve birleştirme),
`yayin` (toplu commit, `main`, Deploy izleme). **Proje ajanları**
(`.claude/agents/`): `ekran-tasarimcisi` (tek ekranın görsel sahibi,
ölçerek teslim eder), `gorsel-denetci` (salt okunur ölçüm). Bir tuzak
yaşanınca ilgili skill'e tek satır ders yazılır; atıfların tazeliğini ve
bu haritanın eksiksizliğini `tests/agentic-files.test.ts` denetler.

## Yerelde

- **`.env.local`'deki `DATABASE_URL` CANLI Neon** — gerçek üyeler ve
  rutinlerin yazıları. Yerelde koşan `db:seed`, `db:migrate` ve her geçici
  betik üretime yazar. Seed yeni kod canlıdayken koşar; migration SQL'i
  koşmadan önce okunur (`.claude/rules/altyapi-ve-guvenlik.md`).

Boş sağlayıcı anahtarında kartlar "veri alınamadı" der, sayfa çökmez —
beklenen. Grafik eksikse önce anahtara bak (`/api/debug/providers`).
`BRIEF_SECRET`/`CRON_SECRET` boşsa korumalı uçlar geliştirmede açık, üretimde
503 (`lib/api-auth.ts`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
