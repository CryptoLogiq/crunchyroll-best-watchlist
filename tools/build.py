#!/usr/bin/env python3
"""Build isolated browser targets from common resources and explicit overlays."""
import argparse
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
TARGETS = ('chromium', 'firefox')
# Deliberate allowlist: no local keys, reference sources or test files.
FILES = ('popup.html', 'THIRD_PARTY.md', 'src', 'vendor')

def merge(base, patch):
    result = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge(result[key], value)
        else:
            result[key] = value
    return result

def resources(target):
    if target not in TARGETS:
        raise ValueError('Unknown browser target: ' + target)
    source = ROOT / 'extension'
    result = {}
    for name in FILES:
        path = source / name
        paths = sorted(path.rglob('*')) if path.is_dir() else [path]
        for item in paths:
            if item.is_symlink():
                raise ValueError('Symlinks are not packaged: ' + str(item))
            if item.is_file():
                if item.suffix not in ('.js', '.html', '.md') and item.name != 'WATCHROLL-LICENSE':
                    raise ValueError('Unexpected resource: ' + str(item))
                result[item.relative_to(source).as_posix()] = item.read_bytes()
    overlay = ROOT / 'browsers' / target
    extra = overlay / 'files'
    if extra.exists():
        for item in sorted(extra.rglob('*')):
            if item.is_symlink():
                raise ValueError('Symlinks are not packaged: ' + str(item))
            if item.is_file():
                name = item.relative_to(extra).as_posix()
                if name in result or name == 'manifest.json':
                    raise ValueError('Overlay cannot replace common files: ' + name)
                if item.suffix not in ('.js', '.css', '.html', '.png', '.svg'):
                    raise ValueError('Unexpected overlay resource: ' + name)
                result[name] = item.read_bytes()
    manifest = merge(json.loads((source / 'manifest.json').read_text()),
                     json.loads((overlay / 'manifest.json').read_text()))
    result['manifest.json'] = (json.dumps(manifest, indent=2, ensure_ascii=False) + '\n').encode()
    validate(target, result)
    return result

def validate(target, files):
    manifest = json.loads(files['manifest.json'])
    assert manifest['manifest_version'] == 3
    assert manifest['permissions'] == ['storage']
    assert 'host_permissions' not in manifest
    for entry in manifest['content_scripts']:
        assert entry['matches'] == ['https://*.crunchyroll.com/*']
        for name in entry['js']:
            assert name in files, name
    assert manifest['action']['default_popup'] in files
    assert 'vendor/WATCHROLL-LICENSE' in files
    if target == 'chromium':
        assert 'browser_specific_settings' not in manifest
    else:
        assert manifest['browser_specific_settings']['gecko']['id']

def build(target):
    files = resources(target)  # Validate before replacing previous output.
    destination = ROOT / 'dist' / target
    if destination.is_symlink():
        raise ValueError('Refusing symlink output directory')
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    for name, data in files.items():
        path = destination / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return destination

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', choices=(*TARGETS, 'all'), default='all')
    args = parser.parse_args()
    for target in TARGETS if args.target == 'all' else (args.target,):
        print(build(target))
