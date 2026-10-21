#!/usr/bin/env bash
#
# Açılış Zili — uygulama kullanıcısının crontab'ını tamamlar (9 Ekim).
#
# update.sh her sürümde YENİ sürümün kopyasıyla çağırıyor; eksik satırı
# ekliyor, var olanlara dokunmuyor. bootstrap.sh crontab'ı ilk kurulumda
# baştan yazıyordu (`crontab -`, eskisini siler) ve tek satırlıktı: ikinci
# bir iş eklemek ya sunucuya elle girmek ya da bootstrap'ı yeniden koşmak
# demekti. Artık satırların listesi burada ve dağıtım onu kendisi uyguluyor.
#
# `bash` öneki: depoda exec biti güvenilir değil (bkz. bootstrap.sh).

set -euo pipefail

APP_ROOT=/srv/acilis-zili
LINES=(
	"30 10 * * 1-5 /bin/bash $APP_ROOT/current/deploy/cron-daily.sh"
	"*/5 * * * * /bin/bash $APP_ROOT/current/deploy/cron-alerts.sh"
	"20 16 * * * /bin/bash $APP_ROOT/current/deploy/cron-bilanco.sh"
	"0 7-11 * * 0 /bin/bash $APP_ROOT/current/deploy/cron-weekly-mail.sh"
	# Pazar özetinin telafisi: pazar bütçeye takılanlar (20 Ekim — gerekçe
	# app/api/cron/haftalik-posta/route.ts). Alarm taraması ön seansla
	# (08:00 UTC'den sonra) başlamadan önce.
	"0 7 * * 1 /bin/bash $APP_ROOT/current/deploy/cron-weekly-mail.sh"
	"35 5,11,17 * * * /bin/bash $APP_ROOT/current/deploy/cron-news.sh"
	# Ortak veri önbelleğinin budaması (20 Ekim — gerekçe update.sh). Next
	# diskteki kaydı hiç silmiyor; sürüm dizinleri budanırken önbellek de
	# gidiyordu, ortak dizinde biriken tarihli adresler (gün başlangıçlı
	# barlar, haber pencereleri) artık kendiliğinden gitmiyor. Kayıt her
	# tazelemede yeniden yazılıyor, yani mtime son yazım; 31 gün en uzun
	# `revalidate`in (30 gün: haber ve veri notu, TCMB arşivi) ötesi — daha
	# kısası taze notu silip fazladan Claude çağrısı yaptırır.
	"50 4 * * * /usr/bin/find $APP_ROOT/shared/fetch-cache -type f -mtime +31 -delete"
)
# EMEKLİ SATIRLAR — saati değişen iş eski satırıyla kalmasın. Ekleme
# yalnız eksik satırı yazıyordu; pazartesi özeti pazara taşınınca (17 Ekim)
# eski satır crontab'da kalır ve pazartesi de uç çağrılırdı (uç "not-sunday"
# deyip dönerdi ama günlükte gürültü). Buradakiler her sürümde silinir.
RETIRED=(
	"15 11-15 * * 1 /bin/bash $APP_ROOT/current/deploy/cron-weekly-mail.sh"
)

# SUNUCU UTC OLMALI. Ubuntu 24.04'ün cron'u (Debian vixie-cron) `CRON_TZ`yi
# DESTEKLEMİYOR — satır işe ortam değişkeni olarak geçiyor, çalışma saatini
# değiştirmiyor (crontab(5): "does not support per-user timezones"). Saati
# UTC tutan şey sunucunun kendi saat dilimi; biri onu İstanbul'a çevirirse
# günlük iş ABD açılışından önce koşar. Her sürümde denetlenir, update.sh bu
# çıktıyı basar (16 Ekim).
if [[ $(date +%z) != "+0000" ]]; then
	echo "UYARI: sunucu saat dilimi $(date +%Z) ($(date +%z)) — cron saatleri UTC değil. Düzelt: sudo timedatectl set-timezone Etc/UTC && sudo systemctl restart cron" >&2
	logger -t acilis-cron -p user.warning "sunucu saat dilimi UTC degil: $(date +%Z)"
fi

current=$(crontab -l 2>/dev/null || true)
next="$current"
# `CRON_TZ=UTC` cronie'de (ve başka dağıtımda) saati UTC'ye sabitler;
# Debian/Ubuntu cron'unda etkisiz, orada güvence yukarıdaki saat dilimi
# denetimi. Zararsız, kalıyor.
if ! grep -qxF "CRON_TZ=UTC" <<<"$next"; then
	next=$(printf 'CRON_TZ=UTC\n%s' "$next")
fi
for line in "${RETIRED[@]}"; do
	next=$(grep -vxF "$line" <<<"$next" || true)
done
for line in "${LINES[@]}"; do
	grep -qxF "$line" <<<"$next" || next=$(printf '%s\n%s' "$next" "$line")
done

if [[ "$next" != "$current" ]]; then
	printf '%s\n' "$next" | sed '/^$/d' | crontab -
	echo "crontab güncellendi"
else
	echo "crontab güncel"
fi
