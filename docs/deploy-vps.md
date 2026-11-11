# Kendi sunucusunda yayına alma (Oracle Cloud Always Free)

**Sitenin yayınlandığı yer burası:** [aciliszili.com](https://aciliszili.com).
Kurulum bir dönem Vercel'in yanındaki ikinci kopyaydı, sonra asıl kopya
buraya taşındı. Gerekçesi kota: barındırmanın ücretsiz katmanında sınırlar
aylık ve ay ortasında bittiğinde site kapanıyor. Kendi sunucusunda ne
fonksiyon süresi sınırı var ne çağrı kotası — günlük cron'un 100 saniyelik
bütçesi de ilk kez olduğu gibi çalışabiliyor.

`main`'e her push GitHub Actions üzerinden buraya dağıtılıyor
(`.github/workflows/deploy.yml`, § Otomatik Dağıtım); aşağıdaki elle koşum
yolu hem ilk kurulum hem de acil durum için duruyor.

Kurulumun TAMAMI tek komutla yapılıyor: `deploy/remote.sh`, yerel makineden
sunucuya `deploy/` dizinini ve ortam dosyasını yükleyip `deploy/bootstrap.sh`'ı
orada çalıştırıyor. Bu belge o komuttan önce yapılması gerekenleri ve
komutun ne yaptığını anlatır; betiklerin kendisi (`deploy/*.sh`) her
adımın gerekçesini kendi içinde taşıyor.

---

## 0. Önce bilinmesi gerekenler

**Cron İKİ YERDE BİRDEN ÇALIŞMAMALI.** `/api/cron/daily` Finnhub'a ~84 istek
atıyor ve ücretsiz katman dakikada 60 kabul ediyor. Aynı dakikada iki koşum
168 istek demek — ikisi de 429 yiyip yarım kalır. Cron yalnız bu sunucunun
crontab'ında (`deploy/cron-install.sh`); `vercel.json` boş (`{}`), Vercel
tarafında cron yok. İkinci bir kopya açılırsa orada crontab kurulmaz.

**İNDEKSLENEBİLİRLİK DERLEME ZAMANINDA PİŞİYOR.** `SITE_INDEXABLE`
`robots.ts`'e statik olarak giriyor: `/etc/acilis-zili.env` içindeki değeri
değiştirmek tek başına yetmez, `deploy/update.sh` bir kez daha koşmalı.
`bootstrap.sh` anahtarı yalnızca DOSYADA YOKKEN yazıyor (varsayılan `true`)
— elle verilmiş bir değere hiç dokunmuyor. Bu ikisi bir arada sessiz bir
tuzak kurmuştu: sunucu ikinci kopyayken yazılan `false`, asıl kopya buraya
taşındıktan sonra da dosyada kaldı ve canlı site `Disallow: /` yayınlamaya
devam etti. İkinci bir kopya açılırsa `false` ORADA yazılır — aynı içerik
iki adreste durursa arama motoru bunu kopya içerik sayar.

**Neon bölgesi gecikmeyi belirler.** `@neondatabase/serverless` her sorgu
için ayrı bir HTTPS turu atıyor. Sunucu ile veritabanı ayrı kıtadaysa bu tur
~100 ms ve bir sayfa onlarca sorgu yapıyor. Oracle bölgesini Neon
bölgesine EN YAKIN olandan seç; ölçmeden "yeterince yakın" deme.

**Sürümler `releases/<zaman>-<sha>` altında yaşıyor, `current` bağı en
sondaki sağlıklı sürümü gösteriyor.** Her `deploy/update.sh` koşumu yeni bir
klasöre klonlayıp orada derliyor, ancak sağlık kontrolü geçince bağı çeviriyor
— derleme dakikalarca sürerken canlı sunucu asla yarım bir sürümün üstünde
durmuyor. Sağlık geçmezse bağ öncekine döner. Next'in veri önbelleği
(`.next/cache/fetch-cache`) ise sürümler arasında ORTAK: `shared/fetch-cache`e
bağ. Gece cron iki kez budar: 31 günden eski kayıtları ve 100 KB'ı geçen
kayıtları iki günde (`deploy/cron-install.sh`; gerekçe `update.sh` ve
`deploy/disk-guard.sh`). Derlemeden önce ayrıca `disk-guard.sh` yer açar
(§ Otomatik Dağıtım).

---

## 1. Sunucuyu aç

Oracle Cloud konsolu → Compute → Instances → Create instance.

| Ayar | Değer |
|---|---|
| Görüntü | Ubuntu 24.04 (Minimal değil) |
| Şekil | `VM.Standard.A1.Flex` — 2 OCPU, 12 GB (Always Free tavanı) |
| Önyükleme diski | 50 GB yeter (Always Free toplamı 200 GB) |
| SSH | kendi açık anahtarını yapıştır |

A1 kapasitesi popüler bölgelerde sık sık dolu oluyor; "Out of capacity"
alırsan başka bir kullanılabilirlik alanı dene.

## 2. Ağı aç — İKİ KATMAN VAR

Bu adım en çok vakit kaybettiren yer: Oracle'da güvenlik duvarı **iki
katmanlı** ve yalnızca birini açmak sessizce yetmez — site dışarıdan
zaman aşımına düşer, hiçbir hata mesajı çıkmaz.

**Katman 1 — Security List.** Konsolda örneğe tıkla → aşağıdaki "Primary
VNIC" bölümünden Subnet'e gir → "Security Lists" → "Default Security List
for vcn-…" → **Security rules** sekmesi → **Add Ingress Rules**. İki kural
ekle: Source Type `CIDR`, Source CIDR `0.0.0.0/0`, IP Protocol `TCP`,
Destination Port Range `80` — sonra aynısı `443` için.

**Katman 2 — sunucunun kendi iptables'ı.** Bunu **elle açmana gerek yok**,
`bootstrap.sh` kendisi açıyor (REJECT kuralının önüne, sıra numarasını
okuyarak) ve `netfilter-persistent save` ile kalıcılaştırıyor. Bu belgede
duruyor çünkü ilk katmanı açmak bu katmanı unutturur — ikisi ayrı sistemler.

## 3. Yerelde hazırlık

**SSH anahtarı.** Oracle örneğine SSH ile bağlanacak bir anahtar çifti
gerekiyor; yoksa:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/acilis-zili -N "" -C "acilis-zili-deploy"
```

Public key'i (`~/.ssh/acilis-zili.pub`) örnek oluşturulurken "SSH keys" alanına
yapıştır (ya da sonradan `ssh-copy-id` ile ekle).

**Ortam dosyası.** `deploy/remote.sh` yerelde `.env.production.local`
dosyasını arıyor:

```bash
npx vercel login
npx vercel link
npx vercel env pull --environment=production .env.production.local
```

Vercel kullanmıyorsan `.env.example`'ı kopyalayıp elle doldur. Dosya
`.env*` deseniyle gitignore'da, depoya girmez.

## 4. Kurulumu çalıştır

```bash
HOST=ubuntu@<SUNUCU_IP> DOMAIN=acilis.ornek.com deploy/remote.sh
```

`DOMAIN` verilmezse sunucu kendi genel IP'sinden bir `sslip.io` adresi
türetir (`1-2-3-4.sslip.io`) — alan adı olmadan da geçerli TLS sertifikasıyla
yayına çıkmak için. Betik sırayla:

1. `deploy/` dizinini ve ortam dosyasını sunucuya yükler (izinler daraltılmış
   olarak — sır dünya-okunur hiçbir noktada durmaz).
2. `bootstrap.sh`'ı root olarak çalıştırır: takas alanı, iptables, saat
   dilimi (UTC), paketler (Node 24 — 22 değil, gerekçe `bootstrap.sh`;
   Caddy), kullanıcı, systemd birimi, TLS, crontab, ilk sürüm.
3. Siteyi **dışarıdan** (senin makinenden) yoklar. Sunucunun kendi içinden
   yapılan bir kontrol Security List'in kapalı olduğunu göremez; bu adım
   görür ve HTTP durumunu basar.

Betik **yeniden çalıştırılabilir** — ortam dosyası zaten sunucudaysa
tekrar göndermez (elle yapılmış değişiklikleri, örn. `SITE_INDEXABLE=true`,
korur); yeniden göndermek istersen `ENV_FORCE=1` ver.

Şema henüz uygulanmadıysa: GitHub Actions → "Migrate DB" (`migrate.yml`,
önce `check`, sonra `apply`; üretim adresi yalnız sunucuda), ardından bir
kez `npm run db:seed`. Migration'lar deploy'da uygulanmaz.

## 5. Cron'u sına

`bootstrap.sh` crontab'ı kendisi yazdı; satırların tamamı
`deploy/cron-install.sh`te (günlük senkron hafta içi 10:30 UTC, alarm
taraması beş dakikada bir, haberler, Günün Grafiği yedeği, risk, budama…) ve
`update.sh` her sürümde eksik satırı ekler, emekli satırı siler. Saatler
UTC'dir çünkü sunucunun saat dilimi UTC: Ubuntu'nun cron'u `CRON_TZ`yi yok
sayar. Bir kez elle sına:

```bash
ssh -i ~/.ssh/acilis-zili ubuntu@<SUNUCU_IP> \
  'sudo -u acilis bash /srv/acilis-zili/current/deploy/cron-daily.sh'
ssh -i ~/.ssh/acilis-zili ubuntu@<SUNUCU_IP> \
  'journalctl -t acilis-cron -n 20 --no-pager'
```

## 6. Sonraki dağıtımlar

```bash
HOST=ubuntu@<SUNUCU_IP> deploy/remote.sh
```

Aynı komut: `deploy/` dizinini yeniden yükler (birim/Caddy/betik
düzeltmeleri sunucuya gider), ortam dosyası zaten varsa dokunmaz, yeni bir
sürüm klonlayıp derler, sağlık kontrolü geçince canlıya alır. Elle,
sunucunun üzerinden de yapılabilir:

```bash
sudo -u acilis -H bash /srv/acilis-zili/current/deploy/update.sh
```

---

## Otomatik Dağıtım (GitHub Actions)

`main`e her push `deploy.yml`ı tetikler:

1. **verify** (runner): `npm ci` → `build` → `typecheck` → `lint` → `npm
   test` → `python3 -m unittest discover -s tests/deploy`. Biri düşerse
   sürüm çıkmaz.
2. **deploy** (iş akışı `concurrency: deploy-vps` grubunda; sunucuya
   dokunan öteki iş akışları da bu sırada bekler): host anahtarı sabitlenir; Claude analiz anahtarı
   ve izinli uygulama değişkenleri GitHub Secrets'ta tanımlıysa sunucuya
   aktarılır (`deploy/sync-app-env.sh`; tanımsız olan sunucudaki değerini
   korur); **"Derleme için diskte yer aç"** adımı bu commit'in
   `deploy/disk-guard.sh`ını stdin ile sunucuda koşturur; son olarak SSH ile
   sunucudaki CANLI sürümün `current/deploy/update.sh`ı çalışır.

**`update.sh` düzeltmesi bir deploy gecikmeli etkili olur:** iş akışı
sunucudaki canlı sürümün kopyasını koşturur. Bu deploy'da geçerli olması
gereken düzeltme, disk adımı gibi `deploy.yml`'de ayrı adım olarak bu
commit'ten koşturulur.

**Düşen koşu:** `verify` düştüyse kod (yerelde aynı komutlar geçmeliydi);
`deploy` adımı düştüyse sunucu (disk, ağ, servis) — kod değiştirmeden önce
işin günlüğüne bak.

Öteki elle tetiklenen iş akışları: "Migrate DB" (`migrate.yml`), "Sync App
Env" (`sync-app-env.yml`, deploy beklemeden ortam aktarımı), "Sync Claude
Analysis Key", "Verify Claude Analysis", "Deneme Postası" (`test-mail.yml`).
Duman testi (`smoke.yml`) ayrı iş akışıdır, dağıtım kapısı değil.

## Mavi-Yeşil Geçiş (Kesintisiz Deploy, 11 Kasım)

Tek servis biriminde `systemctl restart` eski süreci kapatıp yenisini açıyor,
arada Caddy'nin arkasında dinleyen kalmıyordu: her deploy birkaç saniyelik
502 bırakıyordu. Şimdi iki şablon örneği var, her an biri ayakta:

- `acilis-zili@3000` ve `acilis-zili@3001` (`deploy/acilis-zili@.service`).
  Canlı port `/srv/acilis-zili/shared/active-port` dosyasında.
- `update.sh` yeni sürümü BOŞTAKİ portta başlatır, sağlık kontrolü geçince
  canlı port dosyasını çevirir ve eski örneği durdurur. Geçmezse yeni örnek
  durdurulur, `current` geri alınır; canlı süreç hiç kesilmez.
- Caddy iki adresi de bilir (`lb_policy first`), `/api/health/live`'ı iki
  saniyede bir yoklar, kapanan portu atlar; arada kapanan porta giden istek
  15 saniyeye kadar ötekine yeniden denenir.
- Cron betikleri ve ortam eşitleme betikleri canlı portu dosyadan okur.

Kurulum `deploy/bluegreen-setup.sh` (root, idempotent): deploy iş akışı her
koşuda update.sh'tan sonra BU commit'in kopyasıyla çalıştırır. Kuruluysa
hiçbir şey yapmaz. İlk koşuda şablon birimi, sudoers'ı ve Caddy bloğunu
kurar, eski `acilis-zili` birimini 3001'deki örneğe taşır. Caddy
yapılandırması doğrulanmazsa eski dosyayı geri koyar ve eski düzende kalır.

Elle bakmak ve müdahale etmek için:

```bash
cat /srv/acilis-zili/shared/active-port
systemctl status 'acilis-zili@*'
journalctl -u acilis-zili@3001 -n 50
# Eski tek birime dönmek (acil): canlı örneği durdur, eski birimi aç, port dosyasını sil.
sudo systemctl disable --now acilis-zili@3000 acilis-zili@3001
sudo systemctl enable --now acilis-zili
sudo rm /srv/acilis-zili/shared/active-port
```

Port dosyası silinince `update.sh` eski tek birim yoluna döner; Caddy iki
upstream'i bilmeye devam eder, kapalı 3001'i atlar.

## Claude Analiz Anahtarını GitHub Üzerinden Aktarma

Repository → Settings → Secrets and variables → Actions altında
`CLAUDE_ANALYSIS_API_KEY` secret'ını tanımla. Mevcut `VPS_SSH_KEY` secret'ı
ve `VPS_HOST` değişkeni sunucu bağlantısı için kullanılır.

Actions → **Sync Claude Analysis Key** → **Run workflow** yalnız bu
anahtarı `/etc/acilis-zili.env` dosyasında günceller ve `acilis-zili`
servisini yeniden başlatır. Diğer ortam değerleri korunur. Anahtar SSH'nin
şifreli standart girdisinden aktarılır; komut argümanına veya loga yazılmaz.
Dosya atomik olarak değiştirilir ve izinleri `root:acilis`, `0640` olur.

Normal deploy da secret tanımlıysa aynı aktarımı yapar; secret boşsa mevcut
sunucu değeri korunur. İki workflow aynı concurrency grubunu kullanır.
Bu aktarım analiz özelliğini veya veritabanı migration'ını yayınlamaz.

## Sorun giderme

| Belirti | Bakılacak yer |
|---|---|
| Dışarıdan zaman aşımı, `remote.sh` sonunda "ULAŞILAMADI" | § 2 Katman 1 — Security List kapalı |
| Site haritasında `localhost:3000` | `NEXT_PUBLIC_SITE_URL` derleme sırasında yoktu — `update.sh` build'den önce ortamı okuyor mu kontrol et |
| Giriş sonrası yanlış adrese dönüş | `AUTH_TRUST_HOST` eksik — `bootstrap.sh` bunu zorluyor, elle silinmiş olabilir |
| Paylaşım kartları boş | `assets/fonts` eksik — her sürüm taze `git clone` olduğu için normalde olmaz; olduysa klon yarım kalmış demektir |
| Cron 503 | `CRON_SECRET` tanımsız (`lib/api-auth.ts` üretimde açık kapı bırakmıyor) |
| Cron "Permission denied" | betik çalıştırılabilir değil — `deploy/*.sh` depoda `100755` olmalı (`git ls-files -s deploy/`) |
| Cron 401 her gün | ortam dosyasında `$` veya `` ` `` içeren bir sır var ve iki tüketici (systemd, bash `source`) farklı okuyor — `bootstrap.sh`'taki `normalize_env` bunu artık kaçışlıyor; eski bir sürümdeyse güncelle |
| Cron 3 saat erken/geç | sunucunun saat dilimi UTC değil (Ubuntu cron'u `CRON_TZ`yi yok sayar; `update.sh` her sürümde uyarı basar) — `sudo timedatectl set-timezone Etc/UTC && sudo systemctl restart cron` |
| Sayfalar yavaş | Neon bölgesi uzak (§ 0) — `journalctl` değil, sorgu turunu ölç |
| `update.sh` "AYAĞA KALKMADI" diyip geri alıyor | `journalctl -u acilis-zili -n 40` çıktısı zaten basılıyor, oradan devam et |
| Disk doluyor / deploy "YER YETMİYOR" ya da "No space left on device" | Derlemeden önce `deploy/disk-guard.sh` Turbopack önbelleklerini, ortak `fetch-cache`in 100 KB üstü kayıtlarını, npm önbelleğini ve son çare üç günden eski önbellek kayıtlarını siler (6 Kasım 2026; o gün `fetch-cache` 34 GB'tı); yine de yer yoksa iş derlemeye girmeden en büyük dizinleri basar. `du -sh /srv/acilis-zili/releases/* /srv/acilis-zili/shared/*` — yalnızca canlıya çıkmış son 2 sürüm kalmalı; kalmıyorsa `update.sh`'ın budama adımını kontrol et. Ortak önbellek büyüyorsa crontab'da `fetch-cache` budama satırı var mı bak (`deploy/cron-install.sh`). Sürümler dışında büyüyen yer için `sudo du -xh / --max-depth=2 \| sort -rh \| head` (günlükler: `journalctl --vacuum-size=200M`) |
