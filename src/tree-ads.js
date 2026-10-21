import {loadServiceConfig} from './service-config.js';

export async function showTreeRewarded(treeId, options = {}) {
  if (!Number.isInteger(treeId) || treeId < 1 || treeId > 5) throw Error('트리 번호를 확인해 주세요.');
  const {ads} = await loadServiceConfig();
  const adGroupId = ads.rewardedAdGroupId;
  if (!adGroupId) throw Error('리워드 광고 설정이 필요해요.');
  const show = window.treeAds?.showRewarded?.bind(window.treeAds) || (await import('./native-promotions.js')).showNativeRewarded;
  // All trees share one rewarded ID; treeId still identifies the business operation.
  const result = await show({...options, treeId, adGroupId});
  return {...result, adGroupId, eventType: result?.rewarded === true ? 'userEarnedReward' : 'dismissed'};
}

export async function showTreeInterstitial(options = {}) {
  const {ads} = await loadServiceConfig();
  const adGroupId = ads.interstitialAdGroupId;
  if (!adGroupId) throw Error('전면 광고 설정이 필요해요.');
  const show = window.treeAds?.showInterstitial?.bind(window.treeAds) || (await import('./native-promotions.js')).showNativeInterstitial;
  const result = await show({...options, adGroupId});
  return {...result, adGroupId, eventType: result?.dismissed === true ? 'dismissed' : 'not_completed'};
}
