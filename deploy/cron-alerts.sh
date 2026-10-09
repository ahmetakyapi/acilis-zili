#!/usr/bin/env bash
#
# Açılış Zili — fiyat alarmı taraması (9 Ekim).
#
# `/api/cron/alarmlar` ucunu `CRON_SECRET` ile çağırır; uç hedefi geçen
# alarmları işaretleyip abone cihazlara bildirim gönderiyor (lib/alert-sweep.ts).
#
# Crontab girdisi `deploy/cron-install.sh` ile yazılıyor:
#
#   */5 * * * * /bin/bash /srv/acilis-zili/current/deploy/cron-alerts.sh
#
# HER BEŞ DAKİKADA, HER GÜN — bilinçli. Seansın saatleri (ön seans 04:00 ET,
# kapanış sonrası 20:00 ET'ye kadar) yaz saatiyle UTC'de kayıyor ve tatiller
# takvimde; bunu crontab'a yazmak ikinci bir seans saati tutmak olurdu. Uç
# piyasa kapalıyken veritabanına bile gitmeden dönüyor (lib/market-hours.ts
# tek kaynak). Yerel bir curl, beş dakikada bir: maliyeti yok.
#
# Günlük kaydı SESSİZ: her koşumda satır yazmak journald'ı günde 288 satırla
# doldururdu. Yalnızca hata ve tetiklenen alarm yazılıyor.

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
ENDPOINT=http://127.0.0.1:3000/api/cron/alarmlar

[[ -r "$ENV_FILE" ]] || { logger -t acilis-alarm -p user.err "ortam dosyasi okunamadi: $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[[ -n "${CRON_SECRET:-}" ]] || { logger -t acilis-alarm -p user.err "CRON_SECRET tanimli degil"; exit 1; }

response=$(curl -sS --max-time 90 -w '\n%{http_code}' \
	-H "Authorization: Bearer ${CRON_SECRET}" \
	"$ENDPOINT" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" != "200" ]]; then
	logger -t acilis-alarm -p user.err "basarisiz (http ${status}): ${body:0:400}"
	exit 1
fi
if [[ "$body" == *'"triggered":'[1-9]* ]]; then
	logger -t acilis-alarm -p user.info "tetiklendi: ${body:0:400}"
fi
