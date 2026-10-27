// Adapted from PodoMoa: persist the key and submitted phase before any transfer.
const root = 'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/promotion';
const definitiveFailures = new Set(['4100','4109','4110','4112','4114','4116']);
async function provider(env, user, path, body) {
  if (!env.TOSS_MTLS || !user.toss_user_key.startsWith('anon:')) throw Error('promotion_not_configured');
  const now = Date.now();
  const budget = await env.DB.batch([
    env.DB.prepare('DELETE FROM tree_mission_api_calls WHERE user_id = ? AND created_at <= ?').bind(user.id, now - 60000),
    env.DB.prepare('INSERT INTO tree_mission_api_calls (id,user_id,created_at) SELECT ?,?,? WHERE (SELECT count(*) FROM tree_mission_api_calls WHERE user_id = ? AND created_at > ?) < 8')
      .bind(crypto.randomUUID(),user.id,now,user.id,now-60000),
  ]);
  if (budget[1]?.meta?.changes !== 1) throw Error('promotion_rate_limited');
  const response = await env.TOSS_MTLS.fetch(root + '/' + path, {
    method:'POST', headers:{'content-type':'application/json','x-anon-key':user.toss_user_key.slice(5)},
    body:JSON.stringify(body), signal:AbortSignal.timeout(5000),
  });
  const result = await response.json();
  console.info('[tree.promotion.provider]', {path,status:response.status,resultType:result.resultType,errorCode:result.error?.errorCode});
  if (!response.ok && !result.error) throw Error('promotion_http_error');
  return result;
}
const read = (env,user,id) => env.DB.prepare('SELECT * FROM tree_factory_payments WHERE user_id = ? AND id = ?').bind(user.id,id).first();
async function finalize(env,user,payment) {
  if (!payment || !['succeeded','failed'].includes(payment.state)) return;
  if (payment.purpose === 'tree-sale') {
    // A confirmed test payout applies the same tree sale state without paying real points.
    if (payment.state !== 'succeeded') return;
    const now = Date.now(),token=crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("UPDATE tree_factory_payments SET finalized_at=?,finalization_token=? WHERE id=? AND user_id=? AND purpose='tree-sale' AND state='succeeded' AND finalized_at IS NULL AND (SELECT count(DISTINCT asset_id) FROM tree_factory_items WHERE user_id=? AND sold_at IS NULL AND placed=1)=30")
        .bind(now,token,payment.id,user.id,user.id),
      env.DB.prepare('UPDATE tree_factory_items SET sold_at=?,placed=0 WHERE user_id=? AND sold_at IS NULL AND placed=1 AND EXISTS(SELECT 1 FROM tree_factory_payments WHERE id=? AND user_id=? AND finalization_token=?)')
        .bind(now,user.id,payment.id,user.id,token),
      env.DB.prepare('UPDATE tree_factory_layout SET revision=revision+1 WHERE user_id=? AND EXISTS(SELECT 1 FROM tree_factory_payments WHERE id=? AND user_id=? AND finalization_token=?)')
        .bind(user.id,payment.id,user.id,token),
    ]);
    return;
  }
  // Wallet debit was reserved atomically. Test success releases it; live success consumes it.
  if (payment.debug_test === 1 && payment.state === 'succeeded') return;
  if (payment.mode !== 'test' && payment.state !== 'failed') return;
  await env.DB.prepare("INSERT INTO tree_factory_ledger(id,user_id,amount,kind,created_at) VALUES(?,?,?,'test-refund',?) ON CONFLICT DO NOTHING")
    .bind('refund:'+payment.id,user.id,payment.amount,Date.now()).run();
}
export async function advanceFactoryPayment(env,user,id) {
  let payment = await read(env,user,id);
  if (!payment) throw Error('payment_not_found');
  if (['succeeded','failed'].includes(payment.state)) {
    await finalize(env,user,payment);
    return payment;
  }
  const lease = crypto.randomUUID(), now=Date.now();
  const lock = await env.DB.prepare("UPDATE tree_factory_payments SET lease_token = ?, lease_until = ? WHERE id = ? AND user_id = ? AND lease_until < ? AND state NOT IN ('succeeded','failed')")
    .bind(lease,now+45000,id,user.id,now).run();
  if (lock.meta?.changes !== 1) return read(env,user,id);
  async function state(next,code=null) {
    const changed = await env.DB.prepare('UPDATE tree_factory_payments SET state = ?,error_code = ?,updated_at = ? WHERE id = ? AND lease_token = ?')
      .bind(next,code,Date.now(),id,lease).run();
    if (changed.meta?.changes !== 1) throw Error('payment_lease_lost');
    console.info('[tree.promotion.payment]', {event:'state',purpose:payment.purpose,mode:payment.mode,state:next,errorCode:code});
  }
  let stage = 'load';
  try {
    payment = await read(env,user,id);
    console.info('[tree.promotion.payment]', {event:'start',purpose:payment.purpose,mode:payment.mode,state:payment.state});
    const resuming = ['submitted','pending'].includes(payment.state);
    if (payment.state === 'creating') {
      stage = 'get-key';
      const result = await provider(env,user,'execute-promotion/get-key',{});
      const key = typeof result.success === 'object' ? result.success?.key : null;
      if (result.resultType !== 'SUCCESS' || !key) {
        if (result.resultType === 'FAIL' && definitiveFailures.has(String(result.error?.errorCode))) await state('failed',String(result.error.errorCode));
        return await read(env,user,id);
      }
      await env.DB.prepare("UPDATE tree_factory_payments SET provider_key = ?,key_issued_at = ?,state = 'ready',updated_at = ? WHERE id = ? AND lease_token = ? AND state = 'creating'")
        .bind(key,Date.now(),Date.now(),id,lease).run();
      payment = await read(env,user,id);
    }
    if (payment.state === 'ready') {
      if (Date.now() - payment.key_issued_at > 55*60000) {
        await state('failed','unsubmitted_key_expired');
        return await read(env,user,id);
      }
      if (!payment.provider_key) throw Error('payment_key_missing');
      await state('submitted');
      stage = 'execute-promotion';
      const result = await provider(env,user,'execute-promotion',{
        promotionCode:payment.promotion_code,key:payment.provider_key,amount:payment.amount,
      });
      if (result.resultType === 'FAIL' && definitiveFailures.has(String(result.error?.errorCode))) {
        await state('failed',String(result.error.errorCode)); return await read(env,user,id);
      }
      if (payment.mode === 'test' && result.resultType === 'SUCCESS' && result.success?.key === payment.provider_key) {
        await state('succeeded');
      } else await state('pending');
    }
    payment = await read(env,user,id);
    if (payment.state !== 'succeeded') {
      if (!payment.provider_key) throw Error('payment_key_missing');
      stage = 'execution-result';
      const result = await provider(env,user,'execution-result',{promotionCode:payment.promotion_code,key:payment.provider_key});
      if (result.resultType === 'SUCCESS' && result.success === 'SUCCESS') await state('succeeded');
      else if (result.resultType === 'SUCCESS' && result.success === 'FAILED') await state('failed','provider_failed');
      else if (payment.mode === 'test' && result.resultType === 'FAIL' && String(result.error?.errorCode)==='4111') await state('failed','test_result_unavailable');
      else if (resuming && result.resultType === 'FAIL' && String(result.error?.errorCode)==='4111' && Date.now()-payment.key_issued_at < 55*60000) {
        // Retry ONLY the same key. Never issue a replacement for an ambiguous transfer.
        stage = 'retry-execute-promotion';
        await provider(env,user,'execute-promotion',{promotionCode:payment.promotion_code,key:payment.provider_key,amount:payment.amount});
        await state('pending');
      } else await state('pending',result.error?.errorCode ? String(result.error.errorCode) : null);
    }
  } catch (error) {
    const kind = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'request_or_internal_error';
    console.warn('[tree.promotion.payment]',{event:'resume_required',stage,kind,purpose:payment?.purpose,mode:payment?.mode});
  } finally {
    await env.DB.prepare('UPDATE tree_factory_payments SET lease_token = NULL,lease_until = 0 WHERE id = ? AND lease_token = ?').bind(id,lease).run();
  }
  payment=await read(env,user,id);
  await finalize(env,user,payment);
  return payment;
}
