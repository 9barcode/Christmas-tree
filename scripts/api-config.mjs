// Public address of the existing Treemoa Worker; ad IDs remain runtime settings.
export const defaultApiBaseUrl='https://treemoa.bluehawhy.workers.dev';
export function buildApiBase(value,{release=false}={}){
 const base=(value||'').trim().replace(/\/+$/,'')||(release?defaultApiBaseUrl:'');
 if(!base)return '';
 let url;try{url=new URL(base);}catch{throw Error('TREE_API_BASE_URL must be a valid HTTPS origin');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'){
  throw Error('TREE_API_BASE_URL must be an HTTPS origin without /api, credentials, query or fragment');
 }
 return url.origin;
}
