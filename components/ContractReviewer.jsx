import { useState, useRef, useEffect } from "react";

const C = {
  bg: "#0B0F1A", surface: "#131929", card: "#1A2235",
  border: "#243050", gold: "#C9A84C", goldLight: "#E8C97A",
  red: "#E05252", green: "#4ECCA3", blue: "#4A90D9",
  orange: "#F0A500", text: "#E8EDF5", muted: "#7B8BAA",
};

function parseReport(text) {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch { return null; }
}

const rc = (l) => l === "عالي" ? C.red : l === "متوسط" ? C.orange : C.green;

function Tag({ label, color }) {
  return (
    <span style={{ background: `${color}18`, border: `1px solid ${color}44`, color, padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "700" }}>
      {label}
    </span>
  );
}

function Section({ title, color, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRight: `3px solid ${color}`, borderRadius: "14px", padding: "22px", marginBottom: "16px" }}>
      <div style={{ color, fontWeight: "800", fontSize: "15px", marginBottom: "16px" }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.border}22`, fontSize: "14px", gap: "12px", flexWrap: "wrap" }}>
      <span style={{ color: C.muted, fontWeight: "600", flexShrink: 0 }}>{label}</span>
      <span style={{ color: color || C.text, textAlign: "left", maxWidth: "65%" }}>{value}</span>
    </div>
  );
}

export default function ContractReviewer() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [mammoth, setMammoth] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    import("mammoth").then(setMammoth).catch(() => {});
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; };
    document.head.appendChild(s);
  }, []);

  const reset = () => { setReport(null); setText(""); setFileName(""); setFileType(""); setImageData(null); setError(""); };

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const allowed = ["txt", "docx", "pdf", "jpg", "jpeg", "png", "webp"];
    if (!allowed.includes(ext)) { setError("صيغة غير مدعومة. الصيغ: PDF, DOCX, TXT, JPG, PNG"); return; }
    setError(""); setFileName(file.name); setFileType(ext);
    setImageData(null); setText(""); setExtracting(true);
    try {
      if (ext === "txt") {
        setText((await file.text()).slice(0, 15000));
      } else if (ext === "docx") {
        if (!mammoth) { setError("حاول مجدداً بعد ثانية"); setExtracting(false); return; }
        const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        setText(r.value.slice(0, 15000));
      } else if (ext === "pdf") {
        if (!window.pdfjsLib) { setError("حاول مجدداً بعد ثانية"); setExtracting(false); return; }
        const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        let t = "";
        for (let i = 1; i <= Math.min(pdf.numPages, 25); i++) {
          const pg = await pdf.getPage(i);
          const ct = await pg.getTextContent();
          t += ct.items.map(x => x.str).join(" ") + "\n";
        }
        if (t.trim().length < 50) { setError("هذا PDF يحتوي على صور فقط. يرجى رفعه كصورة JPG أو PNG."); setExtracting(false); return; }
        setText(t.slice(0, 15000));
      } else {
        const reader = new FileReader();
        reader.onload = (e) => setImageData({ base64: e.target.result.split(",")[1], mediaType: file.type || "image/jpeg" });
        reader.readAsDataURL(file);
      }
    } catch { setError("خطأ في قراءة الملف. تأكد أنه غير محمي بكلمة مرور."); }
    setExtracting(false);
  };

  const analyze = async () => {
    const isImg = imageData && !text;
    if (!text.trim() && !isImg) { setError("الرجاء إدخال نص العقد أو رفع ملف"); return; }
    setError(""); setLoading(true); setReport(null);
    try {
      const messages = isImg
        ? [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: imageData.mediaType, data: imageData.base64 } }, { type: "text", text: "اقرأ نص العقد في الصورة وحلله. أعد التقرير بصيغة JSON فقط." }] }]
        : [{ role: "user", content: `حلل هذا العقد تحليلاً معمقاً وأعد تقرير JSON مفصل:\n\n${text.slice(0, 13000)}` }];

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      const raw = data.content?.find(b => b.type === "text")?.text || "";
      const parsed = parseReport(raw);
      setReport(parsed || { _raw: raw });
    } catch { setError("حدث خطأ في الاتصال. تحقق من الإنترنت وحاول مجدداً."); }
    setLoading(false);
  };

  const hasContent = text.trim() || imageData;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .up{animation:up .5s ease forwards}
        .spin{animation:spin 1s linear infinite}
        textarea:focus{border-color:${C.gold}!important;box-shadow:0 0 0 3px ${C.gold}20}
        .dz{transition:all .3s}.dz:hover,.dz.drag{border-color:${C.gold}!important;background:${C.gold}08!important}
        .btn:hover{transform:translateY(-2px);box-shadow:0 8px 28px ${C.gold}55}
        .btn:active{transform:translateY(0)}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
      `}</style>
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", color: C.text }}>

        {/* Header */}
        <header style={{ background: `linear-gradient(135deg,${C.surface},#0D1520)`, borderBottom: `1px solid ${C.border}`, padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>⚖️</div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "800" }}>مراجع العقود الذكي</div>
              <div style={{ fontSize: "11px", color: C.muted }}>يدعم PDF · Word · صورة · نص</div>
            </div>
          </div>
          <div style={{ background: `${C.gold}18`, border: `1px solid ${C.gold}44`, color: C.gold, padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>✦ مدعوم بـ Claude AI</div>
        </header>

        <main style={{ maxWidth: "880px", margin: "0 auto", padding: "36px 20px" }}>

          {/* Input */}
          {!report && !loading && (
            <div className="up">
              <h1 style={{ fontSize: "32px", fontWeight: "900", textAlign: "center", marginBottom: "10px", background: `linear-gradient(135deg,${C.text},${C.goldLight})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                راجع عقدك في 30 ثانية
              </h1>
              <p style={{ textAlign: "center", color: C.muted, fontSize: "14px", marginBottom: "28px", lineHeight: "1.8" }}>
                تحليل قانوني وتجاري معمق — مخصص لكل عقد بحسب محتواه الفعلي
              </p>

              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
                {[["📄","PDF"],["📝","Word DOCX"],["🖼️","صورة JPG/PNG"],["📋","نص مباشر"]].map(([i,l]) => (
                  <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "6px 12px", fontSize: "12px", color: C.muted }}>
                    {i} {l}
                  </div>
                ))}
              </div>

              <div className={`dz${drag ? " drag" : ""}`}
                style={{ background: C.card, border: `2px dashed ${C.border}`, borderRadius: "16px", padding: "32px", textAlign: "center", cursor: "pointer", marginBottom: "16px" }}
                onClick={() => fileRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}>
                {extracting ? (
                  <><div className="spin" style={{ width: "32px", height: "32px", border: `3px solid ${C.border}`, borderTop: `3px solid ${C.gold}`, borderRadius: "50%", margin: "0 auto 12px" }} /><div style={{ color: C.gold, fontWeight: "700" }}>جارٍ قراءة الملف...</div></>
                ) : fileName ? (
                  <><div style={{ fontSize: "36px", marginBottom: "8px" }}>{["jpg","jpeg","png","webp"].includes(fileType) ? "🖼️" : fileType === "pdf" ? "📄" : "📝"}</div><div style={{ color: C.green, fontWeight: "700", marginBottom: "4px" }}>✓ تم رفع الملف</div><div style={{ color: C.muted, fontSize: "13px", marginBottom: "10px" }}>{fileName}</div><button onClick={(e) => { e.stopPropagation(); reset(); }} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "4px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>× حذف</button></>
                ) : (
                  <><div style={{ fontSize: "40px", marginBottom: "12px" }}>☁️</div><div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "6px" }}>اسحب الملف هنا أو اضغط للرفع</div><div style={{ color: C.muted, fontSize: "13px" }}>PDF · DOCX · JPG · PNG · TXT</div></>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
              </div>

              {imageData && <div style={{ marginBottom: "14px", borderRadius: "10px", overflow: "hidden", maxHeight: "180px", textAlign: "center", background: C.card, border: `1px solid ${C.border}` }}><img src={`data:${imageData.mediaType};base64,${imageData.base64}`} alt="preview" style={{ maxHeight: "180px", maxWidth: "100%", objectFit: "contain" }} /></div>}

              {!fileName && <>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "16px 0" }}>
                  <div style={{ flex: 1, height: "1px", background: C.border }} />
                  <span style={{ color: C.muted, fontSize: "12px" }}>أو الصق نص العقد مباشرة</span>
                  <div style={{ flex: 1, height: "1px", background: C.border }} />
                </div>
                <textarea style={{ width: "100%", minHeight: "150px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "14px", color: C.text, fontSize: "14px", fontFamily: "inherit", direction: "rtl", resize: "vertical", outline: "none", lineHeight: "1.7" }} value={text} onChange={(e) => setText(e.target.value)} placeholder="الصق نص العقد هنا مباشرة..." />
              </>}

              {error && <div style={{ color: C.red, fontSize: "13px", margin: "12px 0", padding: "12px", background: `${C.red}11`, borderRadius: "8px", border: `1px solid ${C.red}33` }}>⚠️ {error}</div>}

              <button className="btn" disabled={!hasContent} onClick={analyze}
                style={{ width: "100%", padding: "16px", background: hasContent ? `linear-gradient(135deg,${C.gold},${C.goldLight})` : C.border, color: hasContent ? "#0B0F1A" : C.muted, border: "none", borderRadius: "12px", fontSize: "17px", fontWeight: "800", cursor: hasContent ? "pointer" : "default", marginTop: "14px", transition: "all .2s", fontFamily: "inherit" }}>
                🔍 ابدأ تحليل العقد
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="up" style={{ textAlign: "center", padding: "80px 20px" }}>
              <div className="spin" style={{ width: "52px", height: "52px", border: `3px solid ${C.border}`, borderTop: `3px solid ${C.gold}`, borderRadius: "50%", margin: "0 auto 20px" }} />
              <div style={{ color: C.gold, fontSize: "20px", fontWeight: "800", marginBottom: "8px" }}>جارٍ تحليل العقد...</div>
              <div style={{ color: C.muted, fontSize: "14px" }}>يراجع الذكاء الاصطناعي البنود والمخاطر والتوصيات</div>
            </div>
          )}

          {/* Report */}
          {report && !loading && (
            <div className="up">
              {report._raw ? (
                <Section title="📄 نتيجة التحليل" color={C.gold}><p style={{ color: C.muted, lineHeight: "1.8", fontSize: "14px", whiteSpace: "pre-wrap" }}>{report._raw}</p></Section>
              ) : (
                <>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", paddingBottom: "20px", borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: "22px", fontWeight: "900" }}>تقرير مراجعة العقد</div>
                      <div style={{ color: C.muted, fontSize: "12px", marginTop: "4px" }}>{new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}</div>
                      {report.contractType && <div style={{ color: C.muted, fontSize: "13px", marginTop: "4px" }}>النوع: <span style={{ color: C.text }}>{report.contractType}</span></div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                      {report.riskLevel && <Tag label={`● مستوى الخطر: ${report.riskLevel}`} color={rc(report.riskLevel)} />}
                      <button onClick={reset} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "7px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}>↩ تحليل جديد</button>
                    </div>
                  </div>

                  {/* Score Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>
                    {[
                      { v: report.overallScore ?? "—", l: "جودة العقد / 100", c: (report.overallScore ?? 0) >= 70 ? C.green : (report.overallScore ?? 0) >= 50 ? C.orange : C.red },
                      { v: report.risks?.length ?? 0, l: "مخاطر محددة", c: C.red },
                      { v: report.missingClauses?.length ?? 0, l: "بنود مفقودة", c: C.orange },
                    ].map(s => (
                      <div key={s.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "18px", textAlign: "center" }}>
                        <div style={{ fontSize: "30px", fontWeight: "900", color: s.c, lineHeight: 1, marginBottom: "6px" }}>{s.v}</div>
                        <div style={{ fontSize: "11px", color: C.muted, fontWeight: "600" }}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Executive Summary */}
                  {report.executiveSummary && (
                    <Section title="✦ الملخص التنفيذي" color={C.gold}>
                      <p style={{ color: C.text, lineHeight: "1.9", fontSize: "15px" }}>{report.executiveSummary}</p>
                    </Section>
                  )}

                  {/* Overall Recommendation */}
                  {report.overallRecommendation && (
                    <Section title="📌 التوصية الشاملة" color={C.blue}>
                      <p style={{ color: C.text, lineHeight: "1.9", fontSize: "14px" }}>{report.overallRecommendation}</p>
                    </Section>
                  )}

                  {/* Parties */}
                  {report.contractParties && (
                    <Section title="👥 أطراف العقد" color={C.blue}>
                      <Row label="الطرف الأول" value={report.contractParties.party1} />
                      <Row label="الطرف الثاني" value={report.contractParties.party2} />
                      {report.contractParties.balanceAssessment && <Row label="توازن الالتزامات" value={report.contractParties.balanceAssessment} />}
                    </Section>
                  )}

                  {/* Financial Terms */}
                  {report.keyFinancialTerms && (
                    <Section title="💰 الشروط المالية" color={C.gold}>
                      {report.keyFinancialTerms.value && <Row label="قيمة العقد" value={report.keyFinancialTerms.value} color={C.green} />}
                      {report.keyFinancialTerms.paymentTerms && <Row label="شروط الدفع" value={report.keyFinancialTerms.paymentTerms} />}
                      {report.keyFinancialTerms.penalties && <Row label="الغرامات والجزاءات" value={report.keyFinancialTerms.penalties} color={C.red} />}
                      {report.keyFinancialTerms.vat && <Row label="ضريبة القيمة المضافة" value={report.keyFinancialTerms.vat} />}
                      {report.keyFinancialTerms.assessment && <div style={{ marginTop: "10px", padding: "10px", background: `${C.gold}08`, borderRadius: "8px", fontSize: "13px", color: C.muted, lineHeight: "1.7" }}>{report.keyFinancialTerms.assessment}</div>}
                    </Section>
                  )}

                  {/* Risks */}
                  {report.risks?.length > 0 && (
                    <Section title={`⚠️ المخاطر المكتشفة (${report.risks.length})`} color={C.red}>
                      {report.risks.map((r, i) => (
                        <div key={i} style={{ padding: "14px", background: `${C.surface}`, borderRadius: "10px", marginBottom: "10px", border: `1px solid ${rc(r.severity)}22` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <div style={{ fontWeight: "700", fontSize: "14px" }}>{r.title}</div>
                            <Tag label={r.severity} color={rc(r.severity)} />
                          </div>
                          {r.detail && <div style={{ color: C.muted, fontSize: "13px", lineHeight: "1.7", marginBottom: "8px" }}>{r.detail}</div>}
                          {r.contractReference && <div style={{ background: `${C.border}44`, padding: "8px 12px", borderRadius: "6px", fontSize: "12px", color: C.muted, marginBottom: "8px" }}>📎 {r.contractReference}</div>}
                          {r.recommendation && <div style={{ color: C.green, fontSize: "13px", lineHeight: "1.7" }}>💡 {r.recommendation}</div>}
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Missing Clauses */}
                  {report.missingClauses?.length > 0 && (
                    <Section title={`📋 البنود المفقودة (${report.missingClauses.length})`} color={C.orange}>
                      {report.missingClauses.map((c, i) => (
                        <div key={i} style={{ padding: "12px", background: C.surface, borderRadius: "10px", marginBottom: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <div style={{ fontWeight: "700", fontSize: "14px" }}>{c.clause}</div>
                            {c.importance && <Tag label={c.importance} color={rc(c.importance)} />}
                          </div>
                          {c.reason && <div style={{ color: C.muted, fontSize: "13px", lineHeight: "1.7", marginBottom: "6px" }}>{c.reason}</div>}
                          {c.suggestedText && <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}33`, padding: "8px 12px", borderRadius: "6px", fontSize: "12px", color: C.green, lineHeight: "1.7" }}>نص مقترح: {c.suggestedText}</div>}
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Critical Clauses */}
                  {report.criticalClauses?.length > 0 && (
                    <Section title="🔴 البنود الحرجة التي تحتاج تعديل" color={C.red}>
                      {report.criticalClauses.map((c, i) => (
                        <div key={i} style={{ padding: "12px", background: C.surface, borderRadius: "10px", marginBottom: "10px" }}>
                          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "8px" }}>{c.title}</div>
                          {c.currentText && <div style={{ background: `${C.red}11`, padding: "8px 12px", borderRadius: "6px", fontSize: "12px", color: C.muted, marginBottom: "6px", lineHeight: "1.7" }}>النص الحالي: {c.currentText}</div>}
                          {c.issue && <div style={{ color: C.red, fontSize: "13px", marginBottom: "6px" }}>⚠️ {c.issue}</div>}
                          {c.suggestedAmendment && <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}33`, padding: "8px 12px", borderRadius: "6px", fontSize: "12px", color: C.green, lineHeight: "1.7" }}>التعديل المقترح: {c.suggestedAmendment}</div>}
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Saudi Compliance */}
                  {report.saudiComplianceCheck?.length > 0 && (
                    <Section title="🇸🇦 التوافق مع الأنظمة السعودية" color={C.blue}>
                      {report.saudiComplianceCheck.map((s, i) => (
                        <div key={i} style={{ display: "flex", gap: "12px", padding: "10px 0", borderBottom: i < report.saudiComplianceCheck.length - 1 ? `1px solid ${C.border}33` : "none", alignItems: "flex-start", fontSize: "13px" }}>
                          <Tag label={s.status} color={s.status === "متوافق" ? C.green : s.status === "غير متوافق" ? C.red : C.orange} />
                          <div style={{ flex: 1 }}><div style={{ fontWeight: "700", marginBottom: "3px" }}>{s.regulation}</div><div style={{ color: C.muted, lineHeight: "1.6" }}>{s.notes}</div></div>
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Negotiation */}
                  {report.negotiationStrategy && (
                    <Section title="🤝 استراتيجية التفاوض" color={C.green}>
                      {report.negotiationStrategy.priority && <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}33`, padding: "12px 16px", borderRadius: "8px", color: C.green, fontSize: "14px", fontWeight: "700", marginBottom: "14px" }}>🎯 الأولوية: {report.negotiationStrategy.priority}</div>}
                      {report.negotiationStrategy.tips?.map((t, i) => (
                        <div key={i} style={{ padding: "12px", background: C.surface, borderRadius: "10px", marginBottom: "8px" }}>
                          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "6px" }}>{t.point}</div>
                          {t.approach && <div style={{ color: C.muted, fontSize: "13px", marginBottom: "4px" }}>الأسلوب: {t.approach}</div>}
                          {t.leverage && <div style={{ color: C.green, fontSize: "13px" }}>نقطة القوة: {t.leverage}</div>}
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Duration */}
                  {report.contractDuration && (
                    <Section title="📅 مدة العقد وإنهاؤه" color={C.muted}>
                      {report.contractDuration.period && <Row label="مدة العقد" value={report.contractDuration.period} />}
                      {report.contractDuration.renewalTerms && <Row label="شروط التجديد" value={report.contractDuration.renewalTerms} />}
                      {report.contractDuration.terminationConditions && <Row label="شروط الإنهاء" value={report.contractDuration.terminationConditions} />}
                      {report.contractDuration.assessment && <div style={{ marginTop: "10px", color: C.muted, fontSize: "13px", lineHeight: "1.7" }}>{report.contractDuration.assessment}</div>}
                    </Section>
                  )}

                  <div style={{ textAlign: "center", marginTop: "24px" }}>
                    <button onClick={reset} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "12px 32px", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontFamily: "inherit" }}>↩ تحليل عقد جديد</button>
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
