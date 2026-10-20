import {readdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
for(const name of await readdir('src'))if(/\.(js|mjs)$/.test(name))execFileSync(process.execPath,['--check','src/'+name],{stdio:'inherit',windowsHide:true});
console.log('All application modules passed syntax checks');
