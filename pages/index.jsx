import { useState, useRef, useEffect } from "react";

const COLORS = {
  bg: "#0B0F1A",
  surface: "#131929",
  card: "#1A2235",
  border: "#243050",
  gold: "#C9A84C",
  goldLight: "#E8C97A",
  red: "#E05252",
  green: "#4ECCA3",
  blue: "#4A90D9",
  text: "#E8EDF5",
  muted: "#7B8BAA",
};

const SYSTEM_PROMPT = `أنت خبير قانوني متخصص في مراجعة عقود المشتريات والمناقصات في المملكة العربية السعودية.
مهمتك: تحليل نص العقد وإعادة تقرير مفصل بصيغة JSON فقط، بدون أي نص خارج الـ JSON.

الصيغة المطلوبة:
{
  "contractType": "نوع العقد",
  "riskLevel": "عالي أو متوسط أو منخفض",
  "overallScore": 0,
  "risks": [{ "text": "وصف المخاطرة", "severity": "عالي أو متوسط أو منخفض" }],
  "missingClauses": ["بند مفقود"],
  "keyTerms": [{ "label": "اسم البند", "value": "القيمة" }],
  "negotiationTips": ["نصيحة تفاوضية"],
  "summary": "ملخص تنفيذي في جملتين"
}
كن دقيقاً وعملياً.`;

