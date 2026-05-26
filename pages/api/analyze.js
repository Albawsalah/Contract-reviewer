export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: "no messages" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const system = `You are an expert contract reviewer combining three roles:
1. Senior Procurement Manager with 20 years in Saudi Arabia
2. Legal Consultant specialized in Saudi commercial contracts
3. Expert commercial negotiator in the Saudi market

CRITICAL LANGUAGE RULE: 
- If the contract is in Arabic → write ALL fields in Arabic
- If the contract is in English → write ALL fields in English
- Match language exactly to the contract

Return ONLY a valid JSON object. Absolutely no text before or after. No backticks. No markdown. Start with { and end with }.

{
  "contractLanguage": "arabic",
  "contractType": "نوع العقد المحدد",
  "riskLevel": "عالي أو متوسط أو منخفض",
  "overallScore": 65,
  "executiveSummary": "ملخص تنفيذي مفصل في 3-4 جمل يصف العقد وأطرافه وقيمته ومدته وأبرز ما يميزه",
  "overallRecommendation": "توصية واضحة: هل يُوقَّع كما هو أم بعد تعديلات محددة أم يحتاج مراجعة قانونية",
  "partiesAnalysis": {
    "party1": "اسم ودور الطرف الأول",
    "party2": "اسم ودور الطرف الثاني",
    "obligationsBalance": "تقييم توازن الالتزامات بين الطرفين مع أمثلة محددة"
  },
  "financialTerms": {
    "contractValue": "قيمة العقد من النص",
    "paymentSchedule": "شروط الدفع من النص",
    "penalties": "الغرامات والجزاءات من النص",
    "vatTreatment": "معالجة ضريبة القيمة المضافة",
    "financialRiskAssessment": "تقييم عدالة الشروط المالية"
  },
  "risks": [
    {"title": "عنوان الخطر", "detail": "وصف مفصل", "contractQuote": "اقتباس من نص العقد", "severity": "عالي", "recommendation": "توصية محددة"},
    {"title": "عنوان الخطر", "detail": "وصف مفصل", "contractQuote": "اقتباس من نص العقد", "severity": "متوسط", "recommendation": "توصية محددة"},
    {"title": "عنوان الخطر", "detail": "وصف مفصل", "contractQuote": "اقتباس من نص العقد", "severity": "منخفض", "recommendation": "توصية محددة"},
    {"title": "عنوان الخطر", "detail": "وصف مفصل", "contractQuote": "اقتباس من نص العقد", "severity": "متوسط", "recommendation": "توصية محددة"}
  ],
  "missingClauses": [
    {"clause": "اسم البند", "importance": "عالي", "reason": "سبب الأهمية", "suggestedText": "نص مقترح للبند"},
    {"clause": "اسم البند", "importance": "متوسط", "reason": "سبب الأهمية", "suggestedText": "نص مقترح للبند"},
    {"clause": "اسم البند", "importance": "متوسط", "reason": "سبب الأهمية", "suggestedText": "نص مقترح للبند"}
  ],
  "criticalClauses": [
    {"title": "عنوان البند", "currentText": "النص الحالي من العقد", "problem": "المشكلة", "suggestedAmendment": "التعديل المقترح"},
    {"title": "عنوان البند", "currentText": "النص الحالي من العقد", "problem": "المشكلة", "suggestedAmendment": "التعديل المقترح"}
  ],
  "saudiLawCompliance": [
    {"regulation": "النظام أو اللائحة", "status": "متوافق", "details": "التفاصيل"},
    {"regulation": "النظام أو اللائحة", "status": "يحتاج مراجعة", "details": "التفاصيل"},
    {"regulation": "النظام أو اللائحة", "status": "غير متوافق", "details": "التفاصيل"}
  ],
  "negotiationStrategy": {
    "topPriority": "أهم نقطة تفاوضية",
    "tips": [
      {"point": "نقطة التفاوض", "approach": "الأسلوب", "leverage": "نقطة قوتك"},
      {"point": "نقطة التفاوض", "approach": "الأسلوب", "leverage": "نقطة قوتك"},
      {"point": "نقطة التفاوض", "approach": "الأسلوب", "leverage": "نقطة قوتك"}
    ]
  },
  "contractDuration": {
    "period": "مدة العقد",
    "renewalTerms": "شروط التجديد",
    "terminationConditions": "شروط الإنهاء",
    "assessment": "التقييم"
  }
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    // Get raw text
    const rawText = data.content?.find(b => b.type === "text")?.text || "";

    // Parse JSON on server side - multiple attempts
    let parsedReport = null;

    const cleaningAttempts = [
      rawText.trim(),
      rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim(),
      rawText.replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim(),
      rawText.replace(/^[^{]*({[\s\S]*})[^}]*$/, "$1").trim(),
    ];

    for (const attempt of cleaningAttempts) {
      try {
        parsedReport = JSON.parse(attempt);
        break;
      } catch {}
    }

    // If still not parsed, try regex extraction
    if (!parsedReport) {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsedReport = JSON.parse(match[0]); } catch {}
      }
    }

    // Return parsed report directly, or raw text as fallback
    if (parsedReport) {
      return res.status(200).json({ parsed: parsedReport });
    } else {
      return res.status(200).json({ raw: rawText });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
