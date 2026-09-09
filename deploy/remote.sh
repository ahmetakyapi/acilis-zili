#!/usr/bin/env bash
#
# Açılış Zili — yerel makineden sunucuyu kur / güncelle.
#
#   HOST=ubuntu@1.2.3.4 deploy/remote.sh                          # ilk kurulum
#   HOST=ubuntu@1.2.3.4 DOMAIN=acilis.ornek.com deploy/remote.sh
#
# Ortam:
#   HOST       zorunlu — kullanıcı@ip (Oracle Ubuntu görüntüsünde kullanıcı `ubuntu`)
#   KEY        SSH özel anahtarı            (varsayılan ~/.ssh/acilis-zili)
#   ENV_FILE   yüklenecek ortam dosyası     (varsayılan .env.production.local)
#              `npx vercel env pull --environment=production .env.production.local`
#              ile Vercel'den çekilebilir; .env* gitignore'da, depoya girmez.
#   ENV_FORCE  1 ise ortam dosyası sunucuda VARSA da yüklenir (sır döndürme)
#   DOMAIN     alan adı; boşsa sunucu genel IP'den sslip.io adresi türetir
#   REPO, BRANCH  bootstrap'e aynen geçer
#
# Sırayla: deploy/ dizinini ve (gerekiyorsa) ortam dosyasını yükler,
# bootstrap'i root olarak koşturur, sonra siteyi DIŞARIDAN yoklar — sunucunun
# kendi içinden yapılan sağlık kontrolü Oracle Security List'in kapalı
# olduğunu göremez, buradan yapılan görür.

set -euo pipefail

: "${HOST:?HOST=kullanici@ip gerekli}"
KEY="${KEY:-$HOME/.ssh/acilis-zili}"
ENV_FILE="${ENV_FILE:-.env.production.local}"
ENV_FORCE="${ENV_FORCE:-0}"
DOMAIN="${DOMAIN:-}"
REPO="${REPO:-}"
BRANCH="${BRANCH:-}"

die() { printf '\033[1;31mHATA: %s\033[0m\n' "$*" >&2; exit 1; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*" >&2; }

[[ -r "$KEY" ]] || die "SSH anahtarı yok: $KEY (ssh-keygen -t ed25519 -f $KEY)"
here=$(cd "$(dirname "$0")" && pwd)

SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$HOST")
SCP=(scp -q -r -i "$KEY" -o StrictHostKeyChecking=accept-new)

# Yüklenen her şey her çıkış yolunda siliniyor. `; rm -f` zinciri yalnızca
# bootstrap normal bittiğinde koşuyordu: ssh düşerse ya da burada Ctrl-C'ye
# basılırsa sır demeti sunucunun /tmp'sinde kalıyordu.
cleanup() {
	"${SSH[@]}" 'shred -u /tmp/acilis-zili.env 2>/dev/null; rm -rf /tmp/acilis-zili.env /tmp/acilis-deploy' >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ---------------------------------------------------------- ortam dosyası
env_src=""
if "${SSH[@]}" 'sudo test -r /etc/acilis-zili.env' 2>/dev/null; then
	server_has_env=1
else
	server_has_env=0
fi

if [[ $server_has_env -eq 1 && $ENV_FORCE -ne 1 ]]; then
	echo "==> ortam: sunucudaki /etc/acilis-zili.env korunuyor (yüklemek için ENV_FORCE=1)"
elif [[ -r "$ENV_FILE" ]]; then
	grep -q $'\r' "$ENV_FILE" && warn "$ENV_FILE CRLF içeriyor — sunucu tarafı kırpıyor, yine de LF'e çevirmen daha iyi"
	# scp kaynak iznini taşıyor ve msys tarafında bu 0644; sunucuda dünya
	# okunur bir sır dosyası oluyordu. `umask 077` + `cat` izni aktarımın
	# kendisinde daraltıyor.
	"${SSH[@]}" 'umask 077; cat >/tmp/acilis-zili.env' <"$ENV_FILE"
	env_src=/tmp/acilis-zili.env
	echo "==> ortam: $ENV_FILE yüklendi"
else
	[[ $server_has_env -eq 1 ]] || die "$ENV_FILE yok ve sunucuda da /etc/acilis-zili.env yok — ilk kurulum için ortam dosyası şart"
fi

# --------------------------------------------------------- deploy dizini
# Servis birimi, Caddyfile ve update.sh BURADAN kuruluyor — GitHub klonundan
# değil. Klondan alınıyordu ve o, henüz push edilmemiş bir düzeltmeyle deploy
# eden kişinin düzelttiği hatayı sunucuda aynen görmesi demekti.
"${SSH[@]}" 'rm -rf /tmp/acilis-deploy'
"${SCP[@]}" "$here" "$HOST:/tmp/acilis-deploy"
echo "==> deploy/ yüklendi"

"${SSH[@]}" "sudo DOMAIN='$DOMAIN' SITE_ENV_SRC='$env_src' DEPLOY_SRC=/tmp/acilis-deploy REPO='$REPO' BRANCH='$BRANCH' bash /tmp/acilis-deploy/bootstrap.sh"

# Sunucunun karar verdiği adresi geri oku (DOMAIN boş verilmiş olabilir).
site=$("${SSH[@]}" 'sudo grep "^NEXT_PUBLIC_SITE_URL=" /etc/acilis-zili.env | cut -d= -f2- | tr -d "'"'"'\""' | tr -d '\r')
[[ -n "$site" ]] || die "sunucudan adres okunamadı"

printf '\n==> dışarıdan doğrulama: %s\n' "$site"
if status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 45 "$site/"); then
	echo "    HTTP $status"
	[[ "$status" == 200 ]] || die "site $status döndü"
else
	echo "    ULAŞILAMADI. Sunucu içeriden 200 verdiyse sebep dış katman:" >&2
	echo "    Oracle Security List'te TCP 80/443 ingress kuralı var mı? (docs/deploy-vps.md § 2)" >&2
	exit 1
fi
