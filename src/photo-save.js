export const CHRISTMAS_GREETING='당신의 겨울에 따뜻한 순간이 가득하길.\n다가오는 새해에도 건강과 행복이 늘 함께하길 바랍니다.\n메리 크리스마스 🎄';

function base64Of(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('사진을 준비하지 못했어요. 다시 눌러 주세요.'));reader.readAsDataURL(blob)});}

// Prepare before the tap, so mobile save/share retains the user's activation.
export async function preparePhoto(blob,{native=!!globalThis.window?.ReactNativeWebView,loadNative=()=>import('./native-file.js'),readBase64=base64Of}={}){
 if(native){const [sdk,data]=await Promise.all([loadNative(),readBase64(blob)]);return {native:true,blob,file:new File([blob],'my-christmas-tree.png',{type:'image/png'}),save:()=>sdk.saveNativePhoto(data)};}
 return {native:false,blob,file:new File([blob],'my-christmas-tree.png',{type:'image/png'})};
}

export async function savePhoto(photo,{nav=globalThis.navigator,doc=globalThis.document,urls=globalThis.URL}={}){
 if(photo.native){await photo.save();return 'native';}
 if(nav?.share&&nav.canShare?.({files:[photo.file]})){await nav.share({files:[photo.file]});return 'share';}
 const url=urls.createObjectURL(photo.blob),a=doc.createElement('a');a.href=url;a.download='my-christmas-tree.png';doc.body.append(a);a.click();a.remove();setTimeout(()=>urls.revokeObjectURL(url),60000);return 'download';
}

export async function sharePhoto(photo,{nav=globalThis.navigator}={}){
 const payload={files:[photo.file],text:CHRISTMAS_GREETING};
 if(!nav?.share||!nav.canShare?.(payload))throw Error('이 기기에서는 사진과 인사말을 함께 공유할 수 없어요. 사진으로 저장하기를 이용해 주세요.');
 await nav.share(payload);return 'share';
}
