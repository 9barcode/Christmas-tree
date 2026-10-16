import {slotPreview} from './slot-preview.js';
import {planterClipPath,clipPlanter} from './planter.js';
import {startCozyFire} from '../assets/backgrounds/cozy-fire.js';
import {preparePhoto,savePhoto,sharePhoto} from './photo-save.js';
import manifest from './decoration-manifest.js';
import {nextTestDate} from './test-clock.js';
import {isPaid,canShare,restartTree} from './tree-actions.js';
import {settlementFor,rewardKey,ctaText,settleWithServer,confirmedRecord,canContinue} from './settlement.js';
import {sanitizePositions,placeDecoration,defaultPosition,clampPosition,OBJECT_SIZES,floorDepth} from './placement.js';
import {startCozySnow} from '../assets/backgrounds/cozy-room.js';
import {COLORS,initialState,validateState,localDate,attend} from './state.js';
const $=s=>document.querySelector(s),KEY='christmas-tree.frontend.v1';
const preview=new URLSearchParams(location.search).get('preview')==='1';
let state;try{state=validateState(JSON.parse(localStorage.getItem(KEY)))}catch{state=initialState()}
if(preview)state=initialState();
let testDate=localDate();
const today=()=>preview?testDate:localDate();

if(!Array.isArray(manifest.assets)||manifest.assets.length!==30)throw new Error('장식 정보를 확인하지 못했어요.');
const assets=manifest.assets,sequence=[...assets.filter(a=>a.kind==='floor'),...assets.filter(a=>a.kind==='ornament').sort((a,b)=>a.originalNumber-b.originalNumber),...assets.filter(a=>a.kind==='lights'),...assets.filter(a=>a.kind==='topper')];
for(const t of state.trees)t.positions=sanitizePositions(t.positions,sequence,t.count);
let slotMenuIndex=null;
function closeSlotMenu(){document.querySelector('.slot-menu')?.remove();slotMenuIndex=null;document.querySelectorAll('.slot[aria-expanded]').forEach(b=>b.setAttribute('aria-expanded','false'));}
function toggleSlotMenu(index,anchor){const previous=slotMenuIndex;closeSlotMenu();if(previous===index)return;slotMenuIndex=index;anchor.setAttribute('aria-expanded','true');const menu=document.createElement('div');menu.className='slot-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',`${index+1}번 트리 메뉴`);const button=document.createElement('button');button.setAttribute('role','menuitem');button.textContent='↻ 새 트리 꾸미기';button.onclick=()=>{closeSlotMenu();showRestart()};menu.append(button);$('.home header').append(menu);const r=anchor.getBoundingClientRect(),header=$('.home header').getBoundingClientRect();menu.style.left=`${Math.max(0,Math.min(r.left-header.left,header.width-170))}px`;button.focus();}
document.addEventListener('click',e=>{if(!e.target.closest('.slots,.slot-menu'))closeSlotMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&slotMenuIndex!==null){const index=slotMenuIndex;closeSlotMenu();$('.slots').children[index]?.focus();}});
function currentReward(tree=state.trees[state.selected]){return tree.rewardRecord?.key===rewardKey(tree,state.selected)?tree.rewardRecord:null;}
function updateCTA(){const t=state.trees[state.selected],record=currentReward(t);$('.checkin').disabled=busy||(!settlementFor(t,today())&&!canContinue(t,today()));$('.checkin').lastChild.textContent=!busy&&isPaid(t,state.selected)?(canShare(t,state.selected)?'내 트리 자랑하기':'새 트리 꾸미기'):ctaText(t,today(),record,busy);$('.checkin').classList.toggle('gift-cta',!!settlementFor(t,today()));}
const bounds=new Map();
// Use opaque bounds so transparent export padding cannot change decoration placement.
async function geometry(path){if(bounds.has(path))return bounds.get(path);const img=new Image();img.src=path;try{await img.decode()}catch{throw Error(`이미지 준비 실패: ${path}`)};const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>16){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}const g={box:`${x0} ${y0} ${x1-x0+1} ${y1-y0+1}`,w:img.width,h:img.height};bounds.set(path,g);return g;}
async function assetNode(path,className){const el=document.createElement('div');el.className=className;const g=await geometry(path);el.innerHTML=`<svg viewBox="${g.box}" preserveAspectRatio="none" aria-hidden="true"><image href="${path}" width="${g.w}" height="${g.h}"/></svg>`;return el;}
async function updateSlotPreview(index){const t=state.trees[index],button=$('.slots').children[index];if(!t||!button)return;const signature=JSON.stringify(t);const svg=await slotPreview(t,sequence,geometry,index);if(!button.isConnected||signature!==JSON.stringify(state.trees[index]))return;let preview=button.querySelector('.slot-preview');if(!preview){preview=document.createElement('div');preview.className='slot-preview';button.querySelector('img')?.replaceWith(preview)}preview.innerHTML=svg;button.setAttribute('aria-label',`${index+1}번 트리, 장식 ${t.count}/30${isPaid(t,index)?', 새 트리 꾸미기 메뉴':''}`);}
let renderId=0;
async function render(){closeSlotMenu();const id=++renderId,t=state.trees[state.selected];$('.slots').replaceChildren(...Array.from({length:5},(_,i)=>{const b=document.createElement('button');b.className='slot'+(i===state.selected?' selected':'');b.setAttribute('aria-label',`${i+1}번 트리${state.trees[i]?'':' 잠김'}`);b.setAttribute('aria-pressed',String(i===state.selected));if(!state.trees[i])b.classList.add('is-locked');b.innerHTML=state.trees[i]?`<img src="assets/trees/tree-${state.trees[i].color}.png" alt=""><span>${i+1}</span>`:`<span class="lock" aria-hidden="true"><svg viewBox="0 0 32 36"><path d="M8 15V10a8 8 0 0 1 16 0v5" fill="none" stroke="currentColor" stroke-width="5"/><rect x="3" y="14" width="26" height="21" rx="4" fill="currentColor"/><path d="M16 21v7" stroke="#69452b" stroke-width="3"/></svg></span><span>${i+1}</span>`;if(isPaid(state.trees[i],i)){b.classList.add('can-restart');b.insertAdjacentHTML('beforeend','<span class="restart-badge" aria-hidden="true">↻</span>');if(i===state.selected){b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded',String(slotMenuIndex===i));b.setAttribute('aria-label',`${i+1}번 트리, 새 트리 꾸미기 메뉴`);}}b.onclick=()=>{if(busy)return;if(!state.trees[i])return showToast('앞 트리의 첫 출석을 완료하면 열려요');if(i===state.selected&&isPaid(state.trees[i],i)){toggleSlotMenu(i,b);return;}closeSlotMenu();state.selected=i;save();render()};return b}));$('.progress').textContent=`${['첫 번째','두 번째','세 번째','네 번째','다섯 번째'][state.selected]} 트리 · 장식 ${t.count}/30`;updateCTA();if(settlementFor(t,today())){$('.progress').textContent=`${treeNames[state.selected]} 트리 · 모은 장식 ${t.count}개`;}
const tree=await assetNode(`assets/trees/tree-${t.color}.png`,'tree'),pot=await assetNode('assets/planters/planter-wood.png','pot');
// The rear rim sits behind the trunk; the front wall covers its base.
const potBack=await assetNode('assets/planters/planter-wood.png','pot-back');pot.style.clipPath=planterClipPath(true);potBack.style.clipPath=planterClipPath(false);
bindObject(pot,'pot','__pot',t,t.positions?.__pot??defaultPosition('pot'),potBack);
const ornaments=[],floor=[];let n=0,f=0;
for(const a of sequence.slice(0,t.count)){
 const node=await assetNode(a.path,a.kind==='floor'?'floor-item':'ornament '+(a.kind==='topper'?'topper':a.kind==='lights'?'lights':''));
 const index=a.kind==='floor'?f++:a.kind==='ornament'?n++:0;
 if(['lights','topper'].includes(a.kind))bindFixed(node,a.kind,t);else bindObject(node,a.kind,a.id,t,t.positions?.[a.id]??defaultPosition(a.kind,index));
 if(a.kind==='floor')floor.push(node);else ornaments.push(node);
}
if(id!==renderId)return;$('.pot-back')?.remove();$('.garden').prepend(potBack);$('.tree').replaceWith(tree);$('.pot').replaceWith(pot);$('.ornaments').replaceChildren(...ornaments);$('.floor').replaceChildren(...floor);await Promise.all(state.trees.map((_,i)=>updateSlotPreview(i)));}
function fixedPosition(kind,treePosition){const p=defaultPosition(kind),base=defaultPosition('tree');return {x:p.x+treePosition.x-base.x,y:p.y+treePosition.y-base.y};}
function bindFixed(node,kind,tree){const p=defaultPosition(kind),size=OBJECT_SIZES[kind];node.classList.add('fixed-decoration');node.style.width=`${size.w}%`;node.style.height=`${size.h}%`;node.style.left=`${p.x}%`;node.style.top=`${p.y}%`;}
function bindObject(node,kind,id,tree,position,back=null){
 const size=OBJECT_SIZES[kind];let current=clampPosition(kind,position.x,position.y,tree.count===30);node.classList.add('draggable');node.dataset.id=id;node.style.width=`${size.w}%`;node.style.height=`${size.h}%`;
 const editable=()=>!settlementFor(tree,today());node.setAttribute('aria-label',({tree:'트리',pot:'화분',floor:'바닥 장식',ornament:'오너먼트',topper:'별',lights:'전구 줄'})[kind]+' 위치 옮기기');node.setAttribute('role','button');node.tabIndex=editable()?0:-1;
 function paint(){const depth=floorDepth(kind,current.y);if(depth!==null)node.style.zIndex=String(depth);if(back){back.style.width=node.style.width;back.style.height=node.style.height;back.style.left=`${current.x}%`;back.style.top=`${current.y}%`;}node.style.left=`${current.x}%`;node.style.top=`${current.y}%`;if(kind==='tree')for(const fixedKind of ['topper','lights']){const fixed=$('.ornament.'+fixedKind);if(fixed){const p=fixedPosition(fixedKind,current);fixed.style.left=`${p.x}%`;fixed.style.top=`${p.y}%`;}}}
 paint();let drag=null;
 node.onpointerdown=e=>{if(busy||!editable()||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();e.stopPropagation();const r=$('.garden').getBoundingClientRect();drag={pointer:e.pointerId,x:e.clientX,y:e.clientY,start:{...current},rect:r};node.setPointerCapture(e.pointerId);node.classList.add('is-dragging');$('.home').classList.add('dragging');setBusy(true);};
 node.onpointermove=e=>{if(!drag||e.pointerId!==drag.pointer)return;e.preventDefault();current=clampPosition(kind,drag.start.x+(e.clientX-drag.x)/drag.rect.width*100,drag.start.y+(e.clientY-drag.y)/drag.rect.height*100,tree.count===30);paint();};
 function finish(e,cancel){if(!drag||e.pointerId!==drag.pointer)return;if(cancel){current=drag.start;paint()}else{placeDecoration(tree,sequence,id,current.x,current.y);save();updateSlotPreview(state.selected)}drag=null;node.classList.remove('is-dragging');$('.home').classList.remove('dragging');setBusy(false);if(node.hasPointerCapture(e.pointerId))node.releasePointerCapture(e.pointerId);}
 node.onpointerup=e=>finish(e,false);node.onpointercancel=e=>finish(e,true);node.onlostpointercapture=e=>{if(drag)finish(e,true)};
 node.onkeydown=e=>{if(busy||!editable())return;const deltas={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},d=deltas[e.key];if(!d)return;e.preventDefault();const step=e.shiftKey?3:1;current=clampPosition(kind,current.x+d[0]*step,current.y+d[1]*step,tree.count===30);paint();placeDecoration(tree,sequence,id,current.x,current.y);save();updateSlotPreview(state.selected);};
}

function save(){if(!preview)try{localStorage.setItem(KEY,JSON.stringify(state))}catch{showToast('기기에 진행도를 저장하지 못했어요')}}
let toastTimer;function showToast(text){$('.toast').textContent=text;$('.toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('.toast').hidden=true,3500)}
let busy=false;
function setBusy(value){busy=value;$('.home').setAttribute('aria-busy',String(value));document.querySelectorAll('.slots button,.home-links button').forEach(b=>b.disabled=value);updateCTA();}
async function claimPoints(){if(preview){const t=state.trees[state.selected];t.rewardRecord={key:rewardKey(t,state.selected),rewardRef:`test-${Date.now()}`,amount:settlementFor(t,today()).amount,status:'paid'};await render();showToast('테스트 수령 완료 · 실제 포인트는 지급되지 않아요.');return;}const index=state.selected,t=state.trees[index],key=rewardKey(t,index);let expected=currentReward(t)?.rewardRef;try{let result;if(currentReward(t)?.status==='pending'){if(!window.treeRewards?.getStatus)throw Error('포인트 내역 연결을 준비하고 있어요. 모은 기록은 그대로 보관돼요.');result=await window.treeRewards.getStatus({treeId:index+1,cycle:t.cycle||0,rewardRef:expected});}else result=await settleWithServer({api:window.treeRewards,ads:window.treeAds,treeId:index+1,cycle:t.cycle||0,onReserved:p=>{expected=p.rewardRef;t.rewardRecord={key,rewardRef:p.rewardRef,amount:p.amount,status:p.status==='paid'?'pending':p.status==='pending'?'pending':'ready'};save();},onClaimStarted:()=>{t.rewardRecord.status='pending';save();}});t.rewardRecord={key,...confirmedRecord(result,expected)};save();showToast(t.rewardRecord.status==='paid'?`트리의 선물 ${t.rewardRecord.amount}P를 받았어요!`:t.rewardRecord.status==='pending'?'모은 포인트를 확인하고 있어요. 기록은 그대로 보관돼요.':'광고 보고 트리의 선물을 받아 보세요.');await render();}catch(error){showToast(error.message||'모은 포인트를 확인하고 있어요. 기록은 그대로 보관돼요.');}}
$('.checkin').onclick=async()=>{const target=state.trees[state.selected];if(busy)return;if(isPaid(target,state.selected)){if(canShare(target,state.selected))showShare();else showRestart();return;}if(settlementFor(target,today())){if(currentReward(target)?.status==='paid')return;setBusy(true);try{await claimPoints()}finally{setBusy(false)}return;}if(!canContinue(target,today()))return;setBusy(true);try{if(!preview){const ad=window.treeAds;if(!ad?.showRewarded)return showToast('광고 연결을 준비하고 있어요. 연결 후 출석할 수 있어요.');const result=await ad.showRewarded();if(result?.rewarded!==true)return showToast('광고 시청을 완료하면 장식을 받을 수 있어요.');}const date=today();if(attend(state,date,COLORS[Math.floor(Math.random()*COLORS.length)])){save();await render();}}catch{showToast('출석 상태를 확인하고 있어요. 잠시 후 다시 눌러 주세요.');}finally{setBusy(false)}};
const treeNames=['첫 번째','두 번째','세 번째','네 번째','다섯 번째'];
function openModal(title,content){const container=$('.modal-content');container.replaceChildren();$('dialog').classList.toggle('guide-dialog',title==='트리 꾸미기 이용안내');$('dialog').classList.toggle('rewards-dialog',title==='출석 도장 · 보상 내역');const h=document.createElement('h2');h.id='modal-title';h.textContent=title;container.append(h,content);$('dialog').setAttribute('aria-labelledby','modal-title');$('dialog').showModal();}
function showGuide(){if(busy)return;const content=document.createElement('div');content.className='guide-content';const cards=[
 ['assets/ornaments/bell-brass.png','광고 보고 하루 한 번 출석','매일 출석해 트리를 꾸며요. 결석하면 꾸미기가 끝나고, 모은 선물을 받아요.'],
 ['assets/ornaments/reindeer.png','출석하면 루돌프 도장 꾹!','보상 내역에서 선택한 트리의 출석표를 확인해요.'],
 ['assets/trees/tree-pink.png','첫 출석으로 다음 트리를 열어요','같은 날에도 차례로 출석하면 최대 5개를 키울 수 있어요.'],
 ['assets/decorations/gift-burgundy.png','원하는 곳으로 옮겨 꾸며요','화분과 장식을 잡아서 원하는 곳으로 옮겨요. 트리와 별, 전구 줄은 고정이에요.'],
 ['assets/toppers/star-gold.png','30번째 출석에는 반짝이는 별','나만의 트리를 완성해요. 별과 전구 줄은 트리의 정해진 자리에 놓여요.']
 ];for(const [src,title,description] of cards){const card=document.createElement('article');card.className='guide-card';const img=document.createElement('img');img.src=src;img.alt='';const copy=document.createElement('div'),strong=document.createElement('strong'),p=document.createElement('p');strong.textContent=title;p.textContent=description;copy.append(strong,p);card.append(img,copy);content.append(card)}const confirm=document.createElement('button');confirm.className='modal-primary';confirm.textContent='알겠어요';confirm.onclick=()=>$('dialog').close();content.append(confirm);openModal('트리 꾸미기 이용안내',content);}
function showRewards(){if(busy)return;const t=state.trees[state.selected],content=document.createElement('div');const info=document.createElement('p');info.className='calendar-summary';info.textContent=`${treeNames[state.selected]} 트리 · 누적 ${t.count}일 출석`;const note=document.createElement('p');note.className='calendar-note';note.textContent='출석한 날마다 루돌프 도장이 찍혀요.';const settlement=settlementFor(t,today());const points=document.createElement('p');points.className='calendar-summary';points.textContent=settlement?`모은 출석 보상 ${settlement.amount}P`:`차곡차곡 모은 출석 보상 ${t.count*(t.count+1)/2}P`;const record=currentReward(t);if(record?.status==='paid')points.textContent=`받은 출석 보상 ${record.amount}P`;content.append(info,note,points);const grid=document.createElement('ol');grid.className='stamp-calendar';grid.setAttribute('aria-label','30일 출석 도장표');for(let i=1;i<=30;i++){const cell=document.createElement('li'),done=i<=t.count;cell.className='stamp-cell'+(done?' is-complete':'')+(i===t.count+1?' is-next':'');cell.setAttribute('aria-label',`${i}일차, ${done?'출석 완료':'미출석'}`);const label=document.createElement('span');label.className='stamp-day';label.textContent=`${i}일차`;const mark=document.createElement('div');mark.className='stamp-mark';if(done){const stamp=document.createElement('div');stamp.className='rudolph-stamp';const img=document.createElement('img');img.src=i===30?'assets/toppers/star-gold.png':'assets/ornaments/reindeer.png';img.alt=i===30?'완성 별':'';const text=document.createElement('span');text.className='stamp-word';text.textContent='출석';stamp.append(img,text);mark.append(stamp)}else{mark.classList.add('stamp-empty')}const reward=document.createElement('span');reward.className='stamp-detail';reward.textContent=i===30?'별 완성':'장식 1개';cell.append(label,mark,reward);grid.append(cell)}content.append(grid);const foot=document.createElement('p');foot.className='calendar-note';foot.textContent='각 트리의 출석표는 따로 쌓여요. 위쪽 슬롯에서 다른 트리를 선택해 보세요.';content.append(foot);openModal('출석 도장 · 보상 내역',content);}
$('.guide-link').onclick=showGuide;$('.rewards-link').onclick=showRewards;$('.close').onclick=()=>$('dialog').close();
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('dialog').close()}});
const stopFire=await startCozyFire($('.fire'),$('.room'));window.addEventListener('pagehide',stopFire,{once:true});
const stop=startCozySnow($('.snow'));window.addEventListener('pagehide',stop,{once:true});await render();

let currentDay=today();
function refreshAttendanceDay(){if(document.hidden||busy)return;const next=today();if(next===currentDay)return;currentDay=next;render().catch(()=>showToast('출석 화면을 다시 확인하지 못했어요. 앱을 다시 열어 주세요.'));}
window.addEventListener('focus',refreshAttendanceDay);document.addEventListener('visibilitychange',refreshAttendanceDay);const dayTimer=setInterval(refreshAttendanceDay,60000);window.addEventListener('pagehide',()=>clearInterval(dayTimer),{once:true});

// Export only the scene layers, preserving the user's actual decoration positions.
async function treePicture(){
 const home=$('.home'),rect=home.getBoundingClientRect(),canvas=document.createElement('canvas');
 canvas.width=1080;canvas.height=Math.round(rect.height/rect.width*1080)+140;
 const ctx=canvas.getContext('2d'),scale=1080/rect.width;
 ctx.fillStyle='#fff1d7';ctx.fillRect(0,0,canvas.width,canvas.height);
 const room=$('.room');await room.decode();ctx.drawImage(room,0,0,1080,rect.height*scale);
 const nodes=[...document.querySelectorAll('.pot-back,.tree,.pot,.ornament,.floor-item')].sort((a,b)=>(parseInt(getComputedStyle(a).zIndex)||0)-(parseInt(getComputedStyle(b).zIndex)||0));
 for(const node of nodes){const svg=node.querySelector('svg'),source=svg?.querySelector('image');if(!source)continue;const img=new Image();img.src=source.getAttribute('href');await img.decode();const [x,y,w,h]=svg.getAttribute('viewBox').split(' ').map(Number),r=node.getBoundingClientRect();const dx=(r.left-rect.left)*scale,dy=(r.top-rect.top)*scale,dw=r.width*scale,dh=r.height*scale;ctx.save();if(node.classList.contains('pot')||node.classList.contains('pot-back'))clipPlanter(ctx,dx,dy,dw,dh,node.classList.contains('pot'));ctx.drawImage(img,x,y,w,h,dx,dy,dw,dh);ctx.restore();}
 await document.fonts.ready;ctx.fillStyle='#75391f';ctx.textAlign='center';ctx.font='42px Jua, sans-serif';ctx.fillText('30일 동안 정성껏 꾸민 나의 트리',540,canvas.height-58);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('사진을 준비하지 못했어요. 다시 눌러 주세요.')),'image/png'));
}
function actionButton(text,handler){const b=document.createElement('button');b.className='modal-primary';b.textContent=text;b.onclick=handler;return b;}
function showShare(){
 if(!canShare(state.trees[state.selected],state.selected))return;
 const content=document.createElement('div'),note=document.createElement('p');note.textContent='트리 사진을 준비하고 있어요.';content.append(note);
 let picture=null;const index=state.selected,source=state.trees[index];
 const run=async(button,withGreeting=false)=>{if(busy||!picture)return;button.disabled=true;setBusy(true);note.textContent='열린 메뉴에서 이미지 저장 또는 보낼 앱을 선택해 주세요.';try{const result=await (withGreeting?sharePhoto(picture):savePhoto(picture));note.textContent=withGreeting?'트리 사진과 크리스마스 인사말을 함께 공유해요.':result==='download'?'다운로드 내역에서 트리 사진을 확인해 주세요.':'사진을 앨범에 넣으려면 메뉴에서 이미지 저장을 선택해 주세요.';}catch(error){note.textContent=error.name==='AbortError'?'취소했어요. 다시 눌러 주세요.':withGreeting?(error.message||'사진을 공유하지 못했어요. 다시 눌러 주세요.'):'사진을 저장하지 못했어요. 다시 눌러 주세요.';}finally{button.disabled=false;setBusy(false)}};
 const save=actionButton('사진으로 저장하기',()=>run(save)),share=actionButton('친구에게 보내기',()=>run(share,true));save.disabled=share.disabled=true;content.append(save,share);openModal('내 트리 자랑하기',content);
 // Prepare before the tap so native sharing retains the user's activation on mobile.
 treePicture().then(preparePhoto).then(photo=>{if(state.selected!==index||state.trees[index]!==source||!content.isConnected)return;picture=photo;note.textContent='정성껏 꾸민 트리를 사진으로 간직해요.';save.disabled=share.disabled=false;}).catch(()=>{note.textContent='사진을 준비하지 못했어요. 창을 닫고 다시 눌러 주세요.';});
}
function showRestart(){
 const index=state.selected,tree=state.trees[index];if(!isPaid(tree,index))return;
 const content=document.createElement('div'),note=document.createElement('p');note.className='calendar-note';note.textContent=tree.count===30?'완성한 트리를 사진으로 간직할까요? 새로 시작하면 이 슬롯의 장식과 출석표가 새롭게 시작돼요.':'새로운 트리를 함께 꾸며 볼까요? 이 슬롯의 장식과 출석표가 새롭게 시작돼요.';content.append(note);
 if(tree.count===30){const save=actionButton('사진으로 저장하기',async()=>{if(busy)return;save.disabled=true;setBusy(true);try{await savePhoto(await preparePhoto(await treePicture()));note.textContent='사진 저장을 마쳤다면 아래 버튼으로 새로 꾸며 보세요.';}catch{note.textContent='사진을 저장하지 못했어요. 다시 눌러 주세요.';}finally{save.disabled=false;setBusy(false)}});content.append(save)}
 async function start(){if(state.selected!==index||!restartTree(state,index,today()))return;save();$('dialog').close();await render();showToast('새로운 트리가 기다리고 있어요!');}
 content.append(actionButton('바로 새로 꾸미기',()=>{if(!busy)start()}));openModal('새 트리 꾸미기',content);
}


const testTools=document.createElement('aside');testTools.className='test-tools';testTools.setAttribute('aria-label','임시 프론트엔드 날짜 테스트');
if(preview){
 const label=document.createElement('p');label.setAttribute('aria-live','polite');
 const updateLabel=()=>label.textContent=`테스트 날짜 ${testDate} · 실제 광고·지급 없음`;updateLabel();
 const next=document.createElement('button');next.textContent='다음 날 +1일';next.onclick=async()=>{if(busy)return;if($('dialog').open)$('dialog').close();closeSlotMenu();testDate=nextTestDate(testDate);currentDay=testDate;updateLabel();setBusy(true);try{await render()}finally{setBusy(false)}};
 const reset=document.createElement('button');reset.textContent='처음부터';reset.onclick=()=>{if(!busy)location.reload()};
 const back=document.createElement('a');back.textContent='테스트 종료';const url=new URL(location.href);url.searchParams.delete('preview');back.href=url.href;
 testTools.append(label,next,reset,back);
}else{
 const launch=document.createElement('a');const url=new URL(location.href);url.searchParams.set('preview','1');launch.href=url.href;launch.textContent='임시 날짜 테스트';testTools.append(launch);
}
document.body.append(testTools);
