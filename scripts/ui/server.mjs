import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inventario} from '../registry.mjs';
import {doctor} from '../ecosystem.mjs';
import {FERRAMENTAS} from '../mcp/server.mjs';
import {listarInteligencias} from '../intel.mjs';
import {status,salvar,remover,PROVEDORES} from '../lib/credenciais.mjs';

const html=`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MEDEIROS SYSTEM — Painel</title>
<style>
:root{--indigo:#4f46e5;--indigo-dark:#3730a3;--surface:#f8fafc;--card:#ffffff;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--ok:#047857;--bad:#b91c1c}
*{box-sizing:border-box}
body{margin:0;background:var(--surface);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header{background:var(--card);border-bottom:1px solid var(--line);padding:20px 28px;display:flex;align-items:center;gap:14px}
.mark{width:38px;height:38px;border-radius:11px;background:var(--indigo);color:#fff;display:grid;place-items:center;font-weight:700}
h1{font-size:19px;margin:0;letter-spacing:-.01em}
.sub{color:var(--muted);font-size:13px}
main{max-width:1120px;margin:28px auto;padding:0 20px;display:grid;gap:20px}
grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.metric{font-size:30px;font-weight:700;color:var(--indigo-dark);letter-spacing:-.02em}
.label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
h2{font-size:15px;margin:0 0 12px}
.ok{color:var(--ok)}.bad{color:var(--bad)}
ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
li{padding:9px 11px;border:1px solid var(--line);border-radius:9px;font-size:13px}
code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--indigo-dark)}
.tag{display:inline-block;background:#eef2ff;color:var(--indigo-dark);border-radius:6px;padding:2px 7px;font-size:11px;margin-right:6px}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
form{display:grid;grid-template-columns:1fr 1.4fr 1fr auto;gap:10px;align-items:end}
.campo{display:grid;gap:5px}
input,select{width:100%;padding:10px 11px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font:14px system-ui,sans-serif}
input:focus,select:focus{outline:2px solid #c7d2fe;border-color:var(--indigo)}
button{padding:10px 16px;border:0;border-radius:9px;background:var(--indigo);color:#fff;font-weight:600;cursor:pointer}
button:hover{background:var(--indigo-dark)}
.aviso{color:var(--muted);font-size:12px;margin:12px 0 0}
#credStatus{margin-top:12px;font-size:13px}
@media(max-width:760px){form{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
<div class="mark">M</div>
<div><h1>MEDEIROS SYSTEM</h1><div class="sub">Harness local · Node puro · 127.0.0.1:8765</div></div>
</header>
<main>
<section class="card"><h2>Suas credenciais</h2>
 <form id="formCred">
  <div class="campo"><label class="label" for="provedor">Provedor de IA</label><select id="provedor"></select></div>
  <div class="campo"><label class="label" for="chave">Chave de API (sua)</label><input id="chave" type="password" autocomplete="off" placeholder="cole sua chave aqui"></div>
  <div class="campo"><label class="label" for="baseurl">URL base (opcional)</label><input id="baseurl" type="text" autocomplete="off" placeholder="https://..."></div>
  <button type="submit">Salvar</button>
 </form>
 <p class="aviso">A chave fica somente neste computador, fora do repositório. Nunca é enviada para nós nem aparece no painel.</p>
 <div id="credStatus">carregando…</div>
</section>
<grid id="metricas"></grid>
<section class="card"><h2>Inteligências acopladas</h2><ul id="inteligencias"></ul></section>
<section class="card"><h2>Ferramentas MCP</h2><ul id="ferramentas"></ul></section>
<section class="card"><h2>Integridade</h2><div id="integridade">carregando…</div></section>
</main>
<footer>MausBot orquestra · agentes executam · evidência real</footer>
<script>
const get=async r=>(await fetch(r)).json();
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const carregarCred=async()=>{
 const r=await get('/api/credenciais');
 const itens=r.configurados.map(c=>'<li><span class=\"tag\">'+esc(c.provedor)+'</span>configurada em '+esc(c.atualizadoEm)+'</li>').join('');
 document.getElementById('credStatus').innerHTML=r.total?'<ul>'+itens+'</ul>':'<span class=\"bad\">Nenhuma credencial configurada</span>';
};
(async()=>{
 const sel=document.getElementById('provedor');
 sel.innerHTML=${JSON.stringify(PROVEDORES)}.map(p=>'<option value=\"'+esc(p)+'\">'+esc(p)+'</option>').join('');
 await carregarCred();
 document.getElementById('formCred').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const chave=document.getElementById('chave').value.trim();
  if(!chave)return;
  const corpo={provedor:sel.value,chave,baseUrl:document.getElementById('baseurl').value.trim()};
  const resp=await fetch('/api/credenciais',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(corpo)});
  if(resp.ok){document.getElementById('chave').value='';document.getElementById('baseurl').value='';await carregarCred();}
  else{document.getElementById('credStatus').textContent='Falha ao salvar: '+resp.status;}
 });
 const [inv,ints,ferr,inte]=await Promise.all([get('/api/inventario'),get('/api/inteligencias'),get('/api/ferramentas'),get('/api/integridade')]);
 document.getElementById('metricas').innerHTML=[
  ['Especialidades',inv.specialties],['Agentes',inv.agents],['Fluxos',inv.flows],
  ['Inteligências',inv.inteligencias.length],['Ferramentas MCP',ferr.length]
 ].map(([l,v])=>'<div class=\"card\"><div class=\"metric\">'+esc(v)+'</div><div class=\"label\">'+esc(l)+'</div></div>').join('');
 document.getElementById('inteligencias').innerHTML=ints.map(i=>'<li><span class=\"tag\">'+esc(i.categoria.split('/')[0].trim())+'</span><strong>'+esc(i.titulo)+'</strong><br><code>'+esc(i.id)+'</code> — '+esc(i.descricao)+'</li>').join('');
 document.getElementById('ferramentas').innerHTML=ferr.map(f=>'<li><code>'+esc(f.name)+'</code> — '+esc(f.description)+'</li>').join('');
 const ok=inte.ok?'<span class=\"ok\">OK</span>':'<span class=\"bad\">FALHA</span>';
 document.getElementById('integridade').innerHTML='<p>'+ok+' · '+esc(inte.importedFiles)+' arquivos · '+esc(inte.upstreamRepositories)+' fontes · '+esc(inte.specialties)+' especialidades</p>'+(inte.errors.length?'<ul>'+inte.errors.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'');
})().catch(e=>{document.getElementById('integridade').textContent='Erro: '+e.message});
</script>
</body>
</html>`;

