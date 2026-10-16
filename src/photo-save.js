function base64Of(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('사진을 준비하지 못했어요. 다시 눌러 주세요.'));reader.readAsDataURL(blob)});}

// Prepare before the tap, so mobile save/share retains the user's activation.
export async function preparePhoto(blob,{native=!!globalThis.window?.ReactNativeWebView,loadNative=()=>import('./native-file.js'),readBase64=base64Of}={}){
 if(native){const [sdk,data]=await Promise.all([loadNative(),readBase64(blob)]);return {native:true,save:()=>sdk.saveNativePhoto(data)};}
 return {native:false,blob,file:new File([blob],'my-christmas-tree.png',{type:'image/png'})};
}

export async function savePhoto(photo,{nav=globalThis.navigator,doc=globalThis.document,urls=globalThis.URL}={}){
 if(photo.native){await photo.save();return 'native';}
 if(nav?.share&&nav.canShare?.({files:[photo.file]})){await nav.share({files:[photo.file]});return 'share';}
 const url=urls.createObjectURL(photo.blob),a=doc.createElement('a');a.href=url;a.download='my-christmas-tree.png';doc.body.append(a);a.click();a.remove();setTimeout(()=>urls.revokeObjectURL(url),60000);return 'download';
}
