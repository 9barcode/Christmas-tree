import assetBounds from './asset-bounds.js';
import {imageCache} from './image-cache.js';
import {startFactoryScene} from './factory-scene.js';
import {createPhotoPreparation} from './photo-preparation.js';
import {factoryCall,factoryAd,recoverFactoryAd,claimFactoryTree} from './factory-client.js';
import {startHomeBanner} from './banner.js';
import {catalog,byId,kstDate,productionBlockReason,defaultFactoryCatalog,drawCatalog} from './factory-model.js';
import {defaultPosition,clampPosition,OBJECT_SIZES,floorDepth,sanitizePositions} from './placement.js';
import {planterClipPath,clipPlanter} from './planter.js';
import {pageEffects} from './page-effects.js';
import {startCozyFire} from '../assets/backgrounds/cozy-fire.js';
import {startCozySnow} from '../assets/backgrounds/cozy-room.js';
import {preparePhoto,savePhoto,sharePhoto} from './photo-save.js';
const $=s=>document.querySelector(s),urlPreview=new URLSearchParams(location.search).get('preview')==='1';
const preview=urlPreview;
const saleSelection=new Set();
let snapshot,active='tree',busy=false,filter=0,selling=false,toastTimer,animationTimer,stopFactoryScene=()=>{};
let previewState={version:3,date:kstDate(),used:0,overtime:false,limit:10,items:[],collection:[],balance:0,revision:0,pot:defaultPosition('pot'),treeSaleCount:0,treeSold:false,productionReady:true,treeSaleReady:true,exchangeReady:true,payments:[],catalog:defaultFactoryCatalog.map(({id,value})=>({id,value}))};
function rollover(){if(previewState.date!==kstDate())Object.assign(previewState,{date:kstDate(),used:0,overtime:false,limit:10,treeSaleCount:0,treeSold:false,treeSalePending:false});}
async function load(){if(preview){rollover();snapshot=structuredClone(previewState);}else snapshot=await factoryCall('state');}
function toast(text){$('.toast').textContent=text;$('.toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('.toast').hidden=true,4500);}
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function button(text,fn,cls='factory-button'){const b=node('button',cls,text);b.type='button';b.onclick=fn;return b;}
function adButton(text,fn,cls='factory-button ad-action'){const b=button('',fn,cls),icon=node('span','ad-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/></svg><span>광고</span>';b.append(icon,document.createTextNode(text));return b;}
function modal(title,content){if($('dialog').open)$('dialog').close();$('dialog').classList.remove('guide-dialog','tree-sale-result-dialog');const h=node('h2','',title);h.id='modal-title';$('.modal-content').replaceChildren(h,content);$('dialog').setAttribute('aria-labelledby','modal-title');$('dialog').showModal();}
function setBusy(value){busy=value;$('.home').setAttribute('aria-busy',String(value));$('.factory-shell').setAttribute('aria-busy',String(value));for(const root of document.body.children)if(!root.matches('.toast'))root.inert=value;}
async function run(action){if(busy)return;setBusy(true);try{await action();}catch(e){toast(e.message||'연결을 확인해 주세요.');try{await load();await render();}catch{/* Preserve confirmed snapshot. */}}finally{setBusy(false);syncTreeSaleButton();renderPage();}}
function setPage(page){if(busy)return;active=page;filter=0;selling=false;$('.home').hidden=page!=='tree';utilities.hidden=page!=='tree';$('.factory-shell').hidden=page==='tree';document.querySelectorAll('.page-tabs button').forEach(b=>{b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});document.body.dataset.page=page;clearTimeout(animationTimer);syncTreeSaleButton();renderPage();}
const shell=node('section','factory-shell');shell.hidden=true;shell.setAttribute('aria-label','장식 공장과 보관함');const viewport=node('div','factory-viewport');viewport.append(shell);document.body.append(viewport);
const tabs=node('nav','page-tabs');tabs.setAttribute('aria-label','주 메뉴');
for(const [page,label,icon] of [['tree','트리 꾸미기','tree'],['factory','장식 공장','factory'],['inventory','보관함','box'],['collection','도감','book']]){const b=button('',()=>setPage(page),'page-tab');b.dataset.page=page;b.innerHTML=`<svg viewBox="0 0 32 32" aria-hidden="true"><use href="assets/ui/factory-icons.svg#${icon}"/></svg><span></span>`;b.querySelector('span').textContent=label;tabs.append(b);}document.body.append(tabs);
const share=button('사진 저장 · 공유',showShare,'photo-link');$('.home-links').append(share);
const camera=node('img');camera.src='assets/ui/painted/camera.webp';camera.alt='';share.prepend(camera);
const utilities=$('.home-links');utilities.classList.add('tree-utilities');document.body.append(utilities);
new ResizeObserver(()=>document.documentElement.style.setProperty('--page-tabs-height',tabs.getBoundingClientRect().height+'px')).observe(tabs);
$('.slots').hidden=true;$('.slots').replaceChildren();$('.home footer').hidden=true;
$('.home').addEventListener('pointerdown',e=>{if(!e.target.closest('.tree-remove-action'))$('.tree-remove-action')?.remove();},true);
function guideCard(image,title,description){
 const row=node('section','guide-card'),img=node('img'),copy=node('div');
 img.src=image;img.alt='';img.loading='lazy';
 copy.append(node('strong','',title),node('p','',description));row.append(img,copy);return row;
}
function showGuide(){
 const c=node('div','guide-content');
 c.append(
  guideCard('assets/factory/santa.webp','하루 10개씩 만들어요','장식을 모아 트리를 꾸며요.'),
  guideCard('assets/thumbnails/gift-burgundy.webp','하루 10개 더 만들어요','추가 장식도 모을 수 있어요.'),
  guideCard('assets/trees/tree-green.webp','원하는 곳에 꾸며요','장식과 선물은 드래그해 옮겨요.'),
  guideCard('assets/thumbnails/star-gold.webp','트리 판매로 50P','완성한 트리는 하루 5회 판매해요.'),
  guideCard('assets/thumbnails/bell-brass.webp','벨을 포인트로 바꿔요','1벨은 토스포인트 1P예요.')
 );
 modal('트리 꾸미기 이용안내',c);$('dialog').classList.add('guide-dialog');
}
$('.guide-link').onclick=showGuide;
$('.close').onclick=()=>$('dialog').close();$('dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
const bounds=new Map(Object.entries(assetBounds));
let lastTreeScene='';
let preparedTreePhoto=null;
window.addEventListener('pagehide',()=>{preparedTreePhoto=null;});
async function assetNode(path,className){
 let g=bounds.get(path);if(!g){const img=new Image();img.src=path;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>16){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}g={box:`${x0} ${y0} ${x1-x0+1} ${y1-y0+1}`,w:c.width,h:c.height};bounds.set(path,g);}
 // Keep each decoration's silhouette proportional, as in inventory thumbnails.
 // Tree, split planter and fitted light string retain their scene geometry.
 const preserve=className==='tree'||className.startsWith('pot')||className.split(' ').includes('lights')?'none':'xMidYMid meet';
 const n=node('div',className);n.innerHTML=`<svg viewBox="${g.box}" preserveAspectRatio="${preserve}" aria-hidden="true"><image href="${path}" width="${g.w}" height="${g.h}"/></svg>`;return n;
}
async function renderTree(){
 $('.tree-remove-action')?.remove();
 const scene=JSON.stringify(snapshot.items.filter(i=>i.placed).map(i=>[i.id,i.asset_id,i.x,i.y]));
 if(scene===lastTreeScene){syncTreeSaleButton();return;}
 preparedTreePhoto=null;
 const tree=await assetNode('assets/trees/tree-green.webp','tree'),pot=await assetNode('assets/planters/planter-wood.webp','pot'),back=await assetNode('assets/planters/planter-wood.webp','pot-back');pot.style.clipPath=planterClipPath(true);back.style.clipPath=planterClipPath(false);
 snapshot.pot=defaultPosition('pot');
 for(const target of [pot,back])Object.assign(target.style,{width:OBJECT_SIZES.pot.w+'%',height:OBJECT_SIZES.pot.h+'%',left:snapshot.pot.x+'%',top:snapshot.pot.y+'%',transform:'translate(-50%,-50%)',zIndex:String(target===back?0:floorDepth('pot',snapshot.pot.y))});
 const ornaments=[],floor=[];let oi=0,fi=0;
 for(const i of snapshot.items.filter(i=>i.placed)){
 const a=byId[i.asset_id];if(!a)continue;const n=await assetNode(a.path,a.kind==='floor'?'floor-item':'ornament '+(a.kind==='topper'?'topper':a.kind==='lights'?'lights':''));
 const p=Number.isFinite(i.x)?{x:i.x,y:i.y}:defaultPosition(a.kind,a.kind==='floor'?fi++:oi++);
 if(['lights','topper'].includes(a.kind)){const d=defaultPosition(a.kind);Object.assign(n.style,{width:OBJECT_SIZES[a.kind].w+'%',height:OBJECT_SIZES[a.kind].h+'%',left:d.x+'%',top:d.y+'%',transform:'translate(-50%,-50%)'});bindTapToRemove(n,i.id,a.kind,d);}else bindDrag(n,a.kind,i.id,p);
 (a.kind==='floor'?floor:ornaments).push(n);
 }
 $('.pot-back')?.remove();$('.garden').prepend(back);$('.tree').replaceWith(tree);$('.pot').replaceWith(pot);$('.ornaments').replaceChildren(...ornaments);$('.floor').replaceChildren(...floor);
 $('.progress').textContent=`나만의 트리 · 장식 ${snapshot.items.filter(i=>i.placed).length}개`;
 lastTreeScene=scene;
 syncTreeSaleButton();
}
function syncTreeSaleButton(){
 utilities.querySelector('.tree-sale-link')?.remove();
 const available=snapshot?.collection.length===30&&(snapshot.treeSalePending||!snapshot.treeSold);
 utilities.classList.toggle('has-tree-sale',!!available);
 if(!available)return;
 if(snapshot.treeSalePending){utilities.append(button('트리 판매 결과 확인',()=>run(async()=>{snapshot=await factoryCall('recover',{});await renderTree();renderPage();const payout=snapshot.payments.find(p=>p.purpose==='tree-sale');toast(payout?.state==='failed'?'포인트 지급 실패 · 다시 시도해 주세요.':payout?.state==='succeeded'&&!snapshot.treeSalePending?(payout.mode==='test'?'트리 판매 완료 · 포인트 지급 내역 미확인':'트리 판매 완료 · 토스포인트 50P 지급'):'지급 결과를 확인 중이에요. 잠시 후 다시 확인해 주세요.');}),'factory-button tree-sale-link'));return;}
 const ready=new Set(snapshot.items.filter(i=>i.placed).map(i=>i.asset_id)).size===30;
 const claim=ready&&snapshot.treeSaleReady?adButton('트리 판매하기 · 50P',()=>openTreeSaleConfirmation(),'factory-button ad-action tree-sale-link'):button(!snapshot.treeSaleReady?'트리 판매 포인트 지급 준비 중':'장식 30개를 트리에 배치하면 판매할 수 있어요',()=>{},'factory-button tree-sale-link');
 claim.disabled=busy||!ready||!snapshot.treeSaleReady;
 utilities.append(claim);
}
function showTreeSaleResult(kind='pending',detail=''){
 const content=node('div','tree-sale-result');
 const icons={pending:'assets/thumbnails/star-gold.webp',success:'assets/thumbnails/star-gold.webp',failed:'assets/ui/painted/book.webp'};
 const artwork=node('img','tree-sale-result-art');artwork.src=icons[kind]||icons.pending;artwork.alt='';
 const messages={
  pending:'광고 시청을 마쳤어요. 서버에서 50P 지급 결과를 확인하고 있어요.',
  success:'트리 판매가 완료됐어요. 토스포인트 50P가 지급됐어요.',
  test:'트리 판매가 완료됐어요. 토스포인트 지급 내역은 확인되지 않았어요.',
  failed:'50P 지급에 실패했어요. 장식은 다시 사용할 수 있도록 보관돼요.',
  unknown:'지급 결과를 아직 확인하지 못했어요. 다시 광고를 보지 말고 기존 거래 결과부터 확인해 주세요.'
 };
 content.append(artwork,node('p','tree-sale-result-message',messages[kind]||messages.unknown));
 if(detail)content.append(node('p','tree-sale-result-detail',detail));
 if(kind==='pending'||kind==='unknown'){
  const check=button('지급 결과 다시 확인',()=>run(async()=>{
   try{await recoverFactoryAd();snapshot=await factoryCall('recover',{});await renderTree();renderPage();showTreeSaleResultFromSnapshot();}
   catch(error){showTreeSaleResult('unknown',error.message||'잠시 후 다시 확인해 주세요.');}
  }),'factory-button');content.append(check);
 }
 content.append(button('확인',()=>$('dialog').close(),'factory-button tree-sale-result-close'));
 modal(kind==='success'||kind==='test'?'트리 판매 완료':kind==='failed'?'트리 판매 실패':'트리 판매 결과 확인',content);
 $('dialog').classList.add('tree-sale-result-dialog');
}
function showTreeSaleResultFromSnapshot(){
 const payment=snapshot?.payments?.find(p=>p.purpose==='tree-sale');
 if(payment?.state==='failed')showTreeSaleResult('failed');
 else if(payment?.state==='succeeded'&&!snapshot.treeSalePending&&snapshot.items.filter(i=>i.placed).length===0)showTreeSaleResult(payment.mode==='test'?'test':'success');
 else if(payment?.state==='succeeded')showTreeSaleResult('unknown','50P 지급은 성공했지만 장식 소모가 확인되지 않았어요. 지급 내역을 유지하고 다시 확인해 주세요.');
 else showTreeSaleResult('pending');
}
function openTreeSaleConfirmation(){
 const treeReady=new Set(snapshot.items.filter(i=>i.placed).map(i=>i.asset_id)).size===30;
 if(!treeReady||snapshot.treeSold||!snapshot.treeSaleReady)return;
 const confirm=node('div');
 const summary=node('p','','트리 판매로 50P · 하루 5회\n배치한 장식은 사라져요.\n도감 기록은 유지돼요.');summary.style.whiteSpace='pre-line';confirm.append(summary);
 confirm.append(adButton('트리 판매하고 50P 받기',()=>run(async()=>{
  if(preview){
   if(!previewState.treeSold){previewState.treeSaleCount++;previewState.treeSold=previewState.treeSaleCount>=5;previewState.items=previewState.items.map(i=>i.placed?{...i,placed:0,sold_at:Date.now()}:i).filter(i=>!i.sold_at);}
   await load();await renderTree();renderPage();showTreeSaleResult('test');return;
  }
  let adFinished=false;
  try{
   const ad=await factoryAd('tree-sale',{}, {onAdFinished:()=>{adFinished=true;showTreeSaleResult('pending');}});
   snapshot=await claimFactoryTree(ad.requestId);
   await renderTree();renderPage();showTreeSaleResultFromSnapshot();
  }catch(error){
   if(!adFinished)throw error;
   // Ad proof is journaled. Recover an existing request; never trigger another ad or claim here.
   try{snapshot=await factoryCall('recover',{});await renderTree();renderPage();}catch{/* Keep prior snapshot. */}
   const payment=snapshot?.payments?.find(p=>p.purpose==='tree-sale');
   if(payment?.state==='succeeded')showTreeSaleResultFromSnapshot();
   else if(payment?.state==='failed')showTreeSaleResult('failed');
   else showTreeSaleResult('unknown',error.message||'잠시 후 다시 확인해 주세요.');
  }
 })),button('취소',()=>$('dialog').close()));
 modal('트리 판매',confirm);
}
function showTreeRemoveAction(id,kind,p){
 $('.tree-remove-action')?.remove();
 const action=button('빼기',()=>run(async()=>{
  const item=snapshot.items.find(i=>i.id===id);if(!item?.placed)return;
  item.placed=0;await saveLayout();await renderTree();toast('장식을 보관함으로 옮겼어요.');
 }),'tree-remove-action');
 action.dataset.itemId=id;action.setAttribute('aria-label','이 장식을 트리에서 빼서 보관함으로 이동');
 const size=OBJECT_SIZES[kind];action.style.left=Math.max(10,Math.min(90,p.x))+'%';action.style.top=Math.max(7,p.y-(size?.h||6)/2)+'%';$('.garden').append(action);
}
function bindTapToRemove(n,id,kind,p){
 n.classList.add('tree-decoration-tappable');n.tabIndex=0;n.setAttribute('role','button');n.setAttribute('aria-label','장식을 선택해 보관함으로 이동');
 const select=()=>{if(!busy)showTreeRemoveAction(id,kind,p);};n.addEventListener('click',select);n.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};
}
function bindDrag(n,kind,id,initial,back){let p=initial,drag,suppressClick=false;
 n.classList.add('draggable');n.tabIndex=0;n.setAttribute('role','button');n.setAttribute('aria-label',id?`${byId[snapshot.items.find(i=>i.id===id)?.asset_id]?.name||'장식'} 위치 옮기기 또는 회수하기`:'화분 위치 옮기기');
 function paint(){for(const target of [n,back].filter(Boolean)){Object.assign(target.style,{width:OBJECT_SIZES[kind].w+'%',height:OBJECT_SIZES[kind].h+'%',left:p.x+'%',top:p.y+'%',transform:'translate(-50%,-50%)'});const z=target===back?0:floorDepth(kind,p.y);if(z!==null)target.style.zIndex=z;}}paint();
 n.onpointerdown=e=>{if(busy||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();drag={pointer:e.pointerId,x:e.clientX,y:e.clientY,p:{...p},rect:$('.garden').getBoundingClientRect(),moved:false};n.setPointerCapture(e.pointerId);n.classList.add('is-dragging');tabs.inert=true;};
 n.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<16)return;drag.moved=true;p=clampPosition(kind,drag.p.x+dx/drag.rect.width*100,drag.p.y+dy/drag.rect.height*100);paint();};
 function finish(e,cancel){if(!drag||drag.pointer!==e.pointerId)return;const start=drag.p,moved=drag.moved;drag=null;n.classList.remove('is-dragging');tabs.inert=false;if(n.hasPointerCapture(e.pointerId))n.releasePointerCapture(e.pointerId);if(cancel){p=start;paint();return;}if(!moved){if(id)showTreeRemoveAction(id,kind,p);return;}suppressClick=true;setTimeout(()=>{suppressClick=false;},0);run(async()=>{if(id)Object.assign(snapshot.items.find(i=>i.id===id),p);else snapshot.pot=p;await saveLayout();await renderTree();});}
 n.onpointerup=e=>finish(e,false);n.onpointercancel=e=>finish(e,true);n.onlostpointercapture=e=>finish(e,true);
 n.addEventListener('click',e=>{if(!id||busy||suppressClick||e.detail===0)return;if($('.tree-remove-action')?.dataset.itemId!==id)showTreeRemoveAction(id,kind,p);});
 n.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&id){e.preventDefault();showTreeRemoveAction(id,kind,p);return;}const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta||busy)return;e.preventDefault();p=clampPosition(kind,p.x+delta[0],p.y+delta[1]);paint();run(async()=>{if(id)Object.assign(snapshot.items.find(i=>i.id===id),p);else snapshot.pot=p;await saveLayout();});};
}
async function saveLayout(){const body={revision:snapshot.revision,pot:snapshot.pot?.x?snapshot.pot:defaultPosition('pot'),items:snapshot.items.filter(i=>i.placed).map(i=>({id:i.id,x:i.x,y:i.y}))};if(preview){previewState.items=structuredClone(snapshot.items);previewState.pot=body.pot;previewState.revision++;await load();}else snapshot=await factoryCall('layout',body);}
function art(a,locked=false){const img=node('img',locked?'locked-art':'');img.src='assets/thumbnails/'+a.id+'.webp';img.alt=locked?'미획득 장식':a.name;img.loading='lazy';return img;}
function placePageBanner(){
 const region=document.querySelector('.page-banner');if(!region)return;
 if(active==='tree')$('.home').after(region);else shell.after(region);
}
function renderPage(){
 document.querySelector('.sale-actions')?.remove();stopFactoryScene();stopFactoryScene=()=>{};shell.classList.toggle('concept-factory',active==='factory');
 if(!snapshot)return;tabs.querySelectorAll('button').forEach(b=>b.disabled=busy);
 if(active==='tree'){placePageBanner();return;}
 const titles={factory:'장식 공장',inventory:'보관함',collection:'장식 도감'};
 shell.setAttribute('aria-label',titles[active]);shell.replaceChildren();
 if(active==='factory'){renderFactory();placePageBanner();return;}
 const content=node('div','factory-content');shell.append(content);
 if(active!=='collection'){
 const modes=node('div','inventory-modes');for(const [mode,label] of [[false,'보유 장식'],[true,'판매하기']]){const b=button(label,()=>{selling=mode;saleSelection.clear();renderPage();},selling===mode?'selected':'');modes.append(b);}content.append(modes);
 const wallet=node('section','wallet');wallet.append(node('strong','',`교환 가능 ${snapshot.balance}벨`));const pending=snapshot.payments.some(p=>!['failed','succeeded'].includes(p.state));const exchangeButton=adButton(pending?'교환 결과 확인':'토스포인트 교환',()=>run(async()=>{if(preview){if(previewState.balance<1){toast('교환할 벨이 없어요.');return;}const amount=previewState.balance;previewState.balance=0;previewState.payments.unshift({id:'preview-'+Date.now(),amount,mode:'test',state:'succeeded'});await load();renderPage();toast('미리보기 교환 완료');return;}let adRequestId;if(!pending){const ad=await factoryAd('exchange');adRequestId=ad.requestId;}snapshot=await factoryCall(pending?'recover':'exchange',pending?{requestId:crypto.randomUUID()}:{requestId:crypto.randomUUID(),adRequestId});renderPage();const last=snapshot.payments[0];toast(last?.state==='succeeded'?(last.mode==='test'?'테스트 교환 확인 · 실제 지급 없음':'포인트 교환 완료'):last?.state==='failed'?'교환 실패 · 잔액을 돌려드렸어요.':'교환 결과를 확인 중이에요.');}), 'factory-button ad-action exchange-action');exchangeButton.disabled=busy||(!pending&&(!snapshot.exchangeReady||snapshot.balance<1));wallet.append(exchangeButton);content.append(wallet,node('p','fine-print','1벨 = 1토스포인트 · 교환 시 보유 벨 전액을 사용해요.'));
 }
 const filters=node('div','value-filters');for(const value of [0,1,2,3]){const b=button(value?value+'벨':'전체',()=>{filter=value;renderPage();},filter===value?'selected':'');b.setAttribute('aria-pressed',String(filter===value));filters.append(b);}content.append(filters);
 const grid=node('div',active==='collection'?'ornament-grid collection-grid':'ornament-grid inventory-grid');
 const saleMode=active==='inventory'&&selling;content.classList.toggle('has-sale-footer',saleMode);
 const entries=saleMode?catalog.flatMap(a=>snapshot.items.filter(i=>i.asset_id===a.id&&!i.placed).map(saleItem=>({a,saleItem}))):catalog.map(a=>({a}));
 for(const {a,saleItem} of entries){const value=snapshot.catalog.find(r=>r.id===a.id)?.value;const owned=snapshot.items.filter(i=>i.asset_id===a.id),unlocked=snapshot.collection.includes(a.id);if(filter&&value!==filter)continue;if(active==='inventory'&&!owned.length)continue;
 const openCard=()=>{if(active==='inventory'){showItem(a,owned);}else{const c=node('div');c.append(art(a,!unlocked),node('p','',unlocked?'도감에 영구 등록된 장식이에요.':'공장에서 이 장식을 만나 보세요.'));modal(unlocked?a.name:'아직 만나지 못한 장식',c);}};
 const card=saleMode?node('div','ornament-card sale-card'):button('',openCard,'ornament-card'+(!unlocked&&active==='collection'?' undiscovered':''));
 if(saleMode){const checked=saleSelection.has(saleItem.id),disabled=busy||saleItem.value<=0||(!checked&&saleSelection.size>=3);card.classList.toggle('sale-disabled',disabled&&!checked);card.classList.toggle('sale-selected',checked);const check=document.createElement('input');check.type='checkbox';check.className='sale-checkbox';check.checked=checked;check.disabled=disabled;check.setAttribute('aria-label',a.name+' '+(saleItem.placed?'트리 배치 중 ':'')+'판매 선택');check.onchange=()=>{if(check.checked){if(saleSelection.size>=3)return;saleSelection.add(saleItem.id);}else saleSelection.delete(saleItem.id);renderPage();};card.append(check);}
 card.append(art(a,!unlocked&&active==='collection'));
 if(active==='inventory'){card.append(node('span','value-tag',owned.every(i=>i.value===0)?'기존 장식':(saleMode?saleItem.value:(value??owned.find(i=>i.value>0)?.value))+'벨'),node('span','quantity',saleMode?'':'×'+owned.length),node('span','item-name',a.name));if(saleMode?saleItem.placed:owned.some(i=>i.placed))card.append(node('span','placed-badge','트리 배치 중'));}else card.append(node('span','item-name',unlocked?a.name:'?'));grid.append(card);
 }
 content.append(grid);if(saleMode)renderSaleSelection(content);if(!grid.childElementCount){const hasUnplaced=snapshot.items.some(i=>!i.placed),placed=snapshot.items.some(i=>i.placed);const message=saleMode?(hasUnplaced?'선택한 가격의 판매 가능한 장식이 없어요.':placed?'판매할 수 있는 장식이 없어요. 트리에서 장식을 회수해 주세요.':'판매할 장식이 없어요. 공장에서 장식을 생산해 보세요!'):'아직 보관 중인 장식이 없어요. 공장에서 첫 장식을 만들어 보세요!';content.append(node('p','empty-state',message));}
 if(active==='inventory')content.append(node('p','fine-print','판매한 장식도 도감에 남아요. 트리에 배치된 장식은 회수한 뒤 판매할 수 있어요.'));
}
function renderFactory(){
 const stopped=snapshot.used>=snapshot.limit,scene=node('div','workshop'+(stopped?' stopped':''));
 scene.setAttribute('aria-label','시안 원본의 산타 장식 공장');
 const painting=node('img','factory-concept-art');painting.src='assets/factory/concept-original.webp';painting.alt='';painting.draggable=false;
 scene.append(painting,node('div','workshop-light'));shell.append(scene);
 stopFactoryScene=startFactoryScene(scene);
 const counter=node('section','production-counter');counter.setAttribute('aria-label','오늘의 생산량');counter.append(node('span','production-counter-label','오늘의 생산량'),node('strong','',`${snapshot.used} / ${snapshot.limit}`));
 const progress=node('progress','factory-production-progress');progress.max=snapshot.limit;progress.value=snapshot.used;progress.setAttribute('aria-label','오늘 생산 진행률');counter.append(progress);scene.append(counter);
 const panel=node('section','production-panel');panel.append(node('p','','광고를 보고 랜덤 장식 1개를 생산해요.'));
 const unavailable=!preview&&!!productionBlockReason(snapshot);panel.classList.toggle('is-unavailable',unavailable);
 const produce=stopped?button('오늘 생산을 모두 마쳤어요',()=>produceItem()):unavailable?button('생산 준비 상태 확인',()=>produceItem()):button('보고 장식 생산하기',()=>produceItem());produce.disabled=busy||stopped;panel.append(produce,node('p','',unavailable?'생산 설정이 아직 완료되지 않았어요.':`오늘 남은 생산 ${Math.max(0,snapshot.limit-snapshot.used)}회`));shell.append(panel);
 const overtime=node('section','overtime-panel');overtime.append(node('h2','','오늘은 여기까지!'),node('p','',snapshot.overtime?'산타가 야근 중! 오늘도 힘내고 있어요.':'그래도… 산타가 아직 할 일이 남았어요!'));
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
 await run(async()=>{if(preview){previewState.overtime=true;previewState.limit=20;await load();}else{await factoryAd('overtime');await load();}renderPage();toast('공장 재가동! 추가 생산 10회 시작!');});
}
async function produceItem(){
 const reason=!preview&&productionBlockReason(snapshot);
 if(reason){const content=node('div');content.append(node('p','',reason),button('확인',()=>$('dialog').close()));modal('공장 생산 준비 중',content);return;}
 await run(async()=>{
 let result;if(preview){rollover();if(previewState.used>=previewState.limit)return;const entry=drawCatalog(defaultFactoryCatalog),a=byId[entry.id],id=crypto.randomUUID();previewState.used++;previewState.items.push({id,asset_id:a.id,value:entry.value,placed:0,x:null,y:null});if(!previewState.collection.includes(a.id))previewState.collection.push(a.id);result={itemId:id};}else result=await factoryAd('produce');
 await load();renderPage();const scene=$('.workshop');scene?.classList.remove('stopped');scene?.classList.add('producing');const skip=button('연출 건너뛰기',()=>{},'skip-production');skip.disabled=false;shell.append(skip);
 await new Promise(resolve=>{let ended=false;function done(){if(ended)return;ended=true;clearTimeout(animationTimer);skip.remove();scene?.classList.remove('producing');resolve();}function finish(){done();}skip.onclick=finish;animationTimer=setTimeout(done,matchMedia('(prefers-reduced-motion: reduce)').matches?0:2200);});
 const item=snapshot.items.find(i=>i.id===result.itemId);if(item)showItem(byId[item.asset_id],[item],true);
 });}
