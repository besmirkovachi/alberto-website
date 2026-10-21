#!/usr/bin/env python3
"""Package the reviewed static website without touching Git or deploying."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT.parent / 'ALBERTO-WEBSITE-V1-MENU-2026.zip'
PAGES = ['index', 'speisekarte', 'ueber-uns', 'galerie', 'feiern', 'bestellen', 'kontakt', 'impressum', 'datenschutz']
FILES = [name + '.html' for name in PAGES] + [
    'style.css', 'premium.css', 'menu-premium.css', 'story-pages.css', 'service-pages.css',
    'script.js', 'motion.js', 'ratings.js', 'ratings.css', 'menu.json', 'package.json', 'package-lock.json', 'robots.txt',
    'README.md', 'LEXO-FILLIMISHT.txt', 'KONTROLLET.md', 'THIRD-PARTY.md',
]
for directory in ['assets', 'templates', 'scripts', 'tests', 'server']:
    FILES.extend(str(p.relative_to(ROOT)) for p in sorted((ROOT / directory).rglob('*'))
                 if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc')

report = json.loads((ROOT / 'tests/delivery-results.json').read_text())
if report['failures'] or report['browserErrors'] or len(report['passed']) < 13:
    raise SystemExit('The final verification report must pass before packaging.')
if not report.get('sourceHashes'):
    raise SystemExit('Run the 2026 verification suite before packaging.')
for name, expected in report['sourceHashes'].items():
    if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != expected:
        raise SystemExit(f'{name} changed after verification. Run the checks again.')

menu = json.loads((ROOT / 'menu.json').read_text())
reference = json.loads((ROOT / 'tests/menu-2026.json').read_text())
menu_entries = sum(len(category['items']) for category in menu)
price_points = sum(len(item.get('variants', [])) or 1
                   for category in menu for item in category['items'])
if menu_entries != reference['row_count'] or price_points != reference['price_count']:
    raise SystemExit('The packaged menu does not match the verified PDF counts.')

manifest = {
    'project': 'Alberto Website V1 — Premium · Menu 2026',
    'base_branch': 'codex/alberto-premium-v1',
    'base_commit': '43749a496c5e66064a33e21137de92f53aaf341a',
    'entry': 'index.html',
    'pages': len(PAGES),
    'menu_entries': menu_entries,
    'menu_price_points': price_points,
    'menu_categories': len(menu),
    'menu_source': reference['source'],
    'menu_source_sha256': reference['source_sha256'],
    'checks_passed': len(report['passed']),
    'checks_skipped': report.get('skipped', []),
    'verified_at': report['completedAt'],
    'published': False,
    'sha256': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in sorted(FILES)},
}
(ROOT / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
with zipfile.ZipFile(ARCHIVE, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in sorted(FILES + ['MANIFEST.json']):
        archive.write(ROOT / name, name)
with zipfile.ZipFile(ARCHIVE) as archive:
    assert archive.testzip() is None, 'Archive CRC failed'
    for name, expected in manifest['sha256'].items():
        assert hashlib.sha256(archive.read(name)).hexdigest() == expected, name
print(json.dumps({'archive': str(ARCHIVE), 'bytes': ARCHIVE.stat().st_size, 'files': len(FILES) + 1, 'pages': len(PAGES), 'verified': True}))
