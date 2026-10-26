const value = input => typeof input === 'string' ? input.trim() : '';
export function publicAdConfig(env) {
  return {
    interstitialAdGroupId: value(env.INTER_AD_GROUP_ID),
    bannerTextAdGroupId: value(env.BANNER_AD_GROUP_ID),
    bannerImageAdGroupId: value(env.BANNER_IMG_AD_GROUP_ID),
    bannerAdGroupId: value(env.BANNER_AD_GROUP_ID),
    rewardedAdGroupId: value(env.REWARDED_AD_GROUP_ID),
  };
}
