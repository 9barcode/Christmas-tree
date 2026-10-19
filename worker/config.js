const value = input => typeof input === 'string' ? input.trim() : '';
export function publicAdConfig(env) {
  return {
    bannerAdGroupId: value(env.BANNER_AD_GROUP_ID),
    rewardedAdGroupId: value(env.REWARDED_AD_GROUP_ID),
  };
}
// Server-only: never return promotion codes through public configuration APIs.
export function promotionConfig(env) {
  const mode = value(env.TOSS_PROMOTION_MODE) || 'live';
  if (!['live', 'test'].includes(mode)) throw Error('Invalid TOSS_PROMOTION_MODE');
  const configured = value(env.TOSS_PROMOTION_CODE_ATTENDANCE);
  if (mode === 'live' && configured.startsWith('TEST_')) {
    throw Error('Test promotion code cannot be used in live mode');
  }
  return { mode, code: !configured ? '' : mode === 'test' && !configured.startsWith('TEST_') ? 'TEST_' + configured : configured };
}
