# Kendi sunucusunda yayına alma (Oracle Cloud Always Free)

Vercel'in yanında ikinci bir canlı kopya. Gerekçesi kota: barındırma
ücretsiz katmanında sınırlar aylık ve ay ortasında bittiğinde site kapanıyor.
Kendi sunucusunda ne fonksiyon süresi sınırı var ne çağrı kotası — günlük
cron'un 100 saniyelik bütçesi de ilk kez olduğu gibi çalışabiliyor.

Kurulumun TAMAMI tek komutla yapılıyor: `deploy/remote.sh`, yerel makineden
sunucuya `deploy/` dizinini ve ortam dosyasını yükleyip `deploy/bootstrap.sh`'ı
orada çalıştırıyor. Bu belge o komuttan önce yapılması gerekenleri ve
komutun ne yaptığını anlatır; betiklerin kendisi (`deploy/*.sh`) her
adımın gerekçesini kendi içinde taşıyor.

---

## 0. Önce bilinmesi gerekenler

**Cron İKİ YERDE BİRDEN ÇALIŞMAMALI.** `/api/cron/daily` Finnhub'a ~84 istek
atıyor ve ücretsiz katman dakikada 60 kabul ediyor. Aynı dakikada iki koşum
168 istek demek — ikisi de 429 yiyip yarım kalır. `bootstrap.sh` sunucuda
crontab'ı kendisi kuruyor; bunu doğruladıktan sonra `vercel.json` içindeki
`crons` bloğu kaldırılmalı (ya da tersi). Hangisi kalacaksa kalsın, **tek**.

**İkinci kopya indekslenmemeli.** Aynı içerik iki adreste durursa arama
motoru bunu kopya içerik sayar. `bootstrap.sh` bunu kendisi ayarlıyor
(`SITE_INDEXABLE=false`, yalnızca anahtar dosyada yoksa) — asıl kopya bu
sunucuya taşınırsa `/etc/acilis-zili.env` içinde elle `true` yapılır.

**Neon bölgesi gecikmeyi belirler.** `@neondatabase/serverless` her sorgu
için ayrı bir HTTPS turu atıyor. Sunucu ile veritabanı ayrı kıtadaysa bu tur
~100 ms ve bir sayfa onlarca sorgu yapıyor. Oracle bölgesini Neon
bölgesine EN YAKIN olandan seç; ölçmeden "yeterince yakın" deme.

**Sürümler `releases/<zaman>-<sha>` altında yaşıyor, `current` bağı en
sondaki sağlıklı sürümü gösteriyor.** Her `deploy/update.sh` koşumu yeni bir
klasöre klonlayıp orada derliyor, ancak sağlık kontrolü geçince bağı çeviriyor
— derleme dakikalarca sürerken canlı sunucu asla yarım bir sürümün üstünde
durmuyor. Sağlık geçmezse bağ öncekine döner.

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
2. `bootstrap.sh`'ı root olarak çalıştırır: takas alanı, iptables, paketler
   (Node 22, Caddy), kullanıcı, systemd birimi, TLS, crontab, ilk sürüm.
3. Siteyi **dışarıdan** (senin makinenden) yoklar. Sunucunun kendi içinden
   yapılan bir kontrol Security List'in kapalı olduğunu göremez; bu adım
   görür ve HTTP durumunu basar.

Betik **yeniden çalıştırılabilir** — ortam dosyası zaten sunucudaysa
tekrar göndermez (elle yapılmış değişiklikleri, örn. `SITE_INDEXABLE=true`,
korur); yeniden göndermek istersen `ENV_FORCE=1` ver.

Şema henüz uygulanmadıysa bir kez (lokalden `DATABASE_URL` ile):
`npm run db:migrate && npm run db:seed`

## 5. Cron'u tekile indir

`bootstrap.sh` crontab'ı kendisi yazdı (`CRON_TZ=UTC`, hafta içi 10:30 UTC).
Bir kez elle sına:

```bash
ssh -i ~/.ssh/acilis-zili ubuntu@<SUNUCU_IP> \
  'sudo -u acilis bash /srv/acilis-zili/current/deploy/cron-daily.sh'
ssh -i ~/.ssh/acilis-zili ubuntu@<SUNUCU_IP> \
  'journalctl -t acilis-cron -n 20 --no-pager'
```

Başarılıysa **Vercel tarafındaki cron'u kapat** (§ 0) — iki koşum Finnhub
kotasını aşar.

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
| Cron 3 saat erken/geç | crontab'da `CRON_TZ=UTC` yok |
| Sayfalar yavaş | Neon bölgesi uzak (§ 0) — `journalctl` değil, sorgu turunu ölç |
| `update.sh` "AYAĞA KALKMADI" diyip geri alıyor | `journalctl -u acilis-zili -n 40` çıktısı zaten basılıyor, oradan devam et |
| Disk doluyor | `du -sh /srv/acilis-zili/releases/*` — yalnızca canlıya çıkmış son 2 sürüm kalmalı; kalmıyorsa `update.sh`'ın budama adımını kontrol et |
