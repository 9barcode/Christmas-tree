import {cp,mkdir,rm} from 'node:fs/promises';
import {build} from 'esbuild';
const out=new URL('../dist/toss/',import.meta.url);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const path of ['index.html','src','assets'])await cp(new URL(`../${path}`,import.meta.url),new URL(path,out),{recursive:true});
await build({entryPoints:[new URL('../src/native-file.js',import.meta.url).pathname],outfile:new URL('src/native-file.js',out).pathname,bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true});
console.log('Prepared dist/toss (HTML, modules, styles and local assets)');
