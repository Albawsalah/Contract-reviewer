export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: "no messages" });
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "no api key" });

  const system = `أنت خبير مراجعة عقود في السعودية.

قاعدة اللغة: إذا كان العقد بالعربية اكتب كل شيء بالعربية. إذا كان بالإنجليزية اكتب كل شيء بالإنجليزية.

أعد JSON فقط. ابدأ مباشرة بـ { وانته بـ } بدون أي نص قبله أو بعده ولا backticks.

{
  "lang": "ar",
  "contractType": "نوع العقد",
  "riskLevel": "عالي",
  "score": 65,
  "summary": "ملخص تنفيذي مفصل في 3 جمل",
  "recommendation": "توصية شاملة بالتوقيع أو التعديل",
  "party1": "اسم الطرف الأول ودوره",
  "party2": "اسم الطرف الثاني ودوره",
  "partiesBalance": "تقييم توازن الالتزامات",
  "contractValue": "قيمة العقد",
  "paymentTerms": "شروط الدفع",
  "penalties": "الغرامات",
  "vat": "ضريبة القيمة المضافة",
  "risks": [
    {"title": "عنوان الخطر", "detail": "وصف مفصل", "quote": "اقتباس من العقد", "level": "عالي", "fix": "التوصية"},
    {"title": "عنوان الخطر", "detail": "وصف مفصل", "quote": "اقتباس من العقد", "level": "متوسط", "fix": "التوصية"},
    {"title": "عنوان الخطر", "detail": "وصف مفصل", "quote": "اقتباس من العقد", "level": "منخفض", "fix": "التوصية"},
    {"title": "عنوان الخطر", "detail": "وصف مفصل", "quote": "اقتباس من العقد", "level": "متوسط", "fix": "التوصية"}
  ],
  "missing": [
    {"name": "اسم البند", "why": "سبب الأهمية", "text": "نص مقترح", "level": "عالي"},
    {"name": "اسم البند", "why": "سبب الأهمية", "text": "نص مقترح", "level": "متوسط"},
    {"name": "اسم البند", "why": "سبب الأهمية", "text": "نص مقترح", "level": "متوسط"}
  ],
  "critical": [
    {"title": "عنوان البند", "current": "النص الحالي", "problem": "المشكلة", "suggested": "التعديل المقترح"},
    {"title": "عنوان البند", "current": "النص الحالي", "problem": "المشكلة", "suggested": "التعديل المقترح"}
  ],
  "compliance": [
    {"law": "النظام", "status": "متوافق", "note": "تفاصيل"},
    {"law": "النظام", "status": "يحتاج مراجعة", "note": "تفاصيل"},
    {"law": "النظام", "status": "غير متوافق", "note": "تفاصيل"}
  ],
  "negotiation": [
    {"point": "نقطة التفاوض", "how": "الأسلوب", "leverage": "نقطة قوتك"},
    {"point": "نقطة التفاوض", "how": "الأسلوب", "leverage": "نقطة قوتك"},
    {"point": "نقطة التفاوض", "how": "الأسلوب", "leverage": "نقطة قوتك"}
  ],
  "duration": "مدة العقد",
  "renewal": "شروط التجديد",
  "termination": "شروط الإنهاء"
}`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
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

    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data });

    const raw = data.content?.find(b => b.type === "text")?.text || "";
    
    // استخراج JSON بأخذ كل شيء من أول { لآخر }
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    
    let parsed = null;
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = raw.slice(firstBrace, lastBrace + 1);
      try { parsed = JSON.parse(extracted); } catch {}
    }
    
    // محاولة ثانية
    if (!parsed) {
      try { parsed = JSON.parse(raw.trim()); } catch {}
    }

    if (parsed) return res.status(200).json({ ok: true, data: parsed });
    return res.status(200).json({ ok: false, raw });
    
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
