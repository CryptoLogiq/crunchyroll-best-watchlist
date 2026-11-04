#!/usr/bin/env python3
"""Dependency-free manifest checks and browser tests in an isolated profile."""
import functools
import http.server
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'extension/manifest.json').read_text())
assert manifest['manifest_version'] == 3
assert manifest['permissions'] == ['storage']
for entry in manifest['content_scripts']:
    for script in entry['js']:
        assert (ROOT / 'extension' / script).is_file(), script

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

handler = functools.partial(QuietHandler, directory=str(ROOT))
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
browser = shutil.which('chromium') or shutil.which('google-chrome')
if not browser:
    raise SystemExit('Chromium or Google Chrome is required for browser tests.')
try:
    with tempfile.TemporaryDirectory(prefix='bwl-tests-') as profile:
        result = subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
            '--disable-background-networking', '--user-data-dir=' + profile, '--dump-dom',
            '--virtual-time-budget=10000', f'http://127.0.0.1:{server.server_port}/tests/browser.html'],
            capture_output=True, text=True, timeout=45)
        start = result.stdout.find('<pre id="results">')
        end = result.stdout.find('</pre>', start)
        report = result.stdout[start + len('<pre id="results">'):end] if start >= 0 else ''
        print(report or result.stderr[-3000:])
        if result.returncode or not report.startswith('PASSED'):
            raise SystemExit(1)
finally:
    server.shutdown()
