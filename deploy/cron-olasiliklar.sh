#!/usr/bin/env bash
#
# Açılış Zili — Olasılıklar anlık görüntüsü (25 Ekim).
#
# `/api/cron/olasiliklar` ucunu `CRON_SECRET` ile çağırır; uç tahmin
# piyasasından (Kalshi) Fed, Kongre ve makro olasılıklarını okuyup
# `probability_snapshots` tablosuna yazıyor (app/api/cron/olasiliklar/route.ts).
#
# Crontab girdisi `deploy/cron-install.sh` ile yazılıyor:
#
#   7 * * * * /bin/bash /srv/acilis-zili/current/deploy/cron-olasiliklar.sh
#
# SAATTE BİR ÇAĞRILIR AMA GÜNDE BİR YAZAR: kararı uç veriyor — son kayıt
# 20 saatten eskiyse yenisi alınır; seçim gecesi ve Fed karar saatinin
# çevresinde saatte bir. Öteki çağrılar `skipped: fresh` ile hemen döner
# (tek bir veritabanı okuması). Sağlayıcı Türkiye'den erişilemiyor; istek
# sunucudan (yurt dışı) çıkıyor.
#
# Günlük kaydı sessiz: yalnızca hata ve yazım yazılıyor.

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
# Canlı port (11 Kasım, mavi-yeşil): uygulama 3000 ya da 3001'de; hangisi
# olduğunu deploy/update.sh bu dosyaya yazıyor. Dosya yoksa eski tek birim.
APP_PORT=$( { tr -dc '0-9' </srv/acilis-zili/shared/active-port; } 2>/dev/null || true)
APP_PORT=${APP_PORT:-3000}
ENDPOINT=http://127.0.0.1:${APP_PORT}/api/cron/olasiliklar

[[ -r "$ENV_FILE" ]] || { logger -t acilis-olasilik -p user.err "ortam dosyasi okunamadi: $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[[ -n "${CRON_SECRET:-}" ]] || { logger -t acilis-olasilik -p user.err "CRON_SECRET tanimli degil"; exit 1; }

# Sır argv'de değil, stdin'den — gerekçe deploy/cron-daily.sh.
response=$(curl -sS --max-time 90 --retry 3 --retry-delay 30 --retry-connrefused -w '\n%{http_code}' \
	-H @- \
	"$ENDPOINT" <<<"Authorization: Bearer ${CRON_SECRET}" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" != "200" ]]; then
	logger -t acilis-olasilik -p user.err "basarisiz (http ${status}): ${body:0:400}"
	exit 1
fi
if [[ "$body" == *'"saved":'* ]]; then
	logger -t acilis-olasilik -p user.info "yazildi: ${body:0:400}"
fi
