#!/usr/bin/env bash
#
# Açılış Zili — Risk Masası kuralları (25 Ekim).
#
# `/api/cron/risk` ucunu `CRON_SECRET` ile çağırır; uç kullanıcıların risk
# kurallarını son tamamlanmış seansın masasıyla değerlendirir, yanlıştan
# doğruya dönen kural için uyarı yazar ve Web Push gönderir
# (app/api/cron/risk/route.ts).
#
# Crontab girdileri `deploy/cron-install.sh` ile yazılıyor:
#
#   40 21 * * 1-5 /bin/bash /srv/acilis-zili/current/deploy/cron-risk.sh
#   15 11 * * 2-6 /bin/bash /srv/acilis-zili/current/deploy/cron-risk.sh
#
# 21:40 UTC: ABD kapanışından sonra (yazın 17:40, kışın 16:40 ET) — gün
# barları ve Cboe VIX gelmiş. 11:15 UTC ertesi sabah: FRED'in bir gün
# geciken serileri (VXN, VIX3M, kredi farkı) gelmiş, ABD açılışından önce.
# İki koşu aynı seansı değerlendirir; uç tekrar koşuya dayanıklı (kural +
# seans başına tek uyarı), bu yüzden curl yeniden deniyor.
#
# Günlük kaydı sessiz: yalnızca hata ve gönderim yazılıyor
# (cron-alerts.sh ile aynı gerekçe).

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
ENDPOINT=http://127.0.0.1:3000/api/cron/risk

[[ -r "$ENV_FILE" ]] || { logger -t acilis-risk -p user.err "ortam dosyasi okunamadi: $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[[ -n "${CRON_SECRET:-}" ]] || { logger -t acilis-risk -p user.err "CRON_SECRET tanimli degil"; exit 1; }

# Sır argv'de değil, stdin'den — gerekçe deploy/cron-daily.sh.
response=$(curl -sS --max-time 150 --retry 3 --retry-delay 30 --retry-connrefused -w '\n%{http_code}' \
	-H @- \
	"$ENDPOINT" <<<"Authorization: Bearer ${CRON_SECRET}" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" != "200" ]]; then
	logger -t acilis-risk -p user.err "basarisiz (http ${status}): ${body:0:400}"
	exit 1
fi
if [[ "$body" == *'"delivered":'[1-9]* ]]; then
	logger -t acilis-risk -p user.info "gonderildi: ${body:0:400}"
fi
