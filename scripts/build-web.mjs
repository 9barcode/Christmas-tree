import {cp,mkdir,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {buildApiBase} from './api-config.mjs';
const release=process.argv.includes('--release')||process.env.NODE_ENV==='production';
const configuredBase=buildApiBase(process.env.TREE_API_BASE_URL,{release});
const out=new URL('../dist/toss/',import.meta.url);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const path of ['index.html','src','assets'])await cp(new URL(`../${path}`,import.meta.url),new URL(path,out),{recursive:true});
const art=[];const hash=createHash('sha256');
async function scan(path){
 for(const entry of (await readdir(new URL(path,out),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const file=path+entry.name;
  if(entry.isDirectory())await scan(file+'/');
  else if(/\.(png|webp|jpe?g|svg|gif|woff2?)$/i.test(file)){art.push(file);hash.update(file);hash.update(await readFile(new URL(file,out)));}
 }
}
await scan('assets/');
const version=hash.digest('hex').slice(0,20);
// Scope-relative allowlist works both at the origin root and a hosted app subpath.
const worker=(await readFile(new URL('../asset-cache-worker.js',import.meta.url),'utf8'))
 .replace('__ASSET_VERSION__',version).replace('__ASSET_PATHS__',JSON.stringify(art)+'.map(path=>new URL(path,self.registration.scope).pathname)');
await writeFile(new URL('asset-cache-worker.js',out),worker);
await writeFile(new URL('src/api-base.js',out), 'export const apiBaseUrl = ' + JSON.stringify(configuredBase) + ';\n');
console.log('API origin:',configuredBase||'(same origin: local development)');
await build({entryPoints:[new URL('../src/native-file.js',import.meta.url).pathname],outfile:new URL('src/native-file.js',out).pathname,bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true});
await build({entryPoints:[new URL('../src/native-promotions.js',import.meta.url).pathname],outfile:new URL('src/native-promotions.js',out).pathname,bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true});
await build({entryPoints:[new URL('../src/native-banner.js',import.meta.url).pathname],outfile:new URL('src/native-banner.js',out).pathname,bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true});
console.log('Prepared dist/toss (HTML, modules, styles and local assets)');
