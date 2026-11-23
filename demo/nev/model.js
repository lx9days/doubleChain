(function(root){
const stages=[['materials','材料与基础部件'],['systems','关键系统'],['vehicle','整车集成与制造'],['charging','充换电设施'],['maintenance','运维与安全'],['recycling','回收与再生']];
const cityRules={广东:'中山|深圳|东莞|珠海|广州|惠州',江苏:'昆山|南京|苏州|扬州|常熟',浙江:'杭州|温州|嘉兴|宁波|衢州',山东:'青岛|烟台|潍坊|聊城',河北:'保定',四川:'乐山',湖南:'长沙',上海:'浦东新区'};
function region(address){
 const direct=address.match(/北京|天津|上海|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|内蒙古|广西|西藏|宁夏|新疆|台湾|香港|澳门/);
 if(direct) return {name:direct[0],evidence:direct[0],method:'地址省名识别'};
 for(const [name,rule] of Object.entries(cityRules)){const m=address.match(new RegExp('^('+rule+')'));if(m)return {name,evidence:m[0],method:'地址城市映射（规则推定）'};}
 return {name:'未定位',evidence:'',method:'缺失'};
}
function filter(data,s){
 const ps=data.patents.filter(p=>{
  const cs=data.companies.filter(c=>p.company_ids.includes(c.company_id));
  const date=s.mode==='demo'?p.display_date:p.application_date;
  return (!s.patentIds||s.patentIds.includes(p.patent_id))&&(!s.keyword||(p.title+' '+(p.application_number||'')+' '+cs.map(c=>c.name).join(' ')).includes(s.keyword))&&(!s.min||Number(p.patent_id)>=Number(s.min))&&(!s.max||Number(p.patent_id)<=Number(s.max))&&(!s.stage||data.patent_stage.some(e=>e.patent_id===p.patent_id&&s.stage.split('|').includes(e.stage_id)))&&(!s.region||cs.some(c=>s.region.split('|').includes(region(c.address).name)))&&(!s.from||(date&&date>=s.from))&&(!s.to||(date&&date<=s.to))&&(!s.verified||!!p.application_date);
 });
 ps.sort((a,b)=>{if(s.mode==='id')return Number(a.patent_id)-Number(b.patent_id);const x=s.mode==='demo'?a.display_date:a.application_date,y=s.mode==='demo'?b.display_date:b.application_date;return (x||'9999').localeCompare(y||'9999')||Number(a.patent_id)-Number(b.patent_id);});
 const ids=new Set(ps.map(p=>p.patent_id)),edges=data.patent_company.filter(e=>ids.has(e.patent_id));
 const companies=data.companies.filter(c=>edges.some(e=>e.company_id===c.company_id)).map(c=>({...c,degree:new Set(edges.filter(e=>e.company_id===c.company_id).map(e=>e.patent_id)).size}));
 return {patents:ps,companies,edges};
}
function layout(v){
 const patents=v.patents.map((p,i)=>({...p,x:150+i*210,y:920}));
 const pm=new Map(patents.map(p=>[p.patent_id,p]));const occupied={};
 const companies=[...v.companies].sort((a,b)=>b.degree-a.degree).map(c=>{
  const xs=v.edges.filter(e=>e.company_id===c.company_id).map(e=>pm.get(e.patent_id).x).sort((a,b)=>a-b);
  let x=xs[Math.floor(xs.length/2)],lane=0;const band=occupied[c.degree]||=[];
  while(band.some(p=>p.lane===lane&&Math.abs(p.x-x)<190))lane++;
  band.push({x,lane});return {...c,x,y:740-(c.degree-1)*240-(lane%4)*48};
 });const minY=Math.min(0,...companies.map(c=>c.y-60));return {patents,companies,width:Math.max(1100,patents.length*210+100),minY,maxY:1080,height:1080-minY};
}
function exclusive(data){
 const patent_stage=data.patents.map(p=>{const hits=data.patent_stage.filter(e=>e.patent_id===p.patent_id);return new Set(hits.map(e=>e.stage_id)).size===1?hits[0]:{patent_id:p.patent_id,stage_id:'unclassified',evidence:['多义或缺少证据，待人工分类']};});
 return {...data,patent_stage};
}
stages.push(['unclassified','待分类']);
// Time attraction is deliberately stronger than applicant-edge attraction.
function timeLayout(v,d3,showCompanyNames=false){
 const parse=d3.utcParse('%Y-%m-%d');
 const dated=v.patents.map(p=>({...p,date:parse(p.application_date||'')}));
 const dates=dated.filter(p=>p.date).map(p=>p.date);
 const extent=dates.length?d3.extent(dates):null;
 const width=1800,height=820,axisY=650;
 const scale=d3.scaleUtc().domain(extent||[new Date(0),new Date(86400000)]).range([110,1690]);
 const patents=dated.map((p,i)=>({...p,id:'p:'+p.patent_id,kind:'patent',targetX:p.date?scale(p.date):1740,x:p.date?scale(p.date):1740,y:axisY+(i%9-4)*9}));
 const pm=new Map(patents.map(p=>[p.patent_id,p]));
 const companies=v.companies.map((c,i)=>{const xs=v.edges.filter(e=>e.company_id===c.company_id).map(e=>pm.get(e.patent_id).targetX);return {...c,id:'c:'+c.company_id,kind:'company',targetX:d3.mean(xs)||900,x:d3.mean(xs)||900,y:360+(i%9)*16};});
 const links=v.edges.map(e=>({source:'c:'+e.company_id,target:'p:'+e.patent_id}));
 const nodes=[...patents,...companies];
 const sim=d3.forceSimulation(nodes).randomSource(d3.randomLcg(42))
  .force('time',d3.forceX(n=>n.targetX).strength(n=>n.kind==='patent'?.9:.22))
  .force('up',d3.forceY(n=>n.kind==='patent'?axisY:220).strength(n=>n.kind==='patent'?1.4:.16/Math.sqrt(Math.max(1,n.degree))))
  .force('links',d3.forceLink(links).id(n=>n.id).distance(160).strength(.055))
  .force('charge',d3.forceManyBody().strength(n=>n.kind==='company'?-35:-5))
  // Soft walls repel before the emergency clamp, instead of piling nodes on it.
  .force('walls',()=>{for(const n of nodes){
   const left=n.kind==='company'?90:65,right=n.kind==='company'?1710:1760;
   if(n.x<left)n.vx+=(left-n.x)*.18;
   if(n.x>right)n.vx-=(n.x-right)*.18;
   if(n.y<80)n.vy+=(80-n.y)*.18;
   if(n.y>axisY+65)n.vy-=(n.y-axisY-65)*.18;
  }})
  .force('collision',d3.forceCollide(n=>n.kind==='company'?(showCompanyNames?27:Math.min(15,6+Math.sqrt(n.degree))+3):6).iterations(3)).stop();
 for(let i=0;i<300;i++){
  sim.tick();
  // Keep patents in a narrow collision band around their actual time axis.
  patents.forEach(p=>{if(Math.abs(p.y-axisY)>32){p.y=axisY+Math.sign(p.y-axisY)*32;p.vy=0;}});
  nodes.forEach(n=>{if(n.x<30||n.x>width-30){n.x=Math.max(30,Math.min(width-30,n.x));n.vx=0;}if(n.y<30||n.y>axisY+90){n.y=Math.max(30,Math.min(axisY+90,n.y));n.vy=0;}});
 }
 return {patents,companies,width,height,minY:0,maxY:height,force:true,extent,scale,axisY};
}
const api={stages,region,filter,layout,timeLayout,exclusive};if(typeof module!=='undefined')module.exports=api;else root.NEV=api;
})(typeof window!=='undefined'?window:globalThis);
