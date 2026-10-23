import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const path=fileURLToPath(new URL('../lib/account-auth.ts',import.meta.url));
let source=fs.readFileSync(path,'utf8');
if(!source.includes('const discovery = publicDiscovery(request);')){
 const anchor='  const url = new URL(request.url);';
 if(!source.includes('export async function accountGate(')||!source.includes(anchor))throw Error('Непознат accountGate; нужно е ръчно сливане.');
 if(!source.includes("from './public-discovery'"))source="import { publicDiscovery } from './public-discovery';\n"+source;
 source=source.replace(anchor,anchor+'\n  const discovery = publicDiscovery(request);\n  if (discovery) return discovery;');
 fs.writeFileSync(path,source);
}
console.log('Публичните llms.txt и JSON каталози са добавени преди проверката за вход.');
