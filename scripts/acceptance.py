"""Run reproducible local acceptance. Never sends email or charges a payment."""
import argparse, datetime, json, os, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('--output', required=True, help='Report directory outside source repository')
p.add_argument('--require-database', action='store_true', help='Fail if real database tests are unavailable or skipped')
a = p.parse_args()
out = Path(a.output).resolve()
if out == ROOT or ROOT in out.parents:
    p.error('Report directory must be outside repository')
out.mkdir(parents=True, exist_ok=True)
results = []
def run(name, command, cwd=ROOT, timeout=600):
    log = out / (name + '.log')
    try:
        with log.open('w') as stream:
            result = subprocess.run(command, cwd=cwd, stdout=stream, stderr=subprocess.STDOUT, timeout=timeout, env={**os.environ, 'NO_COLOR':'1'})
        item = {'check':name, 'status':'PASSED' if result.returncode == 0 else 'FAILED', 'log':log.name}
    except (OSError, subprocess.TimeoutExpired):
        item = {'check':name, 'status':'FAILED', 'log':log.name, 'reason':'Command unavailable or timed out'}
    results.append(item)
    print(name + ': ' + item['status'], flush=True)
    return item, log
# Dependencies must be installed first. No production Mongo URI fallback is allowed.
server, log = run('server-tests', ['npm','test'], ROOT/'server')
text = log.read_text(errors='replace')
counts = {}
for key in ['tests','pass','fail','skipped']:
    matches = re.findall(r'(?:#|ℹ)\s*' + key + r'\s+(\d+)', text)
    if matches: counts[key] = int(matches[-1])
server['counts'] = counts
run('frontend-build', ['npm','run','build'], ROOT/'client')
run('layout-render', ['node','scripts/layout-smoke.mjs'])
run('source-package', [sys.executable,'scripts/package-release.py','--output',str(out/'UG-SaaS-ERP.zip')])
db_passed = server['status'] == 'PASSED' and bool(os.environ.get('TEST_MONGODB_URI')) and counts.get('skipped') == 0 and counts.get('tests',0) > 0
results.append({'check':'real-database-tests','status':'PASSED' if db_passed else 'PENDING','reason':'See server test results; real acceptance requires a disposable replica set and no skipped tests'})
manual = ['email-delivery','razorpay-capture-failure-refund','logged-in-browser-mobile','offline-device-reconnect','backup-restore','invoice-gst-review','physical-qr-print','full-order-reconciliation','statutory-payroll-review']
report = {'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'checks':results,
          'manualAcceptance':[{'check':x,'status':'PENDING'} for x in manual],
          'localChecksPassed':all(x['status']=='PASSED' for x in results if x['check']!='real-database-tests'),
          'productionReady':False,
          'note':'This runner does not certify live integrations or physical-device acceptance. Logs may include database errors: keep reports private.'}
(out/'acceptance.json').write_text(json.dumps(report,indent=2)+'\n')
failed = not report['localChecksPassed'] or (a.require_database and not db_passed)
print('Report: acceptance.json; production acceptance remains pending', flush=True)
sys.exit(1 if failed else 0)
