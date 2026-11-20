import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home=os.homedir();
const selo=new Date().toISOString().replace(/\D/g,'').slice(0,17);
const arquivos={
 codex:path.join(home,'.codex','config.toml'),
 opencode:path.join(home,'.config','opencode','opencode.json'),
 claude:path.join(home,'.claude.json')
};
// Instalador portátil: registra o node e o CLI embutidos, com caminho absoluto.
// Sem essa variável, mantém o comportamento anterior de usar o CLI global.
const cliBundlado=process.env.OPENMAUSBOT_CLI;
const comando=cliBundlado?process.execPath:(process.platform==='win32'?'openmausbot.cmd':'openmausbot');
const argumentos=cliBundlado?[cliBundlado,'mcp']:['mcp'];
const resultados=[];

function salvar(chave,texto,transformar){
 const arquivo=arquivos[chave];
 if(!fs.existsSync(arquivo)){resultados.push({cliente:chave,ok:false,motivo:'arquivo ausente',arquivo});return;}
 const antes=fs.readFileSync(arquivo,'utf8');
 const depois=transformar(antes);
 if(depois===antes){resultados.push({cliente:chave,ok:true,alterado:false,arquivo});return;}
 const backup=`${arquivo}.bak-${selo}`;
 fs.copyFileSync(arquivo,backup);
 fs.writeFileSync(arquivo,depois);
 resultados.push({cliente:chave,ok:true,alterado:true,backup,arquivo});
}

function adicionarToml(secao,corpo){
 return texto=>{
  if(texto.includes(secao))return texto;
  return texto.trimEnd()+'\n\n'+secao+'\n'+corpo.trim()+'\n';
 };
}

function adicionarJson(chave,nome,entrada){
 return texto=>{
  const padrao=new RegExp('("'+chave+'"\\s*:\\s*\\{)');
  const resultado=JSON.stringify(entrada,null,2).split('\n').map((l,i)=>i?'    '+l:l).join('\n');
  const encontrado=texto.match(padrao);
  if(encontrado){
   if(new RegExp('"'+nome+'"\\s*:').test(texto))return texto;
   const ponto=encontrado.index+encontrado[0].length;
   return texto.slice(0,ponto)+'\n    "'+nome+'": '+resultado+','+texto.slice(ponto);
  }
  if(new RegExp('"'+nome+'"\\s*:').test(texto))return texto;
  const ultimo=texto.lastIndexOf('}');
  if(ultimo<0)return texto;
  const antes=texto.slice(0,ultimo).trimEnd();
  const virgula=antes.endsWith('{')?'':',';
  return antes+virgula+'\n  "'+chave+'": {\n    "'+nome+'": '+resultado+'\n  }\n'+texto.slice(ultimo);
 };
}

salvar('codex',null,adicionarToml('[mcp_servers.openmausbot]',[
 'command = '+JSON.stringify(comando),
 'args = ['+argumentos.map(a=>JSON.stringify(a)).join(', ')+']',
 'startup_timeout_sec = 30',
 'tool_timeout_sec = 600'
].join('\n')));
salvar('opencode',null,adicionarJson('mcp','openmausbot',{type:'local',command:[comando,...argumentos],enabled:true}));
salvar('claude',null,adicionarJson('mcpServers','openmausbot',{command:comando,args:argumentos}));

const ok=resultados.every(r=>r.ok);
console.log(JSON.stringify({ok,resultados},null,2));
if(!ok)process.exitCode=1;
