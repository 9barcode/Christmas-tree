// DOMException.message (including Safari timeout errors) can be read-only.
// Leave native/SDK errors intact and translate using a separate Error object.
export function clientError(error,messages={}){
 const message=messages[error?.code]||(
  error?.name==='TimeoutError'?'서버 응답 시간이 초과됐어요. 네트워크를 확인한 뒤 다시 시도해 주세요.':
  error?.name==='AbortError'?'서버 연결이 중단됐어요. 다시 시도해 주세요.':null
 );
 if(!message)return error;
 const translated=new Error(message,{cause:error});
 if(error?.code!==undefined)translated.code=error.code;
 if(error?.status!==undefined)translated.status=error.status;
 return translated;
}
