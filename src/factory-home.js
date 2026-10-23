import {startFactoryScene} from './factory-scene.js';
import {createPhotoPreparation} from './photo-preparation.js';
import {factoryCall,factoryAd,factoryDebugAd,recoverFactoryAd} from './factory-client.js';
import {startHomeBanner} from './banner.js';
import {catalog,byId,kstDate,productionBlockReason,defaultFactoryCatalog,drawCatalog} from './factory-model.js';
import {defaultPosition,clampPosition,OBJECT_SIZES,floorDepth,sanitizePositions} from './placement.js';
import {planterClipPath,clipPlanter} from './planter.js';
import {pageEffects} from './page-effects.js';
import {startCozyFire} from '../assets/backgrounds/cozy-fire.js';
import {startCozySnow} from '../assets/backgrounds/cozy-room.js';
import {preparePhoto,savePhoto,sharePhoto} from './photo-save.js';
const $=s=>document.querySelector(s),urlPreview=new URLSearchParams(location.search).get('preview')==='1';
let preview=urlPreview,debugMode=false;
let snapshot,active='tree',busy=false,filter=0,selling=false,debugAdsSkipped=false,toastTimer,animationTimer,stopFactoryScene=()=>{};
let previewState={version:3,date:kstDate(),used:0,overtime:false,limit:10,items:[],collection:[],balance:0,revision:0,pot:defaultPosition('pot'),treeSold:false,productionReady:true,exchangeReady:true,payments:[],catalog:defaultFactoryCatalog.map(({id,value})=>({id,value}))};
function rollover(){if(previewState.date!==kstDate())Object.assign(previewState,{date:kstDate(),used:0,overtime:false,limit:10});}
async function load(){if(preview){rollover();snapshot=structuredClone(previewState);}else snapshot=await factoryCall('state');}
function toast(text){$('.toast').textContent=text;$('.toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('.toast').hidden=true,4500);}
function allowDebugAdSkip(){if(debugAdsSkipped)return true;toast('디버그 메뉴에서 광고 스킵을 켜 주세요.');return false;}
function openDebugMenu(){
 if(busy)return;
 const content=node('div','debug-menu-content');
 content.append(node('p','',preview?'미리보기에서는 광고와 지급이 로컬에서만 시뮬레이션됩니다.':snapshot.debugAdSkipEnabled?'서버 환경과 관계없이 광고 단계를 건너뛰고 DB 기반 테스트 포인트 전환을 실행합니다.':'광고 스킵을 사용할 수 없습니다.'));
 const toggle=button(debugAdsSkipped?'광고 스킵 끄기':'광고 스킵 켜기',async()=>{
  if(!preview&&!snapshot.debugAdSkipEnabled){toast('광고 스킵을 사용할 수 없어요.');return;}
  $('dialog').close();await setDebugSkip(!debugAdsSkipped);
 },'debug-ad-button');
 toggle.disabled=!preview&&!snapshot.debugAdSkipEnabled;toggle.setAttribute('aria-pressed',String(debugAdsSkipped));content.append(toggle);
 const dialog=$('dialog');dialog.classList.add('debug-dialog');
 modal('디버그 메뉴',content);
 const title=dialog.querySelector('#modal-title');let drag=null;
 title.style.touchAction='none';title.style.cursor='move';
 title.onpointerdown=event=>{
  if(event.target.closest('button'))return;
  const rect=dialog.getBoundingClientRect();dialog.style.margin='0';dialog.style.left=rect.left+'px';dialog.style.top=rect.top+'px';dialog.style.transform='none';
  drag={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};title.setPointerCapture(event.pointerId);event.preventDefault();
 };
 title.onpointermove=event=>{
  if(!drag)return;
  const rect=dialog.getBoundingClientRect(),left=Math.max(0,Math.min(innerWidth-rect.width,drag.left+event.clientX-drag.x)),top=Math.max(0,Math.min(innerHeight-rect.height,drag.top+event.clientY-drag.y));
  dialog.style.left=left+'px';dialog.style.top=top+'px';
 };
 title.onpointerup=()=>{drag=null;};
 title.onpointercancel=()=>{drag=null;};
}
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function button(text,fn,cls='factory-button'){const b=node('button',cls,text);b.type='button';b.disabled=busy;b.onclick=fn;return b;}
function adButton(text,fn,cls='factory-button ad-action'){const b=button('',fn,cls),icon=node('span','ad-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/></svg><span>광고</span>';b.append(icon,document.createTextNode(text));return b;}
function modal(title,content){if($('dialog').open)$('dialog').close();const h=node('h2','',title);h.id='modal-title';$('.modal-content').replaceChildren(h,content);$('dialog').setAttribute('aria-labelledby','modal-title');$('dialog').showModal();}
function setBusy(value){busy=value;$('.home').setAttribute('aria-busy',String(value));$('.factory-shell').setAttribute('aria-busy',String(value));document.querySelectorAll('.factory-shell button,.page-tabs button,.home button,.tree-utilities button,dialog .factory-button').forEach(b=>b.disabled=value);}
async function run(action){if(busy)return;setBusy(true);try{await action();}catch(e){toast(e.message||'연결을 확인해 주세요.');try{await load();await render();}catch{/* Preserve confirmed snapshot. */}}finally{setBusy(false);renderPage();}}
function setPage(page){if(busy)return;active=page;filter=0;selling=false;$('.home').hidden=page!=='tree';utilities.hidden=page!=='tree';$('.factory-shell').hidden=page==='tree';document.querySelectorAll('.page-tabs button').forEach(b=>{b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});document.body.dataset.page=page;clearTimeout(animationTimer);renderPage();}
const shell=node('section','factory-shell');shell.hidden=true;shell.setAttribute('aria-label','장식 공장과 보관함');document.body.append(shell);
const debugLaunch=button('디버그',openDebugMenu,'debug-launch-button');debugLaunch.setAttribute('aria-label','디버그 메뉴 열기');
const debugSkipSwitch=button('',()=>setDebugSkip(!debugAdsSkipped),'debug-skip-switch');debugSkipSwitch.setAttribute('role','switch');debugSkipSwitch.setAttribute('aria-label','광고 스킵 켜기 또는 끄기');
const debugControls=node('div','debug-controls');debugControls.append(debugSkipSwitch,debugLaunch);document.body.append(debugControls);
function syncDebugSkipSwitch(){const enabled=preview||!!snapshot?.debugAdSkipEnabled;debugSkipSwitch.disabled=!enabled;debugSkipSwitch.setAttribute('aria-checked',String(debugAdsSkipped));debugSkipSwitch.innerHTML='<span class="debug-radio" aria-hidden="true"></span><span>'+ (debugAdsSkipped?'ON':'OFF') +'</span>';}
async function setDebugSkip(value){if(!preview&&!snapshot?.debugAdSkipEnabled){toast('광고 스킵을 사용할 수 없어요.');return;}debugAdsSkipped=value;debugMode=value;syncDebugSkipSwitch();await render();toast(value?'광고 스킵 ON':'광고 스킵 OFF');}
$('dialog').addEventListener('close',()=>{const dialog=$('dialog');dialog.classList.remove('debug-dialog');dialog.style.left='';dialog.style.top='';dialog.style.margin='';dialog.style.transform='';});
const tabs=node('nav','page-tabs');tabs.setAttribute('aria-label','주 메뉴');
for(const [page,label,icon] of [['tree','트리 꾸미기','tree'],['factory','장식 공장','factory'],['inventory','보관함','box'],['collection','도감','book']]){const b=button('',()=>setPage(page),'page-tab');b.dataset.page=page;b.innerHTML=`<svg viewBox="0 0 32 32" aria-hidden="true"><use href="assets/ui/factory-icons.svg#${icon}"/></svg><span></span>`;b.querySelector('span').textContent=label;tabs.append(b);}document.body.append(tabs);
const share=button('사진 저장 · 공유',showShare,'photo-link');$('.home-links').append(share);
const camera=node('img');camera.src='assets/ui/painted/camera.webp';camera.alt='';share.prepend(camera);
const utilities=$('.home-links');utilities.classList.add('tree-utilities');document.body.append(utilities);
new ResizeObserver(()=>document.documentElement.style.setProperty('--page-tabs-height',tabs.getBoundingClientRect().height+'px')).observe(tabs);
$('.slots').hidden=true;$('.slots').replaceChildren();$('.home footer').hidden=true;
$('.guide-link').onclick=()=>{const c=node('div');c.append(node('p','','광고를 보고 공장에서 장식을 만들어요. 보관함에서 배치하거나 판매할 수 있어요.'),node('p','','하루 기본 10회, 야근 광고를 보면 하루 한 번 10회를 더 생산해요. 생산할 때마다 광고를 시청해요.'),node('p','','최초 획득한 장식은 판매해도 도감에 남아요. 서로 다른 장식 30종을 모으면 장식 가치 합계 47원인 트리를 판매하고 50원을 적립해요.'));modal('이용안내',c);};
$('.rewards-link').onclick=()=>setPage('inventory');$('.close').onclick=()=>$('dialog').close();$('dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
const bounds=new Map();
async function assetNode(path,className){
 let g=bounds.get(path);if(!g){const img=new Image();img.src=path;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>16){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}g={box:`${x0} ${y0} ${x1-x0+1} ${y1-y0+1}`,w:c.width,h:c.height};bounds.set(path,g);}
 // Keep each decoration's silhouette proportional, as in inventory thumbnails.
 // Tree, split planter and fitted light string retain their scene geometry.
 const preserve=className==='tree'||className.startsWith('pot')||className.split(' ').includes('lights')?'none':'xMidYMid meet';
 const n=node('div',className);n.innerHTML=`<svg viewBox="${g.box}" preserveAspectRatio="${preserve}" aria-hidden="true"><image href="${path}" width="${g.w}" height="${g.h}"/></svg>`;return n;
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
function placePageBanner(){
 const region=document.querySelector('.page-banner');if(!region)return;
 if(active==='tree')$('.home').after(region);else shell.after(region);
}
function renderPage(){
 stopFactoryScene();stopFactoryScene=()=>{};shell.classList.toggle('concept-factory',active==='factory');
 if(!snapshot)return;tabs.querySelectorAll('button').forEach(b=>b.disabled=busy);
 if(active==='tree'){placePageBanner();return;}
 const titles={factory:'장식 공장',inventory:'보관함',collection:'장식 도감'};
 const header=node('header','factory-header');header.append(button('‹',()=>setPage('tree'),'back-button'),node('h1','',titles[active]),button('?',()=>$('.guide-link').click(),'help-button'));shell.replaceChildren(header);
 if(active==='factory'){renderFactory();placePageBanner();return;}
 const content=node('div','factory-content');shell.append(content);
 if(active==='collection'){
 const summary=node('section','collection-summary');summary.append(node('p','','수집 현황'),node('strong','',`${snapshot.collection.length} / 30`));const progress=node('progress');progress.max=30;progress.value=snapshot.collection.length;progress.setAttribute('aria-label','도감 수집 현황');summary.append(progress,node('p','','장식 30종의 가치 합계 47원 · 트리 판매 시 50원 적립'));
 if(snapshot.collection.length===30){const sold=!!snapshot.treeSold,treeReady=new Set(snapshot.items.filter(i=>i.placed).map(i=>i.asset_id)).size===30;const claim=adButton(sold?'트리 판매 완료 · 50원 적립':treeReady?'광고 보고 트리 판매 · 50원':'서로 다른 장식 30개를 트리에 놓아주세요',()=>{if(!treeReady||sold)return;const confirm=node('div');confirm.append(node('p','','서로 다른 장식 30개로 꾸민 트리를 판매하고 50원을 적립해요. 판매한 장식은 보관함에서 사라지고, 도감 기록은 유지돼요.'));confirm.append(adButton('트리 판매하고 50원 받기',()=>run(async()=>{if(preview){if(!allowDebugAdSkip())return;if(!previewState.treeSold){previewState.treeSold=true;previewState.balance+=50;previewState.items=previewState.items.map(i=>i.placed?{...i,placed:0,sold_at:Date.now()}:i).filter(i=>!i.sold_at);}await load();}else{const ad=debugAdsSkipped?await factoryDebugAd('tree-sale'):await factoryAd('tree-sale');snapshot=await factoryCall('claim',{adRequestId:ad.requestId});} $('dialog').close();await renderTree();renderPage();toast('트리를 판매하고 50원을 적립했어요.');})),button('취소',()=>$('dialog').close()));modal('트리 판매',confirm);});claim.disabled=busy||sold||!treeReady;summary.append(claim);}content.append(summary);
 }else{
 const modes=node('div','inventory-modes');for(const [mode,label] of [[false,'보유 장식'],[true,'판매하기']]){const b=button(label,()=>{selling=mode;renderPage();},selling===mode?'selected':'');modes.append(b);}content.append(modes);
 const wallet=node('section','wallet');wallet.append(node('strong','',`교환 가능 ${snapshot.balance}원`));const pending=snapshot.payments.some(p=>!['failed','succeeded'].includes(p.state));const exchangeButton=adButton(pending?'교환 결과 확인':'토스포인트 교환',()=>run(async()=>{if(preview){if(!allowDebugAdSkip())return;if(previewState.balance<1){toast('교환할 포인트가 없어요.');return;}const amount=previewState.balance;previewState.balance=0;previewState.payments.unshift({id:'debug-'+Date.now(),amount,mode:'test',state:'succeeded'});await load();renderPage();toast('디버그 광고 스킵 · 테스트 포인트 전환 완료');return;}let adRequestId;if(!pending){const ad=debugAdsSkipped?await factoryDebugAd('exchange'):await factoryAd('exchange');adRequestId=ad.requestId;}snapshot=await factoryCall(pending?'recover':'exchange',pending?{requestId:crypto.randomUUID()}:{requestId:crypto.randomUUID(),adRequestId,debugTest:debugAdsSkipped});renderPage();const last=snapshot.payments[0];toast(last?.state==='succeeded'?(last.mode==='test'?'테스트 교환 확인 · 실제 지급 없음':'포인트 교환 완료'):last?.state==='failed'?'교환 실패 · 잔액을 돌려드렸어요.':'교환 결과를 확인 중이에요.');}), 'factory-button ad-action exchange-action');exchangeButton.disabled=busy||(!pending&&(!snapshot.exchangeReady||snapshot.balance<1));wallet.append(exchangeButton);content.append(wallet);
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
 scene.append(painting,node('div','workshop-light'));shell.append(scene);
 stopFactoryScene=startFactoryScene(scene,painting);
 const counter=node('section','production-counter');counter.setAttribute('aria-label','오늘의 생산량');counter.append(node('span','production-counter-label','오늘의 생산량'),node('strong','',`${snapshot.used} / ${snapshot.limit}`));
 const progress=node('progress','factory-production-progress');progress.max=snapshot.limit;progress.value=snapshot.used;progress.setAttribute('aria-label','오늘 생산 진행률');counter.append(progress);scene.append(counter);
 const panel=node('section','production-panel');panel.append(node('p','','광고를 보고 랜덤 장식 1개를 생산해요.'));
 const unavailable=!preview&&!!productionBlockReason(snapshot);panel.classList.toggle('is-unavailable',unavailable);
 const produce=stopped?button('오늘 생산을 모두 마쳤어요',()=>produceItem()):unavailable?button('생산 준비 상태 확인',()=>produceItem()):button('보고 장식 생산하기',()=>produceItem());produce.disabled=busy||stopped;panel.append(produce,node('p','',unavailable?'생산 설정이 아직 완료되지 않았어요.':`오늘 남은 생산 ${Math.max(0,snapshot.limit-snapshot.used)}회`));shell.append(panel);
 const overtime=node('section','overtime-panel');overtime.append(node('h2','','오늘은 여기까지!'),node('p','',snapshot.overtime?'산타가 야근 중! 오늘도 힘내고 있어요.':'그래도… 산타가 아직 할 일이 남았대요!'));
 overtime.classList.toggle('is-overtime',snapshot.overtime);panel.classList.toggle('is-stopped',stopped);
 const b=snapshot.overtime?button('오늘 야근수당 지급 완료',requestOvertime,'factory-button overtime-button'):button('야근수당 주고 공장 재가동!',requestOvertime,'factory-button overtime-button');
 b.disabled=busy;
 overtime.append(b,node('small','',snapshot.overtime?(stopped?'오늘 생산 완료 · 내일 다시 만나요!':'추가 생산 10회 · 오늘 야근 중이에요'):(snapshot.used<10?'기본 생산 10회 완료 후 · 광고로 하루 1번 해제':'광고 시청 후 추가 생산 10회 · 하루 1번 가능해요.')));shell.append(overtime);
 if(preview){const notice=node('p','preview-notice','미리보기 · 광고/지급은 실제로 실행되지 않아요.');shell.append(notice);}
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
 await run(async()=>{if(preview){if(!allowDebugAdSkip())return;previewState.overtime=true;previewState.limit=20;await load();}else{if(debugAdsSkipped)await factoryDebugAd('overtime');else await factoryAd('overtime');await load();}renderPage();toast('공장 재가동! 추가 생산 10회 시작!');});
}
async function produceItem(){
 const reason=!preview&&productionBlockReason(snapshot);
 if(reason){const content=node('div');content.append(node('p','',reason),button('확인',()=>$('dialog').close()));modal('공장 생산 준비 중',content);return;}
 await run(async()=>{
 let result;if(preview){if(!allowDebugAdSkip())return;rollover();if(previewState.used>=previewState.limit)return;const entry=drawCatalog(defaultFactoryCatalog),a=byId[entry.id],id=crypto.randomUUID();previewState.used++;previewState.items.push({id,asset_id:a.id,value:entry.value,placed:0,x:null,y:null});if(!previewState.collection.includes(a.id))previewState.collection.push(a.id);result={itemId:id};}else result=debugAdsSkipped?await factoryDebugAd('produce'):await factoryAd('produce');
 await load();renderPage();const scene=$('.workshop');scene?.classList.remove('stopped');scene?.classList.add('producing');const produced=snapshot.items.find(i=>i.id===result.itemId);if(produced&&scene){const reveal=art(byId[produced.asset_id]);reveal.className='revealed-ornament';scene.append(reveal);}const skip=button('연출 건너뛰기',()=>{},'skip-production');skip.disabled=false;shell.append(skip);
 await new Promise(resolve=>{let ended=false;function done(){if(ended)return;ended=true;clearTimeout(animationTimer);skip.remove();scene?.classList.remove('producing');resolve();}function finish(){done();}skip.onclick=finish;animationTimer=setTimeout(done,matchMedia('(prefers-reduced-motion: reduce)').matches?0:2200);});
 const item=snapshot.items.find(i=>i.id===result.itemId);if(item)showItem(byId[item.asset_id],[item],true);
 });}
function showItem(a,owned,fresh=false,chosenId=null){
 const c=node('div','item-detail');c.append(art(a),node('p','',fresh?'새 장식이 도착했어요! 도감에 등록했어요.':`보유 ${owned.length}개 · 트리 배치 ${owned.filter(i=>i.placed).length}개`));
 const item=owned.find(i=>i.id===chosenId)||(selling?owned.find(i=>i.value>0):null)||owned.find(i=>!i.placed)||owned[0];if(owned.length>1){const select=node('select','instance-picker');select.setAttribute('aria-label','사용할 장식 선택');owned.forEach((i,index)=>{const o=node('option','',`${index+1}번째 · ${i.value?i.value+'원':'기존 장식'} · ${i.placed?'배치 중':'보관 중'}`);o.value=i.id;o.selected=i.id===item.id;select.append(o);});select.onchange=()=>showItem(a,owned,false,select.value);c.append(select);}c.append(node('p','',item.value?`판매 가치 ${item.value}원`:'기존 트리에서 보존한 장식 · 판매 대상 아님'));
 c.append(button('보관하기',()=>$('dialog').close()));
 const duplicatePlaced=!item.placed&&snapshot.items.some(i=>i.placed&&i.asset_id===item.asset_id);
 const placementButton=button(item.placed?'트리에서 회수하기':duplicatePlaced?'같은 장식은 이미 트리에 있어요':'트리에 배치하기',()=>run(async()=>{
 const current=snapshot.items.find(i=>i.id===item.id);if(!current)throw Error('장식 상태를 다시 확인해 주세요.');
 if(!current.placed){if(snapshot.items.some(i=>i.placed&&i.asset_id===current.asset_id))throw Error('같은 장식은 트리에 하나만 놓을 수 있어요.');const placed=snapshot.items.filter(i=>i.placed);if(placed.length>=30)throw Error('트리에는 최대 30개를 배치할 수 있어요.');if(['lights','topper'].includes(a.kind)&&placed.some(i=>byId[i.asset_id].kind===a.kind))throw Error('별과 전구줄은 한 개씩만 배치할 수 있어요.');Object.assign(current,defaultPosition(a.kind,placed.filter(i=>byId[i.asset_id].kind===a.kind).length),{placed:1});}else current.placed=0;
 await saveLayout();await renderTree();$('dialog').close();setPageAfterAction('tree');
 }));
 placementButton.disabled=busy||duplicatePlaced;c.append(placementButton);
 if(item.value>0)c.append(adButton(`1개 판매하기 · ${item.value}원`,()=>{const confirmation=node('div');confirmation.append(node('p','',`${a.name} 1개를 ${item.value}원에 판매할까요? 도감 기록은 유지돼요.${item.placed?' 트리에서도 회수돼요.':''}`),adButton('판매 확정',()=>run(async()=>{if(preview){if(!allowDebugAdSkip())return;const i=previewState.items.findIndex(i=>i.id===item.id);if(i>=0){previewState.balance+=previewState.items[i].value;previewState.items.splice(i,1);}await load();}else{const ad=debugAdsSkipped?await factoryDebugAd('sell',{itemId:item.id}):await factoryAd('sell',{itemId:item.id});snapshot=await factoryCall('sell',{itemId:item.id,adRequestId:ad.requestId});}await renderTree();$('dialog').close();toast('판매 금액을 적립했어요.');})),button('취소',()=>showItem(a,owned,fresh)));modal('장식 판매',confirmation);},'factory-button ad-action'));
 modal(a.name,c);
}
function setPageAfterAction(page){active=page;$('.home').hidden=page!=='tree';utilities.hidden=page!=='tree';shell.hidden=page==='tree';document.body.dataset.page=page;tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',b.dataset.page===page?'page':'false'));renderPage();}
async function render(){syncDebugSkipSwitch();await renderTree();renderPage();}
async function treePicture(){
 const home=$('.home'),rect=home.getBoundingClientRect(),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=Math.round(rect.height/rect.width*1080)+140;
 const ctx=canvas.getContext('2d'),scale=1080/rect.width;ctx.fillStyle='#fff1d7';ctx.fillRect(0,0,canvas.width,canvas.height);
 const room=$('.room');await room.decode();ctx.drawImage(room,0,0,1080,rect.height*scale);
 const nodes=[...home.querySelectorAll('.pot-back,.tree,.pot,.ornament,.floor-item')].sort((a,b)=>(parseInt(getComputedStyle(a).zIndex)||0)-(parseInt(getComputedStyle(b).zIndex)||0));
 for(const node of nodes){
  const svg=node.querySelector('svg'),source=svg?.querySelector('image');if(!source)continue;
  const img=new Image();img.src=source.getAttribute('href');await img.decode();const [x,y,w,h]=svg.getAttribute('viewBox').split(' ').map(Number),r=node.getBoundingClientRect();
  let dx=(r.left-rect.left)*scale,dy=(r.top-rect.top)*scale,dw=r.width*scale,dh=r.height*scale;
  // Match the SVG's centered contain fit when exporting the decorated tree.
  if(svg.getAttribute('preserveAspectRatio')!=='none'){
   const fit=Math.min(dw/w,dh/h),width=w*fit,height=h*fit;
   dx+=(dw-width)/2;dy+=(dh-height)/2;dw=width;dh=height;
  }
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
await load();await render();await motion.start();setPage('tree');startHomeBanner();
let lastDate=snapshot.date;
async function reconnect(){if(preview||busy||document.hidden)return;await run(async()=>{await recoverFactoryAd();snapshot=await factoryCall('recover',{});await render();lastDate=snapshot.date;});}
window.addEventListener('tree:home-ready',reconnect);window.addEventListener('focus',reconnect);document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('factory-paused',document.hidden);if(!document.hidden)reconnect();});
setInterval(()=>{if(!preview&&kstDate()!==lastDate)reconnect();},60000);
// Let a short result timer settle on pagehide; rewards have already been committed.

