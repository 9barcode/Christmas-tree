import { apiBaseUrl } from './api-base.js';
import {readApiResponse} from './api-response.js';
let pending;
export function loadServiceConfig() {
  if (!pending) pending = (async () => {
    const response = await fetch(apiBaseUrl.replace(/\/$/, '') + '/api/config', {
      signal: AbortSignal.timeout(8000), credentials: 'omit', cache: 'no-store',
    });
    if (!response.ok) throw Error('광고 설정을 불러오지 못했어요.');
    const config = await readApiResponse(response);
    if (!config?.ads||typeof config.ads!=='object'||Array.isArray(config.ads)) throw Error('광고 설정을 확인해 주세요.');
    return Object.freeze({ ads: Object.freeze({
      interstitialAdGroupId: typeof config.ads.interstitialAdGroupId==='string'?config.ads.interstitialAdGroupId.trim():'',
      bannerTextAdGroupId: typeof config.ads.bannerTextAdGroupId==='string'?config.ads.bannerTextAdGroupId.trim():'',
      bannerImageAdGroupId: typeof config.ads.bannerImageAdGroupId==='string'?config.ads.bannerImageAdGroupId.trim():'',
      rewardedAdGroupId: typeof config.ads.rewardedAdGroupId==='string'?config.ads.rewardedAdGroupId.trim():'',
    }) });
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
