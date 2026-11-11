import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const isBun=Boolean(process.versions.bun);
export function assertRuntime() {
  const version=(isBun?process.versions.bun:process.versions.node).split('.').map(Number);
  const minimum=isBun?[1,3,4]:[22,12,0];
  if(version[0]<minimum[0]||version[0]===minimum[0]&&(version[1]<minimum[1]||version[1]===minimum[1]&&version[2]<minimum[2]))throw new Error('Harness Kit requires Node.js >= 22.12.0 or Bun >= 1.3.4.');
}
export function isMain(url) {
  if(!process.argv[1])return false;
  try{return fs.realpathSync(fileURLToPath(url))===fs.realpathSync(path.resolve(process.argv[1]));}catch{return false;}
}
export function runtimeEnvironment(){return {...(isBun?{bun:process.versions.bun}:{node:process.versions.node}),platform:process.platform,arch:process.arch};}
export function executable(command,env=process.env) {
  const directories=path.isAbsolute(command)||command.includes('/')||command.includes('\\')?['']:(env.PATH??'').split(path.delimiter).filter(Boolean);
  const extensions=process.platform==='win32'&&!path.extname(command)?['.exe','.com','.cmd','.bat','']:[''];
  for(const directory of directories)for(const extension of extensions){const candidate=path.resolve(directory,command+extension);try{if(fs.statSync(candidate).isFile()){fs.accessSync(candidate,process.platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);return candidate;}}catch{}}
  return null;
}
