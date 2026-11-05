#!/usr/bin/env python3
"""Decode a BWL1:GZIP report locally. Never executes report content."""
import argparse
import base64
import gzip
import io
from pathlib import Path
import sys

MAX_BYTES = 2_000_000

def decode_report(value):
    value = value.strip()
    prefix = 'BWL1:GZIP:'
    if not value.startswith(prefix) or len(value) > 3_000_000:
        raise ValueError('Invalid report format or size')
    compressed = base64.b64decode(value[len(prefix):], validate=True)
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
        raw = stream.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError('Report exceeds 2 MB')
    return raw.decode('utf-8')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', nargs='?', help='Encoded report file; stdin if omitted')
    args = parser.parse_args()
    try:
        if args.file:
            with Path(args.file).open() as stream:
                value = stream.read(3_000_001)
        else:
            value = sys.stdin.read(3_000_001)
        print(decode_report(value))
    except (ValueError, OSError, EOFError) as error:
        parser.exit(1, f'Cannot decode report: {error}\n')
