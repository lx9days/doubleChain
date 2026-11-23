const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const localConfig=path.join(__dirname,'.env.local.json');
if(fs.existsSync(localConfig)){for(const [key,value] of Object.entries(JSON.parse(fs.readFileSync(localConfig,'utf8')))){if(key.startsWith('NEV_LLM_')&&!process.env[key])process.env[key]=String(value);}}

const {
  buildPatentSequenceIndexFromFile,
  loadPatentSequenceIndex,
  queryInvestCanvas,
  queryPatentSequence,
  writePatentSequenceIndex
} = require('./patent-sequence-service.cjs');

const files = {
  '/nev/interaction-recorder.js': 'nev/interaction-recorder.js',
  '/nev/interaction-ui.js': 'nev/interaction-ui.js',
  '/nev/analysis.js': 'nev/analysis.js',
  '/nev/explorer.js': 'nev/explorer.js',
  '/nev/d3.min.js': 'nev/d3.min.js',
  '/nev/industry.js': 'nev/industry.js',
  '/nev/': 'nev/index.html',
  '/nev/app.js': 'nev/app.js',
  '/nev/model.js': 'nev/model.js',
  '/nev/style.css': 'nev/style.css',
  '/nev/china-provinces.json': 'nev/china-provinces.json',
  '/nev/data.json': '../data-derived/nev/demo-listed-300-v1/demo-data.json',
  '/': 'index.html',
  '/index.html': 'index.html',
  '/sequence-v003.html': 'sequence-v003.html',
  '/relation.html': 'relation.html',
  '/app.js': 'app.js',
  '/invest-canvas-app.js': 'invest-canvas-app.js',
  '/invest-canvas-camera.js': 'invest-canvas-camera.js',
  '/invest-canvas-layout.js': 'invest-canvas-layout.js',
  '/sequence-app.js': 'sequence-app.js',
  '/overview.js': 'overview.js',
  '/graph-model.js': 'graph-model.js',
  '/graph-layout.js': 'graph-layout.js',
  '/patent-sequence-layout.js': 'patent-sequence-layout.js',
  '/data.js': 'data.js'
};

const compactIndexPath = path.join(__dirname, 'patent-sequence-index.json');
const rawIndexPath = path.resolve(__dirname, '..', 'invest-on-invent-kg.json', 'invest-on-invent-KG.json');
let patentSequenceIndex = null;

function ensurePatentSequenceIndex(){
  if(patentSequenceIndex){
    return patentSequenceIndex;
  }

  if(fs.existsSync(compactIndexPath)){
    patentSequenceIndex = loadPatentSequenceIndex(compactIndexPath);
    return patentSequenceIndex;
  }

  const built = buildPatentSequenceIndexFromFile(rawIndexPath);
  writePatentSequenceIndex(compactIndexPath, built);
  patentSequenceIndex = loadPatentSequenceIndex(compactIndexPath);
  return patentSequenceIndex;
}

function sendJson(res, statusCode, payload){
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if(url.pathname === '/api/nev-interaction')return require('./interaction-guesser.cjs').handle(req,res);
  if(url.pathname === '/api/nev-assistant')return require('./nev-llm.cjs').handle(req,res);
  if(url.pathname === '/api/patent-sequence'){
    try{
      const index = ensurePatentSequenceIndex();
      const result = queryPatentSequence(index, {
        keyword: url.searchParams.get('keyword') || '',
        page: url.searchParams.get('page') || '1',
        pageSize: url.searchParams.get('pageSize') || '20'
      });
      return sendJson(res, 200, result);
    } catch (error){
      return sendJson(res, 500, {
        error: 'patent-sequence-query-failed',
        message: error.message
      });
    }
  }

    if(url.pathname === '/api/invest-canvas'){
      try{
        const index = ensurePatentSequenceIndex();
        const result = queryInvestCanvas(index, {
          keyword: url.searchParams.get('keyword') || '',
          idStart: url.searchParams.get('idStart') || '',
          idEnd: url.searchParams.get('idEnd') || ''
        });
        return sendJson(res, 200, result);
      } catch (error){
        return sendJson(res, error.statusCode || 500, {
          error: error.code || 'invest-canvas-query-failed',
          message: error.message,
          details: error.details || null
        });
      }
    }

  const file = files[url.pathname];
  if(!file){
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(file);
  const contentType = ext === '.html'
    ? 'text/html; charset=utf-8'
    : ext === '.css' ? 'text/css; charset=utf-8' : ext === '.json' ? 'application/json; charset=utf-8' : 'text/javascript; charset=utf-8';
  res.setHeader('Content-Type', contentType);
  fs.createReadStream(path.join(__dirname, file)).pipe(res);
}).listen(Number(process.env.PORT || 8766), '127.0.0.1', () => {
  console.log(`Demo ready: http://127.0.0.1:${process.env.PORT || 8766}/nev/`);
});
