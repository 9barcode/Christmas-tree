import {loadBM,recoverAd,recoverExchanges,performAd,completeTree,savePositions,preloadBMAds} from './bm-client.js';
import {pageEffects} from './page-effects.js';
import {createPhotoPreparation} from './photo-preparation.js';
import {slotPreview} from './slot-preview.js';
import {planterClipPath,clipPlanter} from './planter.js';
import {startCozyFire} from '../assets/backgrounds/cozy-fire.js';
import {startCozySnow} from '../assets/backgrounds/cozy-room.js';
import {preparePhoto,savePhoto,sharePhoto} from './photo-save.js';
import {sanitizePositions,placeDecoration,defaultPosition,clampPosition,OBJECT_SIZES,floorDepth} from './placement.js';
import {localDate,COLORS} from './state.js';
import {nextTestDate} from './test-clock.js';
import manifest from './decoration-manifest.js';

const $=s=>document.querySelector(s);
const preview=new URLSearchParams(location.search).get('preview')==='1';
const SELECTED_KEY='tree.bm.selected';
const assets=manifest.assets;
if(!Array.isArray(assets)||assets.length!==30)throw Error('장식 정보를 확인하지 못했어요.');
const sequence=[...assets.filter(a=>a.kind==='floor'),...assets.filter(a=>a.kind==='ornament').sort((a,b)=>a.originalNumber-b.originalNumber),...assets.filter(a=>a.kind==='lights'),...assets.filter(a=>a.kind==='topper')];
let testDate=localDate();
let snapshot=preview?{version:2,date:testDate,dailyLimitPerTree:10,balance:0,exchangeMode:'test',slots:[{slot:1,color:'green',decorations:0,positions:{},positions_revision:0,dailyUsed:0,completed_at:null}],credits:[],payments:[]}:await loadBM();
let selected=0;
try{const saved=Number(localStorage.getItem(SELECTED_KEY));if(Number.isInteger(saved)&&saved>=0&&saved<5)selected=saved;}catch{/* Selection is optional. */}
let state,busy=false,renderId=0,toastTimer,recovering=false;
function apply(value){
 if(value?.version!==2||!Array.isArray(value.slots)||!value.slots.some(t=>t.slot===1)||value.dailyLimitPerTree!==10)throw Error('트리 서버 정보를 확인해 주세요.');
 snapshot=value;
 const paidSlots=new Set((value.credits||[]).filter(row=>row.paid_at).map(row=>row.slot));
 const trees=Array(5).fill(null);
 for(const row of value.slots){
  if(!Number.isInteger(row.slot)||row.slot<1||row.slot>5||!COLORS.includes(row.color)||!Number.isInteger(row.decorations)||row.decorations<0||row.decorations>30)throw Error('트리 정보를 확인해 주세요.');
  if(paidSlots.has(row.slot))continue;
  trees[row.slot-1]={...row,count:row.decorations,positions:sanitizePositions(row.positions,sequence,row.decorations)};
 }
 if(!trees[selected]){const active=trees.findIndex(Boolean);if(active>=0)selected=active;else if(paidSlots.has(selected+1)){const open=trees.findIndex((t,index)=>!t&&!paidSlots.has(index+1)&&!value.slots.some(row=>row.slot===index+1));selected=open>=0?open:0;}}
 state={selected,trees};
}
apply(snapshot);
const current=()=>state.trees[selected];
const credit=slot=>snapshot.credits.find(c=>c.slot===slot);
const payment=slot=>snapshot.payments.find(p=>p.slot===slot&&p.state!=='failed'&&(p.mode===snapshot.exchangeMode||p.state!=='succeeded'));
const pending=slot=>{const p=payment(slot);return p&&!['succeeded','failed'].includes(p.state);};
function showToast(message){$('.toast').textContent=message;$('.toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('.toast').hidden=true,4500);}
function select(index){selected=index;state.selected=index;try{localStorage.setItem(SELECTED_KEY,String(index));}catch{/* Not authoritative. */}}
function updateCTA(){
 const tree=current(),button=$('.checkin');
 if(!tree){button.disabled=true;button.lastChild.textContent=busy?'처리 중이에요…':'빈 슬롯을 눌러 광고로 트리 추가';button.classList.remove('gift-cta');return;}
 let label='전면광고 보고 장식 받기',disabled=false;
 if(tree.count<30&&tree.dailyUsed>=10){label='오늘 장식 10개를 모두 모았어요';disabled=true;}
 if(tree.count===30){
  if(!tree.completed_at)label='트리 완성하기';
  else if(credit(tree.slot)?.paid_at)label='내 트리 자랑하기';
  else if(pending(tree.slot))label='포인트 교환 결과 확인';
  else if(payment(tree.slot)?.state==='succeeded'&&payment(tree.slot).mode==='test')label='테스트 교환 확인 완료';
  else label='리워드 광고 보고 30P 교환';
 }
 button.disabled=busy||disabled;
 const adLabel=label==='리워드 광고 보고 30P 교환';
 let adIcon=button.querySelector('.ad-icon');
 if(adLabel&&!adIcon){adIcon=document.createElement('span');adIcon.className='ad-icon';adIcon.setAttribute('aria-hidden','true');adIcon.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 4V6l-5 4H3zm12-1a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/></svg><span>광고</span>';button.insertBefore(adIcon,button.lastChild);}
 if(!adLabel)adIcon?.remove();
 button.lastChild.textContent=busy?'처리 중이에요…':label;
 button.classList.toggle('gift-cta',tree.count===30);
}
function setBusy(value){busy=value;$('.home').setAttribute('aria-busy',String(value));document.querySelectorAll('.slots button,.home-links button,dialog button.modal-primary').forEach(b=>b.disabled=value);updateCTA();}
async function refresh(){if(!preview)apply(await loadBM());else apply(snapshot);await render();}
async function run(action){
 if(busy||recovering)return;
 setBusy(true);
 try{await action();}
 catch(error){showToast(error.message||'연결을 확인하지 못했어요. 다시 눌러 주세요.');try{await refresh();}catch{/* Keep the last confirmed state. */}}
 finally{setBusy(false);}
}

const bounds=new Map();
async function geometry(path){
 if(bounds.has(path))return bounds.get(path);
 const img=new Image();img.src=path;await img.decode();
 const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
 const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 let x0=canvas.width,y0=canvas.height,x1=0,y1=0;
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>16){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 const g={box:`${x0} ${y0} ${x1-x0+1} ${y1-y0+1}`,w:img.width,h:img.height};bounds.set(path,g);return g;
}
async function assetNode(path,className){const node=document.createElement('div'),g=await geometry(path);node.className=className;node.innerHTML=`<svg viewBox="${g.box}" preserveAspectRatio="none" aria-hidden="true"><image href="${path}" width="${g.w}" height="${g.h}"/></svg>`;return node;}
async function render(){
 const id=++renderId,tree=current();
 $('.slots').replaceChildren(...Array.from({length:5},(_,index)=>{
  const t=state.trees[index],b=document.createElement('button'),exchanged=!t&&!!credit(index+1)?.paid_at;
  b.className='slot'+(index===selected?' selected':'')+(!t?(exchanged?' is-exchanged':' is-locked'):'');b.disabled=busy||exchanged;
  b.setAttribute('aria-pressed',String(index===selected));b.setAttribute('aria-label',t?`${index+1}번 트리, 장식 ${t.count}/30`:exchanged?`${index+1}번 트리 · 포인트 교환 완료`:`${index+1}번 트리, 리워드 광고로 추가`);
  b.innerHTML=t?`<img src="assets/trees/tree-${t.color}.png" alt=""><span>${index+1}</span>`:exchanged?'<span class="lock" aria-hidden="true">✓</span><span>'+String(index+1)+'</span>':'<span class="lock" aria-hidden="true">🔒</span><span>'+String(index+1)+'</span>';
  b.onclick=()=>{
   if(busy||recovering)return;
   if(exchanged)return;
   if(!t){showUnlock(index);return;}
   select(index);render().catch(error=>showToast(error.message));
  };return b;
 }));
 if(!tree){$('.progress').textContent='빈 슬롯을 눌러 광고를 보고 새 트리를 만들어요';updateCTA();$('.tree')?.remove();$('.pot')?.remove();$('.pot-back')?.remove();$('.ornaments').replaceChildren();$('.floor').replaceChildren();return;}
 $('.progress').textContent=`${tree.slot}번 트리 · 장식 ${tree.count}/30 · 오늘 ${tree.dailyUsed}/10`;
 updateCTA();
 const [trunk,pot,potBack]=await Promise.all([assetNode(`assets/trees/tree-${tree.color}.png`,'tree'),assetNode('assets/planters/planter-wood.png','pot'),assetNode('assets/planters/planter-wood.png','pot-back')]);
 pot.style.clipPath=planterClipPath(true);potBack.style.clipPath=planterClipPath(false);
 bindObject(pot,'pot','__pot',tree,tree.positions.__pot??defaultPosition('pot'),potBack);
 const ornaments=[],floor=[];let ornamentIndex=0,floorIndex=0;
 for(const a of sequence.slice(0,tree.count)){
  const node=await assetNode(a.path,a.kind==='floor'?'floor-item':'ornament '+(a.kind==='topper'?'topper':a.kind==='lights'?'lights':''));
  const index=a.kind==='floor'?floorIndex++:a.kind==='ornament'?ornamentIndex++:0;
  if(['lights','topper'].includes(a.kind)){
   const p=defaultPosition(a.kind);node.classList.add('fixed-decoration');node.style.width=`${OBJECT_SIZES[a.kind].w}%`;node.style.height=`${OBJECT_SIZES[a.kind].h}%`;node.style.left=`${p.x}%`;node.style.top=`${p.y}%`;
  }else bindObject(node,a.kind,a.id,tree,tree.positions[a.id]??defaultPosition(a.kind,index));
  (a.kind==='floor'?floor:ornaments).push(node);
 }
 if(id!==renderId)return;
 $('.pot-back')?.remove();$('.garden').prepend(potBack);$('.tree').replaceWith(trunk);$('.pot').replaceWith(pot);$('.ornaments').replaceChildren(...ornaments);$('.floor').replaceChildren(...floor);
 await Promise.all(state.trees.map(async(t,index)=>{
  if(!t)return;const svg=await slotPreview(t,sequence,geometry,index);
  if(id!==renderId)return;
  const b=$('.slots').children[index],thumb=document.createElement('div');thumb.className='slot-preview';thumb.innerHTML=svg;b.querySelector('img')?.replaceWith(thumb);
 }));
}
async function persistLayout(tree){
 if(preview){snapshot.slots.find(t=>t.slot===tree.slot).positions=tree.positions;return;}
 const result=await savePositions(tree.slot,tree.positions_revision,tree.positions);
 tree.positions=result.positions;tree.positions_revision=result.revision;
}
function bindObject(node,kind,id,tree,position,back=null){
 let p=clampPosition(kind,position.x,position.y,tree.count===30),drag;
 node.classList.add('draggable');node.dataset.id=id;
 node.style.width=`${OBJECT_SIZES[kind].w}%`;node.style.height=`${OBJECT_SIZES[kind].h}%`;
 node.setAttribute('role','button');node.tabIndex=0;node.setAttribute('aria-label',kind==='pot'?'화분 위치 옮기기':'장식 위치 옮기기');
 function paint(){
  node.style.left=`${p.x}%`;node.style.top=`${p.y}%`;const depth=floorDepth(kind,p.y);if(depth!==null)node.style.zIndex=String(depth);
  if(back){back.style.width=node.style.width;back.style.height=node.style.height;back.style.left=node.style.left;back.style.top=node.style.top;}
 }
 paint();
 node.onpointerdown=e=>{if(busy||recovering||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();e.stopPropagation();drag={pointer:e.pointerId,x:e.clientX,y:e.clientY,start:{...p},rect:$('.garden').getBoundingClientRect()};setBusy(true);node.setPointerCapture(e.pointerId);node.classList.add('is-dragging');$('.home').classList.add('dragging');};
 node.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;e.preventDefault();p=clampPosition(kind,drag.start.x+(e.clientX-drag.x)/drag.rect.width*100,drag.start.y+(e.clientY-drag.y)/drag.rect.height*100,tree.count===30);paint();};
 async function finish(e,cancel){
  if(!drag||drag.pointer!==e.pointerId)return;
  if(cancel){p=drag.start;paint();}else placeDecoration(tree,sequence,id,p.x,p.y);
  drag=null;node.classList.remove('is-dragging');$('.home').classList.remove('dragging');if(node.hasPointerCapture(e.pointerId))node.releasePointerCapture(e.pointerId);
  try{if(!cancel)await persistLayout(tree);await render();}catch(error){showToast(error.message);try{await refresh();}catch{/* Keep unsaved layout until reconnect. */}}finally{setBusy(false);}
 }
 node.onpointerup=e=>finish(e,false);node.onpointercancel=e=>finish(e,true);node.onlostpointercapture=e=>{if(drag)finish(e,true);};
 node.onkeydown=e=>{
  if(busy||recovering)return;const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();
  run(async()=>{const step=e.shiftKey?3:1;p=clampPosition(kind,p.x+delta[0]*step,p.y+delta[1]*step,tree.count===30);paint();placeDecoration(tree,sequence,id,p.x,p.y);await persistLayout(tree);await render();});
 };
}

function actionButton(label,handler){const b=document.createElement('button');b.className='modal-primary';b.textContent=label;b.onclick=handler;return b;}
function paragraph(text){const p=document.createElement('p');p.className='calendar-note';p.textContent=text;return p;}
function openModal(title,content){if($('dialog').open)$('dialog').close();const h=document.createElement('h2');h.id='modal-title';h.textContent=title;$('.modal-content').replaceChildren(h,content);$('dialog').classList.remove('rewards-dialog','guide-dialog');$('dialog').setAttribute('aria-labelledby','modal-title');$('dialog').showModal();}
function showUnlock(index){
 const content=document.createElement('div');content.append(paragraph('리워드 광고 시청을 완료하면 이 슬롯의 트리를 영구적으로 추가해요. 다른 트리의 진행도와 관계없이 선택할 수 있어요.'));
 content.append(actionButton('리워드 광고 보고 트리 추가',()=>run(async()=>{
  if(preview)snapshot.slots.push({slot:index+1,color:COLORS[Math.floor(Math.random()*COLORS.length)],decorations:0,dailyUsed:0,positions:{},positions_revision:0,completed_at:null});
  else await performAd('unlock-slot',index+1);
  $('dialog').close();await refresh();select(index);await render();showToast('새 트리가 추가됐어요.');
 })));openModal(`${index+1}번 트리 추가`,content);
}
function showGuide(){
 if(busy)return;const content=document.createElement('div');
 for(const text of ['전면광고를 보고 선택한 트리에 장식 1개를 추가해요. 트리마다 하루 최대 10개를 모을 수 있어요.','매일 방문하지 않아도 모은 장식은 사라지지 않아요. 하루 횟수는 한국시간 자정에 새로 시작해요.','장식 30개를 모아 배치를 마친 후 트리를 완성하면 30P 상당의 교환 대기 잔액이 적립돼요.','완성한 트리의 포인트는 리워드 광고 시청을 완료한 뒤 교환해요. 지급 확인 중에는 다시 광고를 보지 않고 결과를 확인해요.','추가 트리는 잠긴 슬롯을 선택해 리워드 광고로 열어요. 장식과 화분은 옮길 수 있고 트리·전구·별은 고정돼요.'])content.append(paragraph(text));
 content.append(actionButton('알겠어요',()=>$('dialog').close()));openModal('트리 꾸미기 이용안내',content);
}
function showRewards(){
 if(busy)return;const content=document.createElement('div');content.append(paragraph(`교환 대기 ${snapshot.balance}P · 트리를 완성할 때마다 30P 상당 적립`));
 for(const t of state.trees.filter(Boolean)){
  const c=credit(t.slot),p=payment(t.slot),row=document.createElement('section');
  let description=`${t.slot}번 트리 · 장식 ${t.count}/30 · 오늘 ${t.dailyUsed}/10`;
  if(t.completed_at)description+=c?.paid_at?' · 30P 교환 완료':pending(t.slot)?' · 교환 확인 중':p?.state==='succeeded'&&p.mode==='test'?' · 테스트 교환 확인 완료':' · 30P 교환 대기';
  row.append(paragraph(description));
  if(t.count===30)row.append(actionButton('트리 사진 저장·공유',()=>{select(t.slot-1);$('dialog').close();render().then(showShare).catch(error=>showToast(error.message));}));
  if(t.completed_at&&!c?.paid_at)row.append(actionButton(pending(t.slot)?'교환 결과 확인':'리워드 광고 보고 30P 교환',()=>exchange(t.slot)));
  content.append(row);
 }
 for(const c of snapshot.credits.filter(item=>item.paid_at))content.append(paragraph(`${c.slot}번 트리 · 30P 교환 완료`));
 content.append(actionButton('닫기',()=>$('dialog').close()));openModal('장식 · 포인트 내역',content);
}
function exchange(slot){return run(async()=>{
 if(preview){const c=snapshot.credits.find(c=>c.slot===slot);if(c&&!c.paid_at){c.paid_at=Date.now();snapshot.balance-=30;}await refresh();showToast('테스트 교환 완료 · 실제 지급은 없어요.');}
 else{
  const existing=payment(slot);
  if(!existing||existing.state==='failed')await performAd('exchange-points',slot);
  apply(await recoverExchanges());await render();
  const latest=snapshot.payments.find(p=>p.slot===slot);
  showToast(credit(slot)?.paid_at?'30P 교환이 완료됐어요. 새 트리는 리워드 광고로 추가할 수 있어요.':payment(slot)?.state==='succeeded'?'테스트 교환을 확인했어요. 실제 포인트 지급은 없어요.':latest?.state==='failed'?'교환이 완료되지 않았어요. 모은 포인트는 보관돼요. 잠시 후 다시 시도해 주세요.':'교환 결과를 확인 중이에요. 다시 광고를 볼 필요는 없어요.');
 }
 $('dialog').close();
 });}
$('.checkin').onclick=()=>{
 if(busy||recovering)return;const t=current();if(!t){showToast('빈 슬롯을 눌러 리워드 광고로 트리를 추가해 주세요.');return;}
 if(t.completed_at){if(credit(t.slot)?.paid_at){showShare();return;}return exchange(t.slot);}
 run(async()=>{
  if(t.count===30){
   if(preview){t.completed_at=Date.now();Object.assign(snapshot.slots.find(s=>s.slot===t.slot),{completed_at:t.completed_at});snapshot.credits.push({slot:t.slot,amount:30,paid_at:null});snapshot.balance+=30;}
   else await completeTree(t.slot);
   await refresh();showToast('트리를 완성했어요! 30P를 교환할 수 있어요.');
  }else{
   if(t.dailyUsed>=10)return;
   if(preview){const s=snapshot.slots.find(s=>s.slot===t.slot);s.decorations++;s.dailyUsed++;}
   else await performAd('earn-decoration',t.slot);
   await refresh();showToast(current().count===30?'장식 30개를 모았어요. 배치를 마치고 트리를 완성해 주세요.':'장식 1개를 받았어요.');
  }
 });
};
$('.guide-link').onclick=showGuide;$('.rewards-link').onclick=showRewards;$('.close').onclick=()=>$('dialog').close();
$('dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});

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
 if(current().count!==30||busy)return;
 const content=document.createElement('div'),note=paragraph('트리 사진을 준비하고 있어요.');let picture;
 const index=selected,source=current();
 async function send(button,sharing){
  if(busy)return;if(!picture){await prepare();return;}setBusy(true);
  try{await (sharing?sharePhoto(picture):savePhoto(picture));note.textContent=sharing?'트리 사진을 공유해요.':'열린 메뉴에서 이미지 저장을 선택해 주세요.';}
  catch(error){note.textContent=error.name==='AbortError'?'취소했어요.':error.message;}
  finally{setBusy(false);}
 }
 const save=actionButton('사진으로 저장하기',()=>send(save,false)),share=actionButton('친구에게 보내기',()=>send(share,true));save.disabled=share.disabled=true;
 content.append(note,save,share);openModal('내 트리 자랑하기',content);
 const prepare=createPhotoPreparation({prepare:()=>treePicture().then(preparePhoto),isCurrent:()=>selected===index&&current()===source&&content.isConnected&&$('dialog').open,
  onBusy:()=>{save.disabled=share.disabled=true;},onReady:value=>{picture=value;note.textContent='정성껏 꾸민 트리를 사진으로 간직해요.';save.disabled=share.disabled=false;},onError:()=>{note.textContent='사진 준비를 다시 시도해 주세요.';save.textContent='다시 시도';save.disabled=false;share.disabled=true;}});
 prepare();
}

const motion=pageEffects(async()=>{
 const stopFire=await startCozyFire($('.fire'),$('.room'));
 try{const stopSnow=startCozySnow($('.snow'));return()=>{stopFire();stopSnow();};}catch(error){stopFire();throw error;}
},{onError:error=>console.error('Background motion failed:',error)});
await motion.start();await render();
async function reconnect(){
 if(preview||busy||recovering||document.hidden)return;
 recovering=true;setBusy(true);
 try{
  try{await recoverAd();}catch(error){showToast(error.message);}
  apply(await recoverExchanges());await render();
 }catch{showToast('서버 연결을 확인하지 못했어요. 모은 기록은 서버에 보관돼요.');}
 finally{recovering=false;setBusy(false);}
}
window.addEventListener('tree:home-ready',()=>{if(!preview)preloadBMAds().catch(()=>{});reconnect();});
window.addEventListener('focus',reconnect);window.addEventListener('pageshow',e=>{if(e.persisted)reconnect();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconnect();});
setInterval(()=>{if(!preview&&localDate()!==snapshot.date&&!busy&&!recovering)reconnect();},60000);

const tools=document.createElement('aside');tools.className='test-tools';
if(preview){
 const label=paragraph(`테스트 날짜 ${testDate} · 실제 광고·지급 없음`);
 const next=actionButton('다음 날 +1일',()=>run(async()=>{testDate=nextTestDate(testDate);snapshot.date=testDate;for(const s of snapshot.slots)s.dailyUsed=0;label.textContent=`테스트 날짜 ${testDate} · 실제 광고·지급 없음`;await refresh();}));
 tools.append(label,next,actionButton('처음부터',()=>location.reload()));
}
const link=document.createElement('a'),url=new URL(location.href);if(preview)url.searchParams.delete('preview');else url.searchParams.set('preview','1');link.href=url.href;link.textContent=preview?'테스트 종료':'임시 날짜 테스트';tools.append(link);document.body.append(tools);
