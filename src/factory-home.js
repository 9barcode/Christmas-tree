import {startFactoryScene} from './factory-scene.js';
import {createPhotoPreparation} from './photo-preparation.js';
import {factoryCall,factoryAd,recoverFactoryAd} from './factory-client.js';
import {catalog,byId,kstDate,productionBlockReason,defaultFactoryCatalog,drawCatalog} from './factory-model.js';
import {defaultPosition,clampPosition,OBJECT_SIZES,floorDepth,sanitizePositions} from './placement.js';
import {planterClipPath,clipPlanter} from './planter.js';
import {pageEffects} from './page-effects.js';
import {startCozyFire} from '../assets/backgrounds/cozy-fire.js';
import {startCozySnow} from '../assets/backgrounds/cozy-room.js';
import {preparePhoto,savePhoto,sharePhoto} from './photo-save.js';
const $=s=>document.querySelector(s),preview=new URLSearchParams(location.search).get('preview')==='1';
let snapshot,active='tree',busy=false,filter=0,selling=false,toastTimer,animationTimer,stopFactoryScene=()=>{};
let previewState={version:3,date:kstDate(),used:0,overtime:false,limit:10,items:[],collection:[],balance:0,revision:0,pot:defaultPosition('pot'),collectionReward:false,productionReady:true,exchangeReady:true,payments:[],catalog:defaultFactoryCatalog.map(({id,value})=>({id,value}))};
function rollover(){if(previewState.date!==kstDate())Object.assign(previewState,{date:kstDate(),used:0,overtime:false,limit:10});}
async function load(){if(preview){rollover();snapshot=structuredClone(previewState);}else snapshot=await factoryCall('state');}
function toast(text){$('.toast').textContent=text;$('.toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('.toast').hidden=true,4500);}
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function button(text,fn,cls='factory-button'){const b=node('button',cls,text);b.type='button';b.disabled=busy;b.onclick=fn;return b;}
function adButton(text,fn,cls='factory-button ad-action'){const b=button('',fn,cls),icon=node('span','ad-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 4V6l-5 4H3zm12-1a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/></svg><span>광고</span>';b.append(icon,document.createTextNode(text));return b;}
function modal(title,content){if($('dialog').open)$('dialog').close();const h=node('h2','',title);h.id='modal-title';$('.modal-content').replaceChildren(h,content);$('dialog').setAttribute('aria-labelledby','modal-title');$('dialog').showModal();}
function setBusy(value){busy=value;$('.home').setAttribute('aria-busy',String(value));$('.factory-shell').setAttribute('aria-busy',String(value));document.querySelectorAll('.factory-shell button,.page-tabs button,.home button,.tree-utilities button,dialog .factory-button').forEach(b=>b.disabled=value);}
async function run(action){if(busy)return;setBusy(true);try{await action();}catch(e){toast(e.message||'연결을 확인해 주세요.');try{await load();await render();}catch{/* Preserve confirmed snapshot. */}}finally{setBusy(false);renderPage();}}
function setPage(page){if(busy)return;active=page;filter=0;selling=false;$('.home').hidden=page!=='tree';utilities.hidden=page!=='tree';$('.factory-shell').hidden=page==='tree';document.querySelectorAll('.page-tabs button').forEach(b=>{b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});document.body.dataset.page=page;clearTimeout(animationTimer);renderPage();}
const shell=node('section','factory-shell');shell.hidden=true;shell.setAttribute('aria-label','장식 공장과 보관함');document.body.append(shell);
const tabs=node('nav','page-tabs');tabs.setAttribute('aria-label','주 메뉴');
for(const [page,label,icon] of [['tree','트리 꾸미기','tree'],['factory','장식 공장','factory'],['inventory','보관함','box'],['collection','도감','book']]){const b=button('',()=>setPage(page),'page-tab');b.dataset.page=page;b.innerHTML=`<svg viewBox="0 0 32 32" aria-hidden="true"><use href="assets/ui/factory-icons.svg#${icon}"/></svg><span></span>`;b.querySelector('span').textContent=label;tabs.append(b);}document.body.append(tabs);
const share=button('사진 저장 · 공유',showShare,'photo-link');$('.home-links').append(share);
const camera=node('img');camera.src='assets/ui/painted/camera.webp';camera.alt='';share.prepend(camera);
const utilities=$('.home-links');utilities.classList.add('tree-utilities');document.body.append(utilities);
new ResizeObserver(()=>document.documentElement.style.setProperty('--page-tabs-height',tabs.getBoundingClientRect().height+'px')).observe(tabs);
$('.slots').hidden=true;$('.slots').replaceChildren();$('.home footer').hidden=true;
$('.guide-link').onclick=()=>{const c=node('div');c.append(node('p','','광고를 보고 공장에서 장식을 만들어요. 보관함에서 배치하거나 판매할 수 있어요.'),node('p','','하루 기본 10회, 야근 광고를 보면 하루 한 번 10회를 더 생산해요. 생산할 때마다 광고를 시청해요.'),node('p','','최초 획득한 장식은 판매해도 도감에 남아요. 서로 다른 30종을 모으면 최초 1회 30원을 적립해요.'));modal('이용안내',c);};
$('.rewards-link').onclick=()=>setPage('inventory');$('.close').onclick=()=>$('dialog').close();$('dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
const bounds=new Map();
async function assetNode(path,className){
 let g=bounds.get(path);if(!g){const img=new Image();img.src=path;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>16){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}g={box:`${x0} ${y0} ${x1-x0+1} ${y1-y0+1}`,w:c.width,h:c.height};bounds.set(path,g);}
 const n=node('div',className);n.innerHTML=`<svg viewBox="${g.box}" preserveAspectRatio="none" aria-hidden="true"><image href="${path}" width="${g.w}" height="${g.h}"/></svg>`;return n;
}
async function renderTree(){
 const tree=await assetNode('assets/trees/tree-green.png','tree'),pot=await assetNode('assets/planters/planter-wood.png','pot'),back=await assetNode('assets/planters/planter-wood.png','pot-back');pot.style.clipPath=planterClipPath(true);back.style.clipPath=planterClipPath(false);
 snapshot.pot=sanitizePositions({__pot:snapshot.pot},[],0).__pot||defaultPosition('pot');
 bindDrag(pot,'pot',null,snapshot.pot,back);
 const ornaments=[],floor=[];let oi=0,fi=0;
 for(const i of snapshot.items.filter(i=>i.placed)){
 const a=byId[i.asset_id];if(!a)continue;const n=await assetNode(a.path,a.kind==='floor'?'floor-item':'ornament '+(a.kind==='topper'?'topper':a.kind==='lights'?'lights':''));
 const p=Number.isFinite(i.x)?{x:i.x,y:i.y}:defaultPosition(a.kind,a.kind==='floor'?fi++:oi++);
 if(['lights','topper'].includes(a.kind)){const d=defaultPosition(a.kind);Object.assign(n.style,{width:OBJECT_SIZES[a.kind].w+'%',height:OBJECT_SIZES[a.kind].h+'%',left:d.x+'%',top:d.y+'%',transform:'translate(-50%,-50%)'});}else bindDrag(n,a.kind,i.id,p);
 (a.kind==='floor'?floor:ornaments).push(n);
 }
 $('.pot-back')?.remove();$('.garden').prepend(back);$('.tree').replaceWith(tree);$('.pot').replaceWith(pot);$('.ornaments').replaceChildren(...ornaments);$('.floor').replaceChildren(...floor);
 $('.progress').textContent=`나만의 트리 · 장식 ${snapshot.items.filter(i=>i.placed).length}개`;
}
function bindDrag(n,kind,id,initial,back){let p=initial,drag;
 n.classList.add('draggable');n.tabIndex=0;n.setAttribute('role','button');n.setAttribute('aria-label',id?`${byId[snapshot.items.find(i=>i.id===id)?.asset_id]?.name||'장식'} 위치 옮기기`:'화분 위치 옮기기');
 function paint(){for(const target of [n,back].filter(Boolean)){Object.assign(target.style,{width:OBJECT_SIZES[kind].w+'%',height:OBJECT_SIZES[kind].h+'%',left:p.x+'%',top:p.y+'%',transform:'translate(-50%,-50%)'});const z=target===back?0:floorDepth(kind,p.y);if(z!==null)target.style.zIndex=z;}}paint();
 n.onpointerdown=e=>{if(busy||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();drag={pointer:e.pointerId,x:e.clientX,y:e.clientY,p:{...p},rect:$('.garden').getBoundingClientRect()};n.setPointerCapture(e.pointerId);n.classList.add('is-dragging');tabs.inert=true;};
 n.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;p=clampPosition(kind,drag.p.x+(e.clientX-drag.x)/drag.rect.width*100,drag.p.y+(e.clientY-drag.y)/drag.rect.height*100);paint();};
 function finish(e,cancel){if(!drag||drag.pointer!==e.pointerId)return;const start=drag.p;drag=null;n.classList.remove('is-dragging');tabs.inert=false;if(n.hasPointerCapture(e.pointerId))n.releasePointerCapture(e.pointerId);if(cancel){p=start;paint();return;}run(async()=>{if(id)Object.assign(snapshot.items.find(i=>i.id===id),p);else snapshot.pot=p;await saveLayout();await renderTree();});}
 n.onpointerup=e=>finish(e,false);n.onpointercancel=e=>finish(e,true);n.onlostpointercapture=e=>finish(e,true);
 n.onkeydown=e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta||busy)return;e.preventDefault();p=clampPosition(kind,p.x+delta[0],p.y+delta[1]);paint();run(async()=>{if(id)Object.assign(snapshot.items.find(i=>i.id===id),p);else snapshot.pot=p;await saveLayout();});};
}
async function saveLayout(){const body={revision:snapshot.revision,pot:snapshot.pot?.x?snapshot.pot:defaultPosition('pot'),items:snapshot.items.filter(i=>i.placed).map(i=>({id:i.id,x:i.x,y:i.y}))};if(preview){previewState.items=structuredClone(snapshot.items);previewState.pot=body.pot;previewState.revision++;await load();}else snapshot=await factoryCall('layout',body);}
function art(a,locked=false){const img=node('img',locked?'locked-art':'');img.src='assets/thumbnails/'+a.id+'.webp';img.alt=locked?'미획득 장식':a.name;img.loading='lazy';return img;}
function renderPage(){
 stopFactoryScene();stopFactoryScene=()=>{};shell.classList.toggle('concept-factory',active==='factory');
 if(!snapshot)return;tabs.querySelectorAll('button').forEach(b=>b.disabled=busy);
 if(active==='tree')return;
 const titles={factory:'장식 공장',inventory:'보관함',collection:'장식 도감'};
 const header=node('header','factory-header');header.append(button('‹',()=>setPage('tree'),'back-button'),node('h1','',titles[active]),button('?',()=>$('.guide-link').click(),'help-button'));shell.replaceChildren(header);
 if(active==='factory'){renderFactory();return;}
 const content=node('div','factory-content');shell.append(content);
 if(active==='collection'){
 const summary=node('section','collection-summary');summary.append(node('p','','수집 현황'),node('strong','',`${snapshot.collection.length} / 30`));const progress=node('progress');progress.max=30;progress.value=snapshot.collection.length;progress.setAttribute('aria-label','도감 수집 현황');summary.append(progress,node('p','','서로 다른 장식 30종 모으면 30원!'));
 if(snapshot.collection.length===30){const claim=button(snapshot.collectionReward?'완성 보상 받기 완료':'30원 완성 보상 받기',()=>run(async()=>{if(preview){if(!previewState.collectionReward){previewState.collectionReward=true;previewState.balance+=30;}await load();}else snapshot=await factoryCall('claim',{});renderPage();}));claim.disabled=busy||snapshot.collectionReward;summary.append(claim);}content.append(summary);
 }else{
 const modes=node('div','inventory-modes');for(const [mode,label] of [[false,'보유 장식'],[true,'판매하기']]){const b=button(label,()=>{selling=mode;renderPage();},selling===mode?'selected':'');modes.append(b);}content.append(modes);
 const wallet=node('section','wallet');wallet.append(node('strong','',`교환 가능 ${snapshot.balance}원`));const pending=snapshot.payments.some(p=>!['failed','succeeded'].includes(p.state));const exchangeButton=adButton(pending?'교환 결과 확인':'토스포인트 교환',()=>run(async()=>{if(preview){toast('디자인 미리보기 · 실제 포인트 지급 없음');return;}let adRequestId;if(!pending){const ad=await factoryAd('exchange');adRequestId=ad.requestId;}snapshot=await factoryCall(pending?'recover':'exchange',pending?{requestId:crypto.randomUUID()}:{requestId:crypto.randomUUID(),adRequestId});renderPage();const last=snapshot.payments[0];toast(last?.state==='succeeded'?(last.mode==='test'?'테스트 교환 확인 · 실제 지급 없음':'포인트 교환 완료'):last?.state==='failed'?'교환 실패 · 잔액을 돌려드렸어요.':'교환 결과를 확인 중이에요.');}), 'factory-button ad-action exchange-action');exchangeButton.disabled=busy||(!pending&&(!snapshot.exchangeReady||snapshot.balance<1));wallet.append(exchangeButton);content.append(wallet);
 if(snapshot.payments.length){const history=node('details','payment-history');history.append(node('summary','','최근 교환 내역'));const status={creating:'접수 중',ready:'지급 준비',submitted:'지급 확인 중',pending:'확인 중',succeeded:'완료',failed:'실패 · 잔액 복원'};for(const p of snapshot.payments)history.append(node('p','',`${p.amount}원 · ${p.mode==='test'?'테스트 · ':''}${status[p.state]||p.state}`));content.append(history);}
 }
 const filters=node('div','value-filters');for(const value of [0,1,2,3]){const b=button(value?value+'원':'전체',()=>{filter=value;renderPage();},filter===value?'selected':'');b.setAttribute('aria-pressed',String(filter===value));filters.append(b);}content.append(filters);
 const grid=node('div',active==='collection'?'ornament-grid collection-grid':'ornament-grid inventory-grid');
 for(const a of catalog){const value=snapshot.catalog.find(r=>r.id===a.id)?.value;const owned=snapshot.items.filter(i=>i.asset_id===a.id),unlocked=snapshot.collection.includes(a.id);if(filter&&value!==filter)continue;if(active==='inventory'&&!owned.length)continue;
 const card=button('',()=>{if(active==='inventory')showItem(a,owned);else{const c=node('div');c.append(art(a,!unlocked),node('p','',unlocked?'도감에 영구 등록된 장식이에요.':'공장에서 이 장식을 만나 보세요.'));modal(unlocked?a.name:'아직 만나지 못한 장식',c);}},'ornament-card'+(!unlocked&&active==='collection'?' undiscovered':''));card.append(art(a,!unlocked&&active==='collection'));
 if(active==='inventory'){card.append(node('span','value-tag',owned.every(i=>i.value===0)?'기존 장식':(value??owned.find(i=>i.value>0)?.value)+'원'),node('span','quantity','×'+owned.length),node('span','item-name',a.name));}else card.append(node('span','item-name',unlocked?a.name:'?'));grid.append(card);
 }
 content.append(grid);if(!grid.childElementCount)content.append(node('p','empty-state','아직 보관 중인 장식이 없어요. 공장에서 첫 장식을 만들어 보세요!'));
 if(active==='inventory')content.append(node('p','fine-print','판매한 장식도 도감에 남아요. 배치한 장식을 판매하면 트리에서도 회수돼요.'));
}
function renderFactory(){
 const stopped=snapshot.used>=snapshot.limit,scene=node('div','workshop'+(stopped?' stopped':''));
 scene.setAttribute('aria-label','시안 원본의 산타 장식 공장');
 const painting=node('img','factory-concept-art');painting.src='assets/factory/concept-original.png';painting.alt='';painting.draggable=false;
 const canvas=node('canvas','factory-scene-motion');canvas.setAttribute('aria-hidden','true');
 scene.append(painting,canvas,node('div','workshop-light'));shell.append(scene);
 stopFactoryScene=startFactoryScene(canvas,painting,()=>scene.classList.contains('stopped'),()=>scene.classList.contains('producing'));
 const counter=node('section','production-counter');counter.setAttribute('aria-label','오늘의 생산량');counter.append(node('span','production-counter-label','오늘의 생산량'),node('strong','',`${snapshot.used} / ${snapshot.limit}`));
 const progress=node('progress','factory-production-progress');progress.max=snapshot.limit;progress.value=snapshot.used;progress.setAttribute('aria-label','오늘 생산 진행률');counter.append(progress);scene.append(counter);
 const panel=node('section','production-panel');panel.append(node('p','','광고를 보고 랜덤 장식 1개를 생산해요.'));
 const unavailable=!preview&&!!productionBlockReason(snapshot);panel.classList.toggle('is-unavailable',unavailable);
 const produce=button(stopped?'오늘 생산을 모두 마쳤어요':unavailable?'생산 준비 상태 확인':'광고 보고 장식 생산하기',()=>produceItem());produce.disabled=busy||stopped;panel.append(produce,node('p','',unavailable?'생산 설정이 아직 완료되지 않았어요.':`오늘 남은 생산 ${Math.max(0,snapshot.limit-snapshot.used)}회`));shell.append(panel);
 const overtime=node('section','overtime-panel');overtime.append(node('h2','','오늘은 여기까지!'),node('p','',snapshot.overtime?'산타가 야근 중! 오늘도 힘내고 있어요.':'그래도… 산타가 아직 할 일이 남았대요!'));
 overtime.classList.toggle('is-overtime',snapshot.overtime);panel.classList.toggle('is-stopped',stopped);
 const b=button(snapshot.overtime?'오늘 야근수당 지급 완료':'야근수당 주고 공장 재가동!',requestOvertime,'factory-button overtime-button');
 b.disabled=busy;
 overtime.append(b,node('small','',snapshot.overtime?(stopped?'오늘 생산 완료 · 내일 다시 만나요!':'추가 생산 10회 · 오늘 야근 중이에요'):(snapshot.used<10?'기본 생산 10회 완료 후 · 광고로 하루 1번 해제':'광고 시청 후 추가 생산 10회 · 하루 1번 가능해요.')));shell.append(overtime);
 if(preview){const notice=node('p','preview-notice','디자인 미리보기 · 가격·확률은 예시 · 실제 광고/지급 없음');shell.append(notice);}
}
async function requestOvertime(){
 if(busy)return;
 const reasons=[];
 if(snapshot.overtime)reasons.push('오늘 야근수당은 이미 지급했어요. 야근은 하루 한 번만 가능하며, 한국시간 자정에 다시 이용할 수 있어요.');
 else{
  if(snapshot.used<10)reasons.push(`기본 생산 10회를 모두 마치면 야근할 수 있어요. 지금은 ${snapshot.used}회 생산했고, ${10-snapshot.used}회 남았어요.`);
  const setupReason=!preview&&productionBlockReason(snapshot);if(setupReason)reasons.push(setupReason);
 }
 if(reasons.length){const content=node('div');reasons.forEach(reason=>content.append(node('p','',reason)));content.append(button('확인',()=>$('dialog').close()));modal('야근수당 안내',content);return;}
 await run(async()=>{if(preview){previewState.overtime=true;previewState.limit=20;await load();}else{await factoryAd('overtime');await load();}renderPage();toast('공장 재가동! 추가 생산 10회 시작!');});
}
async function produceItem(){
 const reason=!preview&&productionBlockReason(snapshot);
 if(reason){const content=node('div');content.append(node('p','',reason),button('확인',()=>$('dialog').close()));modal('공장 생산 준비 중',content);return;}
 await run(async()=>{
 let result;if(preview){rollover();if(previewState.used>=previewState.limit)return;const entry=drawCatalog(defaultFactoryCatalog),a=byId[entry.id],id=crypto.randomUUID();previewState.used++;previewState.items.push({id,asset_id:a.id,value:entry.value,placed:0,x:null,y:null});if(!previewState.collection.includes(a.id))previewState.collection.push(a.id);result={itemId:id};}else result=await factoryAd('produce');
 await load();renderPage();const scene=$('.workshop');scene?.classList.remove('stopped');scene?.classList.add('producing');const produced=snapshot.items.find(i=>i.id===result.itemId);if(produced&&scene){const reveal=art(byId[produced.asset_id]);reveal.className='revealed-ornament';scene.append(reveal);}const skip=button('연출 건너뛰기',()=>{},'skip-production');skip.disabled=false;shell.append(skip);
 await new Promise(resolve=>{let ended=false;function done(){if(ended)return;ended=true;clearTimeout(animationTimer);skip.remove();scene?.classList.remove('producing');resolve();}function finish(){done();}skip.onclick=finish;animationTimer=setTimeout(done,matchMedia('(prefers-reduced-motion: reduce)').matches?0:2200);});
 const item=snapshot.items.find(i=>i.id===result.itemId);if(item)showItem(byId[item.asset_id],[item],true);
 });}
function showItem(a,owned,fresh=false,chosenId=null){
 const c=node('div','item-detail');c.append(art(a),node('p','',fresh?'새 장식이 도착했어요! 도감에 등록했어요.':`보유 ${owned.length}개 · 트리 배치 ${owned.filter(i=>i.placed).length}개`));
 const item=owned.find(i=>i.id===chosenId)||(selling?owned.find(i=>i.value>0):null)||owned.find(i=>!i.placed)||owned[0];if(owned.length>1){const select=node('select','instance-picker');select.setAttribute('aria-label','사용할 장식 선택');owned.forEach((i,index)=>{const o=node('option','',`${index+1}번째 · ${i.value?i.value+'원':'기존 장식'} · ${i.placed?'배치 중':'보관 중'}`);o.value=i.id;o.selected=i.id===item.id;select.append(o);});select.onchange=()=>showItem(a,owned,false,select.value);c.append(select);}c.append(node('p','',item.value?`판매 가치 ${item.value}원`:'기존 트리에서 보존한 장식 · 판매 대상 아님'));
 c.append(button('보관하기',()=>$('dialog').close()));
 c.append(button(item.placed?'트리에서 회수하기':'트리에 배치하기',()=>run(async()=>{
 const current=snapshot.items.find(i=>i.id===item.id);if(!current)throw Error('장식 상태를 다시 확인해 주세요.');
 if(!current.placed){const placed=snapshot.items.filter(i=>i.placed);if(placed.length>=30)throw Error('트리에는 최대 30개를 배치할 수 있어요.');if(['lights','topper'].includes(a.kind)&&placed.some(i=>byId[i.asset_id].kind===a.kind))throw Error('별과 전구줄은 한 개씩만 배치할 수 있어요.');Object.assign(current,defaultPosition(a.kind,placed.filter(i=>byId[i.asset_id].kind===a.kind).length),{placed:1});}else current.placed=0;
 await saveLayout();await renderTree();$('dialog').close();setPageAfterAction('tree');
 })));
 if(item.value>0)c.append(adButton(`1개 판매하기 · ${item.value}원`,()=>{const confirmation=node('div');confirmation.append(node('p','',`${a.name} 1개를 ${item.value}원에 판매할까요? 도감 기록은 유지돼요.${item.placed?' 트리에서도 회수돼요.':''}`),adButton('판매 확정',()=>run(async()=>{if(preview){const i=previewState.items.findIndex(i=>i.id===item.id);if(i>=0){previewState.balance+=previewState.items[i].value;previewState.items.splice(i,1);}await load();}else{const ad=await factoryAd('sell',{itemId:item.id});snapshot=await factoryCall('sell',{itemId:item.id,adRequestId:ad.requestId});}await renderTree();$('dialog').close();toast('판매 금액을 적립했어요.');})),button('취소',()=>showItem(a,owned,fresh)));modal('장식 판매',confirmation);},'factory-button ad-action'));
 modal(a.name,c);
}
function setPageAfterAction(page){active=page;$('.home').hidden=page!=='tree';utilities.hidden=page!=='tree';shell.hidden=page==='tree';document.body.dataset.page=page;tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',b.dataset.page===page?'page':'false'));renderPage();}
async function render(){await renderTree();renderPage();}
async function treePicture(){
 const home=$('.home'),rect=home.getBoundingClientRect(),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=Math.round(rect.height/rect.width*1080)+140;
 const ctx=canvas.getContext('2d'),scale=1080/rect.width;ctx.fillStyle='#fff1d7';ctx.fillRect(0,0,canvas.width,canvas.height);
 const room=$('.room');await room.decode();ctx.drawImage(room,0,0,1080,rect.height*scale);
 const nodes=[...home.querySelectorAll('.pot-back,.tree,.pot,.ornament,.floor-item')].sort((a,b)=>(parseInt(getComputedStyle(a).zIndex)||0)-(parseInt(getComputedStyle(b).zIndex)||0));
 for(const node of nodes){
  const svg=node.querySelector('svg'),source=svg?.querySelector('image');if(!source)continue;
  const img=new Image();img.src=source.getAttribute('href');await img.decode();const [x,y,w,h]=svg.getAttribute('viewBox').split(' ').map(Number),r=node.getBoundingClientRect();
  const dx=(r.left-rect.left)*scale,dy=(r.top-rect.top)*scale,dw=r.width*scale,dh=r.height*scale;
  ctx.save();if(node.classList.contains('pot')||node.classList.contains('pot-back'))clipPlanter(ctx,dx,dy,dw,dh,node.classList.contains('pot'));ctx.drawImage(img,x,y,w,h,dx,dy,dw,dh);ctx.restore();
 }
 await document.fonts.ready;ctx.fillStyle='#75391f';ctx.textAlign='center';ctx.font='42px Jua, sans-serif';ctx.fillText('정성껏 꾸민 나의 크리스마스 트리',540,canvas.height-58);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('사진을 준비하지 못했어요.')),'image/png'));
}
function showShare(){
 if(busy)return;
 const content=document.createElement('div'),note=node('p','','트리 사진을 준비하고 있어요.');let picture;
 const revision=snapshot.revision;
 async function send(button,sharing){
  if(busy)return;if(!picture){await prepare();return;}setBusy(true);
  try{await (sharing?sharePhoto(picture):savePhoto(picture));note.textContent=sharing?'트리 사진을 공유해요.':'열린 메뉴에서 이미지 저장을 선택해 주세요.';}
  catch(error){note.textContent=error.name==='AbortError'?'취소했어요.':error.message;}
  finally{setBusy(false);}
 }
 const save=button('사진으로 저장하기',()=>send(save,false)),share=button('친구에게 보내기',()=>send(share,true));save.disabled=share.disabled=true;
 content.append(note,save,share);modal('내 트리 자랑하기',content);
 const prepare=createPhotoPreparation({prepare:()=>treePicture().then(preparePhoto),isCurrent:()=>snapshot.revision===revision&&content.isConnected&&$('dialog').open,
  onBusy:()=>{save.disabled=share.disabled=true;},onReady:value=>{picture=value;note.textContent='정성껏 꾸민 트리를 사진으로 간직해요.';save.disabled=share.disabled=false;},onError:()=>{note.textContent='사진 준비를 다시 시도해 주세요.';save.textContent='다시 시도';save.disabled=false;share.disabled=true;}});
 prepare();
}

const motion=pageEffects(async()=>{const fire=await startCozyFire($('.fire'),$('.room'));const snow=startCozySnow($('.snow'));return()=>{fire();snow();};},{onError:console.error});
await load();await render();await motion.start();setPage('tree');
let lastDate=snapshot.date;
async function reconnect(){if(preview||busy||document.hidden)return;await run(async()=>{await recoverFactoryAd();snapshot=await factoryCall('recover',{});await render();lastDate=snapshot.date;});}
window.addEventListener('tree:home-ready',reconnect);window.addEventListener('focus',reconnect);document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('factory-paused',document.hidden);if(!document.hidden)reconnect();});
setInterval(()=>{if(!preview&&kstDate()!==lastDate)reconnect();},60000);
// Let a short result timer settle on pagehide; rewards have already been committed.

