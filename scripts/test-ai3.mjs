import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const system = fs.readFileSync('/tmp/engine-system.txt', 'utf8');
const text = fs.readFileSync('/home/z/my-project/scripts/sample-proposal.txt', 'utf8');
const user = `داوری کامل این پروپوزال پژوهشی را انجام بده.
عنوان: تأثیر آموزش خودمراقبتی بر کیفیت زندگی بیماران همودیالیزی
زبان سند: fa

سند پروپوزال:
"""
${text}
"""`;

async function main() {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    thinking: { type: 'disabled' },
    max_tokens: 8192,
  });
  const content = completion?.choices?.[0]?.message?.content || '';
  fs.writeFileSync('/tmp/ai-raw3.txt', content);
  const m = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = m ? m[1] : content;
  try {
    const d = JSON.parse(jsonText);
    console.log('TOP-LEVEL KEYS:', Object.keys(d));
    console.log('criteria type:', Array.isArray(d.criteria) ? `array(${d.criteria.length})` : typeof d.criteria, d.criteria ? JSON.stringify(d.criteria).slice(0, 200) : '(missing)');
    console.log('strengths type:', Array.isArray(d.strengths) ? `array(${d.strengths.length})` : typeof d.strengths);
  } catch (e) {
    console.log('PARSE FAIL:', e.message);
    console.log('HEAD:', content.slice(0, 400));
  }
}
main().catch((e) => console.error('ERR', e.message));
