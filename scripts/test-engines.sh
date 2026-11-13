#!/bin/bash
# Test remaining engines on existing project
set -e
BASE="http://localhost:3000"
PID="cmwfehwvu0005meyrcvydyo3l"

t() {
  echo "=== $1 ==="
  shift
  curl -s "$@" > /tmp/eng.json
  python3 - <<'EOF'
import json
d = json.load(open('/tmp/eng.json'))
if 'error' in d:
    print('ERROR:', d['error'][:200])
else:
    p = d.get('payload', {})
    keys = list(p.keys())
    print('OK keys:', keys[:8])
    if 'criteria' in p: print('criteria:', len(p['criteria']))
    if 'issues' in p: print('issues:', len(p['issues']))
    if 'findings' in p: print('findings:', len(p.get('findings', [])))
    if 'reviewers' in p: print('reviewers:', len(p['reviewers']), '| synthesis:', bool(p.get('synthesis')))
    if 'readinessScore' in p: print('readiness:', p['readinessScore'], '| rec:', p.get('recommendation'))
    if 'reportA' in p: print('reportA general:', (p['reportA'].get('generalAssessment') or '')[:80])
    if 'reportB' in p: print('reportB decision:', p['reportB'].get('suggestedDecision'))
    if 'references' in p:
        refs = p['references']
        print('refs found:', p.get('totalFound'), 'verified:', sum(1 for r in refs if r.get('check',{}).get('status')=='verified'))
EOF
}

echo "--- set target journal ---"
curl -s -X PATCH "$BASE/api/projects/$PID" -H 'Content-Type: application/json' -d '{"targetJournal":"BMC Nephrology"}' -o /dev/null -w "patch=%{http_code}\n"

t "STATS AUDIT" -X POST "$BASE/api/projects/$PID/review" -H 'Content-Type: application/json' -d '{"engine":"stats"}'
t "REFERENCES" -X POST "$BASE/api/projects/$PID/references"
t "JOURNAL" -X POST "$BASE/api/projects/$PID/review" -H 'Content-Type: application/json' -d '{"engine":"journal"}'
t "REVIEWERS" -X POST "$BASE/api/projects/$PID/review" -H 'Content-Type: application/json' -d '{"engine":"reviewers"}'
t "REPORTS" -X POST "$BASE/api/projects/$PID/review" -H 'Content-Type: application/json' -d '{"engine":"reports"}'
echo "=== REVISIONS GENERATE ==="
curl -s -X POST "$BASE/api/projects/$PID/revisions" -H 'Content-Type: application/json' -d '{"action":"generate"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('revisions:', len(d.get('revisions', [])) if 'revisions' in d else d.get('error'))"
echo "=== RESPONSE LETTER ==="
curl -s -X POST "$BASE/api/projects/$PID/response-letter" -H 'Content-Type: application/json' -d '{}' | python3 -c "import sys,json; d=json.load(sys.stdin); p=d.get('payload',{}); print('responses:', len(p.get('responses', [])) if 'responses' in p else d.get('error'), '| note:', (p.get('meta',{}).get('honestyNote') or '')[:80] if p else '')"
echo "=== EXPORTS ==="
curl -s -o /tmp/r1.docx -w "docx-full=%{http_code}/%{size_download}B\n" "$BASE/api/projects/$PID/export?report=full"
curl -s -o /tmp/r2.docx -w "docx-authors=%{http_code}/%{size_download}B\n" "$BASE/api/projects/$PID/export?report=authors"
curl -s -o /tmp/r3.docx -w "docx-editor=%{http_code}/%{size_download}B\n" "$BASE/api/projects/$PID/export?report=editor"
curl -s -o /tmp/r4.docx -w "docx-letter=%{http_code}/%{size_download}B\n" "$BASE/api/projects/$PID/export?report=response_letter"
curl -s "$BASE/api/projects/$PID/print?report=authors" -o /tmp/p1.html -w "print-authors=%{http_code}/%{size_download}B\n"
echo "ALL ENGINES DONE"
