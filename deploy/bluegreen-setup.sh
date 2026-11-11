#!/usr/bin/env bash
#
# Açılış Zili — mavi-yeşil deploy kurulumu (11 Kasım). ROOT olarak, idempotent:
#
#   sudo UNIT_SRC=<yol>/acilis-zili@.service bash <yol>/bluegreen-setup.sh
#
# Deploy iş akışı bunu her koşuda update.sh'tan SONRA, BU COMMIT'İN
# kopyasıyla stdin'den çalıştırıyor; birim dosyası da `UNIT_B64` olarak
# yanında gidiyor (.github/workflows/deploy.yml → "Mavi-yeşil kurulum").
# NEDEN `current`tan DEĞİL: `current` uygulama kullanıcısının yazabildiği
# bir dizin; root olarak oradan betik ya da birim okumak, uygulamayı ele
# geçirenin bir sonraki deploy'da root olması demekti. bootstrap.sh klondaki
# kopyayı veriyor. Kuruluysa hiçbir şey yapmaz. Kurulu değilse dört adım, her biri doğrulanarak:
#
#   1. Şablon birim `acilis-zili@.service` (deploy/acilis-zili@.service).
#   2. sudoers: uygulama kullanıcısı iki örneği başlatıp durdurabilsin.
#   3. Caddy: iki upstream (3000, 3001), aktif sağlık yoklaması
#      (`/api/health/live`) ve kapalı portu atlayan yeniden deneme.
#      Yapılandırma doğrulanmazsa eski dosya geri konur.
#   4. GEÇİŞ: eski tek birim (`acilis-zili`, port 3000) çalışıyorsa aynı
#      sürüm 3001'de başlatılır, ayağa kalkınca eski birim durdurulur ve
#      devre dışı bırakılır; canlı port `shared/active-port`a yazılır.
#      3001 kalkmazsa geri alınır: eski birim çalışmaya devam eder.
#
# NEDEN AYRI BETİK, update.sh'ın İÇİNDE DEĞİL: update.sh uygulama kullanıcısı
# olarak koşuyor ve root işi (birim, sudoers, Caddy) yapamıyor; üstelik iş
# akışı canlı sürümün update.sh'ını koşturduğu için update.sh'a yazılan bir
# kurulum bir deploy gecikmeli devreye girerdi (CLAUDE.md → "update.sh
# düzeltmesi bir deploy GECİKMELİ çalışır"). Bu betik `current`tan okunur ve
# update.sh `current`ı bu sürüme çevirdikten sonra koşar: ilk deploy'da
# geçiş, sonrakilerde update.sh'ın mavi-yeşil yolu.

set -euo pipefail

APP_ROOT=/srv/acilis-zili
APP_USER=acilis
UNIT_SRC="${UNIT_SRC:-}"
if [[ -n "${UNIT_B64:-}" ]]; then
	UNIT_SRC=$(mktemp)
	base64 -d <<<"$UNIT_B64" >"$UNIT_SRC"
fi
UNIT_DST=/etc/systemd/system/acilis-zili@.service
SUDOERS=/etc/sudoers.d/acilis-zili
CADDYFILE=/etc/caddy/Caddyfile
ACTIVE="$APP_ROOT/shared/active-port"

note() { printf '==> %s\n' "$*"; }
warn() { printf 'UYARI: %s\n' "$*" >&2; }

[[ $EUID -eq 0 ]] || { echo "root olarak çalıştır" >&2; exit 1; }
[[ -n "$UNIT_SRC" && -r "$UNIT_SRC" ]] || { note "şablon birim verilmedi; kurulum atlandı"; exit 0; }
# Canlı sürüm şablonla gelen health/live ucunu taşımalı: yoksa Caddy'nin
# aktif yoklaması iki portu da düşürür. Uç yoksa (eski sürüm) bekle.
if ! curl -sf -o /dev/null --max-time 5 http://127.0.0.1:3000/api/health/live && ! curl -sf -o /dev/null --max-time 5 http://127.0.0.1:3001/api/health/live; then
	note "canlı sürümde /api/health/live yok; kurulum sonraki deploy'a kaldı"
	exit 0
fi

live_ok() {
	local port=$1 i
	for i in $(seq 1 45); do
		curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:${port}/" && return 0
		sleep 2
	done
	return 1
}

# ---- 1. Şablon birim ----
if ! cmp -s "$UNIT_SRC" "$UNIT_DST"; then
	install -m 0644 "$UNIT_SRC" "$UNIT_DST"
	systemctl daemon-reload
	note "şablon birim kuruldu"
fi

# ---- 2. sudoers ----
# Eski iki izin (restart acilis-zili, reload caddy) geçiş ve elle geri dönüş
# için kalıyor; yanına iki örneğin başlat/durdur/etkinleştir izinleri.
want="$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart acilis-zili, /usr/bin/systemctl reload caddy"
for port in 3000 3001; do
	for verb in start stop restart enable disable; do
		want+=", /usr/bin/systemctl $verb acilis-zili@$port"
	done
