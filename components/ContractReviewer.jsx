import { useState, useRef, useEffect } from "react";

const C = {
  bg:"#0B0F1A",surface:"#131929",card:"#1A2235",
  border:"#243050",gold:"#C9A84C",goldLight:"#E8C97A",
  red:"#E05252",green:"#4ECCA3",blue:"#4A90D9",
  orange:"#F0A500",text:"#E8EDF5",muted:"#7B8BAA",
};

function rc(l){return l==="عالي"?C.red:l==="متوسط"?C.orange:C.green}

function Tag({label,color}){
  return <span style={{background:`${color}18`,border:`1px solid ${color}44`,color,padding:"3px 10px",borderRadius:"6px",fontSize:"12px",fontWeight:"700"}}>{label}</span>;
}

function Card({title,color,children}){
  return(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRight:`3px solid ${color}`,borderRadius:"14px",padding:"20px",marginBottom:"14px"}}>
      <div style={{color,fontWeight:"800",fontSize:"15px",marginBottom:"14px"}}>{title}</div>
      {children}
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
  const [error,setError]=useState("");
  const [drag,setDrag]=useState(false);
  const [mammoth,setMammoth]=useState(null);
  const fileRef=useRef();

  useEffect(()=>{
    import("mammoth").then(setMammoth).catch(()=>{});
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>{
      if(window.pdfjsLib)
        window.pdfjsLib.GlobalWorkerOptions.workerSrc=
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    };
    document.head.appendChild(s);
  },[]);

  const reset=()=>{
    setReport(null);setText("");setFileName("");setFileType("");
    setImageData(null);setError("");setCharCount(0);
  };

  const handleFile=async(file)=>{
    if(!file)return;
    const ext=file.name.split(".").pop().toLowerCase();
    if(!["txt","docx","pdf","jpg","jpeg","png","webp"].includes(ext)){
      setError("صيغة غير مدعومة");return;
    }
    setError("");setFileName(file.name);setFileType(ext);
    setImageData(null);setText("");setCharCount(0);setExtracting(true);
    try{
      if(ext==="txt"){
        const t=(await file.text()).slice(0,15000);
        setText(t);setCharCount(t.length);
      }else if(ext==="docx"){
        if(!mammoth){setError("حاول مجدداً بعد ثانية");setExtracting(false);return;}
        const r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
        const t=r.value.slice(0,15000);
        setText(t);setCharCount(t.length);
      }else if(ext==="pdf"){
        if(!window.pdfjsLib){setError("حاول مجدداً بعد ثانية");setExtracting(false);return;}
        const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
        let t="";
        for(let i=1;i<=Math.min(pdf.numPages,25);i++){
          const pg=await pdf.getPage(i);
          const ct=await pg.getTextContent();
          t+=ct.items.map(x=>x.str).join(" ")+"\n";
        }
        if(t.trim().length<30){
          setError("هذا PDF مسحوح — ارفعه كصورة JPG أو PNG");
          setExtracting(false);return;
        }
        const sl=t.slice(0,15000);
        setText(sl);setCharCount(sl.length);
      }else{
        const reader=new FileReader();
        reader.onload=(e)=>{
          setImageData({base64:e.target.result.split(",")[1],mediaType:file.type||"image/jpeg"});
          setCharCount(-1);
        };
        reader.readAsDataURL(file);
      }
    }catch(e){setError("خطأ في قراءة الملف: "+e.message);}
    setExtracting(false);
  };

  const analyze=async()=>{
    const isImg=imageData&&!text;
    if(!text.trim()&&!isImg){setError("الرجاء إدخال نص أو رفع ملف");return;}
    setError("");setLoading(true);setReport(null);

    try{
      const messages=isImg
        ?[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:imageData.mediaType,data:imageData.base64}},
            {type:"text",text:"اقرأ نص العقد في الصورة وحلله بالتفصيل. أعد التقرير JSON فقط."}
          ]}]
        :[{role:"user",content:`حلل هذا العقد بالتفصيل وأعطني تقرير شامل:\n\n${text.slice(0,12000)}`}];

      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages}),
      });

      const data=await res.json();

      if(!res.ok){
        setError(`خطأ ${res.status}: ${JSON.stringify(data?.error||data)}`);
        setLoading(false);return;
      }

      const raw=data.content?.find(b=>b.type==="text")?.text||"";

      let parsed=null;
      try{
        const clean=raw.replace(/```json\n?|```\n?/g,"").trim();
        parsed=JSON.parse(clean);
      }catch{
        try{
          const match=raw.match(/\{[\s\S]*\}/);
          if(match)parsed=JSON.parse(match[0]);
        }catch{}
      }

      setReport(parsed||{_raw:raw});
    }catch(e){
      setError("خطأ في الاتصال: "+e.message);
    }
    setLoading(false);
  };

  const hasContent=text.trim()||imageData;

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .up{animation:up .4s ease forwards}
        .spin{animation:spin 1s linear infinite}
        textarea:focus{border-color:${C.gold}!important;box-shadow:0 0 0 3px ${C.gold}20}
        .dz{transition:all .3s}.dz:hover,.dz.drag{border-color:${C.gold}!important;background:${C.gold}08!important}
        .btn:hover{transform:translateY(-2px);box-shadow:0 6px 24px ${C.gold}44}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
      `}</style>

      <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Cairo',sans-serif",direction:"rtl",color:C.text}}>
        <header style={{background:`linear-gradient(135deg,${C.surface},#0D1520)`,borderBottom:`1px solid ${C.border}`,padding:"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <div style={{width:"40px",height:"40px",background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>⚖️</div>
            <div>
              <div style={{fontSize:"17px",fontWeight:"800"}}>مراجع العقود الذكي</div>
              <div style={{fontSize:"11px",color:C.muted}}>يدعم PDF · Word · صورة · نص</div>
            </div>
          </div>
          <div style={{background:`${C.gold}18`,border:`1px solid ${C.gold}44`,color:C.gold,padding:"5px 12px",borderRadius:"20px",fontSize:"11px",fontWeight:"600"}}>✦ Claude AI</div>
        </header>

        <main style={{maxWidth:"860px",margin:"0 auto",padding:"32px 16px"}}>

          {/* Input */}
          {!report&&!loading&&(
            <div className="up">
              <h1 style={{fontSize:"30px",fontWeight:"900",textAlign:"center",marginBottom:"8px",background:`linear-gradient(135deg,${C.text},${C.goldLight})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                راجع عقدك في 30 ثانية
              </h1>
              <p style={{textAlign:"center",color:C.muted,fontSize:"14px",marginBottom:"24px"}}>
                تحليل قانوني وتجاري معمق — مخصص لكل عقد بمحتواه الفعلي
              </p>

              <div className={`dz${drag?" drag":""}`}
                style={{background:C.card,border:`2px dashed ${C.border}`,borderRadius:"14px",padding:"28px",textAlign:"center",cursor:"pointer",marginBottom:"14px"}}
                onClick={()=>fileRef.current.click()}
                onDragOver={e=>{e.preventDefault();setDrag(true);}}
                onDragLeave={()=>setDrag(false)}
                onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}>
                {extracting?(
                  <><div className="spin" style={{width:"28px",height:"28px",border:`2px solid ${C.border}`,borderTop:`2px solid ${C.gold}`,borderRadius:"50%",margin:"0 auto 10px"}}/><div style={{color:C.gold,fontWeight:"700"}}>جارٍ قراءة الملف...</div></>
                ):fileName?(
                  <>
                    <div style={{fontSize:"32px",marginBottom:"6px"}}>{["jpg","jpeg","png","webp"].includes(fileType)?"🖼️":fileType==="pdf"?"📄":"📝"}</div>
                    <div style={{color:C.green,fontWeight:"700",marginBottom:"3px"}}>✓ تم رفع الملف</div>
                    <div style={{color:C.muted,fontSize:"13px",marginBottom:"4px"}}>{fileName}</div>
                    {charCount>0&&<div style={{color:C.blue,fontSize:"12px",marginBottom:"8px"}}>📊 تم استخراج {charCount.toLocaleString()} حرف</div>}
                    {charCount===-1&&<div style={{color:C.blue,fontSize:"12px",marginBottom:"8px"}}>🖼️ سيقرأها الذكاء الاصطناعي مباشرة</div>}
                    <button onClick={e=>{e.stopPropagation();reset();}} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"3px 10px",borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontFamily:"inherit"}}>× حذف</button>
                  </>
                ):(
                  <><div style={{fontSize:"36px",marginBottom:"10px"}}>☁️</div><div style={{fontSize:"15px",fontWeight:"700",marginBottom:"4px"}}>اسحب الملف هنا أو اضغط</div><div style={{color:C.muted,fontSize:"12px"}}>PDF · DOCX · JPG · PNG · TXT</div></>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
              </div>

              {imageData&&<div style={{marginBottom:"12px",borderRadius:"10px",overflow:"hidden",maxHeight:"160px",textAlign:"center",background:C.card}}><img src={`data:${imageData.mediaType};base64,${imageData.base64}`} alt="preview" style={{maxHeight:"160px",maxWidth:"100%",objectFit:"contain"}}/></div>}

              {!fileName&&(
                <>
                  <div style={{display:"flex",alignItems:"center",gap:"12px",margin:"14px 0"}}>
                    <div style={{flex:1,height:"1px",background:C.border}}/>
                    <span style={{color:C.muted,fontSize:"12px"}}>أو الصق النص مباشرة</span>
                    <div style={{flex:1,height:"1px",background:C.border}}/>
                  </div>
                  <textarea
                    style={{width:"100%",minHeight:"140px",background:C.card,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"14px",color:C.text,fontSize:"14px",fontFamily:"inherit",direction:"rtl",resize:"vertical",outline:"none",lineHeight:"1.7"}}
                    value={text}
                    onChange={e=>{setText(e.target.value);setCharCount(e.target.value.length);}}
                    placeholder="الصق نص العقد هنا..."/>
                  {text&&<div style={{color:C.blue,fontSize:"12px",marginTop:"4px"}}>📊 {charCount.toLocaleString()} حرف</div>}
                </>
              )}

              {error&&<div style={{color:C.red,fontSize:"13px",margin:"10px 0",padding:"10px",background:`${C.red}11`,borderRadius:"8px",border:`1px solid ${C.red}33`}}>⚠️ {error}</div>}

              <button className="btn" disabled={!hasContent} onClick={analyze}
                style={{width:"100%",padding:"15px",background:hasContent?`linear-gradient(135deg,${C.gold},${C.goldLight})`:C.border,color:hasContent?"#0B0F1A":C.muted,border:"none",borderRadius:"12px",fontSize:"16px",fontWeight:"800",cursor:hasContent?"pointer":"default",marginTop:"12px",transition:"all .2s",fontFamily:"inherit"}}>
                🔍 ابدأ تحليل العقد
              </button>
            </div>
          )}

          {/* Loading */}
          {loading&&(
            <div className="up" style={{textAlign:"center",padding:"70px 20px"}}>
              <div className="spin" style={{width:"48px",height:"48px",border:`3px solid ${C.border}`,borderTop:`3px solid ${C.gold}`,borderRadius:"50%",margin:"0 auto 18px"}}/>
              <div style={{color:C.gold,fontSize:"18px",fontWeight:"800",marginBottom:"6px"}}>جارٍ تحليل العقد...</div>
              <div style={{color:C.muted,fontSize:"13px"}}>يراجع الذكاء الاصطناعي البنود والمخاطر</div>
            </div>
          )}

          {/* Report */}
          {report&&!loading&&(
            <div className="up">
              {report._raw?(
                <Card title="📄 نتيجة التحليل" color={C.gold}>
                  <p style={{color:C.muted,lineHeight:"1.8",fontSize:"14px",whiteSpace:"pre-wrap"}}>{report._raw}</p>
                  <button onClick={reset} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"8px 20px",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontFamily:"inherit",marginTop:"16px"}}>↩ تحليل جديد</button>
                </Card>
              ):(
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px",paddingBottom:"18px",borderBottom:`1px solid ${C.border}`}}>
                    <div>
                      <div style={{fontSize:"20px",fontWeight:"900"}}>تقرير مراجعة العقد</div>
                      <div style={{color:C.muted,fontSize:"12px",marginTop:"3px"}}>{new Date().toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"})}</div>
                      {report.contractType&&<div style={{color:C.text,fontSize:"13px",marginTop:"3px"}}>النوع: {report.contractType}</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"8px"}}>
                      {report.riskLevel&&<Tag label={`مستوى الخطر: ${report.riskLevel}`} color={rc(report.riskLevel)}/>}
                      <button onClick={reset} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"6px 14px",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontFamily:"inherit"}}>↩ تحليل جديد</button>
                    </div>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"16px"}}>
                    {[
                      {v:report.overallScore??"—",l:"جودة العقد / 100",c:(report.overallScore??0)>=70?C.green:(report.overallScore??0)>=50?C.orange:C.red},
                      {v:report.risks?.length??0,l:"مخاطر محددة",c:C.red},
                      {v:report.missingClauses?.length??0,l:"بنود مفقودة",c:C.orange},
                    ].map(s=>(
                      <div key={s.l} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"16px",textAlign:"center"}}>
                        <div style={{fontSize:"28px",fontWeight:"900",color:s.c,lineHeight:1,marginBottom:"5px"}}>{s.v}</div>
                        <div style={{fontSize:"11px",color:C.muted,fontWeight:"600"}}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {report.executiveSummary&&<Card title="✦ الملخص التنفيذي" color={C.gold}><p style={{color:C.text,lineHeight:"1.9",fontSize:"14px"}}>{report.executiveSummary}</p></Card>}
                  {report.overallRecommendation&&<Card title="📌 التوصية الشاملة" color={C.blue}><p style={{color:C.text,lineHeight:"1.9",fontSize:"14px"}}>{report.overallRecommendation}</p></Card>}

                  {report.risks?.length>0&&(
                    <Card title={`⚠️ المخاطر (${report.risks.length})`} color={C.red}>
                      {report.risks.map((r,i)=>(
                        <div key={i} style={{padding:"12px",background:C.surface,borderRadius:"10px",marginBottom:"8px",border:`1px solid ${rc(r.severity)}22`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                            <div style={{fontWeight:"700",fontSize:"14px"}}>{r.title}</div>
                            <Tag label={r.severity} color={rc(r.severity)}/>
                          </div>
                          {r.detail&&<div style={{color:C.muted,fontSize:"13px",lineHeight:"1.7",marginBottom:"6px"}}>{r.detail}</div>}
                          {r.recommendation&&<div style={{color:C.green,fontSize:"13px"}}>💡 {r.recommendation}</div>}
                        </div>
                      ))}
                    </Card>
                  )}

                  {report.missingClauses?.length>0&&(
                    <Card title={`📋 البنود المفقودة (${report.missingClauses.length})`} color={C.orange}>
                      {report.missingClauses.map((c,i)=>(
                        <div key={i} style={{padding:"10px",background:C.surface,borderRadius:"10px",marginBottom:"8px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
                            <div style={{fontWeight:"700",fontSize:"14px"}}>{c.clause}</div>
                            {c.importance&&<Tag label={c.importance} color={rc(c.importance)}/>}
                          </div>
                          {c.reason&&<div style={{color:C.muted,fontSize:"13px",lineHeight:"1.6"}}>{c.reason}</div>}
                        </div>
                      ))}
                    </Card>
                  )}

                  {report.negotiationTips?.length>0&&(
                    <Card title="🤝 نصائح التفاوض" color={C.green}>
                      {report.negotiationTips.map((t,i)=>(
                        <div key={i} style={{padding:"10px",background:C.surface,borderRadius:"10px",marginBottom:"8px"}}>
                          <div style={{fontWeight:"700",fontSize:"14px",marginBottom:"4px"}}>{t.point}</div>
                          {t.approach&&<div style={{color:C.muted,fontSize:"13px"}}>{t.approach}</div>}
                        </div>
                      ))}
                    </Card>
                  )}

                  {report.keyTerms?.length>0&&(
                    <Card title="🔑 البنود الرئيسية" color={C.blue}>
                      {report.keyTerms.map((t,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<report.keyTerms.length-1?`1px solid ${C.border}33`:"none",fontSize:"13px",gap:"12px"}}>
                          <span style={{color:C.muted,fontWeight:"600"}}>{t.label}</span>
                          <span style={{color:C.text}}>{t.value}</span>
                        </div>
                      ))}
                    </Card>
                  )}

                  <div style={{textAlign:"center",marginTop:"20px"}}>
                    <button onClick={reset} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"10px 28px",borderRadius:"10px",cursor:"pointer",fontSize:"13px",fontFamily:"inherit"}}>↩ تحليل عقد جديد</button>
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
