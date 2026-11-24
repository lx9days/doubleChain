let mapMultiPicking=false;
function toggleGroup(key,value,multi=false){
 if(key==='region')mapMultiPicking=multi;
 const values=new Set((state[key]||'').split('|').filter(Boolean));
 if(!value)state[key]='';else if(multi){values.has(value)?values.delete(value):values.add(value);state[key]=[...values].join('|');}else state[key]=values.size===1&&values.has(value)?'':value;
 selection=null;update();
}
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,geo,view,scene,state={keyword:'',min:'',max:'',stage:'',region:'',mode:'real',from:'',to:'',verified:false},selection=null;
let showCompanyNames=false,retainIndustry=false,retainMap=false;
let matchedView;
let camera={x:0,y:0,w:1800,h:1080},drag=null;
const colors=['#789c8c','#438caa','#218f86','#deab57','#8495bd','#889c74'];
const short=s=>s.replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g,'');
function stat(n,label){return `<div><strong>${n}</strong><small>${label}</small></div>`;}
function update(){
 matchedView=NEV.filter(data,state);view=NEV.filter(data,{...state,...(retainIndustry?{stage:''}:{}),...(retainMap?{region:''}:{})});scene=primaryMode==='timeline'?NEV.timeLayout(view,d3,showCompanyNames):NEV.layout(view);
 if(selection&&!((selection.kind==='patent'?view.patents:view.companies).some(p=>(p.patent_id||p.company_id)===selection.id)))selection=null;
 $('stats').innerHTML=stat(view.patents.length,'当前专利')+stat(view.companies.length,'关联企业')+stat(view.patents.filter(p=>p.application_date).length,'来源申请日期')+((retainIndustry||retainMap)?stat(matchedView.patents.length,'匹配专利'): '');
 $('mode').disabled=scene.force;
 $('minimap').style.display=scene.force?'none':'';
 $('from').disabled=$('to').disabled=state.mode==='id';
 $('active').textContent=[retainIndustry&&state.stage&&'产业链：联动高亮',retainMap&&state.region&&'地图：联动高亮',state.patentIds&&`AI 筛选：${state.patentIds.length} 条`,state.stage&&`产业环节：${state.stage.split('|').map(id=>NEV.stages.find(s=>s[0]===id)?.[1]).join('、')}`,state.region&&`地域：${state.region}`,state.mode==='demo'&&'模拟时间模式：不支持真实技术趋势结论',state.min&&state.max&&Number(state.min)>Number(state.max)&&'ID 起值大于止值，请调整'].filter(Boolean).join('  /  ')||'当前展示全部筛选结果 · 点击环节柱子可筛选，再次点击取消';
 const base=NEV.filter(data,{...state,stage:'',...(retainMap?{region:''}:{})});
 $('graph-caption').textContent=state.mode==='id'?'底部按专利 ID 升序排列 · ID 不表示申请年代':state.mode==='real'?'底部按来源申请日排序，日期缺失记录置后 · 等间距排列，不表示时长':'底部按模拟展示日期排序 · 等间距排列，不表示时长';
 if(scene.force)$('graph-caption').textContent='申请日时间轴 · 专利受对应日期位置吸引，企业度越低向上吸力越强 · 专利固定在时间轴附近；垂直位置不表示排名';
 document.querySelector('.graph-panel .legend').innerHTML=scene.force?'<i class="company-key"></i>企业（上方） <i class="patent-key"></i>专利散点<span>连线表示申请关系 · 悬停查看日期，点击查看详情</span>':'<i class="company-key"></i>企业（越高：当前关联专利越多） <i class="patent-key"></i>专利<span>实线为申请关联；顺序不表示技术传承</span>';
 drawGraph();drawMap();showDetail();readable();drawIndustry(data,base,state.stage,(stage,multi)=>toggleGroup('stage',stage,multi));
}
function drawGraph(){
 document.getElementById('excentric-lens')?.replaceChildren();
 if(scene.force){drawTimeGraph();return;}
 const pm=new Map(scene.patents.map(p=>[p.patent_id,p])),cm=new Map(scene.companies.map(c=>[c.company_id,c]));
 const linkedP=new Set(selection?.kind==='company'?view.edges.filter(e=>e.company_id===selection.id).map(e=>e.patent_id):selection?[selection.id]:[]);
 const linkedC=new Set(selection?.kind==='patent'?view.edges.filter(e=>e.patent_id===selection.id).map(e=>e.company_id):selection?[selection.id]:[]);
 let svg=`<line x1="50" y1="920" x2="${scene.width-50}" y2="920" stroke="#adc4d3" stroke-width="2" stroke-dasharray="6 6"/>`;
 svg+=view.edges.map(e=>{const p=pm.get(e.patent_id),c=cm.get(e.company_id),on=!selection||linkedP.has(p.patent_id)&&linkedC.has(c.company_id);return `<path d="M${c.x},${c.y+20} C${c.x},${c.y+100} ${p.x},810 ${p.x},900" stroke="${on?'#3b9f99':'#dee6eb'}" opacity="${selection?(on?1:.3):.35}" stroke-width="${selection&&on?3:1.5}" fill="none"/>`;}).join('');
 svg+=scene.companies.map(c=>`<g class="node" data-kind="company" data-id="${c.company_id}" opacity="${!selection||linkedC.has(c.company_id)?1:.25}"><title>${esc(c.name)} · ${c.degree} 条专利</title><rect x="${c.x-87}" y="${c.y-19}" width="174" height="38" rx="7" fill="#e4f3ef" stroke="#5aaba1"/><text x="${c.x}" y="${c.y-2}" text-anchor="middle" font-size="11" fill="#24685f">${esc(c.name.length>13?c.name.slice(0,12)+'…':c.name)}</text><text x="${c.x}" y="${c.y+12}" text-anchor="middle" font-size="9" fill="#6a9991">当前 ${c.degree} 条关联专利</text></g>`).join('');
 svg+=scene.patents.map(p=>{const date=state.mode==='id'?`ID ${p.patent_id}`:state.mode==='real'?(p.application_date||'申请日期缺失'):`${p.display_date}${p.application_date?' · 真实':' · 模拟'}`;return `<g class="node" data-kind="patent" data-id="${p.patent_id}" opacity="${!selection||linkedP.has(p.patent_id)?1:.25}"><title>${esc(p.title)}\n${esc(date)}</title><rect x="${p.x-87}" y="900" width="174" height="68" rx="7" fill="#eef3fa" stroke="#98b0d0"/><text x="${p.x}" y="919" text-anchor="middle" font-size="11" fill="#3d5e7d">${esc(p.title.slice(0,13))}</text><text x="${p.x}" y="935" text-anchor="middle" font-size="11" fill="#3d5e7d">${esc(p.title.slice(13,26))}${p.title.length>26?'…':''}</text><text x="${p.x}" y="954" text-anchor="middle" font-size="9" fill="${state.mode==='demo'&&!p.application_date?'#aa772d':'#8192a5'}">${esc(date)}</text></g>`;}).join('');
 if(!scene.patents.length)svg+='<text x="350" y="500" class="empty-message">没有匹配记录，请调整筛选条件</text>';
 $('graph').innerHTML=svg;
 $('graph').querySelectorAll('.node text').forEach(n=>n.remove());
 $('graph').querySelectorAll('.node').forEach(n=>n.addEventListener('click',()=>{if(drag?.moved)return;selection={kind:n.dataset.kind,id:n.dataset.id};drawGraph();drawMap();showDetail();}));
 drawMini();
}
const regionPalette=['#0072B2','#E69F00','#009E73','#CC79A7','#D55E00','#332288','#88CCEE','#882255','#44AA99','#AA4499','#999933','#661100','#6699CC','#AA4466','#4477AA','#228833','#EE6677','#AA3377','#BBBB55','#004488','#997700','#663399','#666666'];
const provinceNames='北京 天津 河北 山西 内蒙古 辽宁 吉林 黑龙江 上海 江苏 浙江 安徽 福建 江西 山东 河南 湖北 湖南 广东 广西 海南 重庆 四川 贵州 云南 西藏 陕西 甘肃 青海 宁夏 新疆 台湾 香港 澳门'.split(' ');
const provinceColors=[...regionPalette,'#BB5566','#117733','#DDCC77','#774411','#5555AA','#CC3311','#009988','#EE7733','#33BBEE','#993366','#557722'];
let mapColorMode='province';
const macroRegions=[['华东','上海 江苏 浙江 安徽 福建 江西 山东','#4477AA'],['华南','广东 广西 海南','#228833'],['华中','河南 湖北 湖南','#EE6677'],['华北','北京 天津 河北 山西 内蒙古','#CCBB44'],['西南','重庆 四川 贵州 云南 西藏','#AA3377'],['西北','陕西 甘肃 青海 宁夏 新疆','#66CCEE'],['东北','辽宁 吉林 黑龙江','#AA7744'],['港澳台','香港 澳门 台湾','#888888']];
function macroRegion(name){return macroRegions.find(r=>r[1].split(' ').includes(name))||['未定位','','#777777'];}
function provinceColor(name){return macroRegion(name)[2];}
function macroLegend(){return macroRegions.map(([name,provinces,color])=>`<span class="region-swatch" title="${provinces}"><i style="background:${color}"></i>${name}</span>`).join('');}
function regionColor(c){return provinceColor(NEV.region(c?.address||'').name);}
function mapFill(name,n,max){return mapColorMode==='province'?provinceColor(name):n?d3.interpolateBlues(.18+.82*n/max):'#f0f3f5';}
function drawMapLegend(max){
 $('map-color-legend').innerHTML=mapColorMode==='province'?'<span>大区分类 · 与时间线相同色卡</span>'+macroLegend():`<span>当前筛选范围企业数（家）</span><span class="region-swatch"><i style="background:#f0f3f5"></i>0</span><span style="display:inline-block;width:180px;height:12px;background:linear-gradient(to right,${d3.interpolateBlues(.18)},${d3.interpolateBlues(1)})"></span><span>少 → 多（最大 ${max}）</span><span>时间线仍按大区着色</span>`;
}
function drawTimeGraph(){
 const pm=new Map(scene.patents.map(p=>[p.patent_id,p])),cm=new Map(scene.companies.map(c=>[c.company_id,c]));
 const activeEdges=view.edges.filter(e=>!selection||(selection.kind==='company'?e.company_id===selection.id:e.patent_id===selection.id));
 const ps=new Set(activeEdges.map(e=>e.patent_id)),cs=new Set(activeEdges.map(e=>e.company_id));
 document.querySelector('.graph-panel .legend').innerHTML='颜色表示申请主体所在大区；大点为企业，小点为专利。省份仍可点击探索。'+macroLegend();
 let svg='<g class="time-axis"></g>';
 svg+=view.edges.map(e=>{const p=pm.get(e.patent_id),c=cm.get(e.company_id),on=ps.has(e.patent_id)&&cs.has(e.company_id);return `<line x1="${c.x}" y1="${c.y}" x2="${p.x}" y2="${p.y}" stroke="${on?regionColor(c):'#dbe5e8'}" opacity="${selection?(on?.8:.08):.16}" stroke-width="${selection&&on?2:1}"/>`;}).join('');
 svg+=scene.patents.map(p=>`<g class="node" data-kind="patent" data-id="${p.patent_id}" opacity="${!selection||ps.has(p.patent_id)?1:.15}"><title>${esc(p.title)}\n申请日：${esc(p.application_date||'缺失')}</title><circle cx="${p.x}" cy="${p.y}" r="5" fill="${regionColor(cm.get(p.company_ids[0]))}" stroke="#fff" stroke-width="1"/></g>`).join('');
 svg+=scene.companies.map(c=>`<g class="node" data-kind="company" data-id="${c.company_id}" opacity="${!selection||cs.has(c.company_id)?1:.15}"><title>${esc(c.name)} · ${c.degree} 条专利</title><circle cx="${c.x}" cy="${c.y}" r="${Math.min(15,6+Math.sqrt(c.degree))}" fill="${regionColor(c)}" stroke="white"/>${showCompanyNames?`<text x="${c.x}" y="${c.y-19}" text-anchor="middle" font-size="11" fill="#24685f">${esc(c.name.slice(0,5))}${c.name.length>5?'…':''}</text>`: ''}</g>`).join('');
 if(!scene.patents.length)svg+='<text x="900" y="400" text-anchor="middle" fill="#8192a5">没有匹配记录，请调整筛选条件</text>';
 $('graph').innerHTML=svg;
 $('graph').querySelectorAll('.node text').forEach(n=>n.remove());
 if(scene.extent){
  const axis=d3.select($('graph')).select('.time-axis').attr('transform',`translate(0,${scene.axisY})`);
  const ticks=scene.scale.ticks(8).filter(d=>+d>+scene.extent[0]&&+d<+scene.extent[1]);
  const span=scene.extent[1]-scene.extent[0];
  axis.call(d3.axisBottom(scene.scale).tickValues(span?[scene.extent[0],...ticks.filter(d=>scene.scale(d)>210&&scene.scale(d)<1590),scene.extent[1]]:[scene.extent[0]]).tickFormat(d3.utcFormat('%Y-%m-%d')).tickSize(85));
  axis.attr('color','#6d8595').selectAll('text').attr('font-size',12);
 }
 if(scene.patents.some(p=>!p.date))d3.select($('graph')).append('text').attr('x',1740).attr('y',790).attr('text-anchor','middle').attr('fill','#8192a5').text('日期缺失');
 $('graph').querySelectorAll('.node').forEach(n=>n.addEventListener('click',()=>{if(drag?.moved)return;selection={kind:n.dataset.kind,id:n.dataset.id};drawGraph();drawMap();showDetail();}));
 drawMini();
}
function cameraUpdate(){
 const r=$('graph').getBoundingClientRect();camera.h=camera.w*r.height/Math.max(1,r.width);
 camera.x=Math.max(-200,Math.min(scene.width-100,camera.x));camera.y=Math.max(scene.minY-camera.h*.25,Math.min(scene.maxY-100,camera.y));
 $('graph').setAttribute('viewBox',`${camera.x} ${camera.y} ${camera.w} ${camera.h}`);drawMini();
}
function readable(){if(scene.force){fit();return;}const r=$('graph').getBoundingClientRect();camera.w=r.width*1.7;camera.x=-20;camera.y=Math.max(0,1040-r.height*1.7);cameraUpdate();}
function fit(){const r=$('graph').getBoundingClientRect();camera.w=Math.max(scene.width,scene.height*r.width/r.height);camera.x=(scene.width-camera.w)/2;camera.y=scene.minY-(camera.w*r.height/r.width-scene.height)/2;cameraUpdate();}
function zoom(f,px=.5,py=.5){const w=camera.w,h=camera.h;camera.w=Math.min(Math.max(scene.width,scene.height)*1.8,Math.max(400,w*f));camera.x+=(w-camera.w)*px;camera.y+=(h-h*camera.w/w)*py;cameraUpdate();}
function drawMini(){if(!scene)return;
 if(((retainIndustry&&state.stage)||(retainMap&&state.region))&&matchedView){
 const ps=new Set(matchedView.patents.map(p=>p.patent_id)),cs=new Set(matchedView.companies.map(c=>c.company_id));
 $('graph').querySelectorAll('.node').forEach(n=>{if(!(n.dataset.kind==='company'?cs:ps).has(n.dataset.id))n.setAttribute('opacity','.1');});
 const edges=$('graph').querySelectorAll(':scope > line, :scope > path');
 const offset=scene.force?0:1;
 view.edges.forEach((e,i)=>{if(!ps.has(e.patent_id)&&edges[i+offset])edges[i+offset].setAttribute('opacity','.035');});
 }
const sx=280/scene.width,sy=100/scene.height;$('minimap').innerHTML=scene.patents.map(p=>`<circle cx="${p.x*sx}" cy="${(p.y-scene.minY)*sy}" r="1.5" fill="#7395bd"/>`).join('')+scene.companies.map(c=>`<circle cx="${c.x*sx}" cy="${(c.y-scene.minY)*sy}" r="1.5" fill="#168a7e"/>`).join('')+`<rect x="${camera.x*sx}" y="${(camera.y-scene.minY)*sy}" width="${camera.w*sx}" height="${camera.h*sy}" fill="#309d9518" stroke="#218f86" stroke-width="1"/>`;}
function drawMap(){
 renderMap();
 const groupActive=((retainIndustry&&state.stage)||(retainMap&&state.region));
 const regions=new Set((groupActive?matchedView:view).companies.map(c=>NEV.region(c.address).name));
 let selectedRegions=null;
 if(selection){const ids=selection.kind==='company'?[selection.id]:view.edges.filter(e=>e.patent_id===selection.id).map(e=>e.company_id);selectedRegions=new Set(view.companies.filter(c=>ids.includes(c.company_id)).map(c=>NEV.region(c.address).name));}
 $('map').querySelectorAll('[data-region]').forEach(n=>{const name=n.dataset.region;const on=(!state.region||state.region.split('|').includes(name))&&(!groupActive||regions.has(name))&&(!selectedRegions||selectedRegions.has(name));n.setAttribute('opacity',on?'1':'.2');});
}
function renderMap(){
 if(primaryMode==='map'){drawMapDrill();return;}
 $('map').setAttribute('viewBox','0 0 600 420');
 $('map-drill').hidden=true;
 $('map').closest('section').querySelector('.map-note').textContent='按样本地址归属省份聚合，无企业精确坐标。点击省份联动筛选。';
 const base=NEV.filter(data,{...state,region:'',...(retainIndustry?{stage:''}:{})});const counts={};base.companies.forEach(c=>{const name=NEV.region(c.address).name;counts[name]=(counts[name]||0)+1;});
 const max=Math.max(1,...Object.values(counts));drawMapLegend(max);const project=([x,y])=>[(x-73)*9.5+15,(54-y)*9.5+10];
 const path=geometry=>{const polys=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];return polys.map(poly=>poly.map(ring=>ring.map((pt,i)=>{const [x,y]=project(pt);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ')+'Z').join(' ')).join(' ');};
 let selectedRegions=new Set();if(selection){const cids=selection.kind==='company'?[selection.id]:view.edges.filter(e=>e.patent_id===selection.id).map(e=>e.company_id);selectedRegions=new Set(data.companies.filter(c=>cids.includes(c.company_id)).map(c=>NEV.region(c.address).name));}
 $('map').innerHTML=geo.features.filter(f=>f.geometry).map(f=>{const name=short(f.properties.name||''),n=counts[name]||0;const fill=mapFill(name,n,max);return `<path data-region="${esc(name)}" d="${path(f.geometry)}" fill="${fill}" stroke="${(name&&state.region.split('|').includes(name))||selectedRegions.has(name)?'#e59b36':'#c7d6dc'}" stroke-width="${(name&&state.region.split('|').includes(name))||selectedRegions.has(name)?2.5:.8}" style="cursor:pointer"><title>${esc(name)}：${n} 家企业</title></path>`;}).join('');
 $('map').querySelectorAll('[data-region]').forEach(n=>n.onclick=e=>toggleGroup('region',n.dataset.region,e.ctrlKey));
 $('regions').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<button class="${state.region.split('|').includes(n)?'selected':''}" data-region="${n}">${n} ${c}</button>`).join('')||'<small>当前条件下无企业</small>';
 $('regions').querySelectorAll('button').forEach(n=>n.onclick=e=>toggleGroup('region',n.dataset.region,e.ctrlKey));
}
// Province boundaries are real; applicant lists deliberately avoid invented coordinates.
function drawMapDrill(){
 const host=$('map-drill');host.hidden=false;
 const base=NEV.filter(data,{...state,region:'',...(retainIndustry?{stage:''}:{})});
 const provinces=new Map();
 for(const c of base.companies){const name=NEV.region(c.address).name;if(!provinces.has(name))provinces.set(name,[]);provinces.get(name).push(c);}
 const chosen=state.region;
 const feature=!retainMap&&!mapMultiPicking&&chosen&&geo.features.find(f=>short(f.properties.name||'')===chosen&&f.geometry);
 const collection={type:'FeatureCollection',features:geo.features.filter(f=>f.geometry)};
 const projection=d3.geoIdentity().reflectY(true).fitExtent([[35,25],[565,380]],feature||collection);
 const path=d3.geoPath(projection);
 const max=Math.max(1,...[...provinces.values()].map(cs=>cs.length));drawMapLegend(max);
 $('map').setAttribute('viewBox','0 0 600 420');
 $('map').innerHTML=(feature?[feature]:collection.features).map(f=>{
  const name=short(f.properties.name||''),cs=provinces.get(name)||[];
  return `<path data-region="${esc(name)}" tabindex="0" role="button" aria-label="下钻${esc(name)}，${cs.length}家企业" d="${path(f)}" fill="${mapFill(name,cs.length,max)}" stroke="${chosen?'#218f86':'#c7d6dc'}" stroke-width="${chosen?1.5:.7}"><title>${esc(name)} · ${cs.length} 家企业</title></path>`;
 }).join('');
 if(feature){const [x,y]=path.centroid(feature);$('map').innerHTML+=`<text x="${x}" y="${y}" text-anchor="middle" fill="#24685f" font-size="19" pointer-events="none">${esc(chosen)}</text>`;}
 const enter=(name,multi=false)=>toggleGroup('region',name,multi);
 $('map').querySelectorAll('[data-region]').forEach(n=>{n.onclick=e=>enter(n.dataset.region,e.ctrlKey);n.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();enter(n.dataset.region,e.ctrlKey);}};});
 const companies=(chosen?[...provinces].filter(([name])=>chosen.split('|').includes(name)).flatMap(([,cs])=>cs):base.companies).slice().sort((a,b)=>b.degree-a.degree||a.name.localeCompare(b.name,'zh'));
 const ids=new Set(companies.map(c=>c.company_id));
 const patentCount=new Set(base.edges.filter(e=>ids.has(e.company_id)).map(e=>e.patent_id)).size;
 const company=selection?.kind==='company'?companies.find(c=>c.company_id===selection.id):null;
 host.innerHTML=`<nav class="map-breadcrumb" aria-label="地图下钻路径"><button id="map-home">全国</button>${chosen?`<span> / </span><button id="map-province">${esc(chosen)}</button>`:''}${company?`<span> / ${esc(company.name)}</span>`:''}</nav><h3>${esc(chosen||'全国')} · ${companies.length} 家企业 / ${patentCount} 件专利</h3><p>企业按当前筛选结果的关联专利数排序。点击企业查看专利。</p><div class="map-drill-columns"><div class="map-company-list">${companies.map(c=>`<button class="${company?.company_id===c.company_id?'selected':''}" data-drill-company="${c.company_id}"><span>${esc(c.name)}</span><strong>${c.degree} 件</strong></button>`).join('')||'<p>当前筛选条件下没有企业。</p>'}</div><div class="map-patent-list">${company?`<h4>${esc(company.name)}</h4><p>${esc(company.address)}</p>${base.patents.filter(p=>p.company_ids.includes(company.company_id)).map(p=>`<button data-drill-patent="${p.patent_id}"><span>${esc(p.title)}</span><small>${esc(p.application_date||'申请日期缺失')}</small></button>`).join('')}`:'<p>选择左侧企业，查看申请日期和专利详情。</p>'}</div></div>`;
 $('map-home').onclick=()=>{state.region='';selection=null;update();};
 if($('map-province'))$('map-province').onclick=()=>{selection=null;drawMap();drawGraph();showDetail();};
 host.querySelectorAll('[data-drill-company]').forEach(b=>b.onclick=()=>{selection={kind:'company',id:b.dataset.drillCompany};drawMap();drawGraph();showDetail();});
 host.querySelectorAll('[data-drill-patent]').forEach(b=>b.onclick=()=>{selection={kind:'patent',id:b.dataset.drillPatent};drawGraph();showDetail();$('detail').scrollIntoView({behavior:'smooth',block:'center'});});
 $('regions').innerHTML=[...provinces].sort((a,b)=>b[1].length-a[1].length).map(([name,cs])=>`<button data-region="${esc(name)}" class="${chosen.split('|').includes(name)?'selected':''}">${esc(name)} ${cs.length}</button>`).join('');
 $('regions').querySelectorAll('button').forEach(b=>b.onclick=e=>enter(b.dataset.region,e.ctrlKey));
 $('map').closest('section').querySelector('.map-note').textContent=chosen?'已下钻省份；右侧企业来自样本地址归属。地图不标注企业精确位置。':'点击省份下钻，查看区域企业及关联专利；可通过路径返回全国。';
}
function showDetail(){
 if(!selection){$('detail').innerHTML='点击专利或企业节点，查看标题、日期来源、地址与环节命中词。<p>选中节点将高亮关联对象及地图所在省份。</p>';return;}
 if(selection.kind==='patent'){
 const p=data.patents.find(p=>p.patent_id===selection.id);const es=data.patent_stage.filter(e=>e.patent_id===p.patent_id);
 $('detail').innerHTML=`<h3>${esc(p.title)}</h3>ID：${p.patent_id} · ${esc(p.patent_type||'类型缺失')}<br>来源申请日：<b>${esc(p.application_date||'尚未补全')}</b><br>申请号：${esc(p.application_number)}<br>来源记录：${esc(p.date_source)}<br>IPC：${esc(p.ipc)}<details><summary>摘要与主权项</summary><p>${esc(p.abstract)}</p><p>${esc(p.claims)}</p></details><p>环节分类：单一流程测试规则</p>${es.map(e=>`<div><span class="badge">${esc(NEV.stages.find(s=>s[0]===e.stage_id)?.[1])}</span>${esc(e.evidence.join('、'))}</div>`).join('')}<p>申请主体（来源申请人字段）</p>${data.companies.filter(c=>p.company_ids.includes(c.company_id)).map(c=>`<button data-company="${c.company_id}">${esc(c.name)}</button>`).join('')}`;
 }else{
 const c=view.companies.find(c=>c.company_id===selection.id),r=NEV.region(c.address);
 $('detail').innerHTML=`<h3>${esc(c.name)}</h3>当前关联 ${c.degree} 条专利<br>样本首条地址：${esc(c.address)}<br>地址原值数量：${c.address_variants?.length||1}<br>省级归属：${r.name}<br>识别依据：${r.method} / ${r.evidence}<p>地址来源：上市公司专利数据 · 申请人地址<br>地址时间未知；未提供企业精确坐标。</p>${view.patents.filter(p=>p.company_ids.includes(c.company_id)).map(p=>`<p><button data-patent="${p.patent_id}">${esc(p.title)}</button></p>`).join('')}`;
 }
 $('detail').querySelectorAll('[data-company],[data-patent]').forEach(b=>b.onclick=()=>{selection={kind:b.dataset.company?'company':'patent',id:b.dataset.company||b.dataset.patent};drawGraph();drawMap();showDetail();const n=selection.kind==='company'?scene.companies.find(c=>c.company_id===selection.id):scene.patents.find(p=>p.patent_id===selection.id);camera.x=n.x-camera.w/2;camera.y=n.y-camera.h/2;cameraUpdate();});
}
for(const key of ['keyword','min','max','mode','from','to','verified'])$(key).addEventListener(key==='keyword'?'input':'change',()=>{state[key]=key==='verified'?$(key).checked:$(key).value;if(key==='mode'&&state.mode==='id'){state.from=state.to='';$('from').value=$('to').value='';}update();});
$('reset').onclick=()=>{state={keyword:'',min:'',max:'',stage:'',region:'',mode:'real',from:'',to:'',verified:false};for(const key of ['keyword','min','max','mode','from','to'])$(key).value=state[key];$('verified').checked=false;selection=null;update();};
$('clear-region').onclick=()=>{state.region='';update();};$('clear-selection').onclick=()=>{selection=null;drawGraph();drawMap();showDetail();};
$('zoomin').onclick=()=>zoom(.7);$('zoomout').onclick=()=>zoom(1.4);$('fit').onclick=fit;$('readable').onclick=readable;
$('graph').addEventListener('wheel',e=>{e.preventDefault();const r=$('graph').getBoundingClientRect();zoom(e.deltaY>0?1.15:1/1.15,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);},{passive:false});
// Background double-click clears the selection owned by that view.
for(const [id,key] of [['industry-overview','stage'],['map','region']]){
 const canvas=$(id);
 canvas.addEventListener('dblclick',e=>{
  if(e.target!==canvas)return;
  e.preventDefault();
  state[key]='';selection=null;update();
 });
 canvas.setAttribute('title','双击画布空白处取消当前视图选择');
}
$('graph').addEventListener('dblclick',e=>{
 if(e.target!==$('graph'))return;
 e.preventDefault();
 $('clear-selection').onclick();
});
$('graph').addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,moved:false};});
window.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;const scale=camera.w/$('graph').getBoundingClientRect().width;camera.x=drag.cx-dx*scale;camera.y=drag.cy-dy*scale;cameraUpdate();});
window.addEventListener('pointerup',()=>setTimeout(()=>{drag=null;},0));
$('minimap').addEventListener('pointerdown',e=>{const r=$('minimap').getBoundingClientRect();camera.x=(e.clientX-r.left)/r.width*scene.width-camera.w/2;camera.y=(e.clientY-r.top)/r.height*scene.height+scene.minY-camera.h/2;cameraUpdate();});
window.addEventListener('resize',()=>scene&&cameraUpdate());
// Move existing panels rather than recreate them: filters, selection and handlers survive.
const primaryPanels={industry:$('industry-overview').closest('section'),timeline:$('graph').closest('section'),map:$('map').closest('section')};
for(const [key,title] of [['industry','产业链'],['map','地图']]){
 const control=document.createElement('label');control.className='view-link-mode';
 control.innerHTML=`<input type="checkbox" id="retain-${key}" aria-label="${title}保留未选中数据">保留未选中数据`;
 control.title='按住 Ctrl 点击可多选。开启：点击后联动高亮、减淡其他数据；关闭：点击后过滤数据';
 primaryPanels[key].querySelector('.heading').append(control);
 control.querySelector('input').onchange=e=>{if(key==='industry')retainIndustry=e.target.checked;else retainMap=e.target.checked;update();};
}
const evidencePanel=$('detail').closest('section');
const mapBody=document.createElement('div');mapBody.className='map-body';$('map').before(mapBody);mapBody.append($('map'));
const mapColorControl=document.createElement('label');mapColorControl.innerHTML='地图颜色 <select id="map-color-mode"><option value="province">大区分类</option><option value="count">企业数量</option></select>';primaryPanels.map.querySelector('.heading').append(mapColorControl);
const mapColorLegend=document.createElement('div');mapColorLegend.id='map-color-legend';mapBody.after(mapColorLegend);
$('map-color-mode').onchange=e=>{mapColorMode=e.target.value;drawMap();};
const mapDrill=document.createElement('div');mapDrill.id='map-drill';mapDrill.hidden=true;mapBody.append(mapDrill);
const modeNav=document.createElement('nav');modeNav.className='primary-modes';modeNav.setAttribute('aria-label','主视图选择');
const explorer=document.createElement('div');explorer.className='view-layout';
const mainSlot=document.createElement('div');mainSlot.className='main-slot';
const sideSlot=document.createElement('div');sideSlot.className='side-slot';explorer.append(mainSlot,sideSlot);
$('active').after(modeNav,explorer);
const modeNames={industry:'产业链',timeline:'时间线',map:'地域地图'};
let primaryMode='timeline';
function setPrimaryMode(mode){
 primaryMode=mode;
 if(mode==='timeline'){state.mode='real';$('mode').value='real';}
 for(const [key,panel] of Object.entries(primaryPanels)){
  panel.classList.toggle('primary-view',key===mode);panel.classList.toggle('secondary-view',key!==mode);
  (key===mode?mainSlot:sideSlot).append(panel);
  const button=panel.querySelector('.promote-view');button.textContent=key===mode?'当前主视图':'设为主视图';button.disabled=key===mode;
 }
 modeNav.querySelectorAll('button').forEach(b=>{const on=b.dataset.mode===mode;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
 requestAnimationFrame(()=>{if(data)update();});
}
for(const [key,panel] of Object.entries(primaryPanels)){
 panel.dataset.view=key;
 const button=document.createElement('button');button.className='promote-view';button.setAttribute('aria-label',modeNames[key]+'设为主视图');button.onclick=()=>setPrimaryMode(key);panel.querySelector('.heading').append(button);
 const tab=document.createElement('button');tab.dataset.mode=key;tab.textContent=modeNames[key]+'主视图';tab.onclick=()=>setPrimaryMode(key);modeNav.append(tab);
}
explorer.after(evidencePanel);evidencePanel.classList.add('shared-evidence');
document.querySelector('.workspace').remove();
setPrimaryMode(primaryMode);
Promise.all([fetch('/nev/data.json').then(r=>{if(!r.ok)throw Error('数据加载失败');return r.json();}),fetch('/nev/china-provinces.json').then(r=>{if(!r.ok)throw Error('地图加载失败');return r.json();})]).then(([d,g])=>{data=NEV.exclusive(d);geo=g;update();}).catch(e=>{$('active').textContent='加载失败：'+e.message;});


const assistantPanel=document.createElement('section');assistantPanel.className='panel ai-panel';
assistantPanel.innerHTML='<h2>数据助手 · 搜索与报告</h2><p>将当前筛选范围的标题、摘要、申请日、IPC、企业地址和环节发送到已配置的模型服务。搜索结果可预览后应用；报告仅分析当前范围。</p><details><summary>API 配置（兼容 Chat Completions）</summary><div class="filters"><label>API URL<input id="ai-base" value="https://api.kksj.org/v1/chat/completions" placeholder="https://服务地址/v1/chat/completions"></label><label>API Key<input id="ai-key" type="password" autocomplete="off" placeholder="已配置服务端默认 Key，可填写覆盖"></label><label>模型<select id="ai-model"><option value="gpt-6-astra">gpt-6-astra</option></select></label><button id="ai-list-models" type="button">列出模型</button><span id="ai-model-status" role="status"></span><label>Temperature<input id="ai-temperature" type="number" min="0" max="2" step="0.1" value="0.2"></label></div><p>配置留空时使用服务端环境变量。Key 不写入本地存储；请求经本地服务转发至所填地址。</p></details><textarea id="ai-query" rows="3" placeholder="例如：找出涉及动力电池回收的专利，并说明匹配依据"></textarea><div><button id="ai-search">AI 搜索</button> <button id="ai-report">生成当前范围报告</button> <button id="ai-clear">清除 AI 筛选</button> <button id="ai-download" hidden>下载报告</button></div><p id="ai-status" role="status"></p><div id="ai-result"></div>';
$('active').before(assistantPanel);
let aiBusy=false,aiReport='';
async function askAI(action){
 if(aiBusy||!view)return;
 const query=$('ai-query').value.trim();if(!query){$('ai-status').textContent='请先填写搜索要求或报告主题';return;}
 const ids=view.patents.map(p=>p.patent_id);
 aiBusy=true;$('ai-search').disabled=$('ai-report').disabled=true;$('ai-status').textContent=`正在分析 ${ids.length} 件专利…`;$('ai-result').replaceChildren();$('ai-download').hidden=true;
 try{
 const response=await fetch('/api/nev-assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,query,ids,config:{baseUrl:$('ai-base').value.trim(),apiKey:$('ai-key').value.trim(),model:$('ai-model').value.trim(),temperature:Number($('ai-temperature').value)}})});
 const result=await response.json();if(!response.ok)throw Error(result.error||'请求失败');
 $('ai-status').textContent=`分析范围：${result.count} 件专利（请求时快照）`;
 if(action==='report'){aiReport=result.report;$('ai-result').textContent=aiReport;$('ai-download').hidden=false;}
 else{
 $('ai-result').innerHTML=`<p>${esc(result.summary)}</p><button id="ai-apply">应用 ${result.matches.length} 条匹配结果</button>`+result.matches.map(m=>`<p><b>[${esc(m.id)}] ${esc(data.patents.find(p=>p.patent_id===m.id)?.title)}</b><br>${esc(m.reason)}</p>`).join('');
 $('ai-apply').onclick=()=>{state.patentIds=result.matches.map(m=>m.id);update();$('ai-status').textContent=`已应用 ${result.matches.length} 条 AI 结果，与其他筛选条件取交集`;} ;
 }
 }catch(e){$('ai-status').textContent='未完成：'+e.message;}finally{aiBusy=false;$('ai-search').disabled=$('ai-report').disabled=false;}
}
$('ai-search').onclick=()=>askAI('search');$('ai-report').onclick=()=>askAI('report');
$('ai-clear').onclick=()=>{delete state.patentIds;update();$('ai-status').textContent='已清除 AI 筛选';};
$('ai-download').onclick=()=>{const url=URL.createObjectURL(new Blob([aiReport],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='专利分析报告.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
// Excentric labels are a screen-space overlay: no data nodes are displaced.
const lensControl=document.createElement('label');lensControl.className='view-link-mode timeline-lens-control';
lensControl.innerHTML='<input id="timeline-lens" type="checkbox" checked>名称透镜 <input id="lens-radius" aria-label="透镜半径" type="range" min="20" max="100" value="55" title="透镜半径">';
primaryPanels.timeline.querySelector('.heading').append(lensControl);
const lensOverlay=document.createElementNS('http://www.w3.org/2000/svg','svg');lensOverlay.id='excentric-lens';lensOverlay.setAttribute('aria-hidden','true');$('graph-wrap').append(lensOverlay);
let lensPointer=null,lensIncludeDimmed=false;
function clearLens(){lensOverlay.replaceChildren();}
function renderLens(){
 clearLens();if(!scene?.force||!$('timeline-lens').checked||!lensPointer||drag)return;
 const r=$('graph').getBoundingClientRect(),w=r.width,h=r.height,[mx,my]=lensPointer,radius=Number($('lens-radius').value);
 lensOverlay.setAttribute('viewBox',`0 0 ${w} ${h}`);
 const matrix=$('graph').getScreenCTM();if(!matrix)return;
 const nodeScale=Math.hypot(matrix.a,matrix.b);
 const hits=[];
 $('graph').querySelectorAll('.node').forEach(el=>{
 if(!lensIncludeDimmed&&Number(el.getAttribute('opacity')??1)<1)return;
 const circle=el.querySelector('circle');if(!circle)return;
 const pt=new DOMPoint(Number(circle.getAttribute('cx')),Number(circle.getAttribute('cy'))).matrixTransform(matrix);
 const x=pt.x-r.left,y=pt.y-r.top;if(Math.hypot(x-mx,y-my)>radius)return;
 const item=el.dataset.kind==='company'?scene.companies.find(c=>c.company_id===el.dataset.id):scene.patents.find(p=>p.patent_id===el.dataset.id);
 hits.push({x,y,highlightRadius:(Number(circle.getAttribute('r'))+2)*nodeScale,name:item.name||item.title,color:circle.getAttribute('fill'),id:el.dataset.id});
 });
 let svg=`<circle cx="${mx}" cy="${my}" r="${radius}" fill="#218f8609" stroke="#218f86" stroke-width="1.5"/><text x="${Math.max(8,Math.min(w-140,mx-radius))}" y="${Math.max(15,my-radius-9)}" fill="#24685f" font-size="12">${hits.length} 个节点</text>`;
 const sides=[[],[]];hits.sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id)).forEach(n=>sides[n.x<mx?0:1].push(n));
 // Near an edge, use the side with usable label space.
 if(mx-radius<140){sides[1].push(...sides[0]);sides[0]=[];}else if(w-mx-radius<140){sides[0].push(...sides[1]);sides[1]=[];}
 let shown=0;
 sides.forEach((nodes,side)=>{
 nodes.sort((a,b)=>a.y-b.y||a.x-b.x);
 const anchor=side?Math.min(w-90,mx+radius+20):Math.max(90,mx-radius-20);
 const space=side?w-anchor-10:anchor-10,chars=Math.max(5,Math.floor(space/12));
 const entries=nodes.map(n=>({...n,lines:Array.from({length:Math.ceil(n.name.length/chars)},(_,i)=>n.name.slice(i*chars,(i+1)*chars))}));
 let used=0;const visible=[];for(const n of entries){n.height=n.lines.length*16+8;if(used+n.height>h-44)break;used+=n.height;visible.push(n);}
 let top=Math.max(22,Math.min(h-used-12,my-used/2));
 visible.forEach(n=>{const cy=top+n.height/2,x=side?anchor:anchor-space;
 svg+=`<path d="M${n.x},${n.y} L${side?anchor-8:anchor+8},${cy} L${anchor},${cy}" fill="none" stroke="${n.color}" opacity=".8"/><circle cx="${n.x}" cy="${n.y}" r="${n.highlightRadius}" fill="none" stroke="${n.color}" stroke-width="${1.2*nodeScale}"/><rect x="${x-3}" y="${top}" width="${space+6}" height="${n.height}" rx="3" fill="white" fill-opacity=".95"/><text x="${side?anchor:anchor}" text-anchor="${side?'start':'end'}" fill="#263a45" font-size="12">${n.lines.map((line,i)=>`<tspan x="${anchor}" y="${top+15+i*16}">${esc(line)}</tspan>`).join('')}</text>`;
 top+=n.height;shown++;});
 });
 if(shown<hits.length)svg+=`<text x="12" y="${h-12}" font-size="12" fill="#926824">已显示 ${shown}/${hits.length} 个名称，请缩小透镜或放大画布查看其余节点</text>`;
 lensOverlay.innerHTML=svg;
}
$('graph').addEventListener('pointermove',e=>{const r=$('graph').getBoundingClientRect();lensPointer=[e.clientX-r.left,e.clientY-r.top];lensIncludeDimmed=e.ctrlKey;renderLens();});
$('graph').addEventListener('pointerleave',()=>{lensPointer=null;clearLens();});
$('graph').addEventListener('pointerdown',clearLens);
$('graph').addEventListener('wheel',clearLens);
$('timeline-lens').onchange=renderLens;$('lens-radius').oninput=renderLens;

$('ai-list-models').onclick=async()=>{
 const button=$('ai-list-models'),status=$('ai-model-status');button.disabled=true;status.textContent='正在获取模型…';
 try{
 const response=await fetch('/api/nev-assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'models',config:{baseUrl:$('ai-base').value.trim(),apiKey:$('ai-key').value.trim()}})});
 const result=await response.json();if(!response.ok)throw Error(result.error||'请求失败');
 const previous=$('ai-model').value;$('ai-model').replaceChildren();
 for(const id of result.models){const option=document.createElement('option');option.value=id;option.textContent=id;$('ai-model').append(option);}
 if(result.models.includes(previous))$('ai-model').value=previous;
 status.textContent=result.models.length?`已加载 ${result.models.length} 个模型`:'没有可用模型';
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
};

window.addEventListener('keydown',e=>{if(e.key==='Control'){lensIncludeDimmed=true;renderLens();}});
window.addEventListener('keyup',e=>{if(e.key==='Control'){lensIncludeDimmed=false;renderLens();}});
window.addEventListener('blur',()=>{lensIncludeDimmed=false;clearLens();});
