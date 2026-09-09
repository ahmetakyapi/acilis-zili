#!/usr/bin/env bash
#
# Açılış Zili — yeni sürüm çıkar. Uygulama kullanıcısı olarak:
#
#   sudo -u acilis -H bash /srv/acilis-zili/current/deploy/update.sh
#
# HER SÜRÜM KENDİ DİZİNİNDE. `releases/<zaman>-<sha>` altına klonlanır ve
# orada derlenir; `current` bağı ancak derleme BİTTİKTEN sonra ona çevrilip
# servis yeniden başlatılır. Bir dönem yerinde derleniyordu (`rm -rf .next`
# + build) ve o, dakikalarca süren derleme boyunca canlı sunucunun parça
# dosyalarını altından çekmek demekti: sayfalar açılıyor, script'ler 404.
#
# Sağlık kontrolü geçmezse bağ öncekine geri alınır ve betik sıfırdan farklı
# çıkar — kırık sürüm hiçbir zaman canlı kalmaz.

set -euo pipefail

REPO="${REPO:-https://github.com/ahmetakyapi/acilis-zili.git}"
BRANCH="${BRANCH:-main}"
APP_ROOT=/srv/acilis-zili
ENV_FILE=/etc/acilis-zili.env
KEEP=2
HEALTH_URL=http://127.0.0.1:3000/

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mHATA: %s\033[0m\n' "$*" >&2; exit 1; }

[[ -r "$ENV_FILE" ]] || die "$ENV_FILE okunamıyor (root:acilis 0640 olmalı)"

release=""
deployed=0
# Canlıya ÇIKMAMIŞ sürüm dizini geride bırakılmıyor. Bırakılıyordu ve
# budama ada göre çalıştığı için sonuç şuydu: A canlı ve sağlam, B derlemede
# ölür, C başarılı olur → budama en yeni ikiyi (B, C) tutup A'yı siler, yani
# elde geri dönülecek sağlam sürüm kalmaz ve `previous` yuvasında hiç
# çalışmamış bir dizin durur. Ayrıca her başarısız deneme ~600 MB bırakıyordu.
cleanup() {
	[[ -n "$release" && $deployed -eq 0 && -d "$release" ]] && rm -rf "$release"
	return 0
}
trap cleanup EXIT

point_current() {
	# Atomik değiş-tokuş: `ln -sfn` sil+oluştur yapmıyor, `mv -T` tek sistem
	# çağrısıyla yeniden adlandırıyor — arada `current`ın YOK olduğu bir an
	# oluşmuyor. `-f` geçici bağın artığını eziyor: bir dönem `ln -s` kullanan
	# sürüm, iki komut arasında ölünce `current.tmp` bırakıyordu ve sonraki
	# HER dağıtım derlemeyi bitirdikten sonra "File exists" ile ölüyordu.
	ln -sfn "$1" "$APP_ROOT/current.tmp"
	mv -T "$APP_ROOT/current.tmp" "$APP_ROOT/current"
}

healthy() {
	local i
	for i in $(seq 1 30); do
		if curl -sf -o /dev/null --max-time 5 "$HEALTH_URL"; then
			echo "ayakta (${i}. deneme)"
			return 0
		fi
		sleep 2
	done
	return 1
}

log "kaynak"
sha=$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -c1-7)
[[ -n "$sha" ]] || die "uzak dal okunamadı: $REPO $BRANCH"
release="$APP_ROOT/releases/$(date -u +%Y%m%d-%H%M%S)-$sha"
git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$release"
echo "$release"

# BAĞIMLILIKLAR SIRSIZ ORTAMDA KURULUYOR — sıra bilinçli.
#
# Ortam dosyası bir dönem betiğin başında `set -a` ile okunuyordu ve o,
# DATABASE_URL'den ANTHROPIC_API_KEY'e kadar bütün demetin `npm ci`ye ortam
# olarak geçmesi demekti. node_modules'daki her paketin postinstall betiği
# onu miras alıyor; ele geçirilmiş tek bir bağımlılık sürümü (2025 Eylül'ünde
# npm ekosisteminde tam olarak bu yaşandı) sunucunun bütün sırlarını bir
# `npm update` sonrası ilk dağıtımda dışarı taşırdı.
#
# Kurulum aşamasının bu değerlere ihtiyacı yok. Derlemenin VAR:
# NEXT_PUBLIC_SITE_URL demete gömülüyor, SITE_INDEXABLE robots.ts statik
# üretildiği için oraya pişiyor, statik sayfalar DATABASE_URL'e gidiyor.
log "bağımlılıklar"
cd "$release"
npm ci --no-audit --no-fund

log "derleme"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
npm run build

# `readlink -f` SON BİLEŞENİN VAR OLMASINI İSTEMİYOR: `current` henüz yokken
# (ilk kurulum) bağın kendi yolunu basıp 0 dönüyordu. Sonuç, sağlık kontrolü
# geçmeyen bir ilk dağıtımda `current`ı KENDİNE bağlamaktı — ELOOP, servis
# WorkingDirectory'yi çözemez, journald'da uygulamanın gerçek hatası yerine
# "Failed at step CHDIR" görünür ve teşhis yanlış yere bakar.
# `-e` bütün bileşenlerin var olmasını şart koşuyor; `-L` bağın kendisini.
previous=""
if [[ -L "$APP_ROOT/current" ]]; then
	previous=$(readlink -e "$APP_ROOT/current" || true)
fi

log "servis"
point_current "$release"
sudo systemctl restart acilis-zili

log "sağlık"
if healthy; then
	deployed=1
	# Yalnızca başarılı geçişten sonra buda. `releases/` artık yalnızca
	# canlıya çıkmış sürümleri taşıyor (bkz. cleanup), yani ada göre budama
	# doğru olanı tutuyor.
	find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d |
		sort | head -n "-$KEEP" | xargs -r rm -rf
	exit 0
fi

echo "AYAĞA KALKMADI — son 40 satır:" >&2
journalctl -u acilis-zili -n 40 --no-pager >&2 || true
if [[ -n "$previous" && -d "$previous" && "$previous" != "$release" ]]; then
	echo "önceki sürüme geri dönülüyor: $previous" >&2
	point_current "$previous"
	sudo systemctl restart acilis-zili
	if healthy >&2; then
		echo "geri alma başarılı" >&2
	else
		echo "GERİ ALMA DA KALKMADI — sunucuya bak" >&2
	fi
else
	echo "geri dönülecek önceki sürüm yok" >&2
fi
exit 1
