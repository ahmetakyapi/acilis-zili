#!/usr/bin/env bash
#
# Açılış Zili — "bilanço yarın" hatırlatması (15 Ekim).
#
# `/api/cron/bilanco` ucunu `CRON_SECRET` ile çağırır; uç, tercihi açan
# hesaplara takip listelerindeki şirketlerden YARIN bilanço açıklayacak
# olanları tek bildirimde gönderiyor (app/api/cron/bilanco/route.ts).
#
# Crontab girdisi `deploy/cron-install.sh` ile yazılıyor:
#
#   20 16 * * * /bin/bash /srv/acilis-zili/current/deploy/cron-bilanco.sh
#
# GÜNDE BİR, HER GÜN. Uç tekrar denemeye dayanıklı (son 12 saatte bildirim
# almış hesabı atlıyor — gerekçe uçta), bu yüzden curl yeniden deniyor:
# 16:20'de denk gelen bir sürüm servisi birkaç saniye kapatıyor ya da Neon
# o an düşüyordu ve o günün hatırlatmaları tamamen kayboluyordu. 16:20 UTC = 19:20 TR: akşam, ertesi günün açılış öncesi bilançosu
# için de erken değil geç değil; Türkiye UTC+3'te sabit, saat yaz/kış
# kaymaz. Bilanço yarın yoksa (hafta sonu, tatil) uç boş döner.
#
# Günlük kaydı sessiz: yalnızca hata ve gönderim yazılıyor
# (cron-alerts.sh ile aynı gerekçe).

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
ENDPOINT=http://127.0.0.1:3000/api/cron/bilanco

[[ -r "$ENV_FILE" ]] || { logger -t acilis-bilanco -p user.err "ortam dosyasi okunamadi: $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[[ -n "${CRON_SECRET:-}" ]] || { logger -t acilis-bilanco -p user.err "CRON_SECRET tanimli degil"; exit 1; }

# Sır argv'de değil, stdin'den — gerekçe deploy/cron-daily.sh.
response=$(curl -sS --max-time 90 --retry 4 --retry-delay 30 --retry-connrefused -w '\n%{http_code}' \
	-H @- \
	"$ENDPOINT" <<<"Authorization: Bearer ${CRON_SECRET}" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" != "200" ]]; then
	logger -t acilis-bilanco -p user.err "basarisiz (http ${status}): ${body:0:400}"
	exit 1
fi
if [[ "$body" == *'"delivered":'[1-9]* ]]; then
	logger -t acilis-bilanco -p user.info "gonderildi: ${body:0:400}"
fi
