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
        typeof config?.ads?.rewardedAdGroupId !== 'string') throw Error('광고 설정을 확인해 주세요.');
    return Object.freeze({ ads: Object.freeze({
      bannerAdGroupId: config.ads.bannerAdGroupId.trim(),
      rewardedAdGroupId: config.ads.rewardedAdGroupId.trim(),
    }) });
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
