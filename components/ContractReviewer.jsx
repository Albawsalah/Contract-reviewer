import { useState, useRef, useEffect } from "react";

const C = {
  bg:"#0B0F1A",surface:"#131929",card:"#1A2235",
  border:"#243050",gold:"#C9A84C",goldLight:"#E8C97A",
  red:"#E05252",green:"#4ECCA3",blue:"#4A90D9",
  orange:"#F0A500",text:"#E8EDF5",muted:"#7B8BAA",purple:"#9B59B6",
};

const RISK_COLORS = {"عالي":C.red,"متوسط":C.orange,"منخفض":C.green,"High":C.red,"Medium":C.orange,"Low":C.green};
const STATUS_COLORS = {"compliant":C.green,"non-compliant":C.red,"needs-review":C.orange,"متوافق":C.green,"غير متوافق":C.red,"يحتاج مراجعة":C.orange};

const rc = (l) => RISK_COLORS[l] || C.muted;
const sc = (s) => STATUS_COLORS[s] || C.orange;

function Tag({label,color}){
  const c=color||C.muted;
  return <span style={{background:`${c}18`,border:`1px solid ${c}44`,color:c,padding:"3px 12px",borderRadius:"20px",fontSize:"12px",fontWeight:"700",whiteSpace:"nowrap"}}>{label}</span>;
}

