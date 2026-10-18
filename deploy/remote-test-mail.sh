#!/usr/bin/env bash
#
# Açılış Zili — pazar özetinin DENEME gönderimi (17 Ekim).
# Uygulama kullanıcısı olarak çalışır; adres tek argüman:
#
#   sudo -u acilis -H bash -s -- <adres> < deploy/remote-test-mail.sh
#
# Yerel uca (`/api/cron/haftalik-posta?deneme=`) CRON_SECRET ile istek atar:
# posta yalnız o adrese, gerçek veri ve Claude yorumuyla, "[Deneme]"
# önekiyle gider (gerekçe uçta). Sır argv'de değil stdin'de; yanıtın
# gövdesi basılır, sır ve adres basılmaz.

set -euo pipefail
ADDRESS="${1:-}"
# İkinci argüman tür (18 Ekim): `deneme` (varsayılan, "[Deneme]" önekli) ya
# da `yeniden` — adresi sonradan düzeltilen üyeye gerçek posta, haftada bir.
KIND="${2:-deneme}"
[[ "$ADDRESS" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || { echo "geçersiz adres" >&2; exit 1; }
[[ "$KIND" == "deneme" || "$KIND" == "yeniden" ]] || { echo "geçersiz tür" >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. /etc/acilis-zili.env
set +a
[[ -n "${CRON_SECRET:-}" ]] || { echo "CRON_SECRET tanımlı değil" >&2; exit 1; }

response=$(curl -sS --max-time 290 -w '\n%{http_code}' -G \
	--data-urlencode "${KIND}=${ADDRESS}" \
	-H @- \
	"http://127.0.0.1:3000/api/cron/haftalik-posta" <<<"Authorization: Bearer ${CRON_SECRET}")
status=${response##*$'\n'}
body=${response%$'\n'*}
echo "http ${status}: ${body:0:600}"
[[ "$status" == "200" ]] || exit 1
[[ "$body" == *'"sent":1'* ]] || { echo "UYARI: posta gönderilmedi (adres kayıtlı bir üyeye ait mi, pazar özeti açık mı?)"; exit 1; }
