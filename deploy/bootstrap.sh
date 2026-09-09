#!/usr/bin/env bash
#
# Açılış Zili — sıfır sunucudan çalışan siteye, tek koşum.
#
# Ubuntu 24.04 (Oracle Cloud Always Free, Ampere A1) üzerinde root olarak:
#
#   sudo DOMAIN=acilis.ornek.com SITE_ENV_SRC=/tmp/acilis-zili.env \
#        DEPLOY_SRC=/tmp/acilis-deploy bash bootstrap.sh
#
# Genelde elle çağrılmaz: `deploy/remote.sh` yerel makineden dosyaları yükleyip
# bunu koşturuyor. Betik YENİDEN ÇALIŞTIRILABİLİR — her adım kendi durumuna
# bakıyor, yapılmış işi atlıyor. Yarıda kesilen bir kurulumu baştan almak
# yerine aynı komutu tekrar vermek yeterli.
#
# Ortam:
#   DOMAIN        Sitenin alan adı. Boşsa genel IP'den sslip.io adresi türetilir
#                 (1-2-3-4.sslip.io) — alan adı olmadan da TLS'li yayın için.
#   SITE_ENV_SRC  Yüklenen ortam dosyası. İlk kurulumda zorunlu;
#                 /etc/acilis-zili.env zaten varsa atlanabilir.
#   DEPLOY_SRC    Yüklenen deploy/ dizini. Servis birimi, Caddyfile ve update.sh
#                 BURADAN kurulur — bkz. "yerel mi uzak mı" notu aşağıda.
#   REPO, BRANCH  Uygulama kaynağı. Varsayılan GitHub'daki ana dal.

set -euo pipefail

