#!/bin/bash
# End-to-end smoke test for ResearchMate AI
set -e
BASE="http://localhost:3000"

echo "=== 1) Create project (upload) ==="
CREATE=$(curl -s -X POST "$BASE/api/projects" \
  -F "title=تأثیر آموزش خودمراقبتی بر کیفیت زندگی بیماران همودیالیزی" \
  -F "reviewKind=proposal" \
  -F "files=@/home/z/my-project/scripts/sample-proposal.txt;type=text/plain")
echo "$CREATE" | head -c 600; echo
PID=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['project']['id'])")
echo "PROJECT_ID=$PID"

echo "=== 2) AI classification ==="
curl -s -X POST "$BASE/api/projects/$PID/classify" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('classification') or d)"

echo "=== 3) Proposal review (AI, may take a while) ==="
curl -s -X POST "$BASE/api/projects/$PID/review" -H 'Content-Type: application/json' -d '{"engine":"proposal"}' > /tmp/review.json
python3 - <<'EOF'
import json
d = json.load(open('/tmp/review.json'))
if 'error' in d:
    print('ERROR:', d['error']); raise SystemExit(1)
p = d['payload']
print('summary:', (p.get('summary') or '')[:150])
print('criteria:', len(p.get('criteria', [])), 'issues:', len(p.get('issues', [])))
print('score:', p.get('score', {}).get('total'), 'rec:', p.get('score', {}).get('recommendation'))
print('issue1:', p['issues'][0]['title'] if p.get('issues') else '-')
EOF

echo "=== 4) Print HTML (first 200 bytes) ==="
curl -s "$BASE/api/projects/$PID/print?report=full" | head -c 200; echo

echo "=== 5) Export DOCX ==="
curl -s -o /tmp/report.docx -w "http=%{http_code} size=%{size_download}\n" "$BASE/api/projects/$PID/export?report=full"

echo "=== 6) Settings update roundtrip ==="
curl -s -X PUT "$BASE/api/settings" -H 'Content-Type: application/json' -d '{"proposalWeights":[{"key":"significance","label":"اهمیت و ضرورت پژوهش","weight":12},{"key":"innovation","label":"نوآوری و اصالت","weight":8},{"key":"literature","label":"مرور ادبیات","weight":8},{"key":"objectives","label":"اهداف و فرضیه‌ها","weight":8},{"key":"methodology","label":"روش‌شناسی پژوهش","weight":15},{"key":"sampling","label":"نمونه‌گیری و حجم نمونه","weight":10},{"key":"instruments","label":"ابزارهای سنجش","weight":8},{"key":"statistics","label":"تحلیل آماری","weight":10},{"key":"ethics","label":"ملاحظات اخلاقی","weight":7},{"key":"feasibility","label":"امکان‌پذیری و بودجه","weight":7},{"key":"writing","label":"منابع و نگارش علمی","weight":7}]}' -o /dev/null -w "settings_put=%{http_code}\n"

echo "ALL OK — project id: $PID"