function renderSaleSelection(content){
 for(const id of saleSelection)if(!snapshot.items.some(i=>i.id===id&&!i.placed))saleSelection.delete(id);
 const section=node('section','sale-actions');const total=snapshot.items.filter(i=>saleSelection.has(i.id)).reduce((sum,i)=>sum+i.value,0);
 section.append(node('p','',`선택 ${saleSelection.size}/3개 · 총 ${total}벨`));
 const sell=adButton('광고 보고 판매하기',()=>sellSelected());sell.disabled=busy||!saleSelection.size;section.append(sell);document.body.append(section);
}
async function sellSelected(){
 const ids=[...saleSelection],items=ids.map(id=>snapshot.items.find(i=>i.id===id));
 if(!items.length||items.length>3||items.some(i=>!i||i.value<=0))return;
  run(async()=>{
   if(preview){previewState.balance+=items.reduce((sum,i)=>sum+i.value,0);previewState.items=previewState.items.filter(i=>!ids.includes(i.id));await load();}
   else{const body={itemIds:ids};const ad=await factoryAd('sell',body);snapshot=await factoryCall('sell',{...body,adRequestId:ad.requestId});}
   saleSelection.clear();$('dialog').close();await renderTree();renderPage();toast('판매 금액을 적립했어요.');
  });
}

