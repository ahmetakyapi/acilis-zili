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
# Kademeler: (1) bütün sürümlerin Turbopack önbelleği silinir; (2) boş alan
# hâlâ `MIN_FREE_MB` altındaysa npm önbelleği temizlenir (`npm ci` kilitten
# yeniden indirir, yalnız yavaşlar); (3) yine yetmiyorsa derlemeye hiç
# girilmez — neyin yer kapladığı basılıp betik anlaşılır bir hatayla durur.
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

# Derlemeden önce yer açar; yetmezse 1 döner (çağıran durur).
ensure_build_space() {
	local root=$1 free
	reclaim_build_cache "$root"
	free=$(free_mb "$root")
	echo "boş alan: ${free} MB (gereken ${MIN_FREE_MB} MB)"
	(( free >= MIN_FREE_MB )) && return 0
	if command -v npm >/dev/null 2>&1; then
		npm cache clean --force >/dev/null 2>&1 || true
		free=$(free_mb "$root")
		echo "npm önbelleği temizlendi, boş alan: ${free} MB"
		(( free >= MIN_FREE_MB )) && return 0
	fi
	echo "YER YETMİYOR — en büyükler:" >&2
	du -sh "$root"/releases/* "$root"/shared/* 2>/dev/null | sort -rh | head -n 10 >&2 || true
	return 1
}
