export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: "no messages" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const system = `أنت خبير قانوني ومدير مشتريات في السعودية.

اقرأ العقد المرسل بعناية ثم أعد تحليلاً حقيقياً بصيغة JSON فقط.

قواعد صارمة جداً:
١. يجب أن يحتوي risks على ٣ عناصر على الأقل دائماً
٢. يجب أن يحتوي missingClauses على ٣ عناصر على الأقل دائماً  
٣. يجب أن يحتوي negotiationTips على ٣ عناصر على الأقل دائماً
٤. overallScore يجب أن يكون رقماً بين ٤٠ و٩٠
٥. لا تضع [] فارغة أبداً

أعد هذا الـ JSON فقط بدون أي نص قبله أو بعده:
{
  "contractType": "نوع العقد",
  "riskLevel": "متوسط",
  "overallScore": 65,
  "executiveSummary": "ملخص العقد",
  "overallRecommendation": "التوصية",
  "risks": [
    {"title": "عنوان الخطر", "detail": "التفاصيل", "severity": "عالي", "recommendation": "التوصية"},
    {"title": "عنوان الخطر", "detail": "التفاصيل", "severity": "متوسط", "recommendation": "التوصية"},
    {"title": "عنوان الخطر", "detail": "التفاصيل", "severity": "منخفض", "recommendation": "التوصية"}
  ],
  "missingClauses": [
    {"clause": "البند", "importance": "عالي", "reason": "السبب"},
    {"clause": "البند", "importance": "متوسط", "reason": "السبب"},
    {"clause": "البند", "importance": "متوسط", "reason": "السبب"}
  ],
  "negotiationTips": [
    {"point": "نقطة التفاوض", "approach": "الأسلوب"},
    {"point": "نقطة التفاوض", "approach": "الأسلوب"},
    {"point": "نقطة التفاوض", "approach": "الأسلوب"}
  ],
  "keyTerms": [
    {"label": "البند", "value": "القيمة"},
    {"label": "البند", "value": "القيمة"}
  ]
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Handler error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