function showItem(a,owned,fresh=false,chosenId=null){
 const c=node('div','item-detail');c.append(art(a),node('p','',fresh?'새 장식이 도착했어요! 도감에 등록했어요.':`보유 ${owned.length}개 · 트리 배치 ${owned.filter(i=>i.placed).length}개`));
 const item=owned.find(i=>i.id===chosenId)||(selling?owned.find(i=>i.value>0):null)||owned.find(i=>!i.placed)||owned[0];if(owned.length>1){const select=node('select','instance-picker');select.setAttribute('aria-label','사용할 장식 선택');owned.forEach((i,index)=>{const o=node('option','',`${index+1}번째 · ${i.value?i.value+'벨':'기존 장식'} · ${i.placed?'배치 중':'보관 중'}`);o.value=i.id;o.selected=i.id===item.id;select.append(o);});select.onchange=()=>showItem(a,owned,false,select.value);c.append(select);}c.append(node('p','',item.value?`판매 가치 ${item.value}벨`:'기존 트리에서 보존한 장식 · 판매 대상 아님'));
 c.append(button('보관하기',()=>$('dialog').close()));
 const duplicatePlaced=!item.placed&&snapshot.items.some(i=>i.placed&&i.asset_id===item.asset_id);
 const placementButton=button(item.placed?'트리에서 회수하기':duplicatePlaced?'같은 장식은 이미 트리에 있어요':'트리에 배치하기',()=>run(async()=>{
 const before=structuredClone(snapshot);
 const current=snapshot.items.find(i=>i.id===item.id);if(!current)throw Error('장식 상태를 다시 확인해 주세요.');
 if(!current.placed){if(snapshot.items.some(i=>i.placed&&i.asset_id===current.asset_id))throw Error('같은 장식은 트리에 하나만 놓을 수 있어요.');const placed=snapshot.items.filter(i=>i.placed);if(placed.length>=30)throw Error('트리에는 최대 30개를 배치할 수 있어요.');if(['lights','topper'].includes(a.kind)&&placed.some(i=>byId[i.asset_id].kind===a.kind))throw Error('별과 전구줄은 한 개씩만 배치할 수 있어요.');Object.assign(current,defaultPosition(a.kind,placed.filter(i=>byId[i.asset_id].kind===a.kind).length),{placed:1});}else current.placed=0;
 $('dialog').close();setPageAfterAction('tree');
 try{
  await renderTree();
  // Let the optimistic scene paint before starting server persistence.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  await saveLayout();await renderTree();
 }catch(error){snapshot=before;await renderTree();throw error;}
 }));
 placementButton.disabled=busy||duplicatePlaced;c.append(placementButton);
 if(item.value>0)c.append(button('판매하기',()=>{$('dialog').close();selling=true;filter=0;saleSelection.clear();setPageAfterAction('inventory');}));

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
  const img=await imageCache.load(source.getAttribute('href'));const [x,y,w,h]=svg.getAttribute('viewBox').split(' ').map(Number),r=node.getBoundingClientRect();
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
 const prepare=createPhotoPreparation({prepare:()=>{
  const rect=$('.home').getBoundingClientRect(),key=lastTreeScene+':'+rect.width+':'+rect.height;
  if(preparedTreePhoto?.key===key)return preparedTreePhoto.promise;
  const entry={key,promise:null};preparedTreePhoto=entry;
  entry.promise=treePicture().then(preparePhoto).catch(error=>{if(preparedTreePhoto===entry)preparedTreePhoto=null;throw error;});
  return entry.promise;
 },isCurrent:()=>snapshot.revision===revision&&content.isConnected&&$('dialog').open,
  onBusy:()=>{save.disabled=share.disabled=true;},onReady:value=>{picture=value;note.textContent='정성껏 꾸민 트리를 사진으로 간직해요.';save.disabled=share.disabled=false;},onError:()=>{note.textContent='사진 준비를 다시 시도해 주세요.';save.textContent='다시 시도';save.disabled=false;share.disabled=true;}});
 prepare();
}

