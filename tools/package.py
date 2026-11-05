#!/usr/bin/env python3
"""Build and package independent, reproducible browser artifacts."""
import argparse
import json
import zipfile
from build import ROOT, TARGETS, build, resources

def package(target):
    build(target)
    files = resources(target)
    version = json.loads(files['manifest.json'])['version']
    destination = ROOT / 'dist' / f'crunchyroll-best-watchlist-{target}-{version}.zip'
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            entry = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, data)
    return destination

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', choices=(*TARGETS, 'all'), default='all')
    args = parser.parse_args()
    for target in TARGETS if args.target == 'all' else (args.target,):
        print(package(target))
