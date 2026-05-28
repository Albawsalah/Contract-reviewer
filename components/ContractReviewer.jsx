import { useState, useRef, useEffect } from "react";

const G = {
  bg:"#0B0F1A", s2:"#131929", card:"#1A2235", border:"#243050",
  gold:"#C9A84C", goldL:"#E8C97A", red:"#E05252", green:"#4ECCA3",
  blue:"#4A90D9", orange:"#F0A500", text:"#E8EDF5", muted:"#7B8BAA", purple:"#9B59B6"
};

const riskColor = (l) => ({"عالي":G.red,"متوسط":G.orange,"منخفض":G.green,"High":G.red,"Medium":G.orange,"Low":G.green})[l] || G.muted;
const statusColor = (s) => ({"متوافق":G.green,"compliant":G.green,"غير متوافق":G.red,"non-compliant":G.red})[s] || G.orange;

const Tag = ({t,c}) => <span style={{background:`${c}20`,border:`1px solid ${c}55`,color:c,padding:"3px 12px",borderRadius:"20px",fontSize:"12px",fontWeight:"700",display:"inline-block",whiteSpace:"nowrap"}}>{t}</span>;

const Box = ({icon,title,color,ch}) => (
  <div style={{background:G.card,border:`1px solid ${G.border}`,borderTop:`3px solid ${color}`,borderRadius:"14px",padding:"20px",marginBottom:"14px"}}>
    <div style={{color,fontWeight:"900",fontSize:"15px",marginBottom:"14px",display:"flex",gap:"8px",alignItems:"center"}}><span>{icon}</span><span>{title}</span></div>
    {ch}
  </div>
);

const KV = ({k,v,vc}) => v ? (
  <div style={{display:"flex",gap:"12px",padding:"9px 0",borderBottom:`1px solid ${G.border}44`,fontSize:"13px",flexWrap:"wrap"}}>
    <span style={{color:G.muted,fontWeight:"700",minWidth:"120px",flexShrink:0}}>{k}</span>
    <span style={{color:vc||G.text,flex:1,lineHeight:"1.7"}}>{v}</span>
  </div>
) : null;

