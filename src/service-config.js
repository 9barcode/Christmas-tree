import { apiBaseUrl } from './api-base.js';
let pending;
export function loadServiceConfig() {
  if (!pending) pending = (async () => {
    const response = await fetch(apiBaseUrl.replace(/\/$/, '') + '/api/config', {
      signal: AbortSignal.timeout(8000), credentials: 'omit', cache: 'no-store',
    });
    if (!response.ok) throw Error('광고 설정을 불러오지 못했어요.');
    const config = await response.json();
    if (typeof config?.ads?.bannerAdGroupId !== 'string' ||
        ![1,2,3,4,5].every(treeId => typeof config?.ads?.rewardedAdGroupIds?.[treeId] === 'string')) throw Error('광고 설정을 확인해 주세요.');
    return Object.freeze({ ads: Object.freeze({
      bannerAdGroupId: config.ads.bannerAdGroupId.trim(),
      loadingListAdGroupId: typeof config.ads.loadingListAdGroupId==='string'?config.ads.loadingListAdGroupId.trim():'',
      loadingImageAdGroupId: typeof config.ads.loadingImageAdGroupId==='string'?config.ads.loadingImageAdGroupId.trim():'',
      rewardedAdGroupIds: Object.freeze(Object.fromEntries([1,2,3,4,5].map(treeId =>
        [treeId, config.ads.rewardedAdGroupIds[treeId].trim()]))),
    }) });
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
