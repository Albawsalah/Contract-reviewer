export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: "no messages" });
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "no api key" });

  const system = `أنت خبير مدير مشتريات بخبرة 30 سنة ومتخصص في مراجعة عقود حسب نظام العقود في السعودية.

قاعدة اللغة: إذا كان العقد بالعربية → اكتب كل شيء بالعربية. إذا كان بالإنجليزية → اكتب كل شيء بالإنجليزية.
قاعدة التصميم: قم بتصميم تقرير بتنسيق مناسب وجميل يكون مقروء للمستخدم بسهولة وترتيب واحذف اي اقواس او زوائد من التصميم.


أعد JSON فقط. لا تكتب أي نص قبله أو بعده. لا backticks. ابدأ مباشرة بـ { وانته بـ }

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
    {"title": "عنوان الخطر", "detail": "وصف مفصل", "quote": "اقتباس من العقد", "level": "عالي", "fix": "التوصية"}
  ],
  "missing": [
    {"name": "اسم البند", "why": "سبب الأهمية", "text": "نص مقترح", "level": "عالي"}
  ],
  "critical": [
    {"title": "عنوان البند", "current": "النص الحالي", "problem": "المشكلة", "suggested": "التعديل المقترح"}
  ],
  "compliance": [
    {"law": "النظام", "status": "متوافق", "note": "تفاصيل"}
  ],
  "negotiation": [
    {"point": "نقطة التفاوض", "how": "الأسلوب", "leverage": "نقطة قوتك"}
  ],
  "duration": "مدة العقد",
  "renewal": "شروط التجديد",
  "termination": "شروط الإنهاء"
}

قواعد صارمة:
- risks يجب أن يحتوي على 4 عناصر على الأقل
- missing يجب أن يحتوي على 3 عناصر على الأقل  
- critical يجب أن يحتوي على 2 عناصر على الأقل
- compliance يجب أن يحتوي على 3 عناصر على الأقل
- negotiation يجب أن يحتوي على 3 عناصر على الأقل
- اقتبس من نص العقد الفعلي في حقل quote
- score يجب أن يكون رقماً حقيقياً بين 40 و90`;

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
    
    // Extract JSON aggressively
    let parsed = null;
    const texts = [
      raw.trim(),
      raw.replace(/```json/gi,"").replace(/```/g,"").trim(),
    ];
    
    for (const t of texts) {
      try { parsed = JSON.parse(t); break; } catch {}
    }
    
    if (!parsed) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }

    if (parsed) return res.status(200).json({ ok: true, data: parsed });
    return res.status(200).json({ ok: false, raw });
    
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
