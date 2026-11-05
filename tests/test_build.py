"""Packaging boundaries, isolation and reproducibility, without dependencies."""
import hashlib
import json
from pathlib import Path
import sys
import unittest
import zipfile

TOOLS = Path(__file__).resolve().parents[1] / 'tools'
sys.path.insert(0, str(TOOLS))
from build import merge, resources
from package import package

class BuildTests(unittest.TestCase):
    def test_target_isolation(self):
        chrome = resources('chromium')
        firefox = resources('firefox')
        self.assertNotIn('browser_specific_settings', json.loads(chrome['manifest.json']))
        self.assertIn('browser_specific_settings', json.loads(firefox['manifest.json']))
        for name in chrome.keys() - {'manifest.json'}:
            self.assertEqual(chrome[name], firefox[name], name)
        self.assertEqual(chrome, resources('chromium'))

    def test_nested_merge_does_not_mutate_base(self):
        base = {'action': {'default_popup': 'popup.html'}}
        result = merge(base, {'action': {'default_title': 'Firefox'}})
        self.assertEqual(result['action']['default_popup'], 'popup.html')
        self.assertNotIn('default_title', base['action'])

    def test_reproducible_clean_archives(self):
        for target in ('firefox', 'chromium'):
            first = package(target)
            digest = hashlib.sha256(first.read_bytes()).digest()
            self.assertEqual(digest, hashlib.sha256(package(target).read_bytes()).digest())
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(set(archive.namelist()), set(resources(target)))
                self.assertIn('manifest.json', archive.namelist())
                self.assertFalse(any('ignored' in n or n.endswith('.pem') for n in archive.namelist()))
            other = 'chromium' if target == 'firefox' else 'firefox'
            package(other)
            self.assertEqual(digest, hashlib.sha256(first.read_bytes()).digest())

if __name__ == '__main__':
    unittest.main()
