"""Safe local report decoding, with a decompression limit."""
import base64
import gzip
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from decode_report import decode_report

class ReportTests(unittest.TestCase):
    def test_unicode(self):
        text = 'Français / 日本語 / 😄'
        value = 'BWL1:GZIP:' + base64.b64encode(gzip.compress(text.encode())).decode()
        self.assertEqual(decode_report(value), text)

    def test_reject_invalid_input(self):
        for value in ('', 'https://example.com', 'BWL1:GZIP:@@@', 'BWL1:GZIP:aGVsbG8='):
            with self.assertRaises((ValueError, OSError, EOFError)):
                decode_report(value)

    def test_decompressed_limit(self):
        value = 'BWL1:GZIP:' + base64.b64encode(gzip.compress(b'x' * 2_000_001)).decode()
        with self.assertRaises(ValueError):
            decode_report(value)