done
if [[ "$(cat "$SUDOERS" 2>/dev/null || true)" != "$want" ]]; then
	tmp=$(mktemp)
	printf '%s\n' "$want" >"$tmp"
	if visudo -cf "$tmp" >/dev/null; then
		install -m 0440 "$tmp" "$SUDOERS"
		note "sudoers güncellendi"
	else
		warn "sudoers doğrulanmadı; değiştirilmedi"
	fi
	rm -f "$tmp"
fi

# ---- 3. Caddy ----
# Yerinde düzenleme: canlı dosyanın alan adı ve elle eklenmiş başka satırı
# korunur; yalnız `reverse_proxy 127.0.0.1:3000 {` satırı iki upstream'li
# bloğun başına dönüşür. Bloğun geri kalanı (transport) aynen kalır.
# İKİ DENEME: önce tam blok; sunucudaki Caddy `health_passes`/`health_fails`
# tanımıyorsa (2.7 öncesi) onlarsız. İkisi de doğrulanmazsa eski dosya geri
# konur ve kurulum BURADA, başarıyla biter: canlı port dosyası yazılmadığı
# için update.sh eski tek birim yolunda kalır, site eskisi gibi çalışır.
# Bilerek kırmızı değil: kırmızı deploy bırakılmaz (CLAUDE.md), kesintisiz
# geçiş ise bir iyileştirme; uyarı deploy günlüğünde.
caddy_block() {
	local extra=$1
	perl -0pi -e 's/^(\s*)reverse_proxy 127\.0\.0\.1:3000 \{\n/$1reverse_proxy 127.0.0.1:3000 127.0.0.1:3001 {\n$1\t# Mavi-yeşil (11 Kasım): bkz. deploy\/Caddyfile.\n$1\tlb_policy first\n$1\tlb_try_duration 15s\n$1\tlb_try_interval 250ms\n$1\thealth_uri \/api\/health\/live\n$1\thealth_interval 2s\n$1\thealth_timeout 2s\n'"$extra"'/m' "$CADDYFILE"
}
caddy_ok() { caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; }
if [[ -f "$CADDYFILE" ]] && ! grep -q '127\.0\.0\.1:3001' "$CADDYFILE"; then
	if ! grep -qE '^\s*reverse_proxy 127\.0\.0\.1:3000 \{' "$CADDYFILE"; then
		warn "Caddyfile'da beklenen reverse_proxy satırı yok; mavi-yeşil kurulmadı (eski düzen sürüyor)"
		exit 0
	fi
	cp -a "$CADDYFILE" "$CADDYFILE.bluegreen.bak"
	caddy_block '$1\thealth_passes 2\n$1\thealth_fails 1\n'
	if ! caddy_ok; then
		cp -a "$CADDYFILE.bluegreen.bak" "$CADDYFILE"
		caddy_block ''
	fi
	if caddy_ok && systemctl reload caddy; then
		note "Caddy iki upstream'e geçti"
	else
		cp -a "$CADDYFILE.bluegreen.bak" "$CADDYFILE"
		systemctl reload caddy || true
		warn "Caddy yapılandırması doğrulanmadı; eski dosya geri kondu, mavi-yeşil kurulmadı (eski düzen sürüyor)"
		exit 0
	fi
fi

# ---- 4. Eski tek birimden geçiş ----
if [[ -r "$ACTIVE" ]] && systemctl is-active --quiet "acilis-zili@$(cat "$ACTIVE")"; then
	note "mavi-yeşil zaten kurulu (canlı port $(cat "$ACTIVE"))"
	exit 0
fi
if systemctl is-active --quiet acilis-zili; then
	note "geçiş: aynı sürüm 3001'de başlatılıyor"
	systemctl start acilis-zili@3001
	if live_ok 3001; then
		install -o "$APP_USER" -g "$APP_USER" -m 0644 /dev/null "$ACTIVE.tmp"
		echo 3001 >"$ACTIVE.tmp"
		mv -f "$ACTIVE.tmp" "$ACTIVE"
		systemctl enable acilis-zili@3001 >/dev/null 2>&1
		# Caddy'nin 3001'i sağlıklı görmesi için iki yoklama (2 sn arayla).
		sleep 5
		systemctl disable --now acilis-zili >/dev/null 2>&1
		note "geçiş tamam: canlı port 3001, eski birim devre dışı"
	else
		warn "3001 ayağa kalkmadı; geri alınıyor, eski birim çalışmaya devam ediyor"
		journalctl -u acilis-zili@3001 -n 30 --no-pager >&2 || true
		systemctl stop acilis-zili@3001 || true
		exit 1
	fi
else
	# Hiçbir şey çalışmıyorsa (ilk kurulum ya da elle durdurulmuş) 3000'de aç.
	note "eski birim çalışmıyor; 3000'de başlatılıyor"
	systemctl enable --now acilis-zili@3000 >/dev/null 2>&1
	install -o "$APP_USER" -g "$APP_USER" -m 0644 /dev/null "$ACTIVE.tmp"
	echo 3000 >"$ACTIVE.tmp"
	mv -f "$ACTIVE.tmp" "$ACTIVE"
	live_ok 3000 || { warn "3000 ayağa kalkmadı"; exit 1; }
fi
