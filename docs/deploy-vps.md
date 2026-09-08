# Kendi sunucusunda yayına alma (Oracle Cloud Always Free)

Vercel'in yanında ikinci bir canlı kopya. Gerekçesi kota: barındırma
ücretsiz katmanında sınırlar aylık ve ay ortasında bittiğinde site kapanıyor.
Kendi sunucusunda ne fonksiyon süresi sınırı var ne çağrı kotası — günlük
cron'un 100 saniyelik bütçesi de ilk kez olduğu gibi çalışabiliyor.

Bu belge sunucuyu açmaktan ilk isteğe kadar olan yolu anlatır. Sunucudaki
dosyaların kendisi `deploy/` altında ve her birinin gerekçesi kendi içinde.

---

## 0. Önce bilinmesi gerekenler

**Cron İKİ YERDE BİRDEN ÇALIŞMAMALI.** `/api/cron/daily` Finnhub'a ~84 istek
atıyor ve ücretsiz katman dakikada 60 kabul ediyor. Aynı dakikada iki koşum
168 istek demek — ikisi de 429 yiyip yarım kalır. Sunucudaki crontab
açıldığında `vercel.json` içindeki `crons` bloğu kaldırılmalı (ya da tersi).
Hangisi kalacaksa kalsın, **tek**.

**İkinci kopya indekslenmemeli.** Aynı içerik iki adreste durursa arama
motoru bunu kopya içerik sayar ve hangisini göstereceğine kendisi karar
verir. Bu yüzden ikincil kopyada `SITE_INDEXABLE=false` — hangi kopyanın
asıl olduğu bir dağıtım kararı, `lib/site.ts` onu dışarıdan okuyor.

**Neon bölgesi gecikmeyi belirler.** `@neondatabase/serverless` her sorgu
için ayrı bir HTTPS turu atıyor. Sunucu ile veritabanı ayrı kıtadaysa bu tur
~100 ms ve bir sayfa onlarca sorgu yapıyor. Oracle bölgesini Neon
bölgesine EN YAKIN olandan seç; ölçmeden "yeterince yakın" deme.

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

**Katman 1 — Security List** (Oracle konsolu → VCN → Subnet → Security List):
`0.0.0.0/0` kaynağından TCP 80 ve 443'e Ingress kuralı ekle.

**Katman 2 — sunucunun kendi iptables'ı.** Oracle'ın Ubuntu görüntüleri
SSH dışındaki her şeyi DROP eden kurallarla geliyor:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Node ve Caddy

```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## 4. Kullanıcı ve depo

```bash
sudo useradd --system --create-home --home-dir /home/acilis --shell /bin/bash acilis
sudo mkdir -p /srv/acilis-zili && sudo chown acilis:acilis /srv/acilis-zili
sudo -u acilis git clone https://github.com/<kullanici>/acilis-zili.git /srv/acilis-zili
```

## 5. Ortam değişkenleri

Secret'lar **depo dizininde değil**, `/etc/acilis-zili.env` içinde: depo
herkese açık ve `git pull` ile güncelleniyor.

```bash
sudo install -o root -g acilis -m 0640 /dev/null /etc/acilis-zili.env
sudo nano /etc/acilis-zili.env
```

```ini
# HER DEĞER TIRNAKLI. DATABASE_URL içinde `&` ve `?` var; tırnaksız bir
# satır betikler dosyayı `source` ettiğinde komutu arka plana atar.
DATABASE_URL="postgresql://...?sslmode=require"
AUTH_SECRET="..."
ALPACA_API_KEY_ID="..."
ALPACA_API_SECRET_KEY="..."
FINNHUB_API_KEY="..."
FRED_API_KEY="..."
CRON_SECRET="..."
BRIEF_SECRET="..."
ANTHROPIC_API_KEY="..."
DEEPL_API_KEY="..."

NEXT_PUBLIC_SITE_URL="https://acilis-zili.ornek.com"

# Auth.js üretimde Host başlığına varsayılan olarak güvenmiyor; ters vekil
# arkasında bu değişken olmadan giriş yönlendirmeleri yanlış adrese gider.
AUTH_TRUST_HOST="true"

# Bu kopya İKİNCİL ise açık kalsın. Asıl kopya buraya taşınırsa `true` yap
# ve Vercel tarafını `false`a çevir — ikisi aynı anda indekslenmemeli.
SITE_INDEXABLE="false"
```

`.env.example` içindeki bütün açıklamalar geçerli; buradaki tek fark
`AUTH_TRUST_HOST` ve `SITE_INDEXABLE`.

## 6. İlk derleme

```bash
cd /srv/acilis-zili
sudo -u acilis bash -c 'set -a; . /etc/acilis-zili.env; set +a; npm ci && npm run build'
```

Şema henüz uygulanmadıysa bir kez (lokalden de yapılabilir):
`npm run db:migrate && npm run db:seed`

## 7. Servis

```bash
sudo cp deploy/acilis-zili.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now acilis-zili
curl -I http://127.0.0.1:3000/     # 200 beklenir
```

## 8. TLS ve alan adı

Alan adının A kaydını sunucunun genel IP'sine yönlendir, sonra:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile      # alan adını yaz
sudo systemctl reload caddy
```

Caddy sertifikayı ilk istekte kendisi alıyor. DNS henüz yayılmadıysa
sertifika başarısız olur — `journalctl -u caddy -f` ile izle.

## 9. Cron

```bash
sudo -u acilis crontab -e
```

```cron
CRON_TZ=UTC
30 10 * * 1-5 /srv/acilis-zili/deploy/cron-daily.sh
```

`CRON_TZ=UTC` şart: `vercel.json` içindeki ifade UTC, sistem crontab'ı ise
sunucunun yerel saatini kullanır. Elle bir kez sına:

```bash
sudo -u acilis /srv/acilis-zili/deploy/cron-daily.sh
journalctl -t acilis-cron -n 20 --no-pager
```

Sınadıktan sonra **Vercel tarafındaki cron'u kapat** (§ 0).

## 10. Güncelleme

```bash
sudo -u acilis /srv/acilis-zili/deploy/update.sh
```

Çeker, derler, yeniden başlatır ve ayağa kalktığını doğrular; kalkmazsa
son 40 satır günlüğü basıp sıfırdan farklı çıkar.

---

## Sorun giderme

| Belirti | Bakılacak yer |
|---|---|
| Dışarıdan zaman aşımı, içeriden 200 | § 2 — iki katmandan biri kapalı |
| Site haritasında `localhost:3000` | `NEXT_PUBLIC_SITE_URL` derleme sırasında yoktu |
| Giriş sonrası yanlış adrese dönüş | `AUTH_TRUST_HOST` eksik |
| Paylaşım kartları boş | `assets/fonts` eksik — standalone çıktısına geçilmiş olabilir |
| Cron 503 | `CRON_SECRET` tanımsız (`lib/api-auth.ts` üretimde açık kapı bırakmıyor) |
| Cron 3 saat erken | crontab'da `CRON_TZ=UTC` yok |
| Sayfalar yavaş | Neon bölgesi uzak (§ 0) — `journalctl` değil, sorgu turunu ölç |
