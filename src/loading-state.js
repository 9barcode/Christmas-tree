export const DOT_INTERVAL_MS = 400;
export function loadingText(step) {
  return '트리 꾸미러 들어가는 중' + '.'.repeat(((step % 4) + 4) % 4);
}
// Readiness is determined by real promises; the deadline only detects a stalled load.
export async function waitForHomeReady(tasks, timeoutMs = 25000) {
  let timer;
  try {
    await Promise.race([
      Promise.all(tasks.map(task => Promise.resolve().then(task))),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('홈 화면 준비 시간이 초과됐어요.')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
