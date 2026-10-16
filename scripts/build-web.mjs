import {cp,mkdir,rm} from 'node:fs/promises';
const out=new URL('../dist/toss/',import.meta.url);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const path of ['index.html','src','assets'])await cp(new URL(`../${path}`,import.meta.url),new URL(path,out),{recursive:true});
console.log('Prepared dist/toss (HTML, modules, styles and local assets)');
