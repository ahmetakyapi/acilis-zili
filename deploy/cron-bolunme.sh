#!/usr/bin/env bash
#
# Açılış Zili — portföyde hisse bölünmesi düzeltmesi (24 Kasım).
#
# `/api/cron/bolunme` ucunu `CRON_SECRET` ile çağırır; uç Alpaca'nın
# bölünme kayıtlarına bakıp bölünmeden önce girilmiş partilerin adedini
# çarpar, maliyetini böler (kural lib/portfolio-splits.ts).
#
# Crontab girdileri `deploy/cron-install.sh` ile yazılıyor (sunucu UTC):
#
#   45 14 * * 1-5 /bin/bash /srv/acilis-zili/current/deploy/cron-bolunme.sh
#   20 11 * * *   /bin/bash /srv/acilis-zili/current/deploy/cron-bolunme.sh
#
# 14:45 UTC yaz saatinde 10:45, kışın 09:45 ET: bölünme ex günü açılışta
# geçerli, adet açılıştan önce çarpılırsa portföy dünkü (bölünmemiş)
# fiyatla birkaç saat kat kat görünürdü. 11:20 UTC her sabah telafi (dünün
# koşusu düştüyse). Uç idempotent: uygulanan bölünme defterde, ikinci koşu
# aynı partiye dokunmaz; bu yüzden curl yeniden deneyebilir.
#
# Günlük kaydı sessiz: yalnızca hata ve düzeltme yazılıyor.

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
# Canlı port (mavi-yeşil) — gerekçe deploy/cron-portfoy-ozeti.sh.
APP_PORT=$( { tr -dc '0-9' </srv/acilis-zili/shared/active-port; } 2>/dev/null || true)
APP_PORT=${APP_PORT:-3000}
ENDPOINT=http://127.0.0.1:${APP_PORT}/api/cron/bolunme

[[ -r "$ENV_FILE" ]] || { logger -t acilis-bolunme -p user.err "ortam dosyasi okunamadi: $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[[ -n "${CRON_SECRET:-}" ]] || { logger -t acilis-bolunme -p user.err "CRON_SECRET tanimli degil"; exit 1; }

# Sır argv'de değil, stdin'den — gerekçe deploy/cron-daily.sh.
response=$(curl -sS --max-time 90 --retry 3 --retry-delay 30 --retry-connrefused -w '\n%{http_code}' \
	-H @- \
	"$ENDPOINT" <<<"Authorization: Bearer ${CRON_SECRET}" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" != "200" ]]; then
	logger -t acilis-bolunme -p user.err "basarisiz (http ${status}): ${body:0:400}"
	exit 1
fi
if [[ "$body" == *'"adjusted":[{'* ]]; then
	logger -t acilis-bolunme -p user.info "duzeltildi: ${body:0:400}"
fi
