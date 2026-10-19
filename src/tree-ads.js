import {loadServiceConfig} from './service-config.js';

export async function showTreeRewarded(treeId, options = {}) {
  if (!Number.isInteger(treeId) || treeId < 1 || treeId > 5) throw Error('트리 번호를 확인해 주세요.');
  const {ads} = await loadServiceConfig();
  const adGroupId = ads.rewardedAdGroupIds[treeId];
  if (!adGroupId) throw Error(treeId + '번 트리의 리워드 광고 설정이 필요해요.');
  if (!window.treeAds?.showRewarded) throw Error('광고 연결을 준비하고 있어요.');
  // Explicit ID overrides caller options; never substitute another tree's ad.
  return window.treeAds.showRewarded({...options, treeId, adGroupId});
}