function Section({icon,title,color,children}){
  return(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",padding:"22px",marginBottom:"16px",borderTop:`3px solid ${color}`}}>
      <div style={{color,fontWeight:"900",fontSize:"15px",marginBottom:"16px",display:"flex",alignItems:"center",gap:"8px"}}>
        <span>{icon}</span><span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function InfoRow({label,value,valueColor}){
  if(!value)return null;
  return(
    <div style={{display:"flex",gap:"12px",padding:"10px 0",borderBottom:`1px solid ${C.border}44`,fontSize:"14px",flexWrap:"wrap"}}>
      <span style={{color:C.muted,fontWeight:"700",minWidth:"130px",flexShrink:0}}>{label}</span>
      <span style={{color:valueColor||C.text,flex:1}}>{value}</span>
    </div>
  );
}

export default function ContractReviewer(){
  const [text,setText]=useState("");
  const [fileName,setFileName]=useState("");
  const [fileType,setFileType]=useState("");
  const [imageData,setImageData]=useState(null);
  const [charCount,setCharCount]=useState(0);
  const [loading,setLoading]=useState(false);
  const [extracting,setExtracting]=useState(false);
  const [report,setReport]=useState(null);
  const [rawFallback,setRawFallback]=useState("");
  const [error,setError]=useState("");
  const [drag,setDrag]=useState(false);
  const [mammoth,setMammoth]=useState(null);
  const fileRef=useRef();

  const ar = report?.contractLanguage === "arabic";

  useEffect(()=>{
    import("mammoth").then(setMammoth).catch(()=>{});
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>{ if(window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; };
    document.head.appendChild(s);
  },[]);

  const reset=()=>{ setReport(null);setText("");setFileName("");setFileType("");setImageData(null);setError("");setCharCount(0);setRawFallback(""); };

  const handleFile=async(file)=>{
    if(!file)return;
    const ext=file.name.split(".").pop().toLowerCase();
    if(!["txt","docx","pdf","jpg","jpeg","png","webp"].includes(ext)){setError("صيغة غير مدعومة");return;}
    setError("");setFileName(file.name);setFileType(ext);setImageData(null);setText("");setCharCount(0);setExtracting(true);
    try{
      if(ext==="txt"){ const t=(await file.text()).slice(0,15000);setText(t);setCharCount(t.length); }
      else if(ext==="docx"){
        if(!mammoth){setError("حاول مجدداً");setExtracting(false);return;}
        const r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
        const t=r.value.slice(0,15000);setText(t);setCharCount(t.length);
      }else if(ext==="pdf"){
        if(!window.pdfjsLib){setError("حاول مجدداً");setExtracting(false);return;}
        const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
        let t="";
        for(let i=1;i<=Math.min(pdf.numPages,25);i++){
          const pg=await pdf.getPage(i);
          const ct=await pg.getTextContent();
          t+=ct.items.map(x=>x.str).join(" ")+"\n";
        }
        if(t.trim().length<30){setError("PDF مسحوح — ارفعه كصورة JPG");setExtracting(false);return;}
        const sl=t.slice(0,15000);setText(sl);setCharCount(sl.length);
      }else{
        const reader=new FileReader();
        reader.onload=(e)=>{setImageData({base64:e.target.result.split(",")[1],mediaType:file.type||"image/jpeg"});setCharCount(-1);};
        reader.readAsDataURL(file);
      }
    }catch(e){setError("خطأ: "+e.message);}
    setExtracting(false);
  };

  const analyze=async()=>{
    const isImg=imageData&&!text;
    if(!text.trim()&&!isImg){setError("الرجاء إدخال نص أو رفع ملف");return;}
    setError("");setLoading(true);setReport(null);setRawFallback("");
    try{
      const messages=isImg
        ?[{role:"user",content:[{type:"image",source:{type:"base64",media_type:imageData.mediaType,data:imageData.base64}},{type:"text",text:"Read the contract in this image and analyze it. Return JSON only."}]}]
        :[{role:"user",content:`Analyze this contract thoroughly:\n\n${text.slice(0,12000)}`}];

      const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})});
      const data=await res.json();

      if(!res.ok){setError(`خطأ ${res.status}`);setLoading(false);return;}

      if(data.parsed){ setReport(data.parsed); }
      else if(data.raw){ setRawFallback(data.raw); }
      else { setError("لم يتم الحصول على نتيجة"); }

    }catch(e){setError("خطأ: "+e.message);}
    setLoading(false);
  };

  const hasContent=text.trim()||imageData;
  const scoreColor=(s)=>s>=70?C.green:s>=50?C.orange:C.red;

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fadeUp{animation:fadeUp .4s ease}
        .dz{transition:all .3s}.dz:hover,.dz.drag{border-color:${C.gold}!important;background:${C.gold}08!important}
        .btn:hover{transform:translateY(-2px);box-shadow:0 6px 24px ${C.gold}44}
        textarea:focus{border-color:${C.gold}!important;box-shadow:0 0 0 3px ${C.gold}20}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
      `}</style>

      <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Cairo',sans-serif",direction:"rtl",color:C.text}}>

        {/* Header */}
        <header style={{background:`linear-gradient(135deg,${C.surface},#0D1520)`,borderBottom:`1px solid ${C.border}`,padding:"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <div style={{width:"40px",height:"40px",background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>⚖️</div>
            <div>
              <div style={{fontSize:"17px",fontWeight:"800"}}>مراجع العقود الذكي</div>
              <div style={{fontSize:"11px",color:C.muted}}>PDF · Word · صورة · نص</div>
            </div>
          </div>
          <div style={{background:`${C.gold}18`,border:`1px solid ${C.gold}44`,color:C.gold,padding:"5px 12px",borderRadius:"20px",fontSize:"11px",fontWeight:"600"}}>✦ Claude AI</div>
        </header>

        <main style={{maxWidth:"860px",margin:"0 auto",padding:"32px 16px"}}>

          {/* Input */}
          {!report&&!rawFallback&&!loading&&(
            <div className="fadeUp">
              <h1 style={{fontSize:"30px",fontWeight:"900",textAlign:"center",marginBottom:"8px",background:`linear-gradient(135deg,${C.text},${C.goldLight})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>راجع عقدك في 30 ثانية</h1>
              <p style={{textAlign:"center",color:C.muted,fontSize:"14px",marginBottom:"24px"}}>تحليل قانوني وتجاري معمق — مخصص لكل عقد</p>

              <div className={`dz${drag?" drag":""}`}
                style={{background:C.card,border:`2px dashed ${C.border}`,borderRadius:"14px",padding:"28px",textAlign:"center",cursor:"pointer",marginBottom:"14px"}}
                onClick={()=>fileRef.current.click()}
                onDragOver={e=>{e.preventDefault();setDrag(true);}}
                onDragLeave={()=>setDrag(false)}
                onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}>
                {extracting?(
                  <><div style={{width:"28px",height:"28px",border:`2px solid ${C.border}`,borderTop:`2px solid ${C.gold}`,borderRadius:"50%",margin:"0 auto 10px",animation:"spin 1s linear infinite"}}/><div style={{color:C.gold,fontWeight:"700"}}>جارٍ قراءة الملف...</div></>
                ):fileName?(
                  <>
                    <div style={{fontSize:"32px",marginBottom:"6px"}}>{["jpg","jpeg","png","webp"].includes(fileType)?"🖼️":fileType==="pdf"?"📄":"📝"}</div>
                    <div style={{color:C.green,fontWeight:"700",marginBottom:"3px"}}>✓ تم رفع الملف</div>
                    <div style={{color:C.muted,fontSize:"13px",marginBottom:"4px"}}>{fileName}</div>
                    {charCount>0&&<div style={{color:C.blue,fontSize:"12px",marginBottom:"8px"}}>📊 {charCount.toLocaleString()} حرف</div>}
                    {charCount===-1&&<div style={{color:C.blue,fontSize:"12px",marginBottom:"8px"}}>🖼️ صورة جاهزة للتحليل</div>}
                    <button onClick={e=>{e.stopPropagation();reset();}} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"3px 10px",borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontFamily:"inherit"}}>× حذف</button>
                  </>
                ):(
                  <><div style={{fontSize:"36px",marginBottom:"10px"}}>☁️</div><div style={{fontSize:"15px",fontWeight:"700",marginBottom:"4px"}}>اسحب الملف هنا أو اضغط</div><div style={{color:C.muted,fontSize:"12px"}}>PDF · DOCX · JPG · PNG · TXT</div></>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
              </div>

              {imageData&&<div style={{marginBottom:"12px",borderRadius:"10px",overflow:"hidden",maxHeight:"160px",textAlign:"center",background:C.card}}><img src={`data:${imageData.mediaType};base64,${imageData.base64}`} alt="preview" style={{maxHeight:"160px",maxWidth:"100%",objectFit:"contain"}}/></div>}

              {!fileName&&<>
                <div style={{display:"flex",alignItems:"center",gap:"12px",margin:"14px 0"}}>
                  <div style={{flex:1,height:"1px",background:C.border}}/><span style={{color:C.muted,fontSize:"12px"}}>أو الصق النص مباشرة</span><div style={{flex:1,height:"1px",background:C.border}}/>
                </div>
                <textarea style={{width:"100%",minHeight:"140px",background:C.card,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"14px",color:C.text,fontSize:"14px",fontFamily:"inherit",direction:"rtl",resize:"vertical",outline:"none",lineHeight:"1.7"}} value={text} onChange={e=>{setText(e.target.value);setCharCount(e.target.value.length);}} placeholder="الصق نص العقد هنا..."/>
                {text&&<div style={{color:C.blue,fontSize:"12px",marginTop:"4px"}}>📊 {charCount.toLocaleString()} حرف</div>}
              </>}

              {error&&<div style={{color:C.red,fontSize:"13px",margin:"10px 0",padding:"10px 14px",background:`${C.red}11`,borderRadius:"8px",border:`1px solid ${C.red}33`}}>⚠️ {error}</div>}

              <button className="btn" disabled={!hasContent} onClick={analyze}
                style={{width:"100%",padding:"15px",background:hasContent?`linear-gradient(135deg,${C.gold},${C.goldLight})`:C.border,color:hasContent?"#0B0F1A":C.muted,border:"none",borderRadius:"12px",fontSize:"16px",fontWeight:"800",cursor:hasContent?"pointer":"default",marginTop:"12px",transition:"all .2s",fontFamily:"inherit"}}>
                🔍 ابدأ تحليل العقد
              </button>
            </div>
          )}

          {/* Loading */}
          {loading&&(
            <div className="fadeUp" style={{textAlign:"center",padding:"70px 20px"}}>
              <div style={{width:"48px",height:"48px",border:`3px solid ${C.border}`,borderTop:`3px solid ${C.gold}`,borderRadius:"50%",margin:"0 auto 18px",animation:"spin 1s linear infinite"}}/>
              <div style={{color:C.gold,fontSize:"18px",fontWeight:"800",marginBottom:"6px"}}>جارٍ تحليل العقد...</div>
              <div style={{color:C.muted,fontSize:"13px"}}>يراجع الذكاء الاصطناعي البنود والمخاطر</div>
            </div>
          )}

          {/* Raw fallback */}
          {rawFallback&&!loading&&(
            <div className="fadeUp" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"14px",padding:"20px"}}>
              <div style={{color:C.gold,fontWeight:"800",marginBottom:"12px"}}>📄 نتيجة التحليل</div>
              <pre style={{color:C.muted,fontSize:"13px",whiteSpace:"pre-wrap",lineHeight:"1.8"}}>{rawFallback}</pre>
              <button onClick={reset} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"8px 20px",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontFamily:"inherit",marginTop:"16px"}}>↩ تحليل جديد</button>
            </div>
          )}

          {/* Formatted Report */}
          {report&&!loading&&(()=>{
            const r=report;
            const sc_=r.overallScore||0;
            return(
              <div className="fadeUp">

                {/* Report Header */}
                <div style={{background:`linear-gradient(135deg,${C.card},${C.surface})`,border:`1px solid ${C.border}`,borderRadius:"16px",padding:"24px",marginBottom:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px"}}>
                    <div>
                      <div style={{fontSize:"22px",fontWeight:"900",marginBottom:"4px"}}>{ar?"تقرير مراجعة العقد":"Contract Review Report"}</div>
                      <div style={{color:C.muted,fontSize:"12px"}}>{new Date().toLocaleDateString(ar?"ar-SA":"en-US",{year:"numeric",month:"long",day:"numeric"})}</div>
                      {r.contractType&&<div style={{color:C.text,fontSize:"14px",marginTop:"6px",fontWeight:"600"}}>{ar?"النوع: ":"Type: "}{r.contractType}</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"8px"}}>
                      {r.riskLevel&&<Tag label={(ar?"مستوى الخطر: ":"Risk: ")+r.riskLevel} color={rc(r.riskLevel)}/>}
                      <button onClick={reset} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"7px 16px",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontFamily:"inherit"}}>{ar?"↩ تحليل جديد":"↩ New Analysis"}</button>
                    </div>
                  </div>
                </div>

                {/* Score Cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"16px"}}>
                  {[
                    {v:r.overallScore||"—",l:ar?"جودة العقد / 100":"Quality / 100",c:scoreColor(sc_)},
                    {v:r.risks?.length||0,l:ar?"مخاطر":"Risks",c:C.red},
                    {v:r.missingClauses?.length||0,l:ar?"بنود مفقودة":"Missing",c:C.orange},
                  ].map(s=>(
                    <div key={s.l} style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${s.c}`,borderRadius:"12px",padding:"16px",textAlign:"center"}}>
                      <div style={{fontSize:"28px",fontWeight:"900",color:s.c,lineHeight:1,marginBottom:"5px"}}>{s.v}</div>
                      <div style={{fontSize:"11px",color:C.muted,fontWeight:"600"}}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                {r.executiveSummary&&<Section icon="✦" title={ar?"الملخص التنفيذي":"Executive Summary"} color={C.gold}><p style={{color:C.text,lineHeight:"1.9",fontSize:"14px"}}>{r.executiveSummary}</p></Section>}

                {/* Recommendation */}
                {r.overallRecommendation&&<Section icon="📌" title={ar?"التوصية الشاملة":"Overall Recommendation"} color={C.blue}><p style={{color:C.text,lineHeight:"1.9",fontSize:"14px"}}>{r.overallRecommendation}</p></Section>}

                {/* Parties */}
                {r.partiesAnalysis&&(
                  <Section icon="👥" title={ar?"تحليل الأطراف":"Parties Analysis"} color={C.purple}>
                    <InfoRow label={ar?"الطرف الأول":"Party 1"} value={r.partiesAnalysis.party1}/>
                    <InfoRow label={ar?"الطرف الثاني":"Party 2"} value={r.partiesAnalysis.party2}/>
                    {r.partiesAnalysis.obligationsBalance&&<div style={{marginTop:"12px",padding:"12px",background:`${C.purple}11`,borderRadius:"8px",fontSize:"13px",color:C.muted,lineHeight:"1.8"}}>{r.partiesAnalysis.obligationsBalance}</div>}
                  </Section>
                )}

                {/* Financial */}
                {r.financialTerms&&(
                  <Section icon="💰" title={ar?"الشروط المالية":"Financial Terms"} color={C.gold}>
                    <InfoRow label={ar?"قيمة العقد":"Value"} value={r.financialTerms.contractValue} valueColor={C.green}/>
                    <InfoRow label={ar?"جدول الدفع":"Payment"} value={r.financialTerms.paymentSchedule}/>
                    <InfoRow label={ar?"الغرامات":"Penalties"} value={r.financialTerms.penalties} valueColor={C.red}/>
                    <InfoRow label={ar?"ضريبة القيمة المضافة":"VAT"} value={r.financialTerms.vatTreatment}/>
                    {r.financialTerms.financialRiskAssessment&&<div style={{marginTop:"12px",padding:"12px",background:`${C.gold}11`,borderRadius:"8px",fontSize:"13px",color:C.muted,lineHeight:"1.8"}}>{r.financialTerms.financialRiskAssessment}</div>}
                  </Section>
                )}

                {/* Risks */}
                {r.risks?.length>0&&(
                  <Section icon="⚠️" title={(ar?"المخاطر المكتشفة":"Identified Risks")+` (${r.risks.length})`} color={C.red}>
                    {r.risks.map((item,i)=>(
                      <div key={i} style={{background:C.surface,borderRadius:"12px",padding:"16px",marginBottom:"10px",borderRight:`3px solid ${rc(item.severity)}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px",gap:"8px"}}>
                          <div style={{fontWeight:"800",fontSize:"14px",flex:1}}>{item.title}</div>
                          <Tag label={item.severity} color={rc(item.severity)}/>
                        </div>
                        {item.detail&&<div style={{color:C.muted,fontSize:"13px",lineHeight:"1.8",marginBottom:"8px"}}>{item.detail}</div>}
                        {item.contractQuote&&<div style={{background:`${C.border}44`,padding:"8px 12px",borderRadius:"6px",fontSize:"12px",color:"#A0B0CC",marginBottom:"8px",borderRight:`2px solid ${C.gold}`,lineHeight:"1.7"}}>📎 {ar?"من نص العقد: ":"From contract: "}{item.contractQuote}</div>}
                        {item.recommendation&&<div style={{color:C.green,fontSize:"13px",lineHeight:"1.7"}}>💡 {item.recommendation}</div>}
                      </div>
                    ))}
                  </Section>
                )}

                {/* Missing Clauses */}
                {r.missingClauses?.length>0&&(
                  <Section icon="📋" title={(ar?"البنود المفقودة":"Missing Clauses")+` (${r.missingClauses.length})`} color={C.orange}>
                    {r.missingClauses.map((item,i)=>(
                      <div key={i} style={{background:C.surface,borderRadius:"12px",padding:"14px",marginBottom:"10px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px",gap:"8px"}}>
                          <div style={{fontWeight:"800",fontSize:"14px",flex:1}}>{item.clause}</div>
                          {item.importance&&<Tag label={item.importance} color={rc(item.importance)}/>}
                        </div>
                        {item.reason&&<div style={{color:C.muted,fontSize:"13px",lineHeight:"1.7",marginBottom:"8px"}}>{item.reason}</div>}
                        {item.suggestedText&&<div style={{background:`${C.green}11`,border:`1px solid ${C.green}33`,padding:"10px 12px",borderRadius:"8px",fontSize:"12px",color:C.green,lineHeight:"1.8"}}>✏️ {item.suggestedText}</div>}
                      </div>
                    ))}
                  </Section>
                )}

                {/* Critical Clauses */}
                {r.criticalClauses?.length>0&&(
                  <Section icon="🔴" title={(ar?"البنود الحرجة":"Critical Clauses")+` (${r.criticalClauses.length})`} color={C.red}>
                    {r.criticalClauses.map((item,i)=>(
                      <div key={i} style={{background:C.surface,borderRadius:"12px",padding:"14px",marginBottom:"10px"}}>
                        <div style={{fontWeight:"800",fontSize:"14px",marginBottom:"10px"}}>{item.title}</div>
                        {item.currentText&&<div style={{background:`${C.red}11`,padding:"8px 12px",borderRadius:"6px",fontSize:"12px",color:"#AABBCC",marginBottom:"8px",lineHeight:"1.7"}}><span style={{color:C.red,fontWeight:"700"}}>{ar?"النص الحالي: ":"Current: "}</span>{item.currentText}</div>}
                        {item.problem&&<div style={{color:C.red,fontSize:"13px",marginBottom:"8px",lineHeight:"1.7"}}>⚠️ {item.problem}</div>}
                        {item.suggestedAmendment&&<div style={{background:`${C.green}11`,border:`1px solid ${C.green}33`,padding:"8px 12px",borderRadius:"6px",fontSize:"12px",color:C.green,lineHeight:"1.7"}}><span style={{fontWeight:"700"}}>{ar?"التعديل المقترح: ":"Suggested: "}</span>{item.suggestedAmendment}</div>}
                      </div>
                    ))}
                  </Section>
                )}

                {/* Saudi Law */}
                {r.saudiLawCompliance?.length>0&&(
                  <Section icon="🇸🇦" title={ar?"التوافق مع الأنظمة السعودية":"Saudi Law Compliance"} color={C.blue}>
                    {r.saudiLawCompliance.map((item,i)=>(
                      <div key={i} style={{display:"flex",gap:"12px",padding:"12px 0",borderBottom:i<r.saudiLawCompliance.length-1?`1px solid ${C.border}44`:"none",alignItems:"flex-start"}}>
                        <Tag label={item.status} color={sc(item.status)}/>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:"700",fontSize:"13px",marginBottom:"4px"}}>{item.regulation}</div>
                          <div style={{color:C.muted,fontSize:"12px",lineHeight:"1.7"}}>{item.details}</div>
                        </div>
                      </div>
                    ))}
                  </Section>
                )}

                {/* Negotiation */}
                {r.negotiationStrategy&&(
                  <Section icon="🤝" title={ar?"استراتيجية التفاوض":"Negotiation Strategy"} color={C.green}>
                    {r.negotiationStrategy.topPriority&&<div style={{background:`${C.green}11`,border:`1px solid ${C.green}33`,padding:"12px 16px",borderRadius:"8px",color:C.green,fontSize:"14px",fontWeight:"700",marginBottom:"14px"}}>🎯 {ar?"الأولوية: ":"Priority: "}{r.negotiationStrategy.topPriority}</div>}
                    {r.negotiationStrategy.tips?.map((tip,i)=>(
                      <div key={i} style={{background:C.surface,borderRadius:"12px",padding:"14px",marginBottom:"10px"}}>
                        <div style={{fontWeight:"800",fontSize:"14px",marginBottom:"6px"}}>{tip.point}</div>
                        {tip.approach&&<div style={{color:C.muted,fontSize:"13px",marginBottom:"4px",lineHeight:"1.7"}}>{ar?"الأسلوب: ":"Approach: "}{tip.approach}</div>}
                        {tip.leverage&&<div style={{color:C.green,fontSize:"13px",lineHeight:"1.7"}}>💪 {ar?"نقطة قوتك: ":"Leverage: "}{tip.leverage}</div>}
                      </div>
                    ))}
                  </Section>
                )}

                {/* Duration */}
                {r.contractDuration&&(
                  <Section icon="📅" title={ar?"مدة العقد وإنهاؤه":"Contract Duration"} color={C.muted}>
                    <InfoRow label={ar?"المدة":"Duration"} value={r.contractDuration.period}/>
                    <InfoRow label={ar?"التجديد":"Renewal"} value={r.contractDuration.renewalTerms}/>
                    <InfoRow label={ar?"الإنهاء":"Termination"} value={r.contractDuration.terminationConditions}/>
                    {r.contractDuration.assessment&&<div style={{marginTop:"10px",color:C.muted,fontSize:"13px",lineHeight:"1.8"}}>{r.contractDuration.assessment}</div>}
                  </Section>
                )}

                <div style={{textAlign:"center",marginTop:"24px",paddingBottom:"32px"}}>
                  <button onClick={reset} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"12px 32px",borderRadius:"10px",cursor:"pointer",fontSize:"14px",fontFamily:"inherit"}}>
                    {ar?"↩ تحليل عقد جديد":"↩ Analyze New Contract"}
                  </button>
                </div>

              </div>
            );
          })()}

        </main>
      </div>
    </>
  );
}
