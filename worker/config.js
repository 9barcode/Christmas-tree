const value = input => typeof input === 'string' ? input.trim() : '';
export function publicAdConfig(env) {
  return {
    bannerAdGroupId: value(env.BANNER_AD_GROUP_ID),
    loadingListAdGroupId: value(env.LOADING_LIST_AD_GROUP_ID),
    loadingImageAdGroupId: value(env.LOADING_IMAGE_AD_GROUP_ID),
    rewardedAdGroupIds: Object.fromEntries(Array.from({length: 5}, (_, index) => {
      const treeId = index + 1;
      return [treeId, value(env['REWARDED_AD_GROUP_ID_' + treeId])];
    })),
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

export function missionConfig(env, day) {
  if (![15,30].includes(day)) throw Error('Invalid mission day');
  const mode=value(env.TOSS_PROMOTION_MODE)||'live';
  if (!['live','test'].includes(mode)) throw Error('Invalid TOSS_PROMOTION_MODE');
  const raw=value(env['TOSS_PROMOTION_CODE_DAY_'+day]);
  if (mode==='live' && raw.startsWith('TEST_')) throw Error('Test code in live mode');
  const amount=Number(value(env['TOSS_PROMOTION_AMOUNT_DAY_'+day]) || (day===15?'15':'20'));
  if (!Number.isSafeInteger(amount)||amount<1) throw Error('Invalid promotion amount');
  return {mode,amount,code:!raw?'':mode==='test'&&!raw.startsWith('TEST_')?'TEST_'+raw:raw};
}
