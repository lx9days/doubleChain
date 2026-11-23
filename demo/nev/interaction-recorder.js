(function(root){
function createRecorder({now=()=>performance.now(),sampleMs=60,maxEvents=500,onChange=()=>{}}={}){
 let events=[],recording=false,start=0,lastMove=-Infinity,chart=null,limited=false,cleanup=()=>{};
 const snapshot=()=>({chart,events:events.map(e=>({...e})),limited,recording});
 function stop(){recording=false;cleanup();cleanup=()=>{};onChange(snapshot());return snapshot();}
 function push(event){if(!recording)return;const t=Math.max(0,now()-start);if(event.type==='pointermove'&&t-lastMove<sampleMs)return;if(event.type==='pointermove')lastMove=t;events.push({...event,t:Math.round(t)});if(events.length>=maxEvents){limited=true;stop();}else onChange(snapshot());}
 function begin(context){stop();events=[];chart=JSON.parse(JSON.stringify(context));limited=false;start=now();lastMove=-Infinity;recording=true;onChange(snapshot());}
 function attach(element,context){begin(context);let last={x:0,y:0},pointer=null;const handlers=[];
 const listen=(target,type,fn)=>{target.addEventListener(type,fn,true);handlers.push(()=>target.removeEventListener(type,fn,true));};
 const handler=e=>{
 const inside=element.contains(e.target);const key=e.type==='keydown'||e.type==='keyup';
 if(key){if(!inside||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||!['Shift','Control','Alt','Meta','Escape','Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;}
 else if(!inside&&!(pointer===e.pointerId&&['pointerup','pointercancel'].includes(e.type)))return;
 if(!key){const r=element.getBoundingClientRect();last={x:Math.round(e.clientX-r.left),y:Math.round(e.clientY-r.top)};}
 const hit=inside?e.target.closest?.('[data-id],[data-region],[data-stage]'):null;
 push({type:e.type,...last,button:e.button??null,buttons:e.buttons??0,pointerId:e.pointerId??null,key:key?e.key:null,ctrl:!!e.ctrlKey,shift:!!e.shiftKey,alt:!!e.altKey,meta:!!e.metaKey,...(e.type==='wheel'?{deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode}:{}),target:hit?{kind:hit.dataset.kind||hit.tagName,id:hit.dataset.id||hit.dataset.region||hit.dataset.stage}:null});
 if(e.type==='pointerdown')pointer=e.pointerId;if(['pointerup','pointercancel'].includes(e.type))pointer=null;
 };
 for(const type of ['pointermove','pointerdown','click','wheel','keydown','keyup'])listen(element,type,handler);
 for(const type of ['pointerup','pointercancel'])listen(element.ownerDocument,type,handler);
 cleanup=()=>handlers.forEach(fn=>fn());
 }
 return {begin,attach,push,stop,snapshot,clear(){stop();events=[];chart=null;limited=false;onChange(snapshot());},destroy:stop};
}
function createPayloadFromRecorder(recorder){const s=recorder.snapshot();return {task:'Infer the intended interaction demonstrated on a static visualization.',chart:s.chart,events:s.events,limited:s.limited};}
const api={createRecorder,createPayloadFromRecorder};if(typeof module!=='undefined')module.exports=api;else root.NEVRecorder=api;
})(globalThis);