const motion=pageEffects(async()=>{const fire=await startCozyFire($('.fire'),$('.room'));const snow=startCozySnow($('.snow'));return()=>{fire();snow();};},{onError:console.error});
await load();
if(!preview){
 let pendingAd=false;try{pendingAd=Object.keys(localStorage).some(k=>k.startsWith('tree.factory.pending.'));}catch{}
 if(pendingAd||snapshot.treeSalePending)try{await recoverFactoryAd();snapshot=await factoryCall('recover',{});}catch(error){console.warn('[tree.sale.recovery]',{code:error.code||'retry_required'});}
}
await render();await motion.start();setPage('tree');startHomeBanner();
let lastDate=snapshot.date,lastRefreshAt=Date.now();
async function reconnect(){if(preview||busy||document.hidden||(kstDate()===lastDate&&Date.now()-lastRefreshAt<10000))return;lastRefreshAt=Date.now();await run(async()=>{await recoverFactoryAd();snapshot=await factoryCall('recover',{});await render();lastDate=snapshot.date;});}
window.addEventListener('tree:home-ready',()=>{
 let pendingAd=false;try{pendingAd=Object.keys(localStorage).some(k=>k.startsWith('tree.factory.pending.'));}catch{/* Focus refresh can retry. */}
 if(pendingAd||snapshot.treeSalePending||snapshot.payments.some(p=>!['succeeded','failed'].includes(p.state))){lastRefreshAt=0;reconnect();}
});window.addEventListener('focus',reconnect);document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('factory-paused',document.hidden);if(!document.hidden)reconnect();});
setInterval(()=>{if(!preview&&kstDate()!==lastDate)reconnect();},60000);
// Let a short result timer settle on pagehide; rewards have already been committed.


