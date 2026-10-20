import {mkdir,readdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'dist'),{recursive:true});
for(const file of await readdir(path.join(root,'src')))await copyFile(path.join(root,'src',file),path.join(root,'dist',file));
console.log('Built dist/');
