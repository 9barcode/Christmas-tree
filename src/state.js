import {canContinue} from './settlement.js';
export const COLORS=['green','white','pink','blue','gold'];
export function initialState(){return {version:1,selected:0,trees:[{color:'green',count:0,lastDate:null}]};}
export function localDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function validateState(value){
 if(value?.version!==1||!Array.isArray(value.trees)||value.trees.length<1||value.trees.length>5)return initialState();
 const trees=Array.from(value.trees,t=>t??null);
 if(trees[0]?.color!=='green'||trees.some(t=>t!==null&&(!COLORS.includes(t.color)||!Number.isInteger(t.count)||t.count<0||t.count>30||(t.lastDate!==null&&typeof t.lastDate!=='string'))))return initialState();
 return {...value,trees,selected:Number.isInteger(value.selected)&&trees[value.selected]?value.selected:0};
}
export function createTree(state,index,color){
 if(!Number.isInteger(index)||index<1||index>4||state.trees[index])return false;
 while(state.trees.length<=index)state.trees.push(null);
 state.trees[index]={color:COLORS.includes(color)?color:'green',count:0,lastDate:null};
 state.selected=index;return true;
}
export function attend(state,date){const tree=state.trees[state.selected];if(!tree||!canContinue(tree,date))return false;tree.count++;tree.lastDate=date;return true;}
