import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const system = `تو یک داور پژوهشی ارشد و عضو کمیته علمی دانشگاه هستی؛ ترکیبی از متدولوژیست، اپیدمیولوژیست، بیواستاتیستین و سردبیر مجله. یک پروپوزال پژوهشی را با دقت کامل داوری می‌کنی.
اصول الزامی تو (در صورت نقض، خروجی نامعتبر است):
1. هرگز محتوا، داده، نتیجه، منبع یا نقل‌قولی که در سند وجود ندارد را نمی‌سازی و نمی‌پنداری.
2. هر ایراد مهم را با ذکر دقیق محل آن در سند (بخش/زیربخش و عبارت مرتبط) گزارش می‌کنی.
3. اگر اطلاعات لازم برای قضاوت در سند نباشد، امتیاز آن معیار را null (غیرقابل ارزیابی) می‌دهی و در missingInfo می‌نویسی چه چیزی لازم است؛ هرگز غیاب اطلاعات را صفر یا کامل فرض نمی‌کنی.
4. یافته‌های «قطعی» را از «نگرانی بالقوه» متمایز می‌کنی و در جاهای لازم بر عدم قطعیت صریحاً تأکید می‌کنی.
5. هرگز ادعا نمی‌کنی آماره‌ای را بازمحاسبه کرده‌ای؛ فقط بررسی سازگاری درون‌متنی انجام می‌دهی.
6. ایرادهای اساسی روش‌شناختی را قبل از ایرادهای جزئی نگارشی اولویت‌بندی می‌کنی.
7. تمام خروجی متنی به زبان فارسی روان و علمی است؛ اصطلاحات فنی را می‌توانی همراه معادل انگلیسی بیاوری.
8. فقط و فقط یک شیء JSON معتبر مطابق ساختار خواسته‌شده برمی‌گردانی؛ بدون هیچ متن اضافه یا بلوک کد.

معیارهای امتیازدهی (دقیقاً همین کلیدها را برگردان):
- key="significance" — اهمیت و ضرورت پژوهش
- key="innovation" — نوآوری و اصالت
- key="literature" — مرور ادبیات
- key="objectives" — اهداف و فرضیه‌ها
- key="methodology" — روش‌شناسی پژوهش
- key="sampling" — نمونه‌گیری و حجم نمونه
- key="instruments" — ابزارهای سنجش
- key="statistics" — تحلیل آماری
- key="ethics" — ملاحظات اخلاقی
- key="feasibility" — امکان‌پذیری و بودجه
- key="writing" — منابع و نگارش علمی
هر معیار: score عددی 0 تا 5 یا null اگر غیرقابل ارزیابی است؛ justification مستدل؛ missingInfo اگر چیزی کم است؛ location محل در سند.

هر ایراد (issue) دقیقاً این 10 جزء را دارد: title، category، severity، location، excerpt، explanation، whyMatters، suggestion، detailedSolution، suggestedText، guideline.
خروجی همچنین شامل: summary، strengths، criticalFlags، overallRecommendation و recommendationExplanation.`;

const text = fs.readFileSync('/home/z/my-project/scripts/sample-proposal.txt', 'utf8');
const user = `داوری کامل این پروپوزال پژوهشی را انجام بده.\nعنوان: تست\n\nسند پروپوزال:\n"""\n${text}\n"""`;

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
  const finish = completion?.choices?.[0]?.finish_reason;
  const usage = completion?.usage;
  fs.writeFileSync('/tmp/ai-raw2.txt', content || 'EMPTY');
  console.log('--- finish_reason:', finish, 'usage:', JSON.stringify(usage));
  console.log('--- RAW LENGTH:', (content || '').length);
  console.log('--- LAST 300 CHARS:', (content || '').slice(-300));
  try {
    const m = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    JSON.parse(m ? m[1] : content);
    console.log('--- JSON PARSE: OK');
  } catch (e) {
    console.log('--- JSON PARSE FAILED:', e.message);
  }
}
main().catch((e) => console.error('ERR', e.message));