export default function App() {
  const [txt,setTxt] = useState("");
  const [file,setFile] = useState("");
  const [ext,setExt] = useState("");
  const [img,setImg] = useState(null);
  const [chars,setChars] = useState(0);
  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [report,setReport] = useState(null);
  const [raw,setRaw] = useState("");
  const [err,setErr] = useState("");
  const [drag,setDrag] = useState(false);
  const [mam,setMam] = useState(null);
  const ref = useRef();

  useEffect(() => {
    import("mammoth").then(setMam).catch(()=>{});
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { if(window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; };
    document.head.appendChild(s);
  },[]);

  const clear = () => { setReport(null);setTxt("");setFile("");setExt("");setImg(null);setErr("");setChars(0);setRaw(""); };

  const readFile = async (f) => {
    if(!f) return;
    const e = f.name.split(".").pop().toLowerCase();
    if(!["txt","docx","pdf","jpg","jpeg","png","webp"].includes(e)){setErr("صيغة غير مدعومة");return;}
    setErr("");setFile(f.name);setExt(e);setImg(null);setTxt("");setChars(0);setBusy(true);
    try {
      if(e==="txt"){ const t=(await f.text()).slice(0,15000);setTxt(t);setChars(t.length); }
      else if(e==="docx"){
        if(!mam){setErr("حاول مجدداً");setBusy(false);return;}
        const r=await mam.extractRawText({arrayBuffer:await f.arrayBuffer()});
        const t=r.value.slice(0,15000);setTxt(t);setChars(t.length);
      } else if(e==="pdf"){
        if(!window.pdfjsLib){setErr("حاول مجدداً");setBusy(false);return;}
        const pdf=await window.pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;
        let t="";
        for(let i=1;i<=Math.min(pdf.numPages,25);i++){
          const pg=await pdf.getPage(i);
          const c=await pg.getTextContent();
          t+=c.items.map(x=>x.str).join(" ")+"\n";
        }
        if(t.trim().length<30){setErr("PDF مسحوح — ارفعه كصورة JPG");setBusy(false);return;}
        const sl=t.slice(0,15000);setTxt(sl);setChars(sl.length);
      } else {
        const rd=new FileReader();
        rd.onload=(ev)=>{setImg({b64:ev.target.result.split(",")[1],mt:f.type||"image/jpeg"});setChars(-1);};
        rd.readAsDataURL(f);
      }
    } catch(ex){setErr("خطأ: "+ex.message);}
    setBusy(false);
  };

  const go = async () => {
    const isImg=img&&!txt;
    if(!txt.trim()&&!isImg){setErr("الرجاء إدخال نص أو رفع ملف");return;}
    setErr("");setLoading(true);setReport(null);setRaw("");
    try {
      const msgs = isImg
        ? [{role:"user",content:[{type:"image",source:{type:"base64",media_type:img.mt,data:img.b64}},{type:"text",text:"اقرأ نص العقد في الصورة وحلله. أعد JSON فقط."}]}]
        : [{role:"user",content:`حلل هذا العقد:\n\n${txt.slice(0,12000)}`}];

      const res = await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:msgs})});
      const d = await res.json();
      if(!res.ok){setErr("خطأ "+res.status);setLoading(false);return;}
      if(d.ok && d.data) setReport(d.data);
      else if(d.raw) setRaw(d.raw);
      else setErr("لم يتم الحصول على نتيجة");
    } catch(ex){setErr("خطأ: "+ex.message);}
    setLoading(false);
  };

  const ar = report?.lang === "ar";
  const ok = txt.trim()||img;

  const scoreC = (s) => s>=70?G.green:s>=50?G.orange:G.red;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${G.bg}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    .up{animation:up .4s ease}
    .spin{animation:spin 1s linear infinite}
    .dz{transition:all .3s}
    .dz:hover,.dz.on{border-color:${G.gold}!important;background:${G.gold}08!important}
    textarea:focus{border-color:${G.gold}!important;box-shadow:0 0 0 3px ${G.gold}20}
    .gbtn:hover{transform:translateY(-2px);box-shadow:0 6px 24px ${G.gold}44}
    ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${G.bg}}::-webkit-scrollbar-thumb{background:${G.border};border-radius:3px}
  `;

  return (
    <>
      <style>{css}</style>
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:"'Cairo',sans-serif",direction:"rtl",color:G.text}}>

        {/* Header */}
        <header style={{background:`linear-gradient(135deg,${G.s2},#0D1520)`,borderBottom:`1px solid ${G.border}`,padding:"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <div style={{width:"40px",height:"40px",background:`linear-gradient(135deg,${G.gold},${G.goldL})`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>⚖️</div>
            <div>
              <div style={{fontSize:"17px",fontWeight:"800"}}>مراجع العقود الذكي</div>
              <div style={{fontSize:"11px",color:G.muted}}>PDF · Word · صورة · نص</div>
            </div>
          </div>
          <div style={{background:`${G.gold}18`,border:`1px solid ${G.gold}44`,color:G.gold,padding:"5px 12px",borderRadius:"20px",fontSize:"11px",fontWeight:"600"}}>✦ Claude AI</div>
        </header>

        <main style={{maxWidth:"860px",margin:"0 auto",padding:"32px 16px"}}>

          {/* ===== INPUT ===== */}
          {!report && !raw && !loading && (
            <div className="up">
              <h1 style={{fontSize:"30px",fontWeight:"900",textAlign:"center",marginBottom:"8px",background:`linear-gradient(135deg,${G.text},${G.goldL})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>راجع عقدك في 30 ثانية</h1>
              <p style={{textAlign:"center",color:G.muted,fontSize:"14px",marginBottom:"24px"}}>تحليل قانوني وتجاري معمق — عربي أو إنجليزي</p>

              <div className={`dz${drag?" on":""}`}
                style={{background:G.card,border:`2px dashed ${G.border}`,borderRadius:"14px",padding:"28px",textAlign:"center",cursor:"pointer",marginBottom:"14px"}}
                onClick={()=>ref.current.click()}
                onDragOver={e=>{e.preventDefault();setDrag(true);}}
                onDragLeave={()=>setDrag(false)}
                onDrop={e=>{e.preventDefault();setDrag(false);readFile(e.dataTransfer.files[0]);}}>
                {busy ? (
                  <><div className="spin" style={{width:"28px",height:"28px",border:`2px solid ${G.border}`,borderTop:`2px solid ${G.gold}`,borderRadius:"50%",margin:"0 auto 10px"}}/><div style={{color:G.gold,fontWeight:"700"}}>جارٍ قراءة الملف...</div></>
                ) : file ? (
                  <>
                    <div style={{fontSize:"32px",marginBottom:"6px"}}>{["jpg","jpeg","png","webp"].includes(ext)?"🖼️":ext==="pdf"?"📄":"📝"}</div>
                    <div style={{color:G.green,fontWeight:"700",marginBottom:"3px"}}>✓ تم رفع الملف</div>
                    <div style={{color:G.muted,fontSize:"13px",marginBottom:"6px"}}>{file}</div>
                    {chars>0&&<div style={{color:G.blue,fontSize:"12px",marginBottom:"8px"}}>📊 {chars.toLocaleString()} حرف</div>}
                    {chars===-1&&<div style={{color:G.blue,fontSize:"12px",marginBottom:"8px"}}>🖼️ صورة جاهزة</div>}
                    <button onClick={e=>{e.stopPropagation();clear();}} style={{background:"transparent",border:`1px solid ${G.border}`,color:G.muted,padding:"3px 10px",borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontFamily:"inherit"}}>× حذف</button>
                  </>
                ) : (
                  <><div style={{fontSize:"36px",marginBottom:"10px"}}>☁️</div><div style={{fontSize:"15px",fontWeight:"700",marginBottom:"4px"}}>اسحب الملف هنا أو اضغط</div><div style={{color:G.muted,fontSize:"12px"}}>PDF · DOCX · JPG · PNG · TXT</div></>
                )}
                <input ref={ref} type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" style={{display:"none"}} onChange={e=>readFile(e.target.files[0])}/>
              </div>

              {img && <div style={{marginBottom:"12px",borderRadius:"10px",overflow:"hidden",maxHeight:"160px",textAlign:"center",background:G.card}}><img src={`data:${img.mt};base64,${img.b64}`} alt="preview" style={{maxHeight:"160px",maxWidth:"100%",objectFit:"contain"}}/></div>}

              {!file && <>
                <div style={{display:"flex",alignItems:"center",gap:"12px",margin:"14px 0"}}>
                  <div style={{flex:1,height:"1px",background:G.border}}/><span style={{color:G.muted,fontSize:"12px"}}>أو الصق النص مباشرة</span><div style={{flex:1,height:"1px",background:G.border}}/>
                </div>
                <textarea style={{width:"100%",minHeight:"140px",background:G.card,border:`1px solid ${G.border}`,borderRadius:"12px",padding:"14px",color:G.text,fontSize:"14px",fontFamily:"inherit",direction:"rtl",resize:"vertical",outline:"none",lineHeight:"1.7"}}
                  value={txt} onChange={e=>{setTxt(e.target.value);setChars(e.target.value.length);}} placeholder="الصق نص العقد هنا..."/>
                {txt&&<div style={{color:G.blue,fontSize:"12px",marginTop:"4px"}}>📊 {chars.toLocaleString()} حرف</div>}
              </>}

              {err&&<div style={{color:G.red,fontSize:"13px",margin:"10px 0",padding:"10px 14px",background:`${G.red}11`,borderRadius:"8px",border:`1px solid ${G.red}33`}}>⚠️ {err}</div>}

              <button className="gbtn" disabled={!ok} onClick={go}
                style={{width:"100%",padding:"15px",background:ok?`linear-gradient(135deg,${G.gold},${G.goldL})`:G.border,color:ok?"#0B0F1A":G.muted,border:"none",borderRadius:"12px",fontSize:"16px",fontWeight:"800",cursor:ok?"pointer":"default",marginTop:"12px",transition:"all .2s",fontFamily:"inherit"}}>
                🔍 ابدأ تحليل العقد
              </button>
            </div>
          )}

          {/* ===== LOADING ===== */}
          {loading && (
            <div className="up" style={{textAlign:"center",padding:"70px 20px"}}>
              <div className="spin" style={{width:"48px",height:"48px",border:`3px solid ${G.border}`,borderTop:`3px solid ${G.gold}`,borderRadius:"50%",margin:"0 auto 18px"}}/>
              <div style={{color:G.gold,fontSize:"18px",fontWeight:"800",marginBottom:"6px"}}>جارٍ تحليل العقد...</div>
              <div style={{color:G.muted,fontSize:"13px"}}>يراجع الذكاء الاصطناعي البنود والمخاطر</div>
            </div>
          )}

          {/* ===== RAW FALLBACK ===== */}
          {raw && !loading && (
            <div className="up" style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:"14px",padding:"20px"}}>
              <div style={{color:G.gold,fontWeight:"800",marginBottom:"12px"}}>📄 نتيجة التحليل</div>
              <pre style={{color:G.muted,fontSize:"13px",whiteSpace:"pre-wrap",lineHeight:"1.8"}}>{raw}</pre>
              <button onClick={clear} style={{background:"transparent",border:`1px solid ${G.border}`,color:G.muted,padding:"8px 20px",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontFamily:"inherit",marginTop:"16px"}}>↩ تحليل جديد</button>
            </div>
          )}

          {/* ===== FORMATTED REPORT ===== */}
          {report && !loading && (
            <div className="up">
              {/* Report Header Card */}
              <div style={{background:`linear-gradient(135deg,${G.card},${G.s2})`,border:`1px solid ${G.border}`,borderRadius:"16px",padding:"24px",marginBottom:"16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px"}}>
                  <div>
                    <div style={{fontSize:"22px",fontWeight:"900",marginBottom:"4px"}}>{ar?"تقرير مراجعة العقد":"Contract Review Report"}</div>
                    <div style={{color:G.muted,fontSize:"12px"}}>{new Date().toLocaleDateString(ar?"ar-SA":"en-US",{year:"numeric",month:"long",day:"numeric"})}</div>
                    {report.contractType&&<div style={{color:G.text,fontSize:"14px",marginTop:"6px",fontWeight:"600"}}>{ar?"النوع: ":"Type: "}{report.contractType}</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"8px"}}>
                    {report.riskLevel&&<Tag t={(ar?"مستوى الخطر: ":"Risk: ")+report.riskLevel} c={riskColor(report.riskLevel)}/>}
                    <button onClick={clear} style={{background:"transparent",border:`1px solid ${G.border}`,color:G.muted,padding:"7px 16px",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontFamily:"inherit"}}>{ar?"↩ تحليل جديد":"↩ New Analysis"}</button>
                  </div>
                </div>
              </div>

              {/* Score Cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"16px"}}>
                {[
                  {v:report.score||"—",l:ar?"جودة العقد / 100":"Quality / 100",c:scoreC(report.score||0)},
                  {v:report.risks?.length||0,l:ar?"مخاطر":"Risks",c:G.red},
                  {v:report.missing?.length||0,l:ar?"بنود مفقودة":"Missing",c:G.orange},
                ].map(s=>(
                  <div key={s.l} style={{background:G.card,border:`1px solid ${G.border}`,borderTop:`3px solid ${s.c}`,borderRadius:"12px",padding:"16px",textAlign:"center"}}>
                    <div style={{fontSize:"28px",fontWeight:"900",color:s.c,lineHeight:1,marginBottom:"5px"}}>{s.v}</div>
                    <div style={{fontSize:"11px",color:G.muted,fontWeight:"600"}}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              {report.summary&&<Box icon="✦" title={ar?"الملخص التنفيذي":"Executive Summary"} color={G.gold} ch={<p style={{color:G.text,lineHeight:"1.9",fontSize:"14px"}}>{report.summary}</p>}/>}

              {/* Recommendation */}
              {report.recommendation&&<Box icon="📌" title={ar?"التوصية الشاملة":"Overall Recommendation"} color={G.blue} ch={<p style={{color:G.text,lineHeight:"1.9",fontSize:"14px"}}>{report.recommendation}</p>}/>}

              {/* Parties */}
              {(report.party1||report.party2)&&(
                <Box icon="👥" title={ar?"تحليل الأطراف":"Parties Analysis"} color={G.purple} ch={
                  <>
                    <KV k={ar?"الطرف الأول":"Party 1"} v={report.party1}/>
                    <KV k={ar?"الطرف الثاني":"Party 2"} v={report.party2}/>
                    {report.partiesBalance&&<div style={{marginTop:"12px",padding:"12px",background:`${G.purple}11`,borderRadius:"8px",fontSize:"13px",color:G.muted,lineHeight:"1.8"}}>{report.partiesBalance}</div>}
                  </>
                }/>
              )}

              {/* Financial */}
              {(report.contractValue||report.paymentTerms||report.penalties)&&(
                <Box icon="💰" title={ar?"الشروط المالية":"Financial Terms"} color={G.gold} ch={
                  <>
                    <KV k={ar?"قيمة العقد":"Value"} v={report.contractValue} vc={G.green}/>
                    <KV k={ar?"شروط الدفع":"Payment"} v={report.paymentTerms}/>
                    <KV k={ar?"الغرامات":"Penalties"} v={report.penalties} vc={G.red}/>
                    <KV k={ar?"ضريبة القيمة المضافة":"VAT"} v={report.vat}/>
                  </>
                }/>
              )}

              {/* Risks */}
              {report.risks?.length>0&&(
                <Box icon="⚠️" title={(ar?"المخاطر المكتشفة":"Identified Risks")+` (${report.risks.length})`} color={G.red} ch={
                  report.risks.map((r,i)=>(
                    <div key={i} style={{background:G.s2,borderRadius:"12px",padding:"16px",marginBottom:"10px",borderRight:`3px solid ${riskColor(r.level)}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px",gap:"8px"}}>
                        <div style={{fontWeight:"800",fontSize:"14px",flex:1}}>{r.title}</div>
                        {r.level&&<Tag t={r.level} c={riskColor(r.level)}/>}
                      </div>
                      {r.detail&&<div style={{color:G.muted,fontSize:"13px",lineHeight:"1.8",marginBottom:"8px"}}>{r.detail}</div>}
                      {r.quote&&<div style={{background:`${G.border}55`,padding:"8px 12px",borderRadius:"6px",fontSize:"12px",color:"#A0B0CC",marginBottom:"8px",borderRight:`2px solid ${G.gold}`,lineHeight:"1.7",fontStyle:"italic"}}>📎 {ar?"من العقد: ":"From contract: "}{r.quote}</div>}
                      {r.fix&&<div style={{color:G.green,fontSize:"13px",lineHeight:"1.7"}}>💡 {r.fix}</div>}
                    </div>
                  ))
                }/>
              )}

              {/* Missing Clauses */}
              {report.missing?.length>0&&(
                <Box icon="📋" title={(ar?"البنود المفقودة":"Missing Clauses")+` (${report.missing.length})`} color={G.orange} ch={
                  report.missing.map((m,i)=>(
                    <div key={i} style={{background:G.s2,borderRadius:"12px",padding:"14px",marginBottom:"10px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px",gap:"8px"}}>
                        <div style={{fontWeight:"800",fontSize:"14px",flex:1}}>{m.name}</div>
                        {m.level&&<Tag t={m.level} c={riskColor(m.level)}/>}
                      </div>
                      {m.why&&<div style={{color:G.muted,fontSize:"13px",lineHeight:"1.7",marginBottom:"8px"}}>{m.why}</div>}
                      {m.text&&<div style={{background:`${G.green}11`,border:`1px solid ${G.green}33`,padding:"10px 12px",borderRadius:"8px",fontSize:"12px",color:G.green,lineHeight:"1.8"}}>✏️ {m.text}</div>}
                    </div>
                  ))
                }/>
              )}

              {/* Critical Clauses */}
              {report.critical?.length>0&&(
                <Box icon="🔴" title={(ar?"البنود الحرجة":"Critical Clauses")+` (${report.critical.length})`} color={G.red} ch={
                  report.critical.map((c,i)=>(
                    <div key={i} style={{background:G.s2,borderRadius:"12px",padding:"14px",marginBottom:"10px"}}>
                      <div style={{fontWeight:"800",fontSize:"14px",marginBottom:"10px"}}>{c.title}</div>
                      {c.current&&<div style={{background:`${G.red}11`,padding:"8px 12px",borderRadius:"6px",fontSize:"12px",color:"#AABBCC",marginBottom:"8px",lineHeight:"1.7"}}><span style={{color:G.red,fontWeight:"700"}}>{ar?"النص الحالي: ":"Current: "}</span>{c.current}</div>}
                      {c.problem&&<div style={{color:G.red,fontSize:"13px",marginBottom:"8px",lineHeight:"1.7"}}>⚠️ {c.problem}</div>}
                      {c.suggested&&<div style={{background:`${G.green}11`,border:`1px solid ${G.green}33`,padding:"8px 12px",borderRadius:"6px",fontSize:"12px",color:G.green,lineHeight:"1.7"}}><span style={{fontWeight:"700"}}>{ar?"التعديل المقترح: ":"Suggested: "}</span>{c.suggested}</div>}
                    </div>
                  ))
                }/>
              )}

              {/* Compliance */}
              {report.compliance?.length>0&&(
                <Box icon="🇸🇦" title={ar?"التوافق مع الأنظمة السعودية":"Saudi Law Compliance"} color={G.blue} ch={
                  report.compliance.map((c,i)=>(
                    <div key={i} style={{display:"flex",gap:"12px",padding:"12px 0",borderBottom:i<report.compliance.length-1?`1px solid ${G.border}44`:"none",alignItems:"flex-start"}}>
                      {c.status&&<Tag t={c.status} c={statusColor(c.status)}/>}
                      <div style={{flex:1}}>
                        <div style={{fontWeight:"700",fontSize:"13px",marginBottom:"3px"}}>{c.law}</div>
                        <div style={{color:G.muted,fontSize:"12px",lineHeight:"1.7"}}>{c.note}</div>
                      </div>
                    </div>
                  ))
                }/>
              )}

              {/* Negotiation */}
              {report.negotiation?.length>0&&(
                <Box icon="🤝" title={ar?"استراتيجية التفاوض":"Negotiation Strategy"} color={G.green} ch={
                  report.negotiation.map((n,i)=>(
                    <div key={i} style={{background:G.s2,borderRadius:"12px",padding:"14px",marginBottom:"10px"}}>
                      <div style={{fontWeight:"800",fontSize:"14px",marginBottom:"6px"}}>{n.point}</div>
                      {n.how&&<div style={{color:G.muted,fontSize:"13px",marginBottom:"4px",lineHeight:"1.7"}}>{ar?"الأسلوب: ":"Approach: "}{n.how}</div>}
                      {n.leverage&&<div style={{color:G.green,fontSize:"13px",lineHeight:"1.7"}}>💪 {ar?"نقطة قوتك: ":"Leverage: "}{n.leverage}</div>}
                    </div>
                  ))
                }/>
              )}

              {/* Duration */}
              {(report.duration||report.renewal||report.termination)&&(
                <Box icon="📅" title={ar?"مدة العقد وإنهاؤه":"Duration & Termination"} color={G.muted} ch={
                  <>
                    <KV k={ar?"مدة العقد":"Duration"} v={report.duration}/>
                    <KV k={ar?"التجديد":"Renewal"} v={report.renewal}/>
                    <KV k={ar?"الإنهاء":"Termination"} v={report.termination}/>
                  </>
                }/>
              )}

              <div style={{textAlign:"center",marginTop:"24px",paddingBottom:"32px"}}>
                <button onClick={clear} style={{background:"transparent",border:`1px solid ${G.border}`,color:G.muted,padding:"12px 32px",borderRadius:"10px",cursor:"pointer",fontSize:"14px",fontFamily:"inherit"}}>
                  {ar?"↩ تحليل عقد جديد":"↩ Analyze New Contract"}
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}
