import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inventario} from '../registry.mjs';
import {doctor} from '../ecosystem.mjs';
import {FERRAMENTAS} from '../mcp/server.mjs';
import {listarInteligencias} from '../intel.mjs';

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
</style>
</head>
<body>
<header>
<div class="mark">M</div>
<div><h1>MEDEIROS SYSTEM</h1><div class="sub">Harness local · Node puro · 127.0.0.1:8765</div></div>
</header>
<main>
<grid id="metricas"></grid>
<section class="card"><h2>Inteligências acopladas</h2><ul id="inteligencias"></ul></section>
<section class="card"><h2>Ferramentas MCP</h2><ul id="ferramentas"></ul></section>
<section class="card"><h2>Integridade</h2><div id="integridade">carregando…</div></section>
</main>
<footer>MausBot orquestra · agentes executam · evidência real</footer>
<script>
const get=async r=>(await fetch(r)).json();
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
(async()=>{
 const [inv,ints,ferr,inte]=await Promise.all([get('/api/inventario'),get('/api/inteligencias'),get('/api/ferramentas'),get('/api/integridade')]);
 document.getElementById('metricas').innerHTML=[
  ['Especialidades',inv.specialties],['Agentes',inv.agents],['Fluxos',inv.flows],
  ['Inteligências',inv.inteligencias.length],['Ferramentas MCP',ferr.length]
 ].map(([l,v])=>'<div class="card"><div class="metric">'+esc(v)+'</div><div class="label">'+esc(l)+'</div></div>').join('');
 document.getElementById('inteligencias').innerHTML=ints.map(i=>'<li><span class="tag">'+esc(i.categoria.split('/')[0].trim())+'</span><strong>'+esc(i.titulo)+'</strong><br><code>'+esc(i.id)+'</code> — '+esc(i.descricao)+'</li>').join('');
 document.getElementById('ferramentas').innerHTML=ferr.map(f=>'<li><code>'+esc(f.name)+'</code> — '+esc(f.description)+'</li>').join('');
 const ok=inte.ok?'<span class="ok">OK</span>':'<span class="bad">FALHA</span>';
 document.getElementById('integridade').innerHTML='<p>'+ok+' · '+esc(inte.importedFiles)+' arquivos · '+esc(inte.upstreamRepositories)+' fontes · '+esc(inte.specialties)+' especialidades</p>'+(inte.errors.length?'<ul>'+inte.errors.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'');
})().catch(e=>{document.getElementById('integridade').textContent='Erro: '+e.message});
</script>
</body>
</html>`;

function json(res,value,status=200){
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'});
 res.end(JSON.stringify(value,null,2));
}

export function criarServidor(){
 return http.createServer((req,res)=>{
  const rota=new URL(req.url??'/','http://127.0.0.1').pathname;
  if(rota==='/'){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
   res.end(html);return;
  }
  if(rota==='/api/inventario')return json(res,inventario());
  if(rota==='/api/integridade')return json(res,doctor());
  if(rota==='/api/ferramentas')return json(res,FERRAMENTAS.map(f=>({name:f.name,description:f.description})));
  if(rota==='/api/inteligencias')return json(res,listarInteligencias());
  return json(res,{erro:'Rota desconhecida'},404);
 });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const porta=Number(process.env.PORTA??8765);
 criarServidor().listen(porta,'127.0.0.1',()=>{
  console.log('Painel MEDEIROS SYSTEM: http://127.0.0.1:'+porta);
 });
}
