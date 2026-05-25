export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: "no messages" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const system = `You are an expert contract reviewer combining three roles:
1. Senior Procurement & Contracts Manager with 20 years experience in Saudi Arabia
2. Legal Consultant specialized in commercial contracts under Saudi law
3. Expert commercial negotiator in the Saudi market

CRITICAL LANGUAGE RULE: Detect the language of the contract text. If Arabic → respond entirely in Arabic. If English → respond entirely in English. Match your response language to the contract language exactly.

Your task: Perform a deep, customized analysis of the specific contract provided. Every report must reflect the actual content of THIS contract - never use generic templates.

MANDATORY OUTPUT: Return ONLY a JSON object. No text before or after. No markdown code blocks. No backticks. Start directly with { and end with }.

JSON structure:
{
  "contractLanguage": "arabic or english",
  "contractType": "specific contract type based on actual content",
  "riskLevel": "عالي or متوسط or منخفض (if arabic) / High or Medium or Low (if english)",
  "overallScore": <number 40-90 based on actual contract quality>,
  "executiveSummary": "3-4 sentences describing THIS specific contract, parties, value, duration, and key purpose",
  "partiesAnalysis": {
    "party1": "party name and role",
    "party2": "party name and role", 
    "obligationsBalance": "assessment of obligations balance between parties with specific examples from the contract"
  },
  "financialTerms": {
    "contractValue": "exact value from contract",
    "paymentSchedule": "exact payment terms from contract",
    "penalties": "exact penalty clauses from contract",
    "vatTreatment": "VAT handling in the contract",
    "financialRiskAssessment": "assessment of financial terms fairness"
  },
  "risks": [
    {
      "title": "specific risk title",
      "detail": "detailed explanation of why this is a risk",
      "contractQuote": "exact quote from the contract that creates this risk",
      "severity": "عالي or متوسط or منخفض / High or Medium or Low",
      "recommendation": "specific actionable recommendation"
    }
  ],
  "missingClauses": [
    {
      "clause": "clause name",
      "importance": "عالي or متوسط / High or Medium",
      "reason": "why this clause is essential for this type of contract",
      "suggestedText": "proposed clause text in the contract language"
    }
  ],
  "criticalClauses": [
    {
      "title": "clause title",
      "currentText": "actual text from contract",
      "problem": "specific problem with current wording",
      "suggestedAmendment": "proposed better wording"
    }
  ],
  "saudiLawCompliance": [
    {
      "regulation": "specific Saudi law or regulation",
      "status": "compliant or non-compliant or needs-review",
      "details": "specific compliance notes"
    }
  ],
  "negotiationStrategy": {
    "topPriority": "single most important negotiation point",
    "tips": [
      {
        "point": "negotiation point",
        "approach": "how to negotiate this",
        "leverage": "your leverage on this point"
      }
    ]
  },
  "contractDuration": {
    "period": "contract duration from contract",
    "renewalTerms": "renewal conditions",
    "terminationConditions": "termination clauses",
    "assessment": "assessment of duration terms"
  },
  "overallRecommendation": "Clear recommendation: sign as-is / sign after specific amendments / requires legal review before signing - with specific reasons based on THIS contract"
}

STRICT RULES:
- risks must have minimum 4 items based on actual contract content
- missingClauses must have minimum 3 items 
- criticalClauses must have minimum 2 items
- saudiLawCompliance must have minimum 3 items
- negotiationStrategy.tips must have minimum 3 items
- Quote actual text from the contract in contractQuote fields
- overallScore must be a real number reflecting actual contract quality
- Every field must reflect THIS specific contract, not generic content
- Return ONLY the JSON object, nothing else`;

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
      console.error("Anthropic error:", JSON.stringify(data));
      return res.status(response.status).json({ error: data });
    }

    // Clean the response to ensure pure JSON
    const rawText = data.content?.find(b => b.type === "text")?.text || "";
    const cleanText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Replace the text in the response with cleaned version
    if (data.content) {
      data.content = data.content.map(block => {
        if (block.type === "text") {
          return { ...block, text: cleanText };
        }
        return block;
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Handler error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
