const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
module.exports=function run(binary,prefix=[]){
  const directory=mkdtempSync(join(tmpdir(),'waitinglist-smoke-'));
  const environment={...process.env,WAITINGLIST_SMOKE_DATA:directory};delete environment.ELECTRON_RUN_AS_NODE;
  const child=spawn(binary,[...prefix,'--smoke-test',...(process.platform==='linux'?['--no-sandbox']:[])],{stdio:'inherit',env:environment});
  const timer=setTimeout(()=>{child.kill();process.exitCode=1;},60000);
  function cleanup(){
    // Chromium holds profile files until Electron and its renderers exit on Windows.
    rmSync(directory,{recursive:true,force:true,maxRetries:15,retryDelay:100});
  }
  child.on('error',err=>{clearTimeout(timer);console.error(err.message);try{cleanup();}catch{}process.exitCode=1;});
  child.on('exit',code=>{clearTimeout(timer);process.exitCode=code===0?0:1;try{cleanup();}catch(err){console.error('Smoke cleanup failed: '+err.message);process.exitCode=1;}});
};
