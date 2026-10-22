import manifest from './decoration-manifest.js';
export const names=['버건디 선물','초록 큰 선물','크림 선물','초록 작은 선물','다이아 장식','금빛 장식','초록 눈꽃 장식','아이보리 방울','빨간 방울','황동 종','빨간 리본','지팡이 사탕','눈 덮인 집','아이보리 비둘기','빨간 북','전구줄','과자집','진저브레드','버건디 하트','초록 장갑','솔방울','루돌프','목마','산타 모자','눈꽃','눈사람','빨간 양말','테디베어','미니카','황금 별'];
export const catalog=manifest.assets.map((a,i)=>({...a,name:names[i]}));
export const byId=Object.fromEntries(catalog.map(a=>[a.id,a]));
const twoWonIds=new Set(['gift-green-large','fairy-lights','gingerbread-house','reindeer','rocking-horse','santa-hat','snowman']);
const threeWonIds=new Set(['bauble-ivory-smile','cottage-snow','teddy-bear','toy-car','star-gold']);
// Total weight 6300: 18*245=4410 (70%), 7*180=1260 (20%), 5*126=630 (10%).
// Every item within the same sale value has an equal probability.
export const defaultFactoryCatalog=catalog.map(a=>{
 const value=threeWonIds.has(a.id)?3:twoWonIds.has(a.id)?2:1;
 return {id:a.id,value,weight:{1:245,2:180,3:126}[value]};
});
export const kstDate=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
export function productionBlockReason(state){
 if(state.productionReady)return '';
 if(!state.catalog?.length||state.catalog.some(row=>![1,2,3].includes(row.value)))return '장식별 판매 금액과 등장 확률 설정이 아직 완료되지 않았어요. 준비가 끝나면 광고를 보고 장식을 생산할 수 있어요.';
 return '생산 광고 연결이 아직 준비되지 않았어요. 잠시 후 다시 확인해 주세요.';
}
export function parseFactoryCatalog(raw=JSON.stringify(defaultFactoryCatalog)){
 let rows;try{rows=JSON.parse(raw);}catch{throw Error('catalog_not_configured');}
 if(!Array.isArray(rows)||rows.length!==30||new Set(rows.map(r=>r.id)).size!==30||rows.some(r=>!byId[r.id]||![1,2,3].includes(r.value)||!Number.isSafeInteger(r.weight)||r.weight<1)||rows.reduce((n,r)=>n+r.weight,0)>1000000)throw Error('catalog_not_configured');
 return rows;
}
export function drawCatalog(rows,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]){
 const total=rows.reduce((n,r)=>n+r.weight,0),ceiling=Math.floor(2**32/total)*total;
 let n;do{n=random();}while(n>=ceiling);n%=total;
 for(const row of rows){n-=row.weight;if(n<0)return row;}
}
