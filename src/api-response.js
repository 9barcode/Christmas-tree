export async function readApiResponse(response){
 let payload;
 try{payload=await response.json();}
 catch(cause){
  const error=new Error('서버에서 앱 데이터를 받지 못했어요. 서버 주소와 배포 상태를 확인해 주세요.',{cause});
  error.code='invalid_api_response';error.status=response.status;
  throw error;
 }
 if(!payload||typeof payload!=='object'||Array.isArray(payload)){
  const error=new Error('서버 응답 형식을 확인해 주세요.');
  error.code='invalid_api_response';error.status=response.status;throw error;
 }
 return payload;
}
