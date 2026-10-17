// Durable Toss promotion payment orchestration. Secrets and provider keys never leave the Worker.
const root = 'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/promotion';
const definitiveFailures = new Set(['4100','4109','4110','4112','4114','4116']);
const id = () => crypto.randomUUID();
export async function promotionRequest(env,user,path,body) {
  if (!env.TOSS_MTLS || !user.toss_user_key.startsWith('anon:')) throw new Error('promotion_identity_unavailable');
  const now=Date.now();
  const budget=await env.DB.batch([
    env.DB.prepare('DELETE FROM treemoa_promotion_rate_limits WHERE user_id=? AND created_at<=?').bind(user.id,now-60000),
    env.DB.prepare(`INSERT INTO treemoa_promotion_rate_limits (id,user_id,created_at)
      SELECT ?,?,? WHERE (SELECT count(*) FROM treemoa_promotion_rate_limits WHERE user_id=? AND created_at>?)<8`)
      .bind(id(),user.id,now,user.id,now-60000),
  ]);
  if (budget[1]?.meta?.changes!==1) throw new Error('promotion_call_budget_exhausted');
  const response=await env.TOSS_MTLS.fetch(root+'/'+path,{
    method:'POST',headers:{'content-type':'application/json','x-anon-key':user.toss_user_key.slice(5)},
    body:JSON.stringify(body),signal:AbortSignal.timeout(5000),
  });
  const result=await response.json();
  console.info('[treemoa.promotion.provider]',JSON.stringify({path,httpStatus:response.status,resultType:result.resultType,errorCode:result.error?.errorCode}));
  if(!response.ok&&!result.error)throw new Error('promotion_http_error');
  return result;
}
export async function loadPayment(env,userId,paymentId) {
  return env.DB.prepare('SELECT * FROM treemoa_promotion_payments WHERE id=? AND user_id=?').bind(paymentId,userId).first();
}
export async function advancePayment(env,user,paymentId) {
  let payment=await loadPayment(env,user.id,paymentId);
  if(!payment)throw new Error('payment_not_found');
  if(payment.state==='succeeded'||payment.state==='failed')return payment;
  const lease=id(),now=Date.now();
  const acquired=await env.DB.prepare("UPDATE treemoa_promotion_payments SET lease_token=?,lease_until=? WHERE id=? AND user_id=? AND lease_until<? AND state NOT IN ('succeeded','failed')")
    .bind(lease,now+45000,paymentId,user.id,now).run();
  if(acquired.meta?.changes!==1)return (await loadPayment(env,user.id,paymentId));
  async function setState(next,code=null) {
    const changed=await env.DB.prepare('UPDATE treemoa_promotion_payments SET state=?,error_code=?,updated_at=? WHERE id=? AND lease_token=?')
      .bind(next,code,Date.now(),paymentId,lease).run();
    if(changed.meta?.changes!==1)throw new Error('payment_lease_lost');
  }
  try {
    payment=await loadPayment(env,user.id,paymentId);
    const resuming=payment.state==='submitted'||payment.state==='pending';
    if(payment.state==='creating') {
      const result=await promotionRequest(env,user,'execute-promotion/get-key',{});
      const key=typeof result.success==='object'?result.success?.key:undefined;
      if(result.resultType!=='SUCCESS'||!key) {
        if(result.resultType==='FAIL'&&definitiveFailures.has(String(result.error?.errorCode)))await setState('failed',String(result.error.errorCode));
        return await loadPayment(env,user.id,paymentId);
      }
      await env.DB.prepare("UPDATE treemoa_promotion_payments SET provider_key=?,state='ready',key_issued_at=?,updated_at=? WHERE id=? AND lease_token=? AND state='creating'")
        .bind(key,Date.now(),Date.now(),paymentId,lease).run();
      payment=await loadPayment(env,user.id,paymentId);
    }
    if(payment.state==='ready') {
      if(Date.now()-(payment.key_issued_at||payment.updated_at)>55*60*1000) {
        await setState('failed','unsubmitted_key_expired');
        return await loadPayment(env,user.id,paymentId);
      }
      if(!payment.provider_key)throw new Error('payment_key_missing');
      await setState('submitted');
      const result=await promotionRequest(env,user,'execute-promotion',{promotionCode:payment.promotion_code,key:payment.provider_key,amount:payment.amount});
      if(result.resultType==='FAIL'&&definitiveFailures.has(String(result.error?.errorCode))) {
        await setState('failed',String(result.error.errorCode));
        return await loadPayment(env,user.id,paymentId);
      }
      const returnedKey=typeof result.success==='object'?result.success?.key:undefined;
      if(result.resultType==='SUCCESS'&&returnedKey===payment.provider_key&&payment.promotion_code.startsWith('TEST_')) {
        await setState('succeeded');
        return await loadPayment(env,user.id,paymentId);
      }
      await setState('pending');
    }
    if(!payment.provider_key)throw new Error('payment_key_missing');
    const result=await promotionRequest(env,user,'execution-result',{promotionCode:payment.promotion_code,key:payment.provider_key});
    if(result.resultType==='SUCCESS'&&result.success==='SUCCESS')await setState('succeeded');
    else if(result.resultType==='SUCCESS'&&result.success==='FAILED')await setState('failed','provider_failed');
    else if(result.resultType==='FAIL'&&String(result.error?.errorCode)==='4111'&&payment.promotion_code.startsWith('TEST_'))await setState('failed','test_result_unavailable');
    else if(resuming&&result.resultType==='FAIL'&&String(result.error?.errorCode)==='4111'&&Date.now()-(payment.key_issued_at||payment.created_at)<55*60*1000) {
      // Retry only this same provider key; never mint a replacement after an ambiguous submission.
      const retry=await promotionRequest(env,user,'execute-promotion',{promotionCode:payment.promotion_code,key:payment.provider_key,amount:payment.amount});
      if(retry.resultType==='FAIL'&&definitiveFailures.has(String(retry.error?.errorCode)))await setState('pending',String(retry.error.errorCode));
      else await setState('pending');
    } else await setState('pending',result.error?.errorCode?String(result.error.errorCode):null);
  } catch(cause) {
    console.warn('[treemoa.promotion.payment]',JSON.stringify({event:'resume_required',reason:cause instanceof Error&&cause.message==='promotion_call_budget_exhausted'?'rate_limited':cause instanceof Error&&cause.name==='TimeoutError'?'timeout':'provider_or_storage_unavailable'}));
  } finally {
    await env.DB.prepare('UPDATE treemoa_promotion_payments SET lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?').bind(paymentId,lease).run();
  }
  return await loadPayment(env,user.id,paymentId);
}
