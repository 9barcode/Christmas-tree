// Promotion codes stay server-side. The owner can expose this binding as a
// Wrangler var during setup, then replace it with a Worker secret before launch.
export const MISSION_DAY = 30;
export const MISSION_POINTS = 20;

export function missionPromotionCode(env) {
  const value = typeof env.TOSS_PROMOTION_CODE_DAY_30 === 'string'
    ? env.TOSS_PROMOTION_CODE_DAY_30.trim()
    : '';
  if (!value || value.toLowerCase() === 'notconfirmedyet') return '';
  if (env.TOSS_PROMOTION_MODE === 'live') return value.replace(/^TEST_/, '');
  return value.startsWith('TEST_') ? value : 'TEST_' + value;
}
