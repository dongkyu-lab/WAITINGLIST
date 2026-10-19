const {spawn}=require('node:child_process');
const binary=require('electron');
const environment={...process.env};delete environment.ELECTRON_RUN_AS_NODE;
const child=spawn(binary,['.','--smoke-test',...(process.platform==='linux'?['--no-sandbox']:[])],{stdio:'inherit',env:environment});
const timer=setTimeout(()=>{child.kill();process.exitCode=1;},60000);
child.on('error',err=>{clearTimeout(timer);console.error(err.message);process.exitCode=1;});
child.on('exit',code=>{clearTimeout(timer);process.exitCode=code===0?0:1;});
