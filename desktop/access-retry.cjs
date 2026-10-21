function createAccessRetry({connect,now=Date.now,ttlMs=600000}={}){
  let credential=null,timer=null;
  function clear(){credential=null;clearTimeout(timer);timer=null;}
  function available(){if(credential&&credential.expires<=now())clear();return Boolean(credential);}
  return {
    clear,available,
    remember(token){clear();credential={token,expires:now()+ttlMs};timer=setTimeout(clear,ttlMs);timer.unref?.();},
    async retry(){
      if(!available())throw Error('인증 확인 시간이 지났습니다. Google 계정으로 다시 로그인해 주세요.');
      try{const result=await connect(credential.token);clear();return result;}
      catch(e){if(e.status===401)clear();throw e;}
    }
  };
}
module.exports={createAccessRetry};
