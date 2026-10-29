// v252: qgen-reconcile.js — admin list ke barabar karna (fake window + fake backend)
const fs=require('fs'),path=require('path'),assert=require('assert');
const code=fs.readFileSync(path.join(__dirname,'..','..','qgen-reconcile.js'),'utf8');
let pass=0;const T=async(n,f)=>{try{await f();pass++;console.log('  PASS '+n)}catch(e){console.log('  FAIL '+n+'\n  '+(e.stack||e));process.exitCode=1}};
function mk({adminIds,genIds,backendIds,allowed}){
  const dropped=[],toasts=[];let built=0;
  const W={document:{getElementById:()=>null},toast:m=>toasts.push(m),buildBankList:()=>{built++}};
  W.parent={getClassScopedQuestionBank:()=>adminIds.map(id=>({id,classId:'class_10'})),_bankDropLocal:ids=>dropped.push(...ids)};
  W.QUESTION_BANK=genIds.map(id=>[0,0,0,0,id,0,0,0,0,0,'class_10']);
  W.__qgMapDocs=docs=>docs.map(d=>[0,0,0,0,d.id,0,0,0,0,0,(d.data().classId||'')]).filter(r=>!allowed||!r[10]||allowed.includes(r[10]));
  W.vishnuFirebase={db:{collection:()=>({doc:id=>({get:()=>Promise.resolve(backendIds.has(id)?{exists:true,id,data:()=>({classId:id.startsWith('c9')?'class_9':'class_10'})}:{exists:false})})})}};
  new Function('window','globalThis',code)(W,W);
  return {W,dropped,toasts,built:()=>built};
}
(async()=>{
 await T('admin me 3 zyada: backend me hain -> generator me jud jate hain',async()=>{
  const t=mk({adminIds:['a','b','c','d','e'],genIds:['a','b'],backendIds:new Set(['a','b','c','d','e'])});
  await t.W.__qgReconcileNow(); assert.strictEqual(t.W.QUESTION_BANK.length,5); assert.strictEqual(t.dropped.length,0); assert.ok(t.built()>=1);});
 await T('admin me ghost (backend me nahi) -> admin list se hatate hain',async()=>{
  const t=mk({adminIds:['a','b','x1','x2'],genIds:['a','b'],backendIds:new Set(['a','b'])});
  await t.W.__qgReconcileNow(); assert.deepStrictEqual(t.dropped.sort(),['x1','x2']); assert.strictEqual(t.W.QUESTION_BANK.length,2);});
 await T('milte-julte: kuch jude, kuch ghost',async()=>{
  const t=mk({adminIds:['a','n1','n2','g1'],genIds:['a'],backendIds:new Set(['a','n1','n2'])});
  await t.W.__qgReconcileNow(); assert.strictEqual(t.W.QUESTION_BANK.length,3); assert.deepStrictEqual(t.dropped,['g1']); assert.ok(t.toasts.length===1);});
 await T('barabar ho to kuch nahi karta (koi backend call nahi)',async()=>{
  const t=mk({adminIds:['a','b'],genIds:['a','b'],backendIds:new Set()});
  await t.W.__qgReconcileNow(); assert.strictEqual(t.toasts.length,0); assert.strictEqual(t.dropped.length,0);});
 await T('allowed class ke bahar wale add nahi hote, toast batata hai',async()=>{
  const t=mk({adminIds:['a','c9-1'],genIds:['a'],backendIds:new Set(['a','c9-1']),allowed:['class_10']});
  await t.W.__qgReconcileNow(); assert.strictEqual(t.W.QUESTION_BANK.length,1); assert.ok(/allowed classes/.test(t.toasts[0]));});
 await T('parent na ho (alag page) to chup-chap skip',async()=>{
  const t=mk({adminIds:['a'],genIds:[],backendIds:new Set(['a'])}); t.W.parent=t.W; await t.W.__qgReconcileNow(); assert.strictEqual(t.W.QUESTION_BANK.length,0);});
 console.log(pass+' passed');
})();
