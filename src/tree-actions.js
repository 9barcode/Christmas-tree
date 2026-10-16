import {rewardKey,settlementFor} from './settlement.js';
export function isPaid(tree,index){return tree?.rewardRecord?.key===rewardKey(tree,index)&&tree.rewardRecord.status==='paid';}
export function canShare(tree,index){return tree?.count===30&&isPaid(tree,index);}
export function restartTree(state,index,today){
 const tree=state.trees[index];
 if(!tree||!settlementFor(tree,today)||!isPaid(tree,index))return false;
 state.trees[index]={color:tree.color,count:0,lastDate:null,positions:{},cycle:(tree.cycle||0)+1};
 return true;
}
