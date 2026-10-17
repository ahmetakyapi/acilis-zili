#!/usr/bin/env bash
#
# Açılış Zili — haber tazeleme ve Türkçeleştirme (17 Ekim).
#
# `/api/cron/haberler` ucunu `CRON_SECRET` ile çağırır; uç piyasa haberlerini
# çekiyor ve çevrilmemiş olanları Claude'la Türkçeleştiriyor
# (app/api/cron/haberler/route.ts). Çeviri tabloda kalıyor; aynı haber ikinci
# kez çevrilmiyor.
#
# Crontab girdisi `deploy/cron-install.sh` ile yazılıyor:
#
#   35 5,11,17 * * * /bin/bash /srv/acilis-zili/current/deploy/cron-news.sh
#
# HER GÜN ÜÇ KEZ: 08:35, 14:35, 20:35 TR — sabah bülteninden önce, ABD
# açılışından önce ve akşam. Hafta sonu da koşuyor (hafta sonu haberleri
# pazartesiye kadar İngilizce kalıyordu). Tekrar zararsız, bu yüzden curl
# yeniden deniyor. Günlük kaydı sessiz: yalnızca hata yazılıyor.

set -uo pipefail

ENV_FILE=/etc/acilis-zili.env
ENDPOINT=http://127.0.0.1:3000/api/cron/haberler

[[ -r "$ENV_FILE" ]] || { logger -t acilis-haber -p user.err "ortam dosyasi okunamadi: $ENV_FILE"; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[[ -n "${CRON_SECRET:-}" ]] || { logger -t acilis-haber -p user.err "CRON_SECRET tanimli degil"; exit 1; }

# Sır argv'de değil, stdin'den — gerekçe deploy/cron-daily.sh.
response=$(curl -sS --max-time 130 --retry 2 --retry-delay 60 --retry-connrefused -w '\n%{http_code}' \
	-H @- \
	"$ENDPOINT" <<<"Authorization: Bearer ${CRON_SECRET}" 2>&1)

status=${response##*$'\n'}
body=${response%$'\n'*}

if [[ "$status" != "200" ]]; then
	logger -t acilis-haber -p user.err "basarisiz (http ${status}): ${body:0:400}"
	exit 1
fi
if [[ "$body" == *'"translate":"hata'* || "$body" == *'"news":"hata'* ]]; then
	logger -t acilis-haber -p user.warning "kismi hata: ${body:0:400}"
fi
