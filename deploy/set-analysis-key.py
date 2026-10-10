#!/usr/bin/env python3
"""Update only the Claude analysis secret. Read credentials from stdin, never argv."""
import grp
import os
from pathlib import Path
import re
import sys
import tempfile

VARIABLE = "CLAUDE_ANALYSIS_API_KEY"
LINE = re.compile(r"^\s*(?:export\s+)?CLAUDE_ANALYSIS_API_KEY\s*=")


def update_env(path: Path, raw_key: str, *, uid=None, gid=None):
    key = raw_key.strip()
    if not re.fullmatch(r"sk-ant-[A-Za-z0-9_.-]{20,512}", key):
        raise ValueError("Invalid analysis key format")
    if path.is_symlink() or not path.is_file():
        raise ValueError("Environment file must be an existing regular file")
    original = path.stat()
    lines = path.read_text().splitlines()
    updated = []
    inserted = False
    for line in lines:
        if LINE.match(line):
            if not inserted:
                updated.append(f'{VARIABLE}="{key}"')
                inserted = True
        else:
            updated.append(line)
    if not inserted:
        updated.append(f'{VARIABLE}="{key}"')
    fd, temporary = tempfile.mkstemp(prefix=".acilis-env-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as output:
            os.fchmod(output.fileno(), 0o640)
            os.fchown(output.fileno(), original.st_uid if uid is None else uid,
                      original.st_gid if gid is None else gid)
            output.write("\n".join(updated) + "\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    # Verify equality without exposing the value or its hash.
    actual = [line for line in path.read_text().splitlines() if LINE.match(line)]
    if actual != [f'{VARIABLE}="{key}"']:
        raise RuntimeError("Verification failed")


if __name__ == "__main__":
    try:
        if os.geteuid() != 0:
            raise PermissionError("Root required")
        update_env(Path("/etc/acilis-zili.env"), sys.stdin.read(1024),
                   uid=0, gid=grp.getgrnam("acilis").gr_gid)
    except Exception:
        print("Analysis key update failed; credential content was not logged.", file=sys.stderr)
        sys.exit(1)
    print("Analysis key configured and verified; credential content was not logged.")