function json(res,value,status=200){
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'});
 res.end(JSON.stringify(value,null,2));
}
async function lerCorpo(req){
 let texto='';
 for await(const parte of req){
  texto+=parte;
  if(texto.length>65536)throw Error('Corpo muito grande');
 }
 return JSON.parse(texto||'{}');
}

export function criarServidor(){
 return http.createServer((req,res)=>{
  (async()=>{
   const rota=new URL(req.url??'/','http://127.0.0.1').pathname;
   if(rota==='/'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    res.end(html);return;
   }
   if(rota==='/api/inventario')return json(res,inventario());
   if(rota==='/api/integridade')return json(res,doctor());
   if(rota==='/api/ferramentas')return json(res,FERRAMENTAS.map(f=>({name:f.name,description:f.description})));
   if(rota==='/api/inteligencias')return json(res,listarInteligencias());
   if(rota==='/api/credenciais'&&req.method==='GET')return json(res,status());
   if(rota==='/api/credenciais'&&req.method==='POST')return json(res,salvar(await lerCorpo(req)));
   if(rota==='/api/credenciais'&&req.method==='DELETE')return json(res,remover(new URL(req.url,'http://127.0.0.1').searchParams.get('provedor')));
   return json(res,{erro:'Rota desconhecida'},404);
  })().catch(e=>json(res,{erro:e.message,rota:req.url},400));
 });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const porta=Number(process.env.PORTA??8765);
 criarServidor().listen(porta,'127.0.0.1',()=>{
  console.log('Painel MEDEIROS SYSTEM: http://127.0.0.1:'+porta);
 });
}
