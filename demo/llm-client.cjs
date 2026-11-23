function normalizeMessageContent(content){
 const text=typeof content==='string'?content:Array.isArray(content)?content.filter(x=>x?.type==='text'&&typeof x.text==='string').map(x=>x.text).join('\n'):'';
 if(!text.trim())throw Error('模型返回空内容');return text;
}
async function requestCompletion(messages,{temperature=0.2,fetchImpl=fetch,apiKey,baseUrl,model:requestedModel}={}){
 const key=apiKey||process.env.NEV_LLM_API_KEY,base=baseUrl||process.env.NEV_LLM_BASE_URL,model=requestedModel||process.env.NEV_LLM_MODEL;
 if(!key||!base||!model)throw Error('请配置 NEV_LLM_API_KEY、NEV_LLM_BASE_URL、NEV_LLM_MODEL 后重启');
 const configured=Number(process.env.NEV_LLM_TEMPERATURE??temperature);
 if(!Number.isFinite(configured)||configured<0||configured>2)throw Error('temperature 必须在 0–2 之间');
 try{
 const response=await fetchImpl(base.replace(/\/+$/,'').replace(/\/chat\/completions$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model,temperature:configured,messages}),signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error(`模型服务 HTTP ${response.status}`);
 let body;try{body=await response.json();}catch{throw Error('模型返回非 JSON 响应');}
 return normalizeMessageContent(body.choices?.[0]?.message?.content);
 }catch(e){if(e.name==='TimeoutError'||e.name==='AbortError')throw Error('模型请求超时');if(e instanceof TypeError)throw Error('模型网络请求失败');throw e;}
}
module.exports={requestCompletion,normalizeMessageContent};