function parseReport(text) {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

const FILE_TYPES = {
  txt: "نص عادي",
  docx: "Word",
  pdf: "PDF",
  jpg: "صورة",
  jpeg: "صورة",
  png: "صورة",
  webp: "صورة",
};

export default function ContractReviewer() {
  const [contractText, setContractText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [mammothLib, setMammothLib] = useState(null);
  const fileRef = useRef();

  // Load libraries on client side only
  useEffect(() => {
    // Load mammoth for DOCX
    import("mammoth").then((m) => setMammothLib(m)).catch(() => {});

    // Load PDF.js from CDN
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
    };
    document.head.appendChild(script);
  }, []);

  const resetFile = () => {
    setFileName("");
    setFileType("");
    setImageData(null);
    setContractText("");
    setError("");
  };

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();

    if (!FILE_TYPES[ext]) {
      setError("صيغة الملف غير مدعومة. الصيغ المدعومة: PDF, DOCX, TXT, JPG, PNG");
      return;
    }

    setError("");
    setFileName(file.name);
    setFileType(ext);
    setImageData(null);
    setContractText("");
    setExtracting(true);

    try {
      if (ext === "txt") {
        const text = await file.text();
        setContractText(text.slice(0, 15000));

      } else if (ext === "docx") {
        if (!mammothLib) {
          setError("جارٍ تحميل مكتبة Word... حاول مجدداً بعد ثانية");
          setExtracting(false);
          return;
        }
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammothLib.extractRawText({ arrayBuffer });
        setContractText(result.value.slice(0, 15000));

      } else if (ext === "pdf") {
        if (!window.pdfjsLib) {
          setError("جارٍ تحميل مكتبة PDF... حاول مجدداً بعد ثانية");
          setExtracting(false);
          return;
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = "";
        for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str).join(" ") + "\n";
        }
        if (text.trim().length < 50) {
          setError("هذا PDF يحتوي على صور فقط. يرجى رفعه كصورة JPG أو PNG.");
          setExtracting(false);
          return;
        }
        setContractText(text.slice(0, 15000));

      } else if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImageData({
            base64: e.target.result.split(",")[1],
            mediaType: file.type || "image/jpeg",
          });
        };
        reader.readAsDataURL(file);
      }
    } catch (e) {
      setError("حدث خطأ في قراءة الملف. تأكد أن الملف غير محمي بكلمة مرور.");
    }

    setExtracting(false);
  };

  const analyze = async () => {
    const isImage = imageData && !contractText;
    if (!contractText.trim() && !isImage) {
      setError("الرجاء إدخال نص العقد أو رفع ملف");
      return;
    }

    setError("");
    setLoading(true);
    setReport(null);

    try {
      let messages;

      if (isImage) {
        messages = [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: imageData.mediaType,
                  data: imageData.base64,
                },
              },
              {
                type: "text",
                text: "اقرأ نص العقد في هذه الصورة وحلله. أعطني التقرير بصيغة JSON فقط.",
              },
            ],
          },
        ];
      } else {
        messages = [
          {
            role: "user",
            content: `راجع هذا العقد وأعطني التقرير:\n\n${contractText.slice(0, 12000)}`,
          },
        ];
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages,
        }),
      });

      const data = await res.json();
      const raw = data.content?.find((b) => b.type === "text")?.text || "";
      const parsed = parseReport(raw);
      setReport(parsed || { _raw: raw });
    } catch {
      setError("حدث خطأ في الاتصال. تحقق من الإنترنت وحاول مجدداً.");
    }

    setLoading(false);
  };

  const reset = () => {
    setReport(null);
    resetFile();
  };

  const getRiskColor = (level) =>
    level === "عالي" ? COLORS.red : level === "متوسط" ? "#F0A500" : COLORS.green;

  const getSeverityColor = (s) =>
    s === "عالي" ? COLORS.red : s === "متوسط" ? "#F0A500" : COLORS.green;

  const hasContent = contractText.trim() || imageData;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .spin { animation: spin 1s linear infinite; }
        .pulse { animation: pulse 1.5s ease infinite; }
        textarea:focus { border-color: ${COLORS.gold} !important; box-shadow: 0 0 0 3px ${COLORS.gold}20; }
        .drop-zone { transition: all 0.3s; }
        .drop-zone:hover, .drop-zone.drag { border-color: ${COLORS.gold} !important; background: ${COLORS.gold}08 !important; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px ${COLORS.gold}55; }
        .btn-primary:active { transform: translateY(0); }
        .btn-ghost:hover { border-color: ${COLORS.muted}; color: ${COLORS.text}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl", color: COLORS.text }}>

        {/* Header */}
        <header style={{ background: `linear-gradient(135deg, ${COLORS.surface}, #0D1520)`, borderBottom: `1px solid ${COLORS.border}`, padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>⚖️</div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "800", color: COLORS.text }}>مراجع العقود الذكي</div>
              <div style={{ fontSize: "11px", color: COLORS.muted }}>يدعم PDF · Word · صورة · نص</div>
            </div>
          </div>
          <div style={{ background: `${COLORS.gold}18`, border: `1px solid ${COLORS.gold}44`, color: COLORS.gold, padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>
            ✦ مدعوم بـ Claude AI
          </div>
        </header>

        <main style={{ maxWidth: "860px", margin: "0 auto", padding: "40px 20px" }}>

          {/* Input Screen */}
          {!report && !loading && (
            <div className="fade-up">
              <h1 style={{ fontSize: "34px", fontWeight: "900", textAlign: "center", marginBottom: "10px", background: `linear-gradient(135deg, ${COLORS.text}, ${COLORS.goldLight})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                راجع عقدك في 30 ثانية
              </h1>
              <p style={{ textAlign: "center", color: COLORS.muted, fontSize: "15px", marginBottom: "36px", lineHeight: "1.8" }}>
                ارفع العقد بأي صيغة — سيكشف الذكاء الاصطناعي المخاطر والبنود الناقصة ونصائح التفاوض فوراً
              </p>

              {/* Supported formats */}
              <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "28px", flexWrap: "wrap" }}>
                {[
                  { icon: "📄", label: "PDF" },
                  { icon: "📝", label: "Word DOCX" },
                  { icon: "🖼️", label: "صورة JPG/PNG" },
                  { icon: "📋", label: "نص مباشر" },
                ].map((f) => (
                  <div key={f.label} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "8px", padding: "7px 14px", fontSize: "13px", color: COLORS.muted, display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{f.icon}</span> {f.label}
                  </div>
                ))}
              </div>

              {/* Drop Zone */}
              <div
                className={`drop-zone${dragOver ? " drag" : ""}`}
                style={{ background: COLORS.card, border: `2px dashed ${COLORS.border}`, borderRadius: "16px", padding: "36px", textAlign: "center", cursor: "pointer", marginBottom: "20px" }}
                onClick={() => fileRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              >
                {extracting ? (
                  <div>
                    <div className="spin" style={{ width: "36px", height: "36px", border: `3px solid ${COLORS.border}`, borderTop: `3px solid ${COLORS.gold}`, borderRadius: "50%", margin: "0 auto 16px" }} />
                    <div style={{ color: COLORS.gold, fontWeight: "700" }}>جارٍ قراءة الملف...</div>
                  </div>
                ) : fileName ? (
                  <div>
                    <div style={{ fontSize: "40px", marginBottom: "10px" }}>
                      {fileType === "pdf" ? "📄" : fileType === "docx" ? "📝" : ["jpg","jpeg","png","webp"].includes(fileType) ? "🖼️" : "📋"}
                    </div>
                    <div style={{ color: COLORS.green, fontWeight: "700", marginBottom: "6px" }}>✓ تم رفع الملف بنجاح</div>
                    <div style={{ color: COLORS.muted, fontSize: "13px", marginBottom: "12px" }}>{fileName}</div>
                    <button onClick={(e) => { e.stopPropagation(); resetFile(); }} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.muted, padding: "5px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>
                      × حذف
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "44px", marginBottom: "14px" }}>☁️</div>
                    <div style={{ fontSize: "17px", fontWeight: "700", marginBottom: "8px" }}>اسحب الملف هنا أو اضغط للرفع</div>
                    <div style={{ color: COLORS.muted, fontSize: "13px" }}>PDF · DOCX · JPG · PNG · TXT</div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
              </div>

              {/* Image preview */}
              {imageData && (
                <div style={{ marginBottom: "16px", borderRadius: "12px", overflow: "hidden", maxHeight: "200px", textAlign: "center", background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                  <img src={`data:${imageData.mediaType};base64,${imageData.base64}`} alt="preview" style={{ maxHeight: "200px", maxWidth: "100%", objectFit: "contain" }} />
                </div>
              )}

              {/* OR divider */}
              {!fileName && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "20px 0" }}>
                    <div style={{ flex: 1, height: "1px", background: COLORS.border }} />
                    <span style={{ color: COLORS.muted, fontSize: "13px" }}>أو الصق نص العقد مباشرة</span>
                    <div style={{ flex: 1, height: "1px", background: COLORS.border }} />
                  </div>
                  <textarea
                    style={{ width: "100%", minHeight: "160px", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "12px", padding: "16px", color: COLORS.text, fontSize: "14px", fontFamily: "inherit", direction: "rtl", resize: "vertical", outline: "none", lineHeight: "1.7" }}
                    value={contractText}
                    onChange={(e) => setContractText(e.target.value)}
                    placeholder="الصق نص العقد هنا مباشرة..."
                  />
                </>
              )}

              {error && (
                <div style={{ color: COLORS.red, fontSize: "13px", margin: "12px 0", padding: "12px", background: `${COLORS.red}11`, borderRadius: "8px", border: `1px solid ${COLORS.red}33` }}>
                  ⚠️ {error}
                </div>
              )}

              <button
                className="btn-primary"
                disabled={!hasContent}
                onClick={analyze}
                style={{ width: "100%", padding: "16px", background: hasContent ? `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})` : COLORS.border, color: hasContent ? "#0B0F1A" : COLORS.muted, border: "none", borderRadius: "12px", fontSize: "17px", fontWeight: "800", cursor: hasContent ? "pointer" : "default", marginTop: "16px", transition: "all 0.2s", fontFamily: "inherit" }}
              >
                🔍 ابدأ تحليل العقد
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="fade-up" style={{ textAlign: "center", padding: "80px 20px" }}>
              <div className="spin" style={{ width: "52px", height: "52px", border: `3px solid ${COLORS.border}`, borderTop: `3px solid ${COLORS.gold}`, borderRadius: "50%", margin: "0 auto 24px" }} />
              <div style={{ color: COLORS.gold, fontSize: "20px", fontWeight: "800", marginBottom: "10px" }}>جارٍ تحليل العقد...</div>
              <div style={{ color: COLORS.muted, fontSize: "14px" }}>يراجع الذكاء الاصطناعي البنود والمخاطر والنصائح</div>
            </div>
          )}

          {/* Report */}
          {report && !loading && (
            <div className="fade-up">
              {report._raw ? (
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "14px", padding: "24px" }}>
                  <div style={{ fontWeight: "700", marginBottom: "12px" }}>📄 نتيجة التحليل</div>
                  <p style={{ color: COLORS.muted, lineHeight: "1.8", fontSize: "14px", whiteSpace: "pre-wrap" }}>{report._raw}</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", paddingBottom: "24px", borderBottom: `1px solid ${COLORS.border}` }}>
                    <div>
                      <div style={{ fontSize: "22px", fontWeight: "900" }}>تقرير مراجعة العقد</div>
                      <div style={{ color: COLORS.muted, fontSize: "12px", marginTop: "4px" }}>
                        {new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
                      </div>
                      {report.contractType && <div style={{ color: COLORS.muted, fontSize: "13px", marginTop: "4px" }}>النوع: {report.contractType}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
                      {report.riskLevel && (
                        <div style={{ background: `${getRiskColor(report.riskLevel)}18`, border: `1px solid ${getRiskColor(report.riskLevel)}44`, color: getRiskColor(report.riskLevel), padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "700" }}>
                          ● مستوى الخطر: {report.riskLevel}
                        </div>
                      )}
                      <button className="btn-ghost" onClick={reset} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.muted, padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontFamily: "inherit", transition: "all 0.2s" }}>
                        ↩ تحليل جديد
                      </button>
                    </div>
                  </div>

                  {/* Score Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "24px" }}>
                    {[
                      { value: report.overallScore ?? "—", label: "جودة العقد / 100", color: report.overallScore >= 70 ? COLORS.green : report.overallScore >= 40 ? "#F0A500" : COLORS.red },
                      { value: report.risks?.length ?? 0, label: "مخاطر محددة", color: COLORS.red },
                      { value: report.missingClauses?.length ?? 0, label: "بنود مفقودة", color: "#F0A500" },
                    ].map((s) => (
                      <div key={s.label} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "12px", padding: "20px", textAlign: "center" }}>
                        <div style={{ fontSize: "32px", fontWeight: "900", color: s.color, lineHeight: 1, marginBottom: "6px" }}>{s.value}</div>
                        <div style={{ fontSize: "12px", color: COLORS.muted, fontWeight: "600" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  {report.summary && (
                    <div style={{ background: `${COLORS.gold}08`, border: `1px solid ${COLORS.border}`, borderRight: `3px solid ${COLORS.gold}`, borderRadius: "14px", padding: "22px", marginBottom: "18px" }}>
                      <div style={{ color: COLORS.gold, fontWeight: "700", marginBottom: "10px", fontSize: "15px" }}>✦ الملخص التنفيذي</div>
                      <p style={{ color: COLORS.text, lineHeight: "1.9", fontSize: "15px" }}>{report.summary}</p>
                    </div>
                  )}

                  {/* Risks */}
                  {report.risks?.length > 0 && (
                    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "14px", padding: "22px", marginBottom: "18px" }}>
                      <div style={{ color: COLORS.red, fontWeight: "700", marginBottom: "14px", fontSize: "15px" }}>⚠️ المخاطر المكتشفة ({report.risks.length})</div>
                      {report.risks.map((r, i) => (
                        <div key={i} style={{ display: "flex", gap: "10px", padding: "10px 0", borderBottom: i < report.risks.length - 1 ? `1px solid ${COLORS.border}33` : "none", alignItems: "flex-start" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: getSeverityColor(r.severity), marginTop: "6px", flexShrink: 0 }} />
                          <div style={{ flex: 1, lineHeight: "1.7", fontSize: "14px" }}>
                            {r.text}
                            <span style={{ marginRight: "8px", fontSize: "11px", color: getSeverityColor(r.severity), fontWeight: "700" }}>[{r.severity}]</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Missing Clauses */}
                  {report.missingClauses?.length > 0 && (
                    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "14px", padding: "22px", marginBottom: "18px" }}>
                      <div style={{ color: "#F0A500", fontWeight: "700", marginBottom: "14px", fontSize: "15px" }}>📋 البنود المفقودة ({report.missingClauses.length})</div>
                      {report.missingClauses.map((c, i) => (
                        <div key={i} style={{ display: "flex", gap: "10px", padding: "9px 0", borderBottom: i < report.missingClauses.length - 1 ? `1px solid ${COLORS.border}33` : "none", alignItems: "flex-start", fontSize: "14px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#F0A500", marginTop: "6px", flexShrink: 0 }} />
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Key Terms */}
                  {report.keyTerms?.length > 0 && (
                    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "14px", padding: "22px", marginBottom: "18px" }}>
                      <div style={{ color: COLORS.blue, fontWeight: "700", marginBottom: "14px", fontSize: "15px" }}>🔑 البنود الرئيسية</div>
                      {report.keyTerms.map((t, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < report.keyTerms.length - 1 ? `1px solid ${COLORS.border}33` : "none", fontSize: "14px", gap: "16px" }}>
                          <span style={{ color: COLORS.muted, fontWeight: "600", flexShrink: 0 }}>{t.label}</span>
                          <span style={{ color: COLORS.text, textAlign: "left" }}>{t.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Negotiation Tips */}
                  {report.negotiationTips?.length > 0 && (
                    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRight: `3px solid ${COLORS.green}`, borderRadius: "14px", padding: "22px", marginBottom: "18px" }}>
                      <div style={{ color: COLORS.green, fontWeight: "700", marginBottom: "14px", fontSize: "15px" }}>💡 نصائح التفاوض</div>
                      {report.negotiationTips.map((tip, i) => (
                        <div key={i} style={{ display: "flex", gap: "10px", padding: "9px 0", borderBottom: i < report.negotiationTips.length - 1 ? `1px solid ${COLORS.border}33` : "none", alignItems: "flex-start", fontSize: "14px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORS.green, marginTop: "6px", flexShrink: 0 }} />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ textAlign: "center", marginTop: "28px" }}>
                    <button className="btn-ghost" onClick={reset} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.muted, padding: "12px 32px", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontFamily: "inherit", transition: "all 0.2s" }}>
                      ↩ تحليل عقد جديد
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
