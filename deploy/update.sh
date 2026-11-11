#!/usr/bin/env bash
#
# Açılış Zili — yeni sürüm çıkar. Uygulama kullanıcısı olarak:
#
#   sudo -u acilis -H bash /srv/acilis-zili/current/deploy/update.sh [<sha>]
#
# SHA VERİLİRSE TAM O COMMIT DERLENİR (16 Ekim). Deploy iş akışı verify'ın
# geçtiği commit'i (`github.sha`) geçiyor. Dal ucu klonlanıyordu ve o, yarış
# demekti: X'in yayını sürerken gelen Y ortak `concurrency` grubunda bekliyor,
# ama X'in klonu dal ucunda Y'yi buluyor — Y kendi verify'ı koşmadan canlıya
# çıkıyordu. Argümansız çağrı (elle, deploy/remote.sh) dal ucunu derler.
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
# MAVİ-YEŞİL (11 Kasım): canlı port bu dosyada; kuruluysa (deploy/
# bluegreen-setup.sh) yeni sürüm boştaki portta ayağa kalkar. Yoksa eski tek
# birim yolu (aşağıda, "servis").
ACTIVE_PORT_FILE=$APP_ROOT/shared/active-port

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mHATA: %s\033[0m\n' "$*" >&2; exit 1; }
warn() { printf '\033[1;33mUYARI: %s\033[0m\n' "$*" >&2; }

# Üretim alan adı — indeks uyarısı yalnız bu adrese bağlanır (aşağıda).
PROD_SITE_URL=https://aciliszili.com

[[ -r "$ENV_FILE" ]] || die "$ENV_FILE okunamıyor (root:acilis 0640 olmalı)"

release=""
deployed=0
# Canlıya ÇIKMAMIŞ sürüm dizini geride bırakılmıyor. Bırakılıyordu ve
# budama ada göre çalıştığı için sonuç şuydu: A canlı ve sağlam, B derlemede
# ölür, C başarılı olur → budama en yeni ikiyi (B, C) tutup A'yı siler, yani
# elde geri dönülecek sağlam sürüm kalmaz ve `previous` yuvasında hiç
# çalışmamış bir dizin durur. Ayrıca her başarısız deneme ~600 MB bırakıyordu.
#
# "Canlı mı" sorusunu bayrak değil BAĞIN HEDEFİ cevaplıyor. Bağ çevrildikten
# sonra, sağlık kontrolü bitmeden SSH koparsa (iş iptali, ağ) sonraki çıktıda
# gelen SIGPIPE/SIGHUP da bu trap'i koşturuyor; `deployed` henüz 0 olduğu için
# canlı sürümün dizini silinip servis boşluğa bakıyordu.
cleanup() {
	[[ -n "$release" && $deployed -eq 0 && -d "$release" ]] || return 0
	[[ "$(readlink -e "$APP_ROOT/current" 2>/dev/null || true)" == "$release" ]] && return 0
	rm -rf "$release"
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

# DİSK BEKÇİSİ (6 Kasım 2026): deploy iş akışı bunu zaten ayrı adımda,
# yeni commit'in bekçisiyle koşuyor; burada elle çalıştırmalar
# (deploy/remote.sh) için. Gerekçe deploy/disk-guard.sh başında.
guard="$(dirname "${BASH_SOURCE[0]}")/disk-guard.sh"
if [[ -r "$guard" ]]; then
	log "disk"
	# shellcheck source=deploy/disk-guard.sh
	. "$guard"
	ensure_build_space "$APP_ROOT" || die "derleme için diskte yer yok (ayrıntı yukarıda)"
fi

log "kaynak"
want="${1:-}"
if [[ -n "$want" ]]; then
	[[ "$want" =~ ^[0-9a-f]{40}$ ]] || die "geçersiz SHA: $want"
	sha=${want:0:7}
	release="$APP_ROOT/releases/$(date -u +%Y%m%d-%H%M%S)-$sha"
	git init -q "$release"
	git -C "$release" remote add origin "$REPO"
	git -C "$release" fetch -q --depth 1 origin "$want"
	git -C "$release" checkout -q --detach FETCH_HEAD
	[[ "$(git -C "$release" rev-parse HEAD)" == "$want" ]] || die "çekilen commit $want değil"
else
	sha=$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -c1-7)
	[[ -n "$sha" ]] || die "uzak dal okunamadı: $REPO $BRANCH"
	release="$APP_ROOT/releases/$(date -u +%Y%m%d-%H%M%S)-$sha"
	git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$release"
fi
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
#
# ORTAMI GEÇİRMEMEK YETMİYOR: dosya `root:acilis 0640` ve `npm ci` aynı
# kullanıcıyla koşuyor, yani postinstall `cat /etc/acilis-zili.env` ile
# hepsini okuyabilir. Kurulum betikleri bu yüzden HİÇ koşmuyor
# (`--ignore-scripts`, 16 Ekim). Kilitte betik taşıyan beş paket var —
# esbuild (üç kopya; JS API platform paketini kendisi buluyor), fsevents
# (yalnız macOS), unrs-resolver (yalnız lint) — hiçbiri derlemeye ya da
# çalışma anına gerekmiyor; Next/SWC ve sharp platform paketleriyle geliyor.
# Yeni bir bağımlılık kurulum betiği isterse derleme burada kırılır; çözüm
# bayrağı kaldırmak değil, o paketi `npm rebuild <ad>` ile tek tek açmak.
log "bağımlılıklar"
cd "$release"
npm ci --no-audit --no-fund --ignore-scripts

log "derleme"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# İNDEKS KAPALIYSA YÜKSEK SESLE SÖYLE. `SITE_INDEXABLE=false` ikinci kopya
# için doğru değer (lib/site.ts), ama asıl alan adına derleniyorsa sitenin
# tamamı arama motorundan çekiliyor: robots.txt `Disallow: /`, her sayfada
# `noindex`. Ekim 2026'da canlı tam olarak böyle kaldı ve hiçbir çıktıda
# görünmedi — bootstrap var olan değeri bilerek koruyor (elle yapılanı
# ezmesin diye), yani yanlış değer kendiliğinden düzelmiyor. Derlemeyi
# DURDURMUYOR: bilinçli bir kapatma da olabilir; yalnız sessiz kalmıyor.
noindex_prod=0
indexable=$(printf '%s' "${SITE_INDEXABLE:-}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
if [[ ( $indexable == false || $indexable == 0 ) && "${NEXT_PUBLIC_SITE_URL%/}" == "$PROD_SITE_URL" ]]; then
	noindex_prod=1
	warn "SITE_INDEXABLE=$SITE_INDEXABLE ve adres $PROD_SITE_URL — site arama motorlarına KAPALI derleniyor (robots.txt Disallow: /, noindex). Açmak için $ENV_FILE içinde SITE_INDEXABLE=true yapıp yeniden dağıt."
fi

npm run build

# Turbopack derleme önbelleği çalışma anında okunmuyor ve sürüm başına
# birkaç GB tutuyordu; bir sonraki derlemenin yerini yiyordu (6 Kasım 2026,
# "No space left on device" — gerekçe deploy/disk-guard.sh).
rm -rf "$release/.next/cache/turbopack"

# VERİ ÖNBELLEĞİ SÜRÜMLER ARASI ORTAK (20 Ekim). Next, `fetch`in
# `next.revalidate`li yanıtlarını ve `unstable_cache` girdilerini
# `.next/cache/fetch-cache`e yazıyor (file-system-cache.js: "dağıtımlar
# arası saklanabilsin diye"). Her sürüm kendi dizininde derlendiği için o
# dizin her push'ta BOŞ başlıyordu: günde birkaç dağıtımda Finnhub'ın 24
# saatlik profil/ölçü kayıtları, SEC, FRED, TCMB arşivi ve Claude notları
# (36 saat – 30 gün) her seferinde soğuktu — ilk dakikalarda Finnhub'ın
# dakikadaki 60 hakkı birkaç okurla bitiyor, notlar yeniden yazılıyordu.
#
# `fetch` anahtarı URL + istekten türüyor, derleme kimliği içermiyor;
# sağlayıcı kayıtları her derlemede geçerli. `unstable_cache` anahtarı geri
# çağrının DERLENMİŞ metnini de içeriyor: metin değişirse kayıt ıskalanır
# (fazladan bir çağrı, yanlış veri değil). Dönen ŞEKİL değişip anahtar aynı
# kalırsa eski şekil yeni koda gider — keyParts bu yüzden sürümlü
# ("stock-move-v3"); şekli değiştiren sürümü artırır.
#
# Bedeli: `revalidateTag` kaydı süreç belleğinde. Gece işinin geçersiz
# kıldığı (makro, yatırımcılar, vergi tarifesi) ama arada kimsenin okumadığı
# bir kayıt yeniden başlatmadan sonra kendi `revalidate` süresi (en çok bir
# gün) dolana dek geri gelebilir; aynı sürümde yeniden başlatmada da öyleydi.
#
# Derlemenin kendi çektiği kayıtlar ortağa taşınır (`-u`: yalnız oradakinden
# yeniyse) — derlemede basılan sayfalar o veriyle çizildi. Bağın hedefi
# kökün altında, servisin yazma izni içinde (acilis-zili.service). Disk
# budaması cron-install.sh'ta.
shared_cache="$APP_ROOT/shared/fetch-cache"
mkdir -p "$shared_cache" "$release/.next/cache"
if [[ -d "$release/.next/cache/fetch-cache" && ! -L "$release/.next/cache/fetch-cache" ]]; then
	cp -a -u "$release/.next/cache/fetch-cache/." "$shared_cache/" ||
		warn "derleme önbelleği ortak dizine kopyalanamadı"
	rm -rf "$release/.next/cache/fetch-cache"
fi
ln -sfn "$shared_cache" "$release/.next/cache/fetch-cache"

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

# MAVİ-YEŞİL GEÇİŞ (11 Kasım, sahibinin sorusu: "deployun böyle gitmesi
# normal mi" — /bulmaca 502). Tek birimde `systemctl restart` eski süreci
# kapatıp yenisini açıyordu ve arada Caddy'nin arkasında dinleyen yoktu:
# her deploy birkaç saniyelik bir 502 penceresi. Kuruluysa (şablon birim +
# canlı port dosyası, deploy/bluegreen-setup.sh) yeni sürüm BOŞTAKİ portta
# başlar; canlı süreç o sırada eski sürümden hizmet vermeye devam eder.
# Sağlık geçerse canlı port dosyası çevrilir, eski örnek durdurulur (Caddy
# kapanan portu atlıyor: `lb_policy first` + aktif yoklama). Geçmezse yeni
# örnek durdurulur, `current` geri alınır — canlı süreç hiç kesilmedi.
bluegreen=0
if [[ -f /etc/systemd/system/acilis-zili@.service && -r "$ACTIVE_PORT_FILE" ]]; then
	live=$(tr -dc '0-9' <"$ACTIVE_PORT_FILE")
	if [[ "$live" == 3000 || "$live" == 3001 ]]; then
		bluegreen=1
		idle=$([[ "$live" == 3000 ]] && echo 3001 || echo 3000)
	fi
fi

if [[ $bluegreen -eq 1 ]]; then
	log "servis (mavi-yeşil: canlı $live, yeni $idle)"
	point_current "$release"
	# `restart`, `start` değil: boştaki örnek bir önceki geçişten askıda
	# kalmışsa eski kodla "çalışıyor" sayılmasın.
	sudo systemctl restart "acilis-zili@$idle"
	HEALTH_URL="http://127.0.0.1:$idle/"
	log "sağlık"
	if healthy; then
		deployed=1
		printf '%s\n' "$idle" >"$ACTIVE_PORT_FILE.tmp"
		mv -f "$ACTIVE_PORT_FILE.tmp" "$ACTIVE_PORT_FILE"
		sudo systemctl enable "acilis-zili@$idle" >/dev/null 2>&1 || warn "acilis-zili@$idle etkinleştirilemedi (yeniden başlatmada açılmayabilir)"
		# Caddy'nin yeni portu sağlıklı görmesi için iki yoklama (2 sn arayla).
		sleep 5
		sudo systemctl stop "acilis-zili@$live" || warn "eski örnek ($live) durdurulamadı"
		sudo systemctl disable "acilis-zili@$live" >/dev/null 2>&1 || true
		bash "$release/deploy/cron-install.sh" || echo "UYARI: crontab güncellenemedi" >&2
		find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d |
			sort | head -n "-$KEEP" | xargs -r rm -rf
		if [[ $noindex_prod -eq 1 ]]; then
			warn "canlı sürüm arama motorlarına KAPALI (SITE_INDEXABLE=false)"
		fi
		exit 0
	fi
	echo "YENİ ÖRNEK ($idle) AYAĞA KALKMADI — son 40 satır:" >&2
	journalctl -u "acilis-zili@$idle" -n 40 --no-pager >&2 || true
	sudo systemctl stop "acilis-zili@$idle" || true
	if [[ -n "$previous" && -d "$previous" && "$previous" != "$release" ]]; then
		point_current "$previous"
		echo "canlı örnek ($live) kesilmedi; current önceki sürüme geri alındı: $previous" >&2
	fi
	exit 1
fi

log "servis"
point_current "$release"
sudo systemctl restart acilis-zili

log "sağlık"
if healthy; then
	deployed=1
	# Zamanlanmış işler YENİ sürümün listesinden (deploy/cron-install.sh).
	# Düşerse dağıtım geri alınmıyor: sürüm sağlıklı, eksik bir cron satırı
	# günlüğe yazılıyor ve bir sonraki dağıtım yeniden deniyor.
	bash "$release/deploy/cron-install.sh" || echo "UYARI: crontab güncellenemedi" >&2
	# Yalnızca başarılı geçişten sonra buda. `releases/` artık yalnızca
	# canlıya çıkmış sürümleri taşıyor (bkz. cleanup), yani ada göre budama
	# doğru olanı tutuyor.
	find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d |
		sort | head -n "-$KEEP" | xargs -r rm -rf
	# Derleme çıktısının altında kaybolmasın diye son satır olarak tekrar.
	if [[ $noindex_prod -eq 1 ]]; then
		warn "canlı sürüm arama motorlarına KAPALI (SITE_INDEXABLE=false)"
	fi
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
