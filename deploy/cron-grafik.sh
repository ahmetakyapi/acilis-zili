#!/usr/bin/env bash
#
# Açılış Zili — Günün Grafiği yedeği (8 Kasım).
#
# `/api/cron/grafik` ucunu `CRON_SECRET` ile çağırır; uç son tamamlanmış
# seansın grafiği HİÇ yazılmamışsa bağlam paketinden şablonla iki dilde
# yazar, yazılmışsa dokunmaz (app/api/cron/grafik/route.ts, şablon
# lib/daily-chart-fallback.ts). Neden: 7 Kasım'da rutin kullanım limitine
# takılıp düştü ve hafta sonu boyunca perşembenin grafiği göründü.
#
# Crontab girdileri `deploy/cron-install.sh` ile yazılıyor:
#
#   30 22 * * 1-5 /bin/bash /srv/acilis-zili/current/deploy/cron-grafik.sh
#   45 11 * * *   /bin/bash /srv/acilis-zili/current/deploy/cron-grafik.sh
#
# 22:30 UTC: kapanıştan (yazın 20:00, kışın 21:00 UTC) bir buçuk-iki buçuk
# saat sonra — rutin kapanış + 25 dk'da koşuyor (docs/claude-rutinler.md
# § 7), yedek ona yer bırakır. 11:45 UTC her sabah, hafta sonu dahil:
# gece sağlayıcı düşmüşse ya da gün tatil ertesiyse telafi. Uç tekrar
# koşuya dayanıklı (yalnız boş güne yazar), curl bu yüzden yeniden deniyor;
# 503 bağlam eksik demek, yeniden deneme onu da kapsar.
#
# Günlük kaydı sessiz: yalnızca hata ve yazım yazılıyor.

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
# Canlı port (11 Kasım, mavi-yeşil): uygulama 3000 ya da 3001'de; hangisi
# olduğunu deploy/update.sh bu dosyaya yazıyor. Dosya yoksa eski tek birim.
APP_PORT=$( { tr -dc '0-9' </srv/acilis-zili/shared/active-port; } 2>/dev/null || true)
APP_PORT=${APP_PORT:-3000}
ENDPOINT=http://127.0.0.1:${APP_PORT}/api/cron/grafik

[[ -r "$ENV_FILE" ]] || { logger -t acilis-grafik -p user.err "ortam dosyasi okunamadi: $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[[ -n "${CRON_SECRET:-}" ]] || { logger -t acilis-grafik -p user.err "CRON_SECRET tanimli degil"; exit 1; }

# Sır argv'de değil, stdin'den — gerekçe deploy/cron-daily.sh.
response=$(curl -sS --max-time 170 --retry 3 --retry-delay 60 --retry-connrefused -w '\n%{http_code}' \
	-H @- \
	"$ENDPOINT" <<<"Authorization: Bearer ${CRON_SECRET}" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" != "200" ]]; then
	logger -t acilis-grafik -p user.err "basarisiz (http ${status}): ${body:0:400}"
	exit 1
fi
if [[ "$body" == *'"written":["'* ]]; then
	logger -t acilis-grafik -p user.info "yazildi: ${body:0:400}"
fi
