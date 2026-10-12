"""Verify release source hashes and create a source-only ZIP. No credentials included."""
import argparse, hashlib, json, re, zipfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args()
manifest = json.loads((root / 'RELEASE-MANIFEST.json').read_text())
files = []
for entry in manifest['files']:
    relative = Path(entry['path'])
    if relative.is_absolute() or '..' in relative.parts:
        raise SystemExit('Unsafe manifest path')
    if any(x in relative.parts for x in ('.git', 'node_modules', 'dist', 'backups')):
        raise SystemExit('Non-source path in release manifest')
    if relative.name.startswith('.env') and relative.name != '.env.example':
        raise SystemExit('Private environment file in release manifest')
    path = root / relative
    if path.is_symlink() or not path.is_file():
        raise SystemExit('Missing or linked source: ' + str(relative))
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise SystemExit('Source hash mismatch: ' + str(relative))
    if re.search(rb'(?m)^(<<<<<<< |=======\s*$|>>>>>>> )', data):
        raise SystemExit('Merge conflict marker: ' + str(relative))
    files.append((relative, path))
output = Path(args.output).resolve()
if output == root or root in output.parents:
    raise SystemExit('Write ZIP outside source repository')
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for relative, path in files:
        archive.write(path, 'UG-SaaS-ERP/' + relative.as_posix())
    archive.write(root / 'RELEASE-MANIFEST.json', 'UG-SaaS-ERP/RELEASE-MANIFEST.json')
with zipfile.ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Archive integrity failed')
print(json.dumps({'sourceFiles': len(files), 'zipBytes': output.stat().st_size,
                  'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                  'archiveIntegrity': 'PASSED'}))
