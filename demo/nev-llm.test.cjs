const assert=require('node:assert/strict'),{Readable}=require('node:stream');
const {handle}=require('./nev-llm.cjs');
async function call(body){let status,value;const req=Readable.from([JSON.stringify(body)]);req.method='POST';req.headers={};await handle(req,{writeHead(s){status=s},end(s){value=JSON.parse(s)}});return {status,value};}
(async()=>{
 delete process.env.NEV_LLM_API_KEY;
 assert.equal((await call({action:'search',query:'电池',ids:['44']})).status,503);
 process.env.NEV_LLM_API_KEY='test';process.env.NEV_LLM_BASE_URL='https://example.invalid/v1';process.env.NEV_LLM_MODEL='test';
 global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({matches:[{id:'44',reason:'电池'},{id:'invented'},{id:'44'}],summary:'测试'})}}]})});
 const r=await call({action:'search',query:'电池',ids:['44']});assert.deepEqual(r.value.matches,[{id:'44',reason:'电池'}]);
 assert.equal((await call({action:'search',query:'电池',ids:[]})).status,400);
 console.log('API configuration, ID validation, deduplication and empty scope checks passed (mock provider)');
})();
