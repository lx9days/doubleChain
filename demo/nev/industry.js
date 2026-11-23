function drawIndustry(data,base,selected,onStage){
 const svg=d3.select('#industry-overview');svg.selectAll('*').remove();
 const rows=NEV.stages.map(([id,name])=>{const ids=new Set(data.patent_stage.filter(e=>e.stage_id===id).map(e=>e.patent_id));const ps=base.patents.filter(p=>ids.has(p.patent_id));return {id,name,patents:new Set(ps.map(p=>p.application_number||p.patent_id)).size,companies:new Set(ps.flatMap(p=>p.company_ids)).size};});
 const series=[{key:'companies',name:'企业（家）',color:'#218f86'},{key:'patents',name:'专利（件）',color:'#7899b5'}];
 const x=d3.scaleBand().domain(rows.map(r=>r.id)).range([65,1035]).padding(.25),sub=d3.scaleBand().domain(series.map(s=>s.key)).range([0,x.bandwidth()]).padding(.08),y=d3.scaleLinear().domain([0,Math.max(1,d3.max(rows,r=>Math.max(r.patents,r.companies)))*1.12]).nice().range([330,35]);
 svg.append('g').attr('transform','translate(65,0)').call(d3.axisLeft(y).ticks(5).tickSize(-970).tickFormat(d3.format('d'))).call(g=>g.select('.domain').remove()).call(g=>g.selectAll('line').attr('stroke','#e0e9ed')).call(g=>g.selectAll('text').attr('fill','#718692'));
 svg.append('g').attr('transform','translate(0,330)').call(d3.axisBottom(x).tickFormat(id=>rows.find(r=>r.id===id).name).tickSize(0)).call(g=>g.selectAll('text').attr('dy','1.8em').attr('fill','#526e7b'));
 svg.append('text').attr('x',24).attr('y',25).attr('fill','#718692').text('数量');
 const bars=rows.flatMap(row=>series.map(s=>({row,s,value:row[s.key]})));
 const click=(e,d)=>onStage(d.row.id,e.ctrlKey);
 svg.append('g').selectAll('rect').data(bars).join('rect').attr('class','industry-bar').attr('role','button').attr('tabindex',0).attr('aria-label',d=>`${d.row.name} ${d.s.name} ${d.value}`).attr('aria-pressed',d=>selected.split('|').includes(d.row.id)).attr('x',d=>x(d.row.id)+sub(d.s.key)).attr('y',d=>y(d.value)).attr('width',sub.bandwidth()).attr('height',d=>330-y(d.value)).attr('fill',d=>d.s.color).attr('opacity',d=>!selected||selected.split('|').includes(d.row.id)?1:.3).style('cursor','pointer').on('click',click).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();click(e,d);}}).append('title').text(d=>`${d.row.name}：${d.s.name} ${d.value}，点击筛选`);
 svg.append('g').selectAll('text').data(bars).join('text').attr('x',d=>x(d.row.id)+sub(d.s.key)+sub.bandwidth()/2).attr('y',d=>y(d.value)-7).attr('text-anchor','middle').attr('fill','#526e7b').attr('font-size',12).text(d=>d.value);
 series.forEach((s,i)=>{svg.append('rect').attr('x',1060).attr('y',40+i*28).attr('width',13).attr('height',13).attr('fill',s.color);svg.append('text').attr('x',1080).attr('y',51+i*28).attr('font-size',12).attr('fill','#526e7b').text(s.name);});
 document.getElementById('overview-reset').onclick=()=>onStage('');
}
