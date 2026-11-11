import {spawn,spawnSync} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';

// One bounded, cancellable subprocess implementation for Node and Bun.
export async function runProcess(argv,{cwd,env=process.env,timeoutMs=60000,signal,maxOutput=32768,windowsVerbatimArguments=false}={}) {
  if(signal?.aborted)return {exitCode:null,reason:'cancelled',stdout:'',stderr:'',output:''};
  const child=spawn(argv[0],argv.slice(1),{cwd,env,windowsHide:true,windowsVerbatimArguments,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
  let reason=null,output='';const collected={stdout:'',stderr:''};
  for(const name of ['stdout','stderr']){const decoder=new StringDecoder('utf8');child[name].on('data',chunk=>{const text=decoder.write(chunk);collected[name]=(collected[name]+text).slice(-maxOutput);output=(output+text).slice(-maxOutput);});child[name].on('end',()=>{const text=decoder.end();collected[name]=(collected[name]+text).slice(-maxOutput);output=(output+text).slice(-maxOutput);});}
  function stop(why){
    if(reason)return;reason=why;
    if(child.pid){if(process.platform==='win32')spawnSync('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:2000});else{try{process.kill(-child.pid,'SIGKILL');}catch{}}}
    try{child.kill('SIGKILL');}catch{}
    child.stdout.destroy();child.stderr.destroy();
  }
  const timer=setTimeout(()=>stop('timeout'),timeoutMs),abort=()=>stop('cancelled');signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  try{const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code));});return {exitCode,reason,...collected,output};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
