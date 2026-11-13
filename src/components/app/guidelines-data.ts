/** Client-side snapshot of the standards library (kept in sync with src/lib/guidelines.ts). */
export interface GuidelineClientEntry {
  key: string;
  name: string;
  faName: string;
  version: string;
  year: number;
  designs: string[];
  sourceUrl: string;
}

export const GUIDELINES_CLIENT: GuidelineClientEntry[] = [
  { key: "consort", name: "CONSORT 2025", faName: "گزارش‌دهی کارآزمایی‌های تصادفی‌سازی‌شده", version: "2025", year: 2025, designs: ["کارآزمایی تصادفی"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/consort/" },
  { key: "strobe", name: "STROBE", faName: "گزارش‌دهی مطالعات مشاهده‌ای", version: "Statement", year: 2014, designs: ["کوهورت", "موردی", "مقطعی"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/strobe/" },
  { key: "prisma", name: "PRISMA 2020", faName: "مرور نظام‌مند و متاآنالیز", version: "2020", year: 2020, designs: ["مرور نظام‌مند", "متاآنالیز"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/prisma/" },
  { key: "spirit", name: "SPIRIT 2013", faName: "پروتکل کارآزمایی بالینی", version: "2013", year: 2013, designs: ["پروتکل کارآزمایی"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/spirit/" },
  { key: "stard", name: "STARD 2015", faName: "دقت تشخیصی", version: "2015", year: 2015, designs: ["دقت تشخیصی"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/stard/" },
  { key: "tripod_ai", name: "TRIPOD+AI", faName: "مدل‌های پیش‌بینی و هوش مصنوعی", version: "2024", year: 2024, designs: ["مدل پیش‌بینی"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/tripod-ai/" },
  { key: "coreq", name: "COREQ", faName: "پژوهش کیفی (مصاحبه/گروه کانونی)", version: "32-item", year: 2007, designs: ["کیفی"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/coreq/" },
  { key: "srqr", name: "SRQR", faName: "استاندارد شفافیت پژوهش کیفی", version: "2014", year: 2014, designs: ["کیفی"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/srqr/" },
  { key: "care", name: "CARE", faName: "گزارش مورد بالینی", version: "2013/2017", year: 2013, designs: ["گزارش مورد"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/care/" },
  { key: "arrive", name: "ARRIVE 2.0", faName: "مطالعات حیوانی", version: "2.0", year: 2020, designs: ["مطالعه حیوانی"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/improving-bioscience-research-reporting-arrive-guidelines-for-reporting-animal-research/" },
  { key: "squire", name: "SQUIRE 2.0", faName: "مطالعات بهبود کیفیت", version: "2.0", year: 2015, designs: ["بهبود کیفیت"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/squire/" },
  { key: "cheers", name: "CHEERS 2022", faName: "ارزیابی‌های اقتصادی سلامت", version: "2022", year: 2022, designs: ["اقتصاد سلامت"], sourceUrl: "https://www.equator-network.org/reporting-guidelines/cbeers/" },
  { key: "icmje", name: "ICMJE Recommendations", faName: "توصیه‌های کمیته بین‌المللی سردبیران", version: "2024/2025", year: 2025, designs: ["همه انواع"], sourceUrl: "https://www.icmje.org/recommendations/" },
  { key: "cope", name: "COPE Core Practices", faName: "راهنمای اخلاق انتشارات", version: "Core Practices", year: 2024, designs: ["همه انواع"], sourceUrl: "https://publicationethics.org/guidance/cope-core-practices" },
  { key: "nih_peer_review", name: "NIH Peer Review Criteria", faName: "معیارهای داوری NIH", version: "Simplified (2023+)", year: 2023, designs: ["پروپوزال"], sourceUrl: "https://grants.nih.gov/grant-process/apply-for-grants/peer-review" },
];