REPO="${REPO:-https://github.com/ahmetakyapi/acilis-zili.git}"
BRANCH="${BRANCH:-main}"
APP_ROOT=/srv/acilis-zili
APP_USER=acilis
ENV_FILE=/etc/acilis-zili.env
SRC=/tmp/acilis-bootstrap-src

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
note() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mHATA: %s\033[0m\n' "$*" >&2; exit 1; }

# `set -e` ile ölen bir adım hiçbir şey söylemiyordu ve teşhis, çıktının
# nerede KESİLDİĞİNE bakmakla yapılıyordu. Kapan hangi satırda düşüldüğünü
# yazıyor. (Gerçek bir vakadan geliyor: `ensure_env` keep modunda 1 dönüyor
# ve betik ortam adımından sonra sessizce duruyordu.)
trap 'rc=$?; [[ $rc -eq 0 ]] || printf "\033[1;31mHATA: satır %s, çıkış %s\033[0m\n" "$LINENO" "$rc" >&2' ERR
trap 'rm -f "$ENV_FILE.tmp"' EXIT

[[ $EUID -eq 0 ]] || die "root olarak çalıştır (sudo)."
# shellcheck disable=SC1091
. /etc/os-release
[[ ${ID:-} == ubuntu ]] || warn "Ubuntu dışı dağıtım (${ID:-?}); apt adımları uyarlanmadı."
export DEBIAN_FRONTEND=noninteractive

# Sır demeti /tmp'de dünya-okunur duruyordu ve ona ancak apt/nodesource/caddy
# adımlarından SONRA dokunuluyordu — dakikalarca. İlk iş iznini daralt.
if [[ -n "${SITE_ENV_SRC:-}" && -f "${SITE_ENV_SRC}" ]]; then
	chmod 600 "$SITE_ENV_SRC"
fi

# ---------------------------------------------------------------- alan adı
log "alan adı"
if [[ -z "${DOMAIN:-}" ]]; then
	PUBLIC_IP=$(curl -4 -fsS --max-time 10 https://api.ipify.org || true)
	[[ -n "$PUBLIC_IP" ]] || die "genel IP bulunamadı; DOMAIN ver."
	DOMAIN="${PUBLIC_IP//./-}.sslip.io"
	warn "DOMAIN verilmedi; $DOMAIN kullanılıyor (sslip.io adresi genel IP'ye çözümlenir)."
fi
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || die "DOMAIN geçersiz: $DOMAIN"
note "$DOMAIN"

# -------------------------------------------------------------- takas alanı
# Oracle görüntülerinde takas yok. Next derlemesi 12 GB'ta sığıyor ama bir
# gün sığmazsa belirtisi tek kelime: "Killed" — başka hiçbir açıklama yok.
# 2 GB takas o günü bir yavaşlamaya çeviriyor.
#
# İmza kontrolü ayrı: `fallocate` ile `mkswap` arasında kesilen bir koşum
# imzasız bir /swapfile bırakıyor ve sonraki her koşum `swapon`da ölüyordu —
# "yeniden çalıştırılabilir" betiği kendi kendine kilitleyen bir yarım adım.
log "takas alanı"
if swapon --show=NAME --noheadings 2>/dev/null | grep -qx /swapfile; then
	note "zaten etkin"
else
	if [[ ! -f /swapfile ]]; then
		fallocate -l 2G /swapfile
		chmod 600 /swapfile
	fi
	if ! blkid -o value -s TYPE /swapfile 2>/dev/null | grep -qx swap; then
		mkswap /swapfile >/dev/null
	fi
	swapon /swapfile
	grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
	note "2 GB açıldı"
fi

# ------------------------------------------------- güvenlik duvarı (sunucu)
# Oracle'ın Ubuntu görüntüsü SSH dışındaki her şeyi REJECT eden bir INPUT
# zinciriyle geliyor ve konsoldaki Security List bunu AÇMIYOR — iki ayrı
# katman. ACCEPT kuralı REJECT'ten ÖNCE durmalı; sabit bir sıra numarası
# ("-I INPUT 6" tarifi) görüntü değişince kayıyor, o yüzden REJECT'in yeri
# okunup onun önüne sokuluyor.
log "güvenlik duvarı (sunucu katmanı)"
open_port() {
	local port=$1 pos
	if iptables -C INPUT -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT 2>/dev/null; then
		note "$port zaten açık"
		return 0
	fi
	pos=$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" {print $1; exit}')
	if [[ -n "$pos" ]]; then
		iptables -I INPUT "$pos" -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT
	else
		iptables -A INPUT -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT
	fi
	note "$port açıldı"
}
open_port 80
open_port 443
if command -v netfilter-persistent >/dev/null; then
	netfilter-persistent save >/dev/null 2>&1 || warn "kurallar kalıcılaştırılamadı"
else
	warn "netfilter-persistent yok; kurallar yeniden başlatmada kaybolabilir"
fi

# ---------------------------------------------------------------- paketler
log "paketler"
apt-get update -qq
apt-get install -y -qq git curl ca-certificates gnupg cron >/dev/null

node_major() { node -v 2>/dev/null | sed 's/^v//; s/\..*//'; }
if ! command -v node >/dev/null || [[ $(node_major) -lt 20 ]]; then
	curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
	apt-get install -y -qq nodejs >/dev/null
fi
note "node $(node -v), npm $(npm -v)"

if ! command -v caddy >/dev/null; then
	apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
		gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		>/etc/apt/sources.list.d/caddy-stable.list
	apt-get update -qq
	apt-get install -y -qq caddy >/dev/null
fi
note "$(caddy version | head -1)"

# ------------------------------------------------------ kullanıcı, dizinler
log "kullanıcı ve dizinler"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
	useradd --system --create-home --home-dir "/home/$APP_USER" --shell /bin/bash "$APP_USER"
fi
install -d -o "$APP_USER" -g "$APP_USER" "$APP_ROOT" "$APP_ROOT/releases"
note "$APP_ROOT"

# Uygulama kullanıcısının sudo'yla yapabildiği TEK şey iki servis komutu.
# update.sh derlemeden sonra servisi yeniden başlatıyor; kök yetkisi
# olmadan bunu yapamaz, tam kök yetkisi ise fazla.
cat >/etc/sudoers.d/acilis-zili <<SUDO
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart acilis-zili, /usr/bin/systemctl reload caddy
SUDO
chmod 0440 /etc/sudoers.d/acilis-zili
visudo -cf /etc/sudoers.d/acilis-zili >/dev/null || die "sudoers dosyası geçersiz"

# ----------------------------------------------------------- ortam dosyası
# İki tüketicisi var ve İKİSİ FARKLI DİL KONUŞUYOR: systemd (EnvironmentFile)
# ve bash (`source`, betiklerde). Ortak payda TEK TIRNAK — ikisi de tek tırnak
# içini harfiyen alır. Çift tırnak almıyor: bash `$`, `` ` `` ve `\` genişletir,
# systemd yalnızca dört kaçışı çözer. `CRON_SECRET=pa$sword` böyle iki farklı
# değere ayrışıyordu; uygulama birini, cron ötekini görüyor ve her sabah 401
# alınıyordu — journald'da tek satır, kimse bakmıyor.
#
# Tek tırnak içeremeyen tek şey tek tırnağın kendisi (systemd tek tırnak içinde
# HİÇBİR kaçışı çözmüyor, `'\''` numarası orada çalışmaz). O değerler çift
# tırnağa düşüyor ve dört karakter birden kaçışlanıyor — iki okuyucunun aynı
# şekilde çözdüğü küme tam olarak bu dördü.
#
# CRLF de burada kırpılıyor: kaynak dosya Windows'tan geliyor ve satır
# sonundaki \r, değeri "tırnaklı" desenine uymaz hâle getirip tırnakların
# değerin İÇİNE gömülmesine yol açıyordu. Belirtisi yalnızca veritabanında
# görünür: ana sayfa 200 döner, sağlık kontrolü geçer, ama her sorgu düşer.
normalize_env() {
	awk '
		{ sub(/\r$/, "") }
		/^[[:space:]]*(#|$)/ { next }
		{
			sub(/^[[:space:]]*export[[:space:]]+/, "")
			eq = index($0, "="); if (eq == 0) next
			key = substr($0, 1, eq - 1); val = substr($0, eq + 1)
			sub(/[[:space:]]+$/, "", key)
			if (key !~ /^[A-Za-z_][A-Za-z0-9_]*$/) next
			if (key ~ /^(VERCEL|NX_DAEMON|TURBO_)/ || key == "NODE_ENV" || key == "PORT") next

			# Kaynaktaki tırnakları soy — hedef biçim aşağıda yeniden kuruluyor.
			if (val ~ /^".*"$/) {
				val = substr(val, 2, length(val) - 2)
				gsub(/\\"/, "\"", val); gsub(/\\\\/, "\\", val)
			} else if (val ~ /^\047.*\047$/) {
				val = substr(val, 2, length(val) - 2)
			}

			if (index(val, "\047") == 0) {
				print key "=\047" val "\047"
			} else {
				# Ters bölü ÖNCE: sonraki gsub`ların ürettiği kaçışları
				# ikinci kez kaçışlamamak için sıra önemli.
				gsub(/\\/, "\\\\", val)
				gsub(/"/,  "\\\"", val)
				gsub(/\$/, "\\$",  val)
				gsub(/`/,  "\\`",  val)
				print key "=\"" val "\""
			}
		}' "$1"
}

# `[[ ... ]] && cmd` KULLANMA. Koşul yanlışsa liste 1 döner, fonksiyonun
# dönüş değeri de 1 olur ve `set -e` altında çağıran betik SESSİZCE ölür.
# Tam olarak bu oldu: `ensure_env SITE_INDEXABLE false` ikinci koşumda
# anahtar zaten varken 1 döndürüyor ve bootstrap ortam adımından sonra
# hiçbir şey söylemeden duruyordu.
ensure_env() {
	local key=$1 val=$2 mode=${3:-keep}
	if grep -q "^${key}=" "$ENV_FILE"; then
		if [[ $mode == force ]]; then
			# Ayraç olarak `|` seçildi ama değer de `|` içerebilir; adresler
			# için `#` de riskli. En güvenlisi satırı silip yeniden yazmak.
			sed -i "/^${key}=/d" "$ENV_FILE"
			printf '%s=\047%s\047\n' "$key" "$val" >>"$ENV_FILE"
		fi
	else
		printf '%s=\047%s\047\n' "$key" "$val" >>"$ENV_FILE"
	fi
	return 0
}

log "ortam dosyası"
if [[ -n "${SITE_ENV_SRC:-}" && -r "${SITE_ENV_SRC}" ]]; then
	# Geçici dosya DOĞRU İZİNLE doğuyor. Yönlendirme root umask'ıyla (022)
	# 0644 üretiyordu ve `install` düşerse /etc altında dünya-okunur bir tam
	# sır kopyası kalıyordu; sonraki koşum üzerine yazar ama iznini düzeltmez.
	install -o root -g "$APP_USER" -m 0640 /dev/null "$ENV_FILE.tmp"
	normalize_env "$SITE_ENV_SRC" >"$ENV_FILE.tmp"
	[[ -s "$ENV_FILE.tmp" ]] || die "ortam dosyası boş çıktı: $SITE_ENV_SRC"

	# Sunucuda ELLE yapılmış değişiklikler korunuyor. Yükleme yolu (remote.sh)
	# her koşumda aynı yerel dosyayı gönderiyor; kaynakta OLMAYAN ama sunucuda
	# olan anahtarlar üzerine yazılsaydı, döndürülmüş bir sır ya da elle
	# açılmış SITE_INDEXABLE=true sessizce eskiye dönerdi.
	if [[ -r "$ENV_FILE" ]]; then
		while IFS= read -r line; do
			k=${line%%=*}
			grep -q "^${k}=" "$ENV_FILE.tmp" || printf '%s\n' "$line" >>"$ENV_FILE.tmp"
		done <"$ENV_FILE"
	fi

	install -o root -g "$APP_USER" -m 0640 "$ENV_FILE.tmp" "$ENV_FILE"
	rm -f "$ENV_FILE.tmp"
	shred -u "$SITE_ENV_SRC" 2>/dev/null || rm -f "$SITE_ENV_SRC"
	note "$ENV_FILE yazıldı ($(grep -c '=' "$ENV_FILE") anahtar)"
elif [[ -r "$ENV_FILE" ]]; then
	note "mevcut $ENV_FILE korunuyor"
else
	die "ortam dosyası yok: SITE_ENV_SRC ver ya da $ENV_FILE oluştur (.env.example)"
fi

# Bu kopyaya özgü değerler: adres ve vekil güveni ZORLA, indekslenebilirlik
# yalnızca yoksa (ikincil kopya varsayılanı false; asıl buraya taşınırsa
# dosyada elle true yapılır ve bu betik ona dokunmaz).
ensure_env NEXT_PUBLIC_SITE_URL "https://$DOMAIN" force
ensure_env AUTH_TRUST_HOST true force
ensure_env SITE_INDEXABLE false
for key in DATABASE_URL AUTH_SECRET CRON_SECRET BRIEF_SECRET; do
	grep -qE "^${key}=(\042.+\042|\047.+\047)$" "$ENV_FILE" ||
		warn "$key boş — ilgili özellik üretimde kapalı/503 olur"
done

# --------------------------------------------------------- dağıtım dosyaları
#
# YEREL Mİ, UZAK MI. Servis birimi, Caddyfile ve update.sh varsa YÜKLENEN
# dizinden kuruluyor; yoksa klondan. Sebebi somut: bunlar bir dönem yalnızca
# `git clone`dan alınıyordu ve o, yerelde düzeltilmiş bir birim dosyasının
# sunucuya ASLA gitmemesi demekti — henüz push edilmemiş bir düzeltmeyle
# deploy eden kişi, düzelttiği hatayı sunucuda aynen görüyordu. Uygulama
# KODU için klon doğru kaynak (sürümlenmiş, sha'lı); dağıtım araçları için
# elimizdeki kopya doğru kaynak.
log "dağıtım dosyaları"
if [[ -n "${DEPLOY_SRC:-}" && -d "${DEPLOY_SRC}" ]]; then
	DEPLOY_DIR="$DEPLOY_SRC"
	note "yüklenen kopyadan ($DEPLOY_DIR)"
else
	rm -rf "$SRC"
	git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$SRC"
	DEPLOY_DIR="$SRC/deploy"
	note "klondan — $(git -C "$SRC" rev-parse --short HEAD) ($BRANCH)"
fi
for f in acilis-zili.service Caddyfile update.sh cron-daily.sh; do
	[[ -r "$DEPLOY_DIR/$f" ]] || die "eksik dağıtım dosyası: $DEPLOY_DIR/$f"
done

install -m 0644 "$DEPLOY_DIR/acilis-zili.service" /etc/systemd/system/acilis-zili.service
systemctl daemon-reload
systemctl enable acilis-zili >/dev/null 2>&1
# Başlatma yok: ilk sürüm henüz derlenmedi, update.sh başlatacak.

sed "s/acilis-zili\.ornek\.com/$DOMAIN/" "$DEPLOY_DIR/Caddyfile" >/etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 || die "Caddyfile geçersiz"
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy
note "Caddy → $DOMAIN"

# `bash` ÖNEKİ BİLEREK. Depo Windows'ta commit'leniyor, `core.filemode=false`
# ve exec biti indekste 100644 kalıyor; `git clone` ile inen betik
# çalıştırılabilir DEĞİL. Doğrudan exec eden bir crontab satırı her gün
# "Permission denied" ile düşerdi — journald'a tek satır, senkron hiç koşmaz.
# İndeksteki bit ayrıca düzeltildi (git update-index --chmod=+x); bu önek
# ikinci savunma, çünkü bit bir daha kaybolabilir.
CRON_LINE="30 10 * * 1-5 /bin/bash $APP_ROOT/current/deploy/cron-daily.sh"
if sudo -u "$APP_USER" crontab -l 2>/dev/null | grep -qF "$CRON_LINE"; then
	note "crontab zaten var"
else
	printf '%s\n' "CRON_TZ=UTC" "$CRON_LINE" | sudo -u "$APP_USER" crontab -
	note "crontab yazıldı (UTC 10:30, hafta içi)"
fi

# --------------------------------------------------------------- ilk sürüm
log "ilk sürüm — klon, npm ci, derleme, başlatma"
sudo -u "$APP_USER" -H env REPO="$REPO" BRANCH="$BRANCH" bash "$DEPLOY_DIR/update.sh"
rm -rf "$SRC"

# --------------------------------------------------------------------- son
log "bitti"
note "https://$DOMAIN"
echo
echo "  Dışarıdan erişim için Oracle konsolunda Security List'te TCP 80 ve 443"
echo "  AÇIK olmalı (docs/deploy-vps.md § 2) — bu betik o katmana ulaşamıyor."
echo "  Cron burada koşuyor; Vercel tarafındaki cron'u KAPAT (iki koşum"
echo "  Finnhub'ın dakikalık kotasını aşar)."
