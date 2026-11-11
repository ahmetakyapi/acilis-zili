#!/usr/bin/env bash
#
# Açılış Zili — cuma portföy özeti push'u (11 Kasım).
#
# `/api/cron/portfoy-ozeti` ucunu `CRON_SECRET` ile çağırır; uç haftanın son
# işlem gününün kapanışı kesinleştiyse (ve Türkiye'de gece değilse) tercihi
# açık, portföyü olan okurlara tek push gönderir (gerekçe
# app/api/cron/portfoy-ozeti/route.ts, zamanlama lib/portfolio-week-push.ts).
#
# Crontab girdileri `deploy/cron-install.sh` ile yazılıyor (sunucu UTC):
#
#   7 5,7 * * 2-6 /bin/bash /srv/acilis-zili/current/deploy/cron-portfoy-ozeti.sh
#   37 18 * * 1-5 /bin/bash /srv/acilis-zili/current/deploy/cron-portfoy-ozeti.sh
#
# 05:07 UTC = 08:07 TR (Türkiye yıl boyu UTC+3): normal kapanış yazın 23:20,
# kışın 00:20 TR'de kesinleşiyor, ikisi de gece sessizliğine düşüp ertesi
# sabah 08:00 TR'ye kayıyor; 07:07 UTC aynı sabahın telafisi. 18:37 UTC:
# yarım gün (13:00 ET kapanış, yazın 17:20 kışın 18:20 UTC'de kesin) aynı
# akşam. Öteki koşular "not-due" deyip döner; okur başına hafta anahtarı
# ikinci gönderimi engeller, bu yüzden curl yeniden deneyebilir.
#
# Günlük kaydı sessiz: yalnızca hata ve gönderim yazılıyor
# (cron-alerts.sh ile aynı gerekçe).

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
ENDPOINT=http://127.0.0.1:3000/api/cron/portfoy-ozeti

[[ -r "$ENV_FILE" ]] || { logger -t acilis-portfoy-ozeti -p user.err "ortam dosyasi okunamadi: $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[[ -n "${CRON_SECRET:-}" ]] || { logger -t acilis-portfoy-ozeti -p user.err "CRON_SECRET tanimli degil"; exit 1; }

# Sır argv'de değil, stdin'den — gerekçe deploy/cron-daily.sh.
response=$(curl -sS --max-time 150 --retry 3 --retry-delay 30 --retry-connrefused -w '\n%{http_code}' \
	-H @- \
	"$ENDPOINT" <<<"Authorization: Bearer ${CRON_SECRET}" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" != "200" ]]; then
	logger -t acilis-portfoy-ozeti -p user.err "basarisiz (http ${status}): ${body:0:400}"
	exit 1
fi
if [[ "$body" == *'"delivered":'[1-9]* ]]; then
	logger -t acilis-portfoy-ozeti -p user.info "gonderildi: ${body:0:400}"
fi
