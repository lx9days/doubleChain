/* Grouped bars share a numerical count scale; series retain their own units. */
(async function(){
const status=document.getElementById('status');
try{
 const response=await fetch('/nev/data.json');if(!response.ok)throw new Error(`数据加载失败 (${response.status})`);
 const data=NEV.exclusive(await response.json());
 const stageByPatent=new Map(data.patent_stage.map(e=>[e.patent_id,e.stage_id]));
 const records=Analysis.rows(data,Analysis.initial());
 const rows=NEV.stages.map(([id,label])=>{const patents=records.filter(p=>stageByPatent.get(p.patent_id)===id);return {id,label,companies:Analysis.count(patents,'companies'),patents:patents.length};});
 const series=[{key:'companies',label:'企业（家）',color:'#218f86',unit:'家'},{key:'patents',label:'专利（件）',color:'#7899b5',unit:'件'}];
 const width=1200,height=620,margin={top:38,right:158,bottom:106,left:75};
 const x=d3.scaleBand().domain(rows.map(d=>d.id)).range([margin.left,width-margin.right]).paddingInner(.3).paddingOuter(.18);
 const inner=d3.scaleBand().domain(series.map(d=>d.key)).range([0,x.bandwidth()]).padding(.04);
 const y=d3.scaleLinear().domain([0,d3.max(rows,d=>Math.max(d.companies,d.patents))*1.12||1]).nice().range([height-margin.bottom,margin.top]);
 const svg=d3.select('#chart').append('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img').attr('aria-labelledby','chart-title chart-desc');
 svg.append('title').attr('id','chart-title').text('各产业链环节的企业数与专利申请数');
 svg.append('desc').attr('id','chart-desc').text(rows.map(d=>`${d.label}：企业${d.companies}家，专利${d.patents}件`).join('；'));
 const grid=svg.append('g').attr('transform',`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(width-margin.left-margin.right)).tickFormat(''));
 grid.select('.domain').remove();grid.selectAll('line').attr('stroke','#dfe8ec');
 svg.append('rect').attr('x',margin.left).attr('y',margin.top).attr('width',width-margin.left-margin.right).attr('height',height-margin.bottom-margin.top).attr('fill','none').attr('stroke','#dfe8ec');
 svg.append('g').attr('transform',`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('d'))).call(g=>g.selectAll('text').attr('font-size',13)).call(g=>g.selectAll('path,line').attr('stroke','#9bafb9'));
 const axis=svg.append('g').attr('transform',`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x).tickFormat(id=>rows.find(d=>d.id===id).label).tickSizeOuter(0));
 axis.selectAll('text').attr('font-size',12).attr('dy','1.2em');axis.selectAll('path,line').attr('stroke','#9bafb9');
 svg.append('text').attr('transform','rotate(-90)').attr('x',-(margin.top+height-margin.bottom)/2).attr('y',24).attr('text-anchor','middle').attr('font-size',15).attr('font-weight',600).text('数量');
 svg.append('text').attr('x',(margin.left+width-margin.right)/2).attr('y',height-25).attr('text-anchor','middle').attr('font-size',15).attr('font-weight',600).text('产业链环节');
 const tip=document.getElementById('tooltip');
 function show(event,d){tip.replaceChildren();const title=document.createElement('strong');title.textContent=d.row.label;tip.append(title,document.createElement('br'),`${d.series.label}：${d.value} ${d.series.unit}`);tip.style.display='block';const r=event.target.getBoundingClientRect();tip.style.left=Math.min(window.innerWidth-250,event.clientX||r.x+20)+'px';tip.style.top=Math.max(8,(event.clientY||r.y)-70)+'px';}
 const detail=document.createElement('section');detail.className='stage-detail';detail.hidden=true;document.getElementById('chart').append(detail);
 let selectedStage=null;
 function selectStage(event,d){
  selectedStage=selectedStage===d.row.id?null:d.row.id;
  svg.selectAll('.bar').attr('opacity',b=>!selectedStage||b.row.id===selectedStage?1:.25).attr('aria-pressed',b=>b.row.id===selectedStage);
  detail.replaceChildren();detail.hidden=!selectedStage;if(!selectedStage)return;
  const ps=records.filter(p=>stageByPatent.get(p.patent_id)===selectedStage),ids=new Set(ps.flatMap(p=>p.company_ids)),cs=data.companies.filter(c=>ids.has(c.company_id));
  const heading=document.createElement('h2');heading.textContent=d.row.label+' · 企业与专利';const clear=document.createElement('button');clear.textContent='清除选择';clear.onclick=()=>selectStage(event,d);detail.append(heading,clear);
  const columns=document.createElement('div');columns.className='stage-columns';
  for(const [title,items] of [['申请主体（'+cs.length+'家）',cs.map(c=>c.name+' · '+ps.filter(p=>p.company_ids.includes(c.company_id)).length+'件')],['专利申请（'+ps.length+'件）',ps.map(p=>p.title+' · '+p.application_number)]]){const box=document.createElement('div'),h=document.createElement('h3'),list=document.createElement('ul');h.textContent=title;items.forEach(t=>{const li=document.createElement('li');li.textContent=t;list.append(li);});box.append(h,list);columns.append(box);}detail.append(columns);
 }
 const bars=rows.flatMap(row=>series.map(s=>({row,series:s,value:row[s.key]})));
 svg.append('g').selectAll('rect').data(bars).join('rect').attr('class','bar').attr('tabindex',0).attr('aria-label',d=>`${d.row.label}，${d.series.label} ${d.value}`).attr('x',d=>x(d.row.id)+inner(d.series.key)).attr('y',d=>y(d.value)).attr('width',inner.bandwidth()).attr('height',d=>y(0)-y(d.value)).attr('fill',d=>d.series.color).attr('role','button').on('click',selectStage).on('keydown',(event,d)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectStage(event,d);}}).on('pointermove',show).on('focus',show).on('pointerleave',()=>tip.style.display='none').on('blur',()=>tip.style.display='none');
 svg.append('g').selectAll('text').data(bars).join('text').attr('x',d=>x(d.row.id)+inner(d.series.key)+inner.bandwidth()/2).attr('y',d=>y(d.value)-9).attr('text-anchor','middle').attr('font-size',13).attr('fill','#375766').text(d=>d.value);
 const legend=svg.append('g').attr('transform',`translate(${width-margin.right+24},${margin.top})`);legend.append('text').attr('font-weight',600).attr('font-size',14).text('统计对象');series.forEach((s,i)=>{legend.append('rect').attr('x',0).attr('y',18+i*29).attr('width',15).attr('height',15).attr('fill',s.color);legend.append('text').attr('x',23).attr('y',30+i*29).attr('font-size',13).text(s.label);});
 status.textContent=`当前样本：${records.length} 件专利申请 · ${Analysis.count(records,'companies')} 家申请主体`;status.style.fontSize='12px';
}catch(error){status.textContent='图表加载失败：'+error.message;console.error(error);}
})();

// Timeline uses the same deduplicated sample as the grouped bars.
(async function timelinePanel(){
 const host=document.createElement('section');host.hidden=true;host.id='timeline-panel';
 const chart=document.getElementById('chart'),nav=document.createElement('nav');nav.style.cssText='display:flex;gap:10px;margin:24px 0';
 const barsButton=document.createElement('button'),timeButton=document.createElement('button');barsButton.textContent='环节数量分布';timeButton.textContent='时间与申请主体';nav.append(barsButton,timeButton);chart.before(nav);chart.after(host);
 function mode(time){chart.hidden=time;host.hidden=!time;barsButton.setAttribute('aria-pressed',!time);timeButton.setAttribute('aria-pressed',time);document.querySelector('h1').textContent=time?'专利申请时间与主体关联':'产业链环节数量分布';document.querySelector('.subtitle').textContent=time?'专利严格按来源申请日定位 · 企业位于时间带外围':'新能源汽车 · 企业与专利在各环节的数量分布';}
 barsButton.onclick=()=>mode(false);timeButton.onclick=()=>mode(true);
 host.innerHTML='<div class="timeline-tools"><button data-action="reset">全景</button><button data-action="clear">取消选中</button><span>滚轮缩放时间 · 拖动平移 · 点击企业或专利查看关联</span></div><p class="timeline-note">横轴为来源申请日（未外部核验）；专利纵向仅用于避碰。企业位置不表示实力或成立时间，连边仅表示申请关联。</p><div class="timeline-scroll"></div><details><summary class="missing-summary">缺失日期</summary><div class="missing-list"></div></details><details open><summary>选中对象与来源证据</summary><div class="timeline-detail">点击企业或专利查看证据。</div></details>';
 const style=document.createElement('style');style.textContent='button{font:inherit;padding:8px 14px;background:white;border:1px solid #ccd4dc;border-radius:4px;cursor:pointer}button[aria-pressed=true]{background:#e5f3f0;border-color:#218f86}.timeline-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.timeline-tools span,.timeline-note{color:#777;font-size:12px}.timeline-scroll{max-height:760px;overflow:auto;border:1px solid #e2e6ea;margin:18px 0}.timeline-scroll svg{width:100%;min-width:1100px;touch-action:none}.timeline-detail{line-height:1.8;max-height:320px;overflow:auto;padding:12px 0;white-space:pre-wrap}#timeline-panel details{margin:12px 0}.timeline-node{cursor:pointer}.timeline-node:focus{outline:2px solid #218f86}';document.head.append(style);
 try{
 const response=await fetch('/nev/data.json');if(!response.ok)throw Error('数据加载失败');const data=NEV.exclusive(await response.json()),records=Analysis.rows(data,Analysis.initial());
 const dated=records.filter(p=>p.application_date&&Number.isFinite(Date.parse(p.application_date))),missing=records.filter(p=>!dated.includes(p));
 host.querySelector('.missing-summary').textContent=`缺失或无效申请日期：${missing.length} 件`;const detail=host.querySelector('.timeline-detail');
 let selected=null;
 function evidence(p){detail.textContent=[p.title,`申请号：${p.application_number}`,`类型：${p.patent_type||''}`,`来源申请日：${p.application_date||'缺失'}（未外部核验）`,`IPC：${p.ipc||''}`,`摘要：${p.abstract||''}`,`主权项：${p.claims||''}`,`来源记录：${p.source_record_id||p.date_source||p.patent_id}`,...data.companies.filter(c=>p.company_ids.includes(c.company_id)).map(c=>`${c.name} · 来源地址：${c.address||'缺失'}`),`分类证据：${JSON.stringify(data.patent_stage.filter(e=>e.patent_id===p.patent_id))}`].join('\n\n');}
 missing.forEach(p=>{const b=document.createElement('button');b.textContent=p.title;b.onclick=()=>evidence(p);host.querySelector('.missing-list').append(b);});
 if(!dated.length){host.querySelector('.timeline-scroll').textContent='没有可绘制的来源申请日期。';return;}
 const width=1200,left=55,right=1145;
 const extent=d3.extent(dated,p=>Date.parse(p.application_date));const pad=Math.max(86400000,(extent[1]-extent[0])*.035);
 const scale=d3.scaleUtc().domain([new Date(extent[0]-pad),new Date(extent[1]+pad)]).range([left,right]);
 const patents=dated.map(p=>({...p,x:scale(new Date(p.application_date))})).sort((a,b)=>a.x-b.x);
 // Exact x, deterministic y-only packing: no force may move a date.
 const lanes=[];patents.forEach(p=>{let lane=0;while(lanes[lane]!=null&&p.x-lanes[lane]<12)lane++;lanes[lane]=p.x;p.lane=lane;});
 const companies=data.companies.map(c=>({...c,patents:patents.filter(p=>p.company_ids.includes(c.company_id))})).filter(c=>c.patents.length).sort((a,b)=>d3.mean(a.patents,p=>p.x)-d3.mean(b.patents,p=>p.x));
 const occupied=[[],[]];companies.forEach((c,i)=>{c.side=i%2;c.x=Math.max(150,Math.min(1050,d3.mean(c.patents,p=>p.x)));let lane=0;while(occupied[c.side][lane]?.some(x=>Math.abs(x-c.x)<220))lane++;(occupied[c.side][lane]??=[]).push(c.x);c.lane=lane;});
 const top=50+occupied[0].length*38,bandHeight=Math.max(90,lanes.length*13+30),bottom=top+bandHeight,height=bottom+occupied[1].length*38+70;
 patents.forEach(p=>p.y=top+20+p.lane*13);companies.forEach(c=>c.y=c.side?bottom+45+c.lane*38:top-45-c.lane*38);
 const svg=d3.select(host.querySelector('.timeline-scroll')).append('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img').attr('aria-label','严格按申请日期定位的专利与外围企业关联图');
 svg.append('rect').attr('x',left).attr('y',top).attr('width',right-left).attr('height',bandHeight).attr('fill','#f2f6fa');
 svg.append('defs').append('clipPath').attr('id','timeline-clip').append('rect').attr('x',left).attr('y',0).attr('width',right-left).attr('height',height);
 const axis=svg.append('g').attr('transform',`translate(0,${bottom})`),edges=svg.append('g').attr('clip-path','url(#timeline-clip)'),dots=svg.append('g').attr('clip-path','url(#timeline-clip)'),labels=svg.append('g');
 const links=companies.flatMap(c=>c.patents.map(p=>({c,p})));
 const edge=edges.selectAll('line').data(links).join('line').attr('x1',d=>d.c.x).attr('y1',d=>d.c.y).attr('y2',d=>d.p.y);
 const dot=dots.selectAll('circle').data(patents).join('circle').attr('class','timeline-node').attr('tabindex',0).attr('cy',p=>p.y).attr('r',4.5).on('click',(e,p)=>choose('patent',p)).on('keydown',(e,p)=>{if(e.key==='Enter')choose('patent',p);});dot.append('title').text(p=>`${p.title}\n${p.application_date}\n${p.application_number}`);
 const company=labels.selectAll('g').data(companies).join('g').attr('class','timeline-node').attr('tabindex',0).attr('transform',c=>`translate(${c.x},${c.y})`).on('click',(e,c)=>choose('company',c)).on('keydown',(e,c)=>{if(e.key==='Enter')choose('company',c);});company.append('rect').attr('x',-106).attr('y',-14).attr('width',212).attr('height',28).attr('rx',4);company.append('text').attr('text-anchor','middle').attr('dy','.35em').attr('font-size',11).text(c=>`${c.name.length>14?c.name.slice(0,14)+'…':c.name} · ${c.patents.length}件`);company.append('title').text(c=>`${c.name} · ${c.patents.length}件`);
 function choose(kind,d){selected={kind,id:kind==='company'?d.company_id:d.patent_id};if(kind==='patent')evidence(d);else{detail.textContent=`${d.name}\n来源地址：${d.address||'缺失'}（地址时间未知）\n当前关联 ${d.patents.length} 件有日期申请\n`;d.patents.forEach(p=>{const b=document.createElement('button');b.textContent=`${p.application_date} · ${p.title}`;b.onclick=()=>choose('patent',p);detail.append(b);});}highlight();}
 function linked(c,p){return selected&&(selected.kind==='company'?c.company_id===selected.id:p.patent_id===selected.id);}
 function highlight(){edge.attr('stroke',d=>linked(d.c,d.p)?'#218f86':'#a7b8c9').attr('stroke-opacity',d=>linked(d.c,d.p)?.9:selected?.06:.14).attr('stroke-width',d=>linked(d.c,d.p)?1.8:.7);dot.attr('fill',p=>selected&&(selected.kind==='patent'?p.patent_id===selected.id:p.company_ids.includes(selected.id))?'#7899b5':'#218f86');company.select('rect').attr('fill',c=>selected&&(selected.kind==='company'?c.company_id===selected.id:c.patents.some(p=>p.patent_id===selected.id))?'#fff0db':'#f5f8fb').attr('stroke','#afbdca');}
 function draw(x){axis.call(d3.axisBottom(x).ticks(8).tickFormat(d3.utcFormat('%Y-%m-%d')));dot.attr('cx',p=>x(new Date(p.application_date)));edge.attr('x2',d=>x(new Date(d.p.application_date)));}
 const zoom=d3.zoom().extent([[left,0],[right,height]]).scaleExtent([1,50]).translateExtent([[left,0],[right,height]]).on('zoom',e=>draw(e.transform.rescaleX(scale)));svg.call(zoom).on('dblclick.zoom',null);host.querySelector('[data-action=reset]').onclick=()=>svg.call(zoom.transform,d3.zoomIdentity);host.querySelector('[data-action=clear]').onclick=()=>{selected=null;detail.textContent='点击企业或专利查看证据。';highlight();};draw(scale);highlight();
 }catch(e){host.querySelector('.timeline-scroll').textContent='时间线加载失败：'+e.message;console.error(e);}
})();
