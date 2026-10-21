/* 考研择校工作台 · 前端逻辑（纯本地，无上传） */
(function(){
var KD = window.KD;
var S = KD.schools;
var NL = String.fromCharCode(10);
var LS = {fav:"ky_fav", chk:"ky_chk", gchk:"ky_gchk", ans:"ky_ans", w:"ky_w"};
function read(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
var state={fav:read(LS.fav,[]), chk:read(LS.chk,{}), gchk:read(LS.gchk,[]), ans:read(LS.ans,{}), w:read(LS.w,Object.assign({},KD.abilityModel.weights))};

/* ---------- 小工具 ---------- */
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function sMark(m){var c=m==="★"?"s0":(m==="◇"?"s1":"s2");return '<span class="'+c+'" title="'+esc(KD.legend[m]||"")+'">'+m+"</span>"}
function mark(s){return String(s||"").replace(/([★☆○])/g,function(m){return sMark(m)})}
function gRank(g){var o={"A+":14,A:13,"A-":12,"B+":11,B:10,"B-":9,"C+":8,C:7,"C-":6};return o[g]||0}
function hasProg(s,codes){return s.programs.some(function(p){return codes.some(function(c){return p.c.indexOf(c)>=0})})}
function tierBucket(d){return d>=4?"rush":(d>=2.8?"safe":"backup")}
function bucketLabel(b){return b==="rush"?"冲刺":(b==="safe"?"稳妥":"保底")}
function bucketCls(b){return b==="rush"?"r":(b==="safe"?"b":"g")}
function toast(t){var e=document.getElementById("toast");e.textContent=t;e.classList.add("on");clearTimeout(e._t);e._t=setTimeout(function(){e.classList.remove("on")},2200)}
function $(id){return document.getElementById(id)}

/* ---------- 就业补充与考分标尺 ---------- */
function mergeEmp(){S.forEach(function(s){if(!s.emp&&KD.empExtra&&KD.empExtra[s.id])s.emp=KD.empExtra[s.id];if(!s.emp){s.emp=[s.job]}})}
function numLine(l){var t=l&&l.total;if(typeof t==="number")return t;if(typeof t==="string"){var m=t.match(/(\d{3})/);if(m&&/^\d{3}$/.test(m[1]))return +m[1]}return null}
function scoreInfo(s,ans){
  var M=KD.scoreModel, zone=s.zone||"A";
  var fl=M.floor["理学"][zone], fg=M.floor["工学"][zone];
  var ref=null, refL=null;
  (s.line||[]).forEach(function(l){var t=numLine(l);if(t&&t>=250&&t<=500){
    var chem=/化学|0703|材化|材料与化工/.test(l.n||"");
    if(ref===null||(chem&&refL&&!/化学|0703|材化|材料与化工/.test(refL.n))) {ref=t;refL=l}
  }});
  var add=8; M.margin.forEach(function(b){ if(s.diff>=b[0]) add=b[1] });
  var path=(ans&&ans.path)||"";
  var floorUse = (path==="0856"||path==="0817") ? fg : (path==="0703" ? fl : (hasProg(s,["0703"])?fl:fg));
  if(s.selfLine){ floorUse=Math.max(floorUse,300); add=add+5 }   /* 34 所自划线：学校线通常≥300，再留安全边际 */
  var base=Math.max(floorUse, ref||0);
  var target=Math.round((base+add)/5)*5;
  return {fl:fl,fg:fg,floorUse:floorUse,ref:ref,refL:refL,add:add,target:target,
    basis: (ref?("往年参考线 "+ref+"（"+(refL.y||"")+" "+(refL.n||"")+"）+ 难度加成 "+add) : "国家线地板 "+floorUse+" + 难度加成 "+add+"（未核实到该校院线）") + (s.selfLine?"；自划线院校按学校线≥300 估算":""),
    single:M.single, selfLine:!!s.selfLine};
}

/* ---------- 匹配模型 ---------- */
function ability(a){
  var M=KD.abilityModel, v=M.base;
  v += (M.english||{})[a.english||"cet4"]||0;
  v += (M.rank||{})[a.rank||"top50"]||0;
  v += (M.goal||{})[a.goal||"unsure"]||0;
  v += (M.risk||{})[a.risk||"balance"]||0;
  var sc=parseFloat(a.score);
  if(!isNaN(sc)&&sc>150) v += Math.max(-0.8, Math.min(0.8, (sc-310)/45));
  v -= (M.discount||0);
  return Math.max(M.min||2, Math.min(M.max||4.3, v));
}
function provOf(s){return s.prov}
var RG={
  "湖南":function(s){return s.prov==="湖南"},
  "华中":function(s){return ["湖北","河南","安徽","江西","湖南"].indexOf(s.prov)>=0},
  "长三角":function(s){return ["江苏","浙江","上海","安徽"].indexOf(s.prov)>=0},
  "珠三角":function(s){return ["广东"].indexOf(s.prov)>=0 || s.city==="广州"},
  "西南":function(s){return ["重庆","四川","云南","贵州","广西"].indexOf(s.prov)>=0},
  "西北":function(s){return ["陕西","甘肃","新疆","宁夏","青海","山西","内蒙古"].indexOf(s.prov)>=0},
  "东北":function(s){return ["吉林","辽宁","黑龙江"].indexOf(s.prov)>=0},
  "不限":function(){return true}
};
function fitDetail(s,a){
  var W=state.w, out={}, ans=a||{};
  var dirs=ans.dirs||[];
  if(dirs.length){var inter=dirs.filter(function(d){return s.dirs.indexOf(d)>=0}); out.dir=inter.length/dirs.length; out.dirWhy=inter}
  else {out.dir=0.6; out.dirWhy=[]}
  var regs=ans.region||[];
  if(!regs.length){regs=["不限"]}
  var hit=regs.filter(function(r){return RG[r] && RG[r](s)});
  out.region=Math.min(1, hit.length/ (regs.indexOf("不限")>=0?1:Math.max(1,regs.length)) * (regs.indexOf("不限")>=0?0.7:1));
  out.regionWhy=hit;
  var m = ans.math||"ok";
  if(m==="weak"){ out.math = hasProg(s,["0703"])?1:(hasProg(s,["0817","other"])?0.7:0.5); }
  else if(m==="ok"){ out.math = 0.86; }
  else { out.math = hasProg(s,["0817","0856"])?1:0.8; }
  if(ans.path==="0703") out.math *= hasProg(s,["0703"])?1.12:0.5;
  if(ans.path==="0856") out.math *= hasProg(s,["0856","0817"])?1.12:0.55;
  if(ans.path==="0817") out.math *= hasProg(s,["0817","0856"])?1.12:0.6;
  out.math=Math.max(0.15,Math.min(1.25,out.math));
  var txt=(s.fair||[]).map(function(f){return f.k+f.v}).join("")+(s.diaoji||"");
  if(txt.indexOf("极友好")>=0) out.fair=1; else if(txt.indexOf("友好")>=0||txt.indexOf("保护一志愿")>=0) out.fair=0.86; else out.fair=s.selfLine?0.6:0.72;
  var goal=ans.goal||"unsure";
  if(goal==="phd"){ var g=gRank(s.hx)+gRank(s.hg); out.goal=(s.id==="ucas"?1:(g>=24?0.95:(g>=18?0.8:0.55))); }
  else if(goal==="enterprise"){ out.goal=/产业|企业|就业|长三角|珠三角|新能源|制造/.test(s.job+s.platform)?0.95:0.65; }
  else if(goal==="bianzhi"){ out.goal=/211|双一流/.test(s.tier)?0.98:(/985/.test(s.tier)?1:0.5); }
  else out.goal=0.72;
  var sum=W.dir+W.region+W.math+W.fair+W.goal||1;
  var total=(out.dir*W.dir + out.region*W.region + out.math*W.math + out.fair*W.fair + out.goal*W.goal)/sum;
  out.score=Math.round(total*100);
  out.tips=[];
  if(out.dirWhy&&out.dirWhy.length) out.tips.push("方向对口："+out.dirWhy.join("、"));
  if(out.regionWhy&&out.regionWhy.length&&regs.indexOf("不限")<0) out.tips.push("符合地区偏好（"+out.regionWhy.join("、")+"）");
  if(out.math>=1) out.tips.push(( (ans.math==="weak") ? "可避开数学（自命题化学为主）":"路径与你的数学偏好匹配"));
  if(out.fair>=0.9) out.tips.push("对双非本科口碑友好");
  if(out.goal>=0.9) out.tips.push("与“"+({phd:"读博科研",enterprise:"进企业",bianzhi:"考编/教师"}[goal]||"目标")+"”匹配");
  if(out.dir<0.4&&dirs.length) out.tips.push("注意：该校强项与你想读的方向重叠少");
  if(out.region<0.4&&regs.indexOf("不限")<0) out.tips.push("注意：不在你选择的地区");
  if(s.selfLine) out.tips.push("34 所自划线，不过院线只能外调");
  return out;
}
function classify(s,a){
  var ab=ability(a), gap=s.diff-ab, b;
  if(gap>0.9) b="rush"; else if(gap<-0.9) b="backup";
  else b = s.diff>=4.0?"rush":(s.diff>=2.7?"safe":"backup");
  return {b:b,gap:gap,ab:ab};
}
function recommend(s,a){
  var f=fitDetail(s,a), c=classify(s,a);
  var comfort=Math.max(0,1-Math.abs(c.gap)/2.6);
  return {fit:f, cls:c, index:Math.round(f.score*0.62+comfort*38)};
}

/* ---------- 针对该同学的个性化提示 ---------- */
function profileNotes(a){
  var out=[];
  (KD.profileAdvice||[]).forEach(function(a2){
    var key=a2["if"].split(":"), v=key[1].split("|");
    var cur=a[key[0]];
    var hit = Array.isArray(cur) ? v.some(function(x){return cur.indexOf(x)>=0}) : v.indexOf(String(cur))>=0;
    if(hit) out.push(a2);
  });
  return out;
}
function riskNotesHTML(a){
  var list=profileNotes(a);
  if(!list.length) return "";
  return "<div class='sep'></div><h3>针对你的情况，最该做的 4 件事</h3><ul class='tight'>"+
    list.map(function(x){return "<li><span class='pill "+x.level+"'>"+esc(x.t)+"</span><div class='note'>"+esc(x.b)+"</div></li>"}).join("")+"</ul>";
}

/* ---------- 总览 ---------- */
function renderHero(){
  var lt=(document.querySelector&&document.querySelector('#tabbar .tab[data-p="lib"]')); if(lt) lt.textContent="院校库（"+S.length+" 所）";
  var st=KD.meta.baseStudent;
  $("heroBadges").innerHTML=[st.school+" · "+st.college, st.major, "适配院校 "+S.length+" 所", "国家线数据至 2026 年", "第四轮学科评估（官方最新公开全量结果）"].map(function(t){return '<span class="badge">'+esc(t)+"</span>"}).join("");
}
function renderHome(){
  var st=KD.meta.baseStudent, ab=ability(state.ans);
  var dist={rush:0,safe:0,backup:0};
  S.forEach(function(s){dist[classify(s,state.ans).b]++});
  var byIdx=S.slice().sort(function(x,y){return recommend(y,state.ans).index-recommend(x,state.ans).index});var gg={rush:[],safe:[],backup:[]};byIdx.forEach(function(s){gg[classify(s,state.ans).b].push(s)});var best=gg.rush.slice(0,2).concat(gg.safe.slice(0,2),gg.backup.slice(0,2));
  $("homeGrid").innerHTML =
   '<div class="card"><h2>你的基本盘</h2><dl class="kv">'+
   '<dt>学校</dt><dd>'+esc(st.school)+"（公办本科，位于湘潭）</dd>"+
   '<dt>学院</dt><dd>'+esc(st.college)+"</dd>"+
   '<dt>专业</dt><dd>'+esc(st.major)+"</dd>"+
   '<dt>年级</dt><dd>'+esc(st.grade)+"</dd></dl><div class='sep'></div><ul class='tight'>"+
   st.facts.map(function(f){return "<li>"+sMark(f.s)+" "+esc(f.t)+' <span class="note">来源：'+esc(f.src)+"</span></li>"}).join("")+
   "</ul><div class='sep'></div><p class='note'>结论：本校已具备材料与化工硕士点、且有约三成毕业生考研录取——你的目标是现实的。择校的关键不是“能不能考”，而是“用哪条路径、报哪所学院、留哪几个兜底”。</p></div>"+
   '<div class="card"><h2>当前匹配画像</h2><p class="note">能力指数（2.0-4.3，越高代表可冲击难度越大）</p><div class="big">'+ab.toFixed(2)+
   ' <span class="note" style="font-size:13px">/ 4.3（满分）</span></div><div class="sep"></div>'+
   '<div class="row" style="margin-bottom:10px"><button class="btn sm" id="homeWz">继续分步测评</button><button class="btn sm ghost" id="homeGo">直接看全部条件面板</button></div><div class="row"><span class="pill r">冲刺 '+dist.rush+" 所</span><span class='pill b'>稳妥 "+dist.safe+" 所</span><span class='pill g'>保底 "+dist.backup+" 所</span></div>"+
   '<p class="note" style="margin-top:10px">按你当前条件，综合匹配度最高的“冲 2 + 稳 2 + 保 2”：</p><ul class="tight">'+
   best.map(function(s){var r=recommend(s,state.ans);return "<li><a href='javascript:void(0)' data-open='"+s.id+"'>"+esc(s.name)+"</a> <span class='pill "+bucketCls(r.cls.b)+"'>"+bucketLabel(r.cls.b)+"</span> <span class='note'>匹配 "+r.index+" 分 · 化学 "+esc(s.hx)+" / 化工 "+esc(s.hg)+"</span></li>"}).join("")+
   "</ul>"+riskNotesHTML(state.ans)+"</div>";
  $("homePaths").innerHTML="<h2>四条可选路径（先选路径，再选学校）</h2><table class='t'><tr><th>代码</th><th>名称</th><th>典型初试科目</th><th>适合谁</th></tr>"+
    KD.paths.map(function(p){return "<tr><td>"+esc(p.code)+"</td><td><b>"+esc(p.name)+"</b><div class='note'>"+esc(p.sub)+"</div></td><td>"+esc(p.kemu)+"</td><td>"+esc(p.note)+"</td></tr>"}).join("")+"</table>";
  Array.prototype.forEach.call(document.querySelectorAll("[data-open]"),function(a){a.onclick=function(){openSchool(a.getAttribute("data-open"))}});
  var hw=$("homeWz"); if(hw) hw.onclick=function(){wzOpen(0)};
  var hg=$("homeGo"); if(hg) hg.onclick=function(){go("match")};
}

/* ---------- 院校库 ---------- */
function uniq(arr){return arr.filter(function(v,i){return arr.indexOf(v)===i})}
function initFilters(){
  var fill=function(id,vals,lab){var e=$(id);vals.forEach(function(v){var o=document.createElement("option");o.value=v;o.textContent=lab?lab(v):v;e.appendChild(o)})};
  fill("fTier",uniq(S.map(function(s){return s.tier.indexOf("985")>=0?"985":(s.tier.indexOf("211")>=0?"211 / 双一流":(s.tier.indexOf("双一流")>=0?"双一流（非211）":(s.id==="ucas"?"中科院研究所":"省属重点 / 双非")))})));
  fill("fRegion",uniq(S.map(function(s){return s.region})));
  fill("fHx",["A+","A","A-","B+","B","B-","C+","C","C-","无"]);
  fill("fHg",["A+","A","A-","B+","B","B-","C+","C","C-","无"]);
  fill("fDir",KD.dirs);
  $("fQuick").innerHTML=['<button class="chip" data-q="fav">我的星标</button>','<button class="chip" data-q="selfline">只看非自划线</button>','<button class="chip" data-q="diaoji">调剂友好</button>','<button class="chip" data-q="hunan">湖南周边</button>','<button class="chip" data-q="good">化学B+及以上</button>'].join("");
}
var quick={};
function libList(){
  var q=$("fSearch").value.trim(), tg=$("fTarget")?$("fTarget").value:"", t=$("fTier").value, r=$("fRegion").value, hx=$("fHx").value, hg=$("fHg").value, d=$("fDir").value, mt=$("fMath").value, df=$("fDiff").value, so=$("fSort").value;
  var out=S.filter(function(s){
    if(q){var hay=(s.name+s.city+s.prov+s.tier+s.dirs.join("")+s.colleges.join("")+s.platform+s.job).toLowerCase();if(hay.indexOf(q.toLowerCase())<0)return false}
    if(t){var lab=s.tier.indexOf("985")>=0?"985":(s.tier.indexOf("211")>=0?"211 / 双一流":(s.tier.indexOf("双一流")>=0?"双一流（非211）":(s.id==="ucas"?"中科院研究所":"省属重点 / 双非")));if(lab!==t)return false}
    if(r&&s.region!==r)return false;
    if(hx&&(s.hx==="-"?"无":s.hx)!==hx)return false;
    if(hg&&(s.hg==="-"?"无":s.hg)!==hg)return false;
    if(d&&s.dirs.indexOf(d)<0)return false;
    if(mt==="no"&&!hasProg(s,["0703"]))return false;
    if(mt==="yes"&&!hasProg(s,["0817","0856"]))return false;
    if(df&&tierBucket(s.diff)!==df)return false;
    if(tg){var tt=scoreInfo(s,state.ans).target; if(tg==="t1"&&tt>285)return false; if(tg==="t2"&&(tt<286||tt>305))return false; if(tg==="t3"&&(tt<306||tt>325))return false; if(tg==="t4"&&tt<=325)return false}
    if(quick.fav&&state.fav.indexOf(s.id)<0)return false;
    if(quick.selfline&&s.selfLine)return false;
    if(quick.diaoji&&(!/调剂|缺额|大户/.test(s.diaoji)))return false;
    if(quick.hunan&&!(["湖南","湖北","江西","河南"].indexOf(s.prov)>=0))return false;
    if(quick.good&&gRank(s.hx)<11)return false;
    return true;
  });
  out.sort(function(x,y){
    if(so==="diff_desc")return y.diff-x.diff;
    if(so==="diff_asc")return x.diff-y.diff;
    if(so==="hx")return gRank(y.hx)-gRank(x.hx)||y.diff-x.diff;
    if(so==="hg")return gRank(y.hg)-gRank(x.hg)||y.diff-x.diff;
    return x.name.localeCompare(y.name,"zh");
  });
  return out;
}
function cardHTML(s){
  var b=tierBucket(s.diff), on=state.fav.indexOf(s.id)>=0;
  return '<div class="sc"><div class="row" style="justify-content:space-between"><div><h4><a href="javascript:void(0)" data-open="'+s.id+'">'+esc(s.name)+'</a></h4><div class="sub">'+esc(s.city)+" · "+esc(s.tier)+(s.zone==="B"?" · B 区":"")+(s.selfLine?" · 自划线":"")+"</div></div>"+
   '<button class="star'+(on?" on":"")+'" data-fav="'+s.id+'" title="加入 / 移出我的志愿单">'+(on?"★":"☆")+"</button></div>"+
   '<div class="grade"><span class="pill n">化学 '+esc(s.hx)+'</span><span class="pill n">化工 '+esc(s.hg)+'</span><span class="pill '+bucketCls(b)+'">'+bucketLabel(b)+"档</span>"+(s.id==="hnie"?"<span class='pill y'>本校 · 最稳兜底</span>":"")+"</div>"+
   '<div class="gline">'+esc(s.programs.map(function(p){return p.c+" "+p.n}).join(" ｜ "))+"</div>"+
   '<div class="gline">'+mark((s.line[0]?s.line[0].s:"◇")+" 复试线参考："+esc((s.line[0]&&(s.line[0].total||s.line[0].n))||"需核验"))+"</div>"+
   (function(){var q=scoreInfo(s,state.ans);return '<div class="gline"><b style="color:#1b4d8f;font-size:15px">建议目标分 ≈ '+q.target+'</b><span class="note"> 分（'+(q.ref?"参考院线":"国家线地板")+q.floorUse+' + '+q.add+'）</span></div>'})()+
   '<div class="gline note">方向：'+esc(s.dirs.slice(0,4).join("、"))+"</div>"+
   '<div class="gline note">就业：'+esc((s.emp&&s.emp[0]?s.emp[0]:s.job).slice(0,46))+"…</div>"+
   '<div class="diffbar"><i style="width:'+Math.round(s.diff/5*100)+'%"></i></div>'+
   '<div class="scfoot"><span class="note">难度 '+s.diff.toFixed(1)+" / 5</span><div class='row'><button class='btn sm ghost' data-open='"+s.id+"'>全部资料</button>"+
   '<button class="btn sm ghost" data-cmp="'+s.id+'">对比</button></div></div></div>';
}
function renderLib(){
  var list=libList();
  $("libCount").textContent="共 "+list.length+" 所符合条件（全部库 "+S.length+" 所）";
  $("libCards").innerHTML=list.length?list.map(cardHTML).join(""):'<div class="empty">没有符合条件的院校，试试放宽筛选条件。</div>';
  bindCards();
}
function bindCards(){
  Array.prototype.forEach.call(document.querySelectorAll("[data-open]"),function(a){a.onclick=function(){openSchool(a.getAttribute("data-open"))}});
  Array.prototype.forEach.call(document.querySelectorAll("[data-fav]"),function(b){b.onclick=function(){toggleFav(b.getAttribute("data-fav"))}});
  Array.prototype.forEach.call(document.querySelectorAll("[data-cmp]"),function(b){b.onclick=function(){addFav(b.getAttribute("data-cmp"));renderCompare()}});
}
function toggleFav(id){var i=state.fav.indexOf(id);if(i<0){state.fav.push(id);toast("已加入志愿单")}else{state.fav.splice(i,1);toast("已从志愿单移除")}save(LS.fav,state.fav);renderLib();renderCompare();renderHome()}
function addFav(id){if(state.fav.indexOf(id)<0){state.fav.push(id);save(LS.fav,state.fav);toast("已加入志愿单")}}

/* ---------- 院校详情抽屉 ---------- */
function openSchool(id){
  var s=S.filter(function(x){return x.id===id})[0];if(!s)return;
  var a=state.ans, r=recommend(s,a), items=(s.todo||[]).concat(["核对 2026/2027 招生简章专业目录（科目代码、参考书、招生人数、推免数）","确认初试是否考数学与英语一/英语二","查近三年拟录取名单最低分与平均分"]);
  var chk=state.chk[id]||[];
  var scoreBlock="";
  var html='<div class="dh"><div><h2 style="margin-bottom:2px">'+esc(s.name)+'</h2><div class="note">'+esc(s.city+" · "+s.prov+" · 院校代码 "+s.code)+"</div>"+
    '<div class="row" style="margin-top:6px"><span class="pill '+(s.id==="ucas"?"y":(/985/.test(s.tier)?"tier":(/211|双一流/.test(s.tier)?"tier2":"n")))+'">'+esc(s.tier)+"</span>"+
    '<span class="pill n">化学 '+esc(s.hx)+' '+sMark("★")+'</span><span class="pill n">化工 '+esc(s.hg)+' '+sMark("★")+"</span>"+
    '<span class="pill '+bucketCls(r.cls.b)+'">'+bucketLabel(r.cls.b)+" · 综合匹配 "+r.index+" 分</span></div></div>"+
    '<div class="row"><button class="btn sm '+(state.fav.indexOf(id)>=0?"":"ghost")+'" data-fav2="'+id+'">'+(state.fav.indexOf(id)>=0?"★ 已在志愿单":"☆ 加入志愿单")+'</button><button class="btn sm ghost" id="dclose">关闭</button></div></div><div class="db">';

  html+='<div class="dsec"><div class="lbl">身份与学科实力</div><dl class="kv">'+
   '<dt>所在城市</dt><dd>'+esc(s.city)+"（"+esc(s.prov)+"，"+(s.zone==="B"?"B 区（复试线更低）":"A 区")+"）· "+esc(s.region)+"</dd>"+
   '<dt>化学评估</dt><dd>'+esc(s.hx)+"（第四轮学科评估 0703 化学）"+sMark("★")+"</dd>"+
   '<dt>化工评估</dt><dd>'+esc(s.hg)+"（第四轮学科评估 0817 化学工程与技术）"+sMark("★")+"</dd>"+
   '<dt>自划线</dt><dd>'+(s.selfLine?"是，34 所自划线院校之一（复试线由学校自定，通常高于国家线）"+sMark("★"):"否，执行国家线 + 学院线")+"</dd>"+
   '<dt>博士点</dt><dd>'+mark(s.phd)+"</dd>"+
   '<dt>招生学院</dt><dd>'+esc(s.colleges.join(" / "))+"</dd>"+
   '<dt>培养平台</dt><dd>'+esc(s.platform)+"</dd>"+
   '<dt>就业去向</dt><dd>'+esc(s.job)+"</dd></dl></div>";

  html+='<div class="dsec"><div class="lbl">可报专业（初试报名本质是选到“学院 + 方向”）</div><table class="t"><tr><th>代码</th><th>专业</th><th>类型</th><th>方向说明</th></tr>'+
   s.programs.map(function(p){return "<tr><td>"+esc(p.c)+"</td><td><b>"+esc(p.n)+"</b></td><td>"+esc(p.t)+"</td><td>"+mark(p.d)+"</td></tr>"}).join("")+"</table>"+
   '<div class="sep"></div><dl class="kv"><dt>初试科目</dt><dd>'+mark(s.kemu)+"</dd><dt>学制</dt><dd>"+mark(s.dur)+"</dd><dt>学费</dt><dd>"+mark(s.tuition)+"</dd><dt>招生人数</dt><dd>"+mark(s.enroll)+"</dd></dl></div>";

  html+='<div class="dsec"><div class="lbl">分数线（务必区分“复试线”与“录取最低分”）</div><table class="t"><tr><th>年份</th><th>口径</th><th>总分</th><th>单科</th><th>可信度</th></tr>'+
   s.line.map(function(l){return "<tr><td>"+esc(l.y)+"</td><td>"+esc(l.n)+(l.note?'<div class="note">'+esc(l.note)+"</div>":"")+"</td><td><b>"+esc(l.total==null?"—":l.total)+"</b></td><td>"+esc(l.single||"—")+"</td><td>"+sMark(l.s||"◇")+"</td></tr>"}).join("")+"</table>"+
   '<p class="note" style="margin:8px 0 0">'+esc(KD.scoreModel.note)+"</p></div>";

  (function(){
    var q=scoreInfo(s,state.ans);
    var gap="";
    var mine=parseFloat(state.ans.score);
    if(!isNaN(mine)&&mine>150){
      var g=mine-q.target;
      gap = g>=0 ? "<span class='pill g'>你填的模拟分 "+mine+" 已达目标分（余量 "+g+" 分）</span>"
                 : "<span class='pill r'>你填的模拟分 "+mine+" 距目标分还差 "+(-g)+" 分</span>";
    } else gap="<span class='note'>在“智能匹配”里填上模拟分，这里会直接算出差多少。</span>";
    var html='<div class="dsec"><div class="lbl">考分标尺：这所学校初试至少要考多少分</div>'+
      '<div class="row" style="align-items:flex-end;gap:18px"><div><div class="note">建议目标分（初试总分）</div><div class="big">'+q.target+'</div></div>'+
      '<div class="note" style="flex:1;min-width:220px">算法：'+esc(q.basis)+" = <b>"+q.target+"</b> 分（取 5 的整数）<br>"+esc(KD.scoreModel.rule)+"</div></div>"+
      '<table class="t" style="margin-top:10px"><tr><th>项目</th><th>分值</th><th>说明</th></tr>'+
      '<tr><td>国家线地板（理学）</td><td><b>'+q.fl+'</b></td><td>2026 年 '+s.zone+" 区 · 0703 化学学硕适用"+sMark("★")+"</td></tr>"+
      '<tr><td>国家线地板（工学）</td><td><b>'+q.fg+'</b></td><td>2026 年 '+s.zone+" 区 · 0817/0856 专硕学硕适用"+sMark("★")+"</td></tr>"+
      '<tr><td>该校往年参考线</td><td><b>'+(q.ref||"—")+'</b></td><td>'+esc(q.refL?(q.refL.y+" "+q.refL.n):"未核实到院线，按国家线地板估算")+" "+sMark(q.refL?(q.refL.s||"◇"):"○")+"</td></tr>"+
      '<tr><td>难度加成</td><td><b>+'+q.add+'</b></td><td>难度 '+s.diff.toFixed(1)+"/5，复试线只是进门槛，录取最低分通常更高</td></tr>"+
      '<tr><td>单科要求</td><td colspan="2">'+esc(q.single)+"</td></tr></table>"+
      '<div class="row" style="margin-top:10px">'+gap+(q.selfLine?"<span class='pill y'>34 所自划线：以学校线+院线为准，不看国家线</span>":"")+"</div></div>";
    scoreBlock=html;
  })();

  html+=scoreBlock;
  html+='<div class="dsec"><div class="lbl">公平度、复试与调剂</div><table class="t"><tr><th>项目</th><th>情况</th><th>可信度</th></tr>'+
   s.fair.map(function(f){return "<tr><td>"+esc(f.k)+"</td><td>"+esc(f.v)+"</td><td>"+sMark(f.s||"◇")+"</td></tr>"}).join("")+
   "<tr><td>调剂</td><td>"+mark(s.diaoji)+"</td><td>"+sMark("◇")+"</td></tr></table>"+
   '<p class="note">“口碑类”信息来自历年考生反馈与公开讨论，属参考性质；最终请以院校复试录取细则文字为准。</p></div>';

  html+='<div class="dsec"><div class="lbl">就业与出路</div><div class="note" style="margin-bottom:8px">'+esc(s.job)+"</div><ul class='tight'>"+
   (s.emp||[]).map(function(x){return "<li>"+esc(x)+"</li>"}).join("")+"</ul>"+
   '<div class="sep"></div><div class="note">就业数据提示：各校年度就业质量报告的口径（签约率、平均薪资）差异很大，且多数已不再公开发布；上面的“典型雇主”是行业与校友网络的常识性归纳，'+sMark("◇")+" 建议以目标学院公布的毕业去向表与学长反馈为准。</div></div>";

  html+='<div class="dsec"><div class="lbl">匹配你的情况</div><div class="grid g2"><div>'+
   '<h3 class="pro">为什么值得考虑</h3><ul class="tight">'+s.good.map(function(g){return "<li>"+esc(g)+"</li>"}).join("")+"</ul></div><div>"+
   '<h3 class="con">必须正视的风险</h3><ul class="tight">'+s.risk.map(function(g){return "<li>"+esc(g)+"</li>"}).join("")+"</ul></div></div>"+
   '<div class="sep"></div><div class="lbl">模型给出的理由</div><ul class="tight">'+
   '<li>难度 '+s.diff.toFixed(1)+' / 5，你的能力指数 '+r.cls.ab.toFixed(2)+'，差值 '+(r.cls.gap>0?"+":"")+r.cls.gap.toFixed(2)+" → 判为"+bucketLabel(r.cls.b)+"档</li>"+
   r.fit.tips.map(function(t){return "<li>"+esc(t)+"</li>"}).join("")+"</ul></div>";

  html+='<div class="dsec"><div class="lbl">报名前逐项核验（勾选自动保存在本机）</div><ul class="checklist">'+
   items.map(function(t,i){var d=chk.indexOf(i)>=0;return "<li class='"+(d?"done":"")+"'><input type='checkbox' data-chk='"+i+"' "+(d?"checked":"")+" /><span>"+esc(t)+"</span></li>"}).join("")+
   "</ul><div class='note' style='margin-top:8px'>共 "+items.length+" 项，已完成 "+chk.length+" 项。</div></div>";

  html+='<div class="dsec"><div class="lbl">官方信息检索入口</div><ul class="tight">'+
   KD.help.links(s.name).map(function(l){return '<li><a href="'+l.u+'" target="_blank" rel="noopener">'+esc(l.t)+"</a></li>"}).join("")+
   '</ul><div class="note" style="margin-top:8px">链接为定向检索入口（自动带上校名与关键词），打开后请优先点进 .edu.cn / 研究生院官网结果并截图存档。</div></div>';

  html+="</div>";
  var d=$("drawer");d.innerHTML=html;d.classList.add("on");try{history.replaceState(null,"","#school/"+s.id)}catch(e){}$("veil").classList.add("on");document.body.style.overflow="hidden";
  $("dclose").onclick=closeDrawer;
  Array.prototype.forEach.call(d.querySelectorAll("[data-fav2]"),function(b){b.onclick=function(){toggleFav(b.getAttribute("data-fav2"));openSchool(id)}});
  Array.prototype.forEach.call(d.querySelectorAll("[data-chk]"),function(c){c.onchange=function(){var i=+c.getAttribute("data-chk"),arr=state.chk[id]||[];var p=arr.indexOf(i);
    if(c.checked&&p<0)arr.push(i); if(!c.checked&&p>=0)arr.splice(p,1); state.chk[id]=arr; save(LS.chk,state.chk); openSchool(id)}});
}
function closeDrawer(){$("drawer").classList.remove("on");$("veil").classList.remove("on");document.body.style.overflow="";var c=(location.hash||"").split("/")[0]==="#school";if(c)go("lib",true)}

/* ---------- 智能匹配 ---------- */
function optsOf(q){
  if(q.optsFrom==="dirs")return KD.dirs.map(function(d){return {v:d,t:d}});
  if(q.optsFrom==="examYears")return Object.keys(KD.examYears).map(function(k){return {v:k,t:KD.examYears[k].label,d:KD.examYears[k].note}});
  return q.opts||[];
}
function renderQuestions(){
  var a=state.ans;
  $("modelDesc").textContent=KD.abilityModel.desc+"  分档规则："+KD.abilityModel.tiers;
  $("weightsWrap").innerHTML=Object.keys(KD.abilityModel.weights).map(function(k){
    var names={dir:"方向对口",region:"地区偏好",math:"路径/数学可行",fair:"对双非友好度",goal:"出路匹配"};
    return '<div class="wgrid"><label class="f">'+names[k]+" 权重（当前 "+state.w[k]+"）</label><input type='range' min='0' max='30' value='"+state.w[k]+"' data-w='"+k+"'></div>";
  }).join("");
  Array.prototype.forEach.call(document.querySelectorAll("[data-w]"),function(r){r.oninput=function(){state.w[r.getAttribute("data-w")]=+r.value;save(LS.w,state.w);r.previousSibling? null:null;var l=r.parentNode.querySelector(".f");l.textContent=l.textContent.replace(/（当前.*?）/,"（当前 "+r.value+"）")}});

  $("qWrap").innerHTML=KD.questions.map(function(q,i){
    var opts=optsOf(q), v=a[q.id];
    var head='<div class="qh">'+(i+1)+". "+esc(q.label)+' <span class="note">'+esc(q.help||"")+"</span></div>";
    var body;
    if(q.type==="multi"){
      var arr=v||[];
      body='<div class="chips">'+opts.map(function(o){return '<button class="chip'+(arr.indexOf(o.v)>=0?" on":"")+'" data-multi="'+q.id+'" data-v="'+esc(o.v)+'">'+esc(o.t)+"</button>"}).join("")+"</div>";
    }else if(q.type==="number"){
      body='<input type="number" placeholder="'+esc(q.placeholder||"")+'" data-num="'+q.id+'" value="'+esc(v==null?"":v)+'">';
    }else{
      body='<div class="chips">'+opts.map(function(o){return '<button class="chip'+(v===o.v?" on":"")+'" data-single="'+q.id+'" data-v="'+esc(o.v)+'">'+esc(o.t)+(o.d?' <span class="mini">· '+esc(o.d)+"</span>":"")+"</button>"}).join("")+"</div>";
    }
    return '<div class="qcard">'+head+body+"</div>";
  }).join("");
  Array.prototype.forEach.call(document.querySelectorAll("[data-single]"),function(b){b.onclick=function(){var id=b.getAttribute("data-single");state.ans[id]=b.getAttribute("data-v");saveAns();renderQuestions();}});
  Array.prototype.forEach.call(document.querySelectorAll("[data-multi]"),function(b){b.onclick=function(){var id=b.getAttribute("data-multi"),v=b.getAttribute("data-v"),arr=state.ans[id]||[];
    var p=arr.indexOf(v); if(p<0)arr.push(v); else arr.splice(p,1); state.ans[id]=arr; saveAns(); renderQuestions();}});
  Array.prototype.forEach.call(document.querySelectorAll("[data-num]"),function(inp){inp.oninput=function(){var id=inp.getAttribute("data-num");state.ans[id]=inp.value;saveAns();}});
}
function saveAns(){save(LS.ans,state.ans);renderHome()}
function renderMatch(){
  var a=state.ans;
  var ranked=S.map(function(s){return {s:s,r:recommend(s,a)}}).sort(function(x,y){return y.r.index-x.r.index});
  var groups={rush:[],safe:[],backup:[]};
  ranked.forEach(function(o){groups[o.r.cls.b].push(o)});
  var rec=[];
  var pick=function(arr,n){return arr.slice(0,n)};
  var list=pick(groups.rush,3).concat(pick(groups.safe,4),pick(groups.backup,3));
  var ab=ability(a);
  var box=function(name,cls,arr,n){
    return '<div class="tierbox '+cls+'"><h3>'+name+'<span class="note">'+arr.length+" 所符合，列前 "+n+"</span></h3>"+
     (arr.length?arr.slice(0,n).map(function(o){
       return '<div class="mrow"><div class="row" style="justify-content:space-between"><span class="n"><a href="javascript:void(0)" data-open="'+o.s.id+'">'+esc(o.s.name)+"</a></span>"+
       '<span class="note">难度 '+o.s.diff.toFixed(1)+' · 匹配 '+o.r.fit.score+" · 综合 "+o.r.index+"</span></div>"+
       '<div class="bar"><i style="width:'+o.r.index+'%"></i></div>'+
       '<div class="why">'+ (o.r.fit.tips.slice(0,3).map(function(t){return "· "+esc(t)}).join("<br>")) +"</div>"+
       '<div class="why con">'+esc(o.s.risk[0]||"")+"</div>"+
       '<div class="row" style="margin-top:6px"><button class="btn sm ghost" data-open="'+o.s.id+'">全部资料</button><button class="btn sm ghost" data-cmp2="'+o.s.id+'">加入志愿单</button></div></div>';
     }).join(""):'<div class="empty note">按当前条件没有该档院校，试着调整地区或风险偏好。</div>')+"</div>";
  };
  $("matchResult").innerHTML='<div class="card" style="margin-bottom:16px"><h2>推荐结果</h2><p class="note">能力指数 '+ab.toFixed(2)+
   ' / 5；风险偏好：'+esc(({safe:"稳字当头",balance:"平衡",rush:"敢冲"})[a.risk||"balance"])+"。下面按“冲刺 3 + 稳妥 4 + 保底 3”给你一份可直接使用的报名名单，并另附调剂兜底建议。</p>"+
   '<div class="row" style="margin-top:6px"><span class="pill r">冲刺：'+esc(pick(groups.rush,3).map(function(o){return o.s.name}).join("、")||"—")+"</span>"+
   '<span class="pill b">稳妥：'+esc(pick(groups.safe,4).map(function(o){return o.s.name}).join("、"))+"</span>"+
   '<span class="pill g">保底：'+esc(pick(groups.backup,3).map(function(o){return o.s.name}).join("、"))+"</span></div>"+
   '<div class="sep"></div><p class="note">'+esc(KD.strategy.ladder)+"</p></div>"+
   '<div class="res">'+box("冲刺档（1 个志愿可考虑）","rush",groups.rush,3)+box("稳妥档（最该重点准备）","safe",groups.safe,4)+box("保底 / 调剂兜底档","backup",groups.backup,3)+"</div>";
  Array.prototype.forEach.call(document.querySelectorAll("[data-open]"),function(x){x.onclick=function(){openSchool(x.getAttribute("data-open"))}});
  Array.prototype.forEach.call(document.querySelectorAll("[data-cmp2]"),function(x){x.onclick=function(){addFav(x.getAttribute("data-cmp2"));renderCompare();renderMatch()}});
}

/* ---------- 对比 ---------- */
function renderCompare(){
  var list=state.fav.map(function(id){return S.filter(function(s){return s.id===id})[0]}).filter(Boolean);
  if(!list.length){$("cmpBox").innerHTML='<div class="card empty">还没有志愿单。在“院校库”点 ☆ 星标，或点“对比当前筛选前 4 所”。</div>';return}
  var rows=[
   ["层次 / 标签",function(s){return esc(s.tier)+(s.selfLine?"（自划线）":"")}],
   ["城市 / 区",function(s){return esc(s.city+" · "+(s.zone==="B"?"B 区":"A 区"))}],
   ["化学评估",function(s){return esc(s.hx)}],["化工评估",function(s){return esc(s.hg)}],
   ["可报专业",function(s){return esc(s.programs.map(function(p){return p.c+" "+p.n+"("+p.t+")"}).join("；"))}],
   ["初试科目倾向",function(s){return esc(s.kemu)}],
   ["最近参考线",function(s){return esc(s.line.map(function(l){return l.y+" "+(l.total||"")}).join("；"))}],
   ["建议目标分",function(s){var q=scoreInfo(s,state.ans);return "<b style='font-size:16px'>≈ "+q.target+"</b> 分<div class='note'>地板 "+q.floorUse+" + 加成 "+q.add+(q.ref?"（参考院线 "+q.ref+"）":"（未核实到院线）")+"</div>"}],
   ["国家线地板",function(s){var q=scoreInfo(s,state.ans);return "理学 "+q.fl+" / 工学 "+q.fg+"（"+s.zone+" 区 2026）"}],
   ["就业与出路",function(s){return "<ul class='tight'>"+(s.emp||[]).map(function(x){return "<li>"+esc(x)+"</li>"}).join("")+"</ul>"}],
   ["招生 / 学费 / 学制",function(s){return esc(s.enroll)+"<br>"+esc(s.tuition)+"<br>"+esc(s.dur)}],
   ["博士点与平台",function(s){return esc(s.phd)+"<br>"+esc(s.platform)}],
   ["就业",function(s){return esc(s.job)}],
   ["对双非友好度",function(s){return esc(s.fair.map(function(f){return f.k+"："+f.v}).join("；"))}],
   ["调剂",function(s){return esc(s.diaoji)}],
   ["优势",function(s){return "<ul class='tight'>"+s.good.map(function(g){return "<li>"+esc(g)+"</li>"}).join("")+"</ul>"}],
   ["风险",function(s){return "<ul class='tight'>"+s.risk.map(function(g){return "<li>"+esc(g)+"</li>"}).join("")+"</ul>"}],
   ["你的匹配度",function(s){var r=recommend(s,state.ans);return "综合 "+r.index+" 分 · "+bucketLabel(r.cls.b)+"档（难度 "+s.diff.toFixed(1)+"，能力 "+r.cls.ab.toFixed(2)+"）"}],
   ["操作",function(s){return "<button class='btn sm ghost' data-open='"+s.id+"'>打开档案</button> <button class='btn sm ghost' data-unfav='"+s.id+"'>移出</button>"}]
  ];
  $("cmpBox").innerHTML='<div class="card cmpwrap"><table class="cmp"><tr><th>对比项</th>'+list.map(function(s){return "<th>"+esc(s.name)+"</th>"}).join("")+"</tr>"+
   rows.map(function(r){return "<tr><th>"+r[0]+"</th>"+list.map(function(s){return "<td>"+r[1](s)+"</td>"}).join("")+"</tr>"}).join("")+"</table></div>";
  Array.prototype.forEach.call($("cmpBox").querySelectorAll("[data-open]"),function(x){x.onclick=function(){openSchool(x.getAttribute("data-open"))}});
  Array.prototype.forEach.call($("cmpBox").querySelectorAll("[data-unfav]"),function(x){x.onclick=function(){toggleFav(x.getAttribute("data-unfav"));renderCompare()}});
}
function exportList(){
  var list=state.fav.map(function(id){return S.filter(function(s){return s.id===id})[0]}).filter(Boolean);
  if(!list.length){toast("志愿单为空");return}
  var txt=["我的考研志愿单（生成自择校工作台 · "+new Date().toLocaleString()+"）","说明：★已核实 ◇参考 ○待核验，报名前请以院校当年公告为准。",""].concat(
    list.map(function(s){var r=recommend(s,state.ans);
      return [s.name+"（"+s.city+" · "+s.tier+" · "+(s.zone==="B"?"B 区":"A 区")+"）",
      "  化学评估 "+s.hx+" / 化工评估 "+s.hg+" / 难度 "+s.diff.toFixed(1)+" / 判定 "+bucketLabel(r.cls.b)+"档 / 综合匹配 "+r.index,
      "  可报专业："+s.programs.map(function(p){return p.c+" "+p.n}).join("、"),
      "  参考线："+s.line.map(function(l){return l.y+" "+(l.total||"")+"（"+(l.s||"◇")+"）"}).join("；"),
      "  初试科目："+s.kemu,
      "  核验事项："+(s.todo||[]).join("；"),
      "  官方检索："+KD.help.links(s.name)[1].u,""].join(NL)}));
  var blob=new Blob([txt.join(NL)],{type:"text/plain;charset=utf-8"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="考研志愿单.txt";a.click();
  toast("已导出 考研志愿单.txt");
}

/* ---------- 备考路径页 ---------- */
function renderPlan(){
  $("tlBox").innerHTML=KD.timeline.map(function(t){
    return '<div class="node"><div class="when">'+esc(t.ph)+'</div><h3 style="margin:2px 0 4px">'+esc(t.title)+'</h3><ul class="tight">'+t.tasks.map(function(x){return "<li>"+esc(x)+"</li>"}).join("")+"</ul></div>";
  }).join("");
  $("pathTable").innerHTML='<table class="t"><tr><th>代码</th><th>名称与说明</th><th>典型科目</th><th>适合</th></tr>'+KD.paths.map(function(p){
    return "<tr><td>"+esc(p.code)+"</td><td><b>"+esc(p.name)+"</b><div class='note'>"+esc(p.sub)+"</div></td><td>"+esc(p.kemu)+"</td><td>"+esc(p.note)+"</td></tr>"}).join("")+"</table>";
  var m=KD.emailTemplate;
  $("mailBox").innerHTML='<div class="note">发送时机：'+esc(m.when)+'</div><div class="sep"></div>'+
   '<label class="f">主题</label><div style="background:#f3f6fb;padding:8px 10px;border-radius:8px;font-size:14px">'+esc(m.subject)+"</div>"+
   '<label class="f" style="margin-top:10px">正文（把 XXX 换成你自己的信息）</label><pre class="mail">'+esc(m.body)+"</pre>"+
   '<div class="row"><button class="btn sm ghost" id="copyMail">复制邮件正文</button><button class="btn sm ghost" id="copySubject">复制主题</button></div>'+
   '<ul class="tight">'+m.tips.map(function(t){return "<li>"+esc(t)+"</li>"}).join("")+"</ul>";
  $("copyMail").onclick=function(){navigator.clipboard?navigator.clipboard.writeText(m.body).then(function(){toast("已复制邮件正文")}):toast("浏览器不支持自动复制，请手动选择")};
  $("copySubject").onclick=function(){navigator.clipboard?navigator.clipboard.writeText(m.subject).then(function(){toast("已复制主题")}):toast("请手动复制")};
  $("stratBox").innerHTML='<h3>三档法</h3><p class="note">'+esc(KD.strategy.ladder)+"</p>"+
    KD.strategy.tiers.map(function(t){return '<div class="sep"></div><b>'+esc(t.t)+"</b><div class='note'>"+esc(t.d)+"</div>"}).join("")+
    '<div class="sep"></div><h3>择校铁律</h3><ul class="tight">'+KD.strategy.rules.map(function(x){return "<li>"+esc(x)+"</li>"}).join("")+"</ul>";
  $("pitBox").innerHTML='<ul class="tight">'+KD.strategy.pitfalls.map(function(p){
    return "<li><b>"+esc(p.p)+"</b><div class='note'>怎么办："+esc(p.fix)+"</div></li>"}).join("")+"</ul>";
  var g=state.gchk||[];
  $("globalCheck").innerHTML=KD.checklistGlobal.map(function(t,i){var d=g.indexOf(i)>=0;
    return "<li class='"+(d?"done":"")+"'><input type='checkbox' data-g='"+i+"' "+(d?"checked":"")+"><span>"+esc(t)+"</span></li>"}).join("");
  Array.prototype.forEach.call($("globalCheck").querySelectorAll("[data-g]"),function(c){c.onchange=function(){var i=+c.getAttribute("data-g"),p=g.indexOf(i);
    if(c.checked&&p<0)g.push(i); if(!c.checked&&p>=0)g.splice(p,1); state.gchk=g; save(LS.gchk,g); renderPlan()}});
  $("termsBox").innerHTML='<table class="t"><tr><th>名词</th><th>一句话解释</th></tr>'+KD.terms.map(function(t){return "<tr><td><b>"+esc(t.k)+"</td><td>"+esc(t.v)+"</td></tr>"}).join("")+"</table>";
}

/* ---------- 数据说明页 ---------- */
function renderData(){
  var src=[
   "教育部学位与研究生教育发展中心《第四轮学科评估结果》（2017 年 12 月公布，目前官方最新公开的全量分档结果）：本站 0703 化学、0817 化学工程与技术的等级、院校代码均取自该名单。",
   "第五轮学科评估结果未向社会公开完整名单，因此任何“第五轮 A/ A+”说法都要看学校自己的官宣，本站不予采用。",
   "教育部历年《全国硕士研究生招生考试考生进入复试的初试成绩基本要求》（国家线）：2023—2026 年理学、工学 A/B 区数据。",
   "各高校研究生院与学院官网公告：湖南大学 2025 复试基本分数线、湘潭大学 2025 复试分数线、南京工业大学 2025 复试分数线、湖南师范大学 2026 复试办法、南华大学 2025 复试名单、青岛科技大学 2025 学院线、湖南农业大学 2026 复试细则等（卡片内已标注年份与口径）。",
   "湖南工程学院材料与化工学院官网：学院专业构成、2024 年获批材料与化工硕士点、化学与材料科学进入 ESI 前 1%、2024 届考研录取率约 30%（144 人）。",
   "“对双非友好度 / 保护一志愿 / 调剂情况”等属历年考生公开反馈与经验性总结，标注为 ◇，需你以院校当年复试录取细则文字确认。",
   "标注为 ○ 的字段（招生人数、学费、具体学院线、部分科目）本站没有可靠来源，特意留空——请在报名前用官方目录补齐，本站已在每张档案卡底部生成核验清单。"
  ];
  $("srcList").innerHTML=src.map(function(t){return "<li>"+esc(t)+"</li>"}).join("");
  $("legendBox").innerHTML=Object.keys(KD.legend).map(function(k){return '<div class="row" style="margin-bottom:6px">'+sMark(k)+"<span>"+esc(KD.legend[k])+"</span></div>"}).join("");
  var nl=KD.meta.nationalLines;
  $("lineTable").innerHTML='<table class="t"><tr><th>学科门类</th><th>区</th>'+nl.years.map(function(y){return "<th>"+y+"</th>"}).join("")+"</tr>"+
    nl.rows.map(function(r){return "<tr><td>"+esc(r.cat)+"</td><td>"+esc(r.zone)+"</td>"+nl.years.map(function(y){return "<td><b>"+(r.v[y]||"—")+"</b></td>"}).join("")+"</tr>"}).join("")+"</table><p class='note'>"+esc(nl.unit)+"</p>";
  $("lineTrend").textContent=KD.meta.nationalLines.trend;
  $("disclaimer").innerHTML='<ul class="tight"><li>能用来做什么：把 38 所与你有现实交集的院校放在同一套可比口径下（学科等级、区、是否自划线、可报专业、参考线、公平度、平台、就业），并按你的条件排出三档名单。</li>'+
   '<li>不能用来做什么：它不是录取概率预测，也不能替代当年招生简章。招生人数、推免占比、学院线、参考书这四类信息每年都在变，务必按档案卡的核验清单逐条核对。</li>'+
   '<li>建议用法：先用“智能匹配”生成名单 → 挑 6-8 所进入“志愿单” → 在“志愿对比”并排看 → 逐所打开档案、勾完核验清单 → 9 月新简章发布后再复核一次。</li>'+
   '<li>数据核实日期：2026 年 10 月 21 日。院校信息如有出入，以研招网与招生单位公告为准。</li></ul>';
  $("masterTable").innerHTML='<table class="cmp"><tr><th>院校</th><th>城市</th><th>层次</th><th>区</th><th>自划线</th><th>化学</th><th>化工</th><th>难度</th><th>建议目标分</th><th>默认判定</th><th>可报专业</th><th>最近参考线</th></tr>'+
   S.slice().sort(function(x,y){return y.diff-x.diff}).map(function(s){var r=recommend(s,state.ans);
     return "<tr><td><a href='javascript:void(0)' data-open='"+s.id+"'>"+esc(s.name)+"</a></td><td>"+esc(s.city)+"</td><td>"+esc(s.tier)+"</td><td>"+s.zone+"</td><td>"+(s.selfLine?"是":"否")+"</td><td>"+esc(s.hx)+"</td><td>"+esc(s.hg)+"</td><td>"+s.diff.toFixed(1)+"</td><td><b>"+scoreInfo(s,state.ans).target+"</b></td><td>"+bucketLabel(r.cls.b)+"</td><td>"+esc(s.programs.map(function(p){return p.c}).join("/"))+"</td><td>"+esc(s.line.map(function(l){return l.y+":"+(l.total||"—")}).join("；"))+"</td></tr>"}).join("")+"</table>";
  Array.prototype.forEach.call($("masterTable").querySelectorAll("[data-open]"),function(x){x.onclick=function(){openSchool(x.getAttribute("data-open"))}});
}

/* ---------- 路由（可用 #lib / #match / #school/校id 直达） ---------- */
function go(key,silent){
  Array.prototype.forEach.call(document.querySelectorAll("#tabbar .tab"),function(x){x.classList.toggle("on",x.getAttribute("data-p")===key)});
  Array.prototype.forEach.call(document.querySelectorAll("section.panel"),function(x){x.classList.remove("on")});
  var p=$("p-"+key); if(p)p.classList.add("on");
  if(key==="lib")renderLib(); if(key==="cmp")renderCompare();
  if(!silent && location.hash!=="#"+key){ try{history.replaceState(null,"","#"+key)}catch(e){location.hash="#"+key} }
}
function applyHash(){
  var h=(location.hash||"").replace(/^#/,"");
  if(!h){go("home",true);return}
  var m=h.split("/");
  if(m[0]==="school"&&m[1]){ go("lib",true); openSchool(m[1]); return }
  if(m[0]==="wizard"){ go("match",true); wzOpen(m[1]?Math.min(+m[1],KD.questions.length):wzLoad()); return }
  go(m[0]||"home",true);
}
window.addEventListener("hashchange",applyHash);


/* ---------- 分步测评向导 ---------- */
var wz={i:0};
function wzSave(){try{localStorage.setItem("ky_wz",String(wz.i))}catch(e){}}
function wzLoad(){try{var v=localStorage.getItem("ky_wz");return v?+v:0}catch(e){return 0}}
function wzOpen(step){ wz.i=(typeof step==="number")?step:0; $("wveil").classList.add("on"); $("wizard").classList.add("on"); document.body.style.overflow="hidden"; wzRender(); }
function wzClose(){ $("wveil").classList.remove("on"); $("wizard").classList.remove("on"); document.body.style.overflow=""; renderMatch(); renderHome(); renderLib(); renderCompare(); }
function wzSet(id,v){ state.ans[id]=v; save(LS.ans,state.ans); }
function wzRender(){
  var qs=KD.questions, n=qs.length;
  if(wz.i>=n){ wzResult(); return }
  var q=qs[wz.i], opts=(q.optsFrom==="dirs"?KD.dirs.map(function(d){return {v:d,t:d}}):(q.optsFrom==="examYears"?Object.keys(KD.examYears).map(function(k){return {v:k,t:KD.examYears[k].label,d:KD.examYears[k].note}}):(q.opts||[])));
  var v=state.ans[q.id], body="";
  if(q.type==="number"){
    body='<input type="number" id="wzNum" placeholder="'+esc(q.placeholder||"例如 300")+'" value="'+esc(v==null?"":v)+'" style="font-size:18px;padding:14px">'+
      '<p class="note" style="margin-top:10px">没做过模拟卷就留空，不影响其他判断。填了会更准：310 分大致对应“能进多数稳妥档复试”。</p>';
  }else if(q.type==="multi"){
    var arr=v||[];
    body='<div class="ops two">'+opts.map(function(o){return '<button class="op'+(arr.indexOf(o.v)>=0?" on":"")+'" data-m="'+esc(o.v)+'"><span class="t">'+esc(o.t)+'</span>'+(o.d?'<span class="d">'+esc(o.d)+"</span>":"")+"</button>"}).join("")+"</div>"+
      '<p class="note" style="margin-top:10px">可多选；不选也可以直接下一步（视为“不限”）。</p>';
  }else{
    body='<div class="ops">'+opts.map(function(o){return '<button class="op'+(v===o.v?" on":"")+'" data-s="'+esc(o.v)+'"><span class="t">'+esc(o.t)+'</span>'+(o.d?'<span class="d">'+esc(o.d)+"</span>":"")+"</button>"}).join("")+"</div>";
  }
  var pct=Math.round(wz.i/n*100);
  $("wizard").innerHTML='<div class="wzh"><div class="top"><span class="step">第 '+(wz.i+1)+" / "+n+" 题</span>"+
    '<div class="row"><button class="btn ghost sm" id="wzSkip">稍后决定</button><button class="btn ghost sm" id="wzX">完成</button></div></div>'+
    '<div class="prog"><i style="width:'+pct+'%"></i></div></div>'+
    '<div class="wzb"><h3 class="wzq">'+esc(q.label)+'</h3><p class="wzhint">'+esc(q.help||"")+"</p>"+body+"</div>"+
    '<div class="wzf"><span class="mini">'+(q.type==="single"?"点选后自动进入下一题":"选完点“下一题”")+'</span>'+
    '<div class="row">'+(wz.i>0?'<button class="btn ghost sm" id="wzPrev">上一步</button>':"")+
    (q.type==="single"?"":'<button class="btn sm" id="wzNext">下一题</button>')+"</div></div>";
  Array.prototype.forEach.call($("wizard").querySelectorAll("[data-s]"),function(b){b.onclick=function(){wzSet(q.id,b.getAttribute("data-s"));wz.i++;wzSave();setTimeout(wzRender,170)}});
  Array.prototype.forEach.call($("wizard").querySelectorAll("[data-m]"),function(b){b.onclick=function(){var val=b.getAttribute("data-m"),arr=state.ans[q.id]||[];var p=arr.indexOf(val);if(p<0)arr.push(val);else arr.splice(p,1);state.ans[q.id]=arr;save(LS.ans,state.ans);wzRender()}});
  var nx=$("wzNext"); if(nx) nx.onclick=function(){var e2=$("wzNum"); if(e2&&e2.value) wzSet(q.id,e2.value); wz.i++;wzSave();wzRender()};
  var pv=$("wzPrev"); if(pv) pv.onclick=function(){var e2=$("wzNum"); if(e2&&e2.value) wzSet(q.id,e2.value); if(wz.i>0)wz.i--;wzSave();wzRender()};
  $("wzSkip").onclick=function(){wz.i++;wzSave();wzRender()};
  $("wzX").onclick=function(){wz.i=n;wzSave();wzRender()};
  if(pv){} 
}
function wzResult(){
  var n=KD.questions.length;
  var byIdx=S.slice().sort(function(x,y){return recommend(y,state.ans).index-recommend(x,state.ans).index});
  var g={rush:[],safe:[],backup:[]};byIdx.forEach(function(s){g[classify(s,state.ans).b].push(s)});
  var ab=ability(state.ans);
  var main=g.safe[0]||g.backup[0]||byIdx[0];
  var picked=main?recommend(main,state.ans):null;
  var sum=KD.questions.map(function(q){var v=state.ans[q.id];if(!v||(Array.isArray(v)&&!v.length))return "";var lab=v;
    if(q.opts){var o=q.opts.filter(function(x){return x.v===v})[0];lab=o?o.t:v}
    if(q.optsFrom==="examYears"&&KD.examYears[v])lab=KD.examYears[v].label;
    return "<span>"+esc(q.label.replace(/^\d+\.\s*/,""))+"：" +esc(Array.isArray(v)?v.join("/"):lab)+"</span>"}).join("");
  var tie=function(name,cls,arr,cnt){
    return '<div class="tie '+cls+'"><h4>'+name+' <span class="note">'+arr.length+" 所符合，取前 "+Math.min(cnt,arr.length)+"</span></h4>"+
      (arr.length?arr.slice(0,cnt).map(function(s){var r=recommend(s,state.ans);
        return '<div class="it"><span><a href="javascript:void(0)" data-open="'+s.id+'">'+esc(s.name)+"</a> <span class='note'>"+esc(s.city)+" · 化学 "+esc(s.hx)+" / 化工 "+esc(s.hg)+"</span></span><span class='note'>综合 "+r.index+" · 难度 "+s.diff.toFixed(1)+"</span></div>"}).join(""):'<div class="note">按当前条件无该档院校，可放宽地区或改风险偏好。</div>')+"</div>";
  };
  $("wizard").innerHTML='<div class="wzh"><div class="top"><span class="step">测评完成</span><div class="row"><button class="btn ghost sm" id="wzAgain">重新测</button><button class="btn sm" id="wzDone">看完整名单</button></div></div><div class="prog"><i style="width:100%"></i></div></div>'+
   '<div class="wzb"><h3 class="wzq">你的三档名单</h3><p class="wzhint">能力指数 '+ab.toFixed(2)+"（上限 4.3）· 风险偏好："+esc(({safe:"稳字当头",balance:"平衡",rush:"敢冲"})[state.ans.risk||"balance"])+"</p>"+
   '<div class="wzsum">'+sum+"</div>"+
   (main?'<div class="bigrec"><b>报名建议：第一志愿主攻 '+esc(main.name)+"（"+esc(main.city)+"）</b><div class='note' style='margin-top:6px'>"+
     "综合匹配 "+(picked?picked.index:"")+" 分，判为"+bucketLabel(picked?picked.cls.b:"safe")+"档。"+esc(main.good[0])+"。"+
     "同时把下面保底档与调剂校提前查好专业代码——初试只能填一个志愿，兜底表就是你的第二次机会。</div></div>":"")+
   '<div class="tierbar">'+tie("冲刺档（想清楚风险再报）","rush",g.rush,3)+tie("稳妥档（最该重点准备）","safe",g.safe,4)+tie("保底 / 调剂兜底档","backup",g.backup,4)+"</div>"+
   '<p class="note" style="margin-top:14px">名单依据：第四轮学科评估等级、是否 34 所自划线、A/B 区、招生体量、对双非友好度与产业带就业，结合你上面选择的权重（可在“智能匹配”页拖动权重条实时重算）。</p></div>'+
   '<div class="wzf"><span class="mini">勾选的院校会进入“志愿对比”，可导出 txt 或 Ctrl+P 存 PDF</span><div class="row"><button class="btn ghost sm" id="wzAddAll">把上面名单加入志愿单</button><button class="btn sm" id="wzDone2">完成</button></div></div>';
  Array.prototype.forEach.call($("wizard").querySelectorAll("[data-open]"),function(x){x.onclick=function(){openSchool(x.getAttribute("data-open"))}});
  $("wzAgain").onclick=function(){wz.i=0;wzSave();wzRender()};
  $("wzDone").onclick=wzClose; $("wzDone2").onclick=wzClose;
  $("wzAddAll").onclick=function(){var ids=[];var by=S.slice().sort(function(x,y){return recommend(y,state.ans).index-recommend(x,state.ans).index});var g2={rush:[],safe:[],backup:[]};by.forEach(function(s){g2[classify(s,state.ans).b].push(s)});
    g2.rush.slice(0,2).concat(g2.safe.slice(0,3),g2.backup.slice(0,3)).forEach(function(s){if(ids.indexOf(s.id)<0)ids.push(s.id)});
    ids.forEach(function(id){if(state.fav.indexOf(id)<0)state.fav.push(id)});save(LS.fav,state.fav);renderLib();renderCompare();toast("已加入 "+ids.length+" 所到志愿单")};
}

/* ---------- 交互装配 ---------- */
Array.prototype.forEach.call(document.querySelectorAll("#tabbar .tab"),function(t){
  t.onclick=function(){
    Array.prototype.forEach.call(document.querySelectorAll("#tabbar .tab"),function(x){x.classList.remove("on")});
    Array.prototype.forEach.call(document.querySelectorAll("section.panel"),function(x){x.classList.remove("on")});
    go(t.getAttribute("data-p"));
    if(t.getAttribute("data-p")==="lib")renderLib();
    if(t.getAttribute("data-p")==="cmp")renderCompare();
    window.scrollTo(0,0);
  };
});
["fSearch","fTier","fRegion","fHx","fHg","fDir","fMath","fDiff","fSort","fTarget"].forEach(function(id){
  var e=$(id); e.addEventListener("input",renderLib); e.addEventListener("change",renderLib);
});
Array.prototype.forEach.call($("fQuick").querySelectorAll("[data-q]"),function(b){
  b.onclick=function(){var k=b.getAttribute("data-q");quick[k]=!quick[k];b.classList.toggle("on",!!quick[k]);renderLib()};
});
$("wzStart").onclick=function(){wzOpen(0)};
$("wzResume").onclick=function(){wzOpen(wzLoad())};
$("wveil").onclick=wzClose;
$("runMatch").onclick=function(){renderMatch();var y=$("matchResult");y.scrollIntoView({behavior:"smooth"});toast("已按你的条件生成三档名单")};
$("resetMatch").onclick=function(){state.ans={};save(LS.ans,state.ans);renderQuestions();renderMatch();renderHome();renderLib();toast("已清空，重新选择即可")};
$("cmpAddTop").onclick=function(){libList().slice(0,4).forEach(function(s){addFav(s.id)});renderCompare();toast("已把当前筛选前 4 所加入志愿单")};
$("exportList").onclick=exportList;
$("clearFav").onclick=function(){state.fav=[];save(LS.fav,state.fav);renderCompare();renderLib();toast("已清空星标")};
$("veil").onclick=closeDrawer;
document.addEventListener("keydown",function(e){if(e.key==="Escape"){if($("wizard").classList.contains("on"))wzClose();else closeDrawer()}});

// 先写入默认画像（该同学已确认的条件），再渲染与路由，保证首屏与向导一致
if(!state.ans.__init){ state.ans=JSON.parse(JSON.stringify(KD.defaultProfile||{})); save(LS.ans,state.ans); }
mergeEmp();initFilters();renderHero();renderHome();renderQuestions();renderLib();renderCompare();renderPlan();renderData();
if(KD.defaultNote) $("matchHint").textContent=KD.defaultNote;
renderMatch();applyHash();

// 记住上次答到第几题，方便下次接着填
var _wzStep=wzLoad();
if(_wzStep>0&&_wzStep<KD.questions.length){ var _b=$("wzResume"); if(_b){ _b.style.display=""; var _s=$("wzStep"); if(_s)_s.textContent=_wzStep+1 } }

/* 仅用于自检与后续调整：把内部函数暴露到 window，方便调试（不影响正常使用） */
window.__ky={scoreInfo:scoreInfo,mergeEmp:mergeEmp,wzOpen:wzOpen,wzRender:wzRender,wzResult:wzResult,wzClose:wzClose,go:go,applyHash:applyHash,state:state,renderMatch:renderMatch,renderHome:renderHome,renderLib:renderLib,renderQuestions:renderQuestions,renderCompare:renderCompare,renderPlan:renderPlan,renderData:renderData,openSchool:openSchool,toggleFav:toggleFav,exportList:exportList,ability:ability,recommend:recommend,classify:classify,fitDetail:fitDetail};
})();