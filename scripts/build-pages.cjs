const fs=require('node:fs'),path=require('node:path');
const out=path.resolve('_site');fs.mkdirSync(out,{recursive:true});
const target=path.join(out,'nev');fs.mkdirSync(target,{recursive:true});
for(const name of ['index.html','style.css','model.js','d3.min.js','industry.js','app.js','china-provinces.json','interaction-recorder.js','interaction-ui.js']){
 let content=fs.readFileSync(path.join('demo/nev',name),'utf8');
 if(name==='index.html')content=content.replaceAll('/nev/','./').replace('<a href="/">原始数据画布 ↗</a>','<span>静态演示版</span>');
 if(name==='app.js')content=content.replaceAll("fetch('/nev/","fetch('./");
 fs.writeFileSync(path.join(target,name),content);
}
fs.copyFileSync('data-derived/nev/demo-listed-300-v1/demo-data.json',path.join(target,'data.json'));
fs.appendFileSync(path.join(target,'app.js'),`
// GitHub Pages has no Node API backend.
assistantPanel.innerHTML='<h2>静态演示版</h2><p>三个视图及本地筛选可用。AI 搜索、报告和交互意图分析需运行本地 Node 服务。</p>';
`);
// Omit the server-dependent interaction recording UI in this static build.
let html=fs.readFileSync(path.join(target,'index.html'),'utf8').replace('<script src="./interaction-ui.js"></script>','');
fs.writeFileSync(path.join(target,'index.html'),html);
fs.writeFileSync(path.join(out,'index.html'),'<meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./nev/"><a href="./nev/">打开双链观测台</a>');
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('Built GitHub Pages static demo');
