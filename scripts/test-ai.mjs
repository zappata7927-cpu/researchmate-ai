import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const system = `تو یک داور پژوهشی ارشد هستی. فقط یک شیء JSON معتبر برگردان، بدون هیچ متن اضافه یا بلوک کد.
تست ساختار: {"summary": "متن کوتاه", "strengths": ["..."], "criteria": [{"key": "significance", "label": "...", "score": 3, "justification": "..."}], "issues": [{"title": "...", "category": "methodological", "severity": "major", "location": "...", "excerpt": "", "explanation": "...", "whyMatters": "...", "suggestion": "...", "detailedSolution": "...", "suggestedText": null, "guideline": null}]}`;

const text = fs.readFileSync('/home/z/my-project/scripts/sample-proposal.txt', 'utf8');
const user = `داوری کامل این پروپوزال را با فرمت JSON انجام بده (حداکثر ۳ ایراد، توضیح‌ها کوتاه):\n"""\n${text}\n"""`;

async function main() {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    thinking: { type: 'disabled' },
  });
  const content = completion?.choices?.[0]?.message?.content;
  fs.writeFileSync('/tmp/ai-raw.txt', content || 'EMPTY');
  console.log('--- RAW LENGTH:', (content || '').length);
  console.log((content || '').slice(0, 800));
  try {
    JSON.parse(content.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
    console.log('--- JSON PARSE: OK (after fence strip)');
  } catch (e) {
    console.log('--- JSON PARSE FAILED:', e.message);
  }
}
main().catch((e) => {
  console.error('ERR', e.message);
});
