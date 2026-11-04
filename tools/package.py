#!/usr/bin/env python3
"""Package only extension resources; never include local agent/reference files."""
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / 'extension'
version = json.loads((source / 'manifest.json').read_text())['version']
destination = root / 'dist' / f'crunchyroll-best-watchlist-{version}.zip'
destination.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob('*')):
        if path.is_file():
            entry = zipfile.ZipInfo(path.relative_to(source).as_posix(), (2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, path.read_bytes())
print(destination)
