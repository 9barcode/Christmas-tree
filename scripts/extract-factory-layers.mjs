import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {layers,rollers} from '../src/factory-scene-layers.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=join(root,'assets/factory/concept-original.webp');
const out=join(root,'assets/factory/original');mkdirSync(out,{recursive:true});
const temp=mkdtempSync(join(tmpdir(),'factory-source-layers-'));
function extract(id,rect,draw){
 const [x,y,w,h]=rect,mask=join(temp,id+'-mask.png');
 execFileSync('convert',['-size','512x1024','xc:black','-fill','white','-stroke','none','-draw',draw,mask]);
 execFileSync('convert',[source,mask,'-alpha','off','-compose','CopyOpacity','-composite','-crop',`${w}x${h}+${x}+${y}`,'+repage','-define','webp:lossless=true',join(out,id+'.webp')]);
}
for(const layer of layers)extract(layer.id,layer.rect,`path '${layer.path}'`);
rollers.forEach(({x,y,rx,ry},i)=>extract('roller-'+i,[x-rx,y-ry,rx*2,ry*2],`ellipse ${x},${y} ${rx},${ry} 0,360`));
execFileSync('convert',[source,'-crop','38x15+169+438','+repage','-define','webp:lossless=true',join(out,'belt-tile.webp')]);
console.log('Extracted original pixels into assets/factory/original (no generated characters).');
