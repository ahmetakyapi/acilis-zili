#!/usr/bin/env bash
#
# Açılış Zili — günlük senkron tetikleyicisi.
#
# Vercel Cron'un yaptığı işin aynısı: `/api/cron/daily` ucunu `CRON_SECRET`
# ile çağırmak. Uç kendi bütçesini kendi yönetiyor (100 saniye, dolarsa kalan
# adımları atlayıp raporluyor) — burada yapılacak tek şey onu tetiklemek ve
# sonucu görünür bir yere yazmak.
#
# Crontab girdisi (sudo -u acilis crontab -e):
#
#   CRON_TZ=UTC
#   30 10 * * 1-5 /srv/acilis-zili/deploy/cron-daily.sh
#
# `CRON_TZ=UTC` ŞART. `vercel.json` içindeki `30 10 * * 1-5` ifadesi UTC'dir;
# sistem crontab'ı ise sunucunun YEREL saatini kullanır. Sunucu İstanbul'a
# ayarlıysa aynı satır işi üç saat erken çalıştırır — yani ABD piyasası
# açılmadan, o günün bilanço sonuçları daha yokken.

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
ENDPOINT=http://127.0.0.1:3000/api/cron/daily

if [[ ! -r "$ENV_FILE" ]]; then
	logger -t acilis-cron -p user.err "ortam dosyasi okunamadi: $ENV_FILE"
	exit 1
fi

# Değerler tırnaklı yazılmalı: DATABASE_URL içinde `&` ve `?` var ve
# tırnaksız bir satır kabukta komutu arka plana atar.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [[ -z "${CRON_SECRET:-}" ]]; then
	logger -t acilis-cron -p user.err "CRON_SECRET tanimli degil - uc 503 dondurur"
	exit 1
fi

# --max-time, ucun 100 saniyelik bütçesinin üstünde bir pay bırakıyor.
response=$(curl -sS --max-time 180 -w '\n%{http_code}' \
	-H "Authorization: Bearer ${CRON_SECRET}" \
	"$ENDPOINT" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" == "200" ]]; then
	logger -t acilis-cron -p user.info "ok: ${body:0:800}"
else
	logger -t acilis-cron -p user.err "basarisiz (http ${status}): ${body:0:800}"
	exit 1
fi
