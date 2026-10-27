// Reuse in-flight decodes and a small LRU of decoded images for photo export.
// Keep memory bounded: compressed file size is not the decoded memory cost.
export function createImageCache({create=()=>new Image(),maxBytes=32*1024*1024,maxEntries=12}={}){
 const entries=new Map();let bytes=0;
 function trim(){
  for(const [key,entry] of entries){
   if(bytes<=maxBytes&&entries.size<=maxEntries)break;
   if(!entry.bytes)continue;
   entries.delete(key);bytes-=entry.bytes;
  }
 }
 return {load(url){
  if(entries.has(url)){const entry=entries.get(url);entries.delete(url);entries.set(url,entry);return entry.promise;}
  const entry={bytes:0,promise:null};entries.set(url,entry);
  entry.promise=(async()=>{
   const image=create();image.decoding='async';image.src=url;await image.decode();
   if(!image.naturalWidth)throw Error('이미지를 준비하지 못했어요.');
   if(entries.get(url)===entry){entry.bytes=image.naturalWidth*image.naturalHeight*4;bytes+=entry.bytes;trim();}return image;
  })().catch(error=>{if(entries.get(url)===entry)entries.delete(url);throw error;});
  return entry.promise;
 },clear(){entries.clear();bytes=0;}};
}
export const imageCache=createImageCache();
globalThis.addEventListener?.('pagehide',()=>imageCache.clear());
