#!/usr/bin/env bash
#
# Derleme öncesi disk bekçisi — `update.sh` kaynak olarak okur.
#
# NEDEN (6 Kasım 2026, run 334): deploy derlemenin ortasında "No space left
# on device" ile düştü; Turbopack kendi önbelleğini
# (`releases/<sürüm>/.next/cache/turbopack`) yazamadı. Her sürüm dizini o
# önbelleği derleme sonrasında da taşıyordu ve hiçbir adım silmiyordu:
# derleme anında diskte canlı + önceki sürüm + yeni sürüm, üçü de birkaç
# GB'lık önbellekle. Çalışma anı bu önbelleği OKUMUYOR (yalnız derleme;
# `next start` .next/server ve .next/static'ten çalışır), yani silmek güvenli.
# `.next/cache/images` (görsel optimizasyonu) ve `fetch-cache` (ortak veri
# önbelleği, bağ) çalışma anında kullanılıyor — onlara dokunulmaz.
#
# Kademeler: (1) bütün sürümlerin Turbopack önbelleği silinir; (2) ortak
# veri önbelleğinden BÜYÜK kayıtlar budanır (aşağıda); (3) npm önbelleği
# temizlenir (`npm ci` kilitten yeniden indirir, yalnız yavaşlar); (4) son
# çare üç günden eski bütün veri önbelleği kayıtları; (5) yine yetmiyorsa derlemeye hiç girilmez — neyin yer kapladığı basılıp betik
# anlaşılır bir hatayla durur.
#
# ORTAK VERİ ÖNBELLEĞİ (6 Kasım, run 335 — bekçinin ilk koşusu): Turbopack
# ve npm temizlendikten sonra boş alan yalnız 1.999 MB'a çıktı; diskin asıl
# yükü `shared/fetch-cache` 34 GB, sürüm dizinleri 1,1'er GB. Gece işi
# (cron-install.sh) yalnız 31 günden eski kaydı siliyordu ve tarihli adresler
# (gün başlangıçlı barlar, haber pencereleri) her gün yeni anahtar üretiyor.
# BOYUTA göre budanıyor, yaşa göre değil: en eski kayıtlar 30 günlük Claude
# notları (küçük, onlarca KB) ve onları silmek ücretli yeniden yazım demek;
# yeri dolduranlar büyük sağlayıcı yanıtları. Silinen kayıt yalnız bir
# ıskadır: sağlayıcıya yeniden sorulur, yanlış veri gösterilmez.
# Yarıda kalan derleme hem dakikalar yer hem de "derleme hatası" diye yanlış
# yere baktırıyordu.

# Derleme için gereken en az boş alan (MB). Ölçü: Next 16 + Turbopack
# derlemesi .next'e ~1,5 GB yazıyor, node_modules ~600 MB; iki katı pay.
MIN_FREE_MB="${MIN_FREE_MB:-4096}"

free_mb() {
	df -Pm "$1" | awk 'NR == 2 { print $4 }'
}

# Bütün sürümlerin Turbopack derleme önbelleğini siler. Silinen dizinleri basar.
reclaim_build_cache() {
	local root=$1 dir
	[[ -d "$root/releases" ]] || return 0
	for dir in "$root"/releases/*/.next/cache/turbopack; do
		[[ -d "$dir" ]] || continue
		rm -rf "$dir"
		echo "silindi: $dir"
	done
}

# Ortak veri önbelleğinden büyük kayıtları budar. $2: `recent` ise son
# bir saatte yazılanlara dokunmaz (çalışan sürümün az önce çektiği), `all`
# ise bütün büyük kayıtlar. Küçük kayıtlar (Claude notları) kalır.
prune_fetch_cache() {
	local dir="$1/shared/fetch-cache" age=()
	[[ -d "$dir" ]] || return 0
	if [[ "$2" == old ]]; then
		# Son çare: boyuttan bağımsız, üç günden eski her kayıt (Claude
		# notları dahil — yeniden yazılırlar; derlemenin geçmesi önce gelir).
		find "$dir" -type f -mtime +3 -delete 2>/dev/null || true
		return 0
	fi
	[[ "$2" == recent ]] && age=(-mmin +60)
	find "$dir" -type f -size +"${FETCH_CACHE_BIG_KB:-100}"k "${age[@]}" -delete 2>/dev/null || true
}

# Derlemeden önce yer açar; yetmezse 1 döner (çağıran durur).
ensure_build_space() {
	local root=$1 free pass
	reclaim_build_cache "$root"
	free=$(free_mb "$root")
	echo "boş alan: ${free} MB (gereken ${MIN_FREE_MB} MB)"
	(( free >= MIN_FREE_MB )) && return 0
	for pass in recent all; do
		prune_fetch_cache "$root" "$pass"
		free=$(free_mb "$root")
		echo "veri önbelleğinin büyük kayıtları budandı ($pass), boş alan: ${free} MB"
		(( free >= MIN_FREE_MB )) && return 0
	done
	if command -v npm >/dev/null 2>&1; then
		npm cache clean --force >/dev/null 2>&1 || true
		free=$(free_mb "$root")
		echo "npm önbelleği temizlendi, boş alan: ${free} MB"
		(( free >= MIN_FREE_MB )) && return 0
	fi
	prune_fetch_cache "$root" old
	free=$(free_mb "$root")
	echo "veri önbelleğinin üç günden eski kayıtları budandı, boş alan: ${free} MB"
	(( free >= MIN_FREE_MB )) && return 0
	echo "YER YETMİYOR — en büyükler:" >&2
	du -sh "$root"/releases/* "$root"/shared/* 2>/dev/null | sort -rh | head -n 10 >&2 || true
	return 1
}
