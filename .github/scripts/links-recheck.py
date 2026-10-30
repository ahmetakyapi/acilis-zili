#!/usr/bin/env python3
"""Lychee raporundaki hataları curl ile bir kez daha dener, açılanları eler.

NEDEN VAR (30 Ekim, issue #28): ilk raporun 86 hatasının 77'si Yahoo
Finance'in (ve bir kez Nasdaq'ın) "HTTP/2 protocol error"ıydı; aynı adresler
tarayıcıda ve curl'de 200 dönüyor. Lychee'nin HTTP/1.1'e zorlama ayarı yok,
Yahoo'yu dışlamak da oradaki GERÇEK 404'leri (raporda altı tane) gizlerdi.
Bu yüzden lychee'nin hata saydığı her adres, tarayıcı kimliğiyle ve HTTP/1.1
ile bir kez daha soruluyor; yalnız yine düşenler issue'ya yazılıyor.

Kullanım: links-recheck.py <lychee/out.md> <rapor.md>
Kalan kırık bağlantı sayısını stdout'a basar (iş akışı issue'yu buna göre
açar ya da kapatır).
"""
import re
import subprocess
import sys
from pathlib import Path

# Lychee'nin `--accept` listesiyle aynı: bot kapısı ve ödeme duvarı kırık
# sayılmaz (gerekçe .github/workflows/links.yml).
ACCEPT = set(range(200, 300)) | {401, 402, 403, 429}
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)
TIMEOUT_SECONDS = "30"

PAGE = re.compile(r"^### Errors in (\S+)")
ERROR = re.compile(r"^\* \[([^\]]+)\] <([^>]+)>(?: \(at [^)]*\))?(?: \| (.*))?$")


def parse(report: str):
    """[(sayfa, [(kod, adres, mesaj), ...]), ...] — sayfa sırası korunur."""
    pages = []
    for line in report.splitlines():
        page = PAGE.match(line)
        if page:
            pages.append((page.group(1), []))
            continue
        error = ERROR.match(line)
        if error and pages:
            pages[-1][1].append((error.group(1), error.group(2), error.group(3) or ""))
    return pages


def curl_status(url: str) -> int:
    """Yönlendirmeleri izleyerek son durum kodu; ağ hatasında 0."""
    result = subprocess.run(
        [
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "--http1.1", "-L", "--max-time", TIMEOUT_SECONDS,
            "-A", USER_AGENT, "-H", "Accept: text/html", url,
        ],
        capture_output=True,
        text=True,
    )
    try:
        return int(result.stdout.strip() or 0)
    except ValueError:
        return 0


def recheck(report: str, status=curl_status):
    """(kalan_sayı, yeni_rapor). Aynı adres birden çok sayfada geçse de bir kez sorulur."""
    pages = parse(report)
    seen = {}
    total = 0
    kept_pages = []
    for page, errors in pages:
        kept = []
        for code, url, message in errors:
            total += 1
            if url not in seen:
                seen[url] = status(url)
            if seen[url] not in ACCEPT:
                kept.append((code, url, message))
        if kept:
            kept_pages.append((page, kept))

    remaining = sum(len(errors) for _, errors in kept_pages)
    lines = [
        f"Lychee {total} hata saydı; curl ile tekrar denemede "
        f"{total - remaining} tanesi açıldı (çoğu Yahoo'nun HTTP/2 hatası). "
        f"Kalan {remaining} bağlantı gerçekten kırık.",
        "",
        "Mercek kaynakları veritabanında (`stories.sources`): ölü bağlantı "
        "arşiv kopyasıyla (web.archive.org) değiştirilir, kopya yoksa adres "
        "kaldırılıp etiket bırakılır.",
    ]
    for page, errors in kept_pages:
        lines += ["", f"### {page}", ""]
        for code, url, message in errors:
            lines.append(f"* [{code}] <{url}>" + (f" | {message}" if message else ""))
    footer = [line for line in report.splitlines() if line.startswith("[Full Github Actions output]")]
    if footer:
        lines += ["", footer[-1]]
    return remaining, "\n".join(lines) + "\n"


def main():
    source, target = Path(sys.argv[1]), Path(sys.argv[2])
    report = source.read_text() if source.exists() else ""
    remaining, body = recheck(report)
    target.write_text(body)
    print(remaining)


if __name__ == "__main__":
    main()
