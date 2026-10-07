import { build } from 'esbuild';
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
await writeFile('pages/index.html',(await readFile('pages/index.html','utf8')).replace(/[\t ]+$/gm,''));
await build({entryPoints:['src/pages-worker.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'pages/_worker.js',minify:false,legalComments:'inline'});
await build({entryPoints:['src/workers-worker.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'workers/src/worker.js',minify:false,legalComments:'inline'});
for(const name of ['app.js','index.html','style.css','usque-register.js','warp-egress-selector.py','_headers'])await copyFile(`pages/${name}`,`workers/public/${name}`);
console.log('Pages and Workers built; static frontend synchronized.');
