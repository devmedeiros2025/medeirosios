import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {attach,plan,createProject,doctor,ROOT,ignoradoSemGit} from '../scripts/ecosystem.mjs';
function project(){return fs.mkdtempSync(path.join(os.tmpdir(),'mazyos-test-'));}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function baseDoctor(root){
 for(const f of ['AGENTS.md','CLAUDE.md','README.md','docs/COMPATIBILIDADE.md','docs/ROTEAMENTO.md']){
  const p=path.join(root,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'contrato\n');
 }
 fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify({schema:1,skills:[]}));
 fs.writeFileSync(path.join(root,'sources.lock.json'),JSON.stringify({sources:[]}));
}
test('attach preserves rules, makes backups and is idempotent',()=>{
 const p=project();fs.writeFileSync(path.join(p,'AGENTS.md'),'Regra própria: manter testes.\n');const first=attach(p);assert.equal(first.changed.length,4);assert.ok(first.backup);assert.equal(fs.readFileSync(path.join(first.backup,'AGENTS.md'),'utf8'),'Regra própria: manter testes.\n');assert.match(fs.readFileSync(path.join(p,'AGENTS.md'),'utf8'),/^Regra própria/);assert.equal(attach(p).changed.length,0);
});
test('conflict preflight leaves original files intact',()=>{
 const p=project();fs.writeFileSync(path.join(p,'AGENTS.md'),'Existing');fs.mkdirSync(path.join(p,'.agents/skills/mazyos-ecosystem'),{recursive:true});fs.writeFileSync(path.join(p,'.agents/skills/mazyos-ecosystem/SKILL.md'),'User skill');assert.throws(()=>attach(p),/Skill local/);assert.equal(fs.readFileSync(path.join(p,'AGENTS.md'),'utf8'),'Existing');assert.equal(fs.existsSync(path.join(p,'CLAUDE.md')),false);
});
test('reject malformed instruction blocks',()=>{const p=project();fs.writeFileSync(path.join(p,'AGENTS.md'),'<!-- MAZYOS-EXPX:BEGIN -->');assert.throws(()=>attach(p),/Bloco de instruções gerenciadas/);});
test('team total includes coordinator and does not invent started agents',()=>{
 for(const n of [1,2,3,6]){const result=plan(project(),n,'Entrega verificável');assert.equal(result.agents.length,n);assert.equal(result.startedAgents,0);assert.equal(result.agents.filter(a=>a.role==='orquestrador').length,1);assert.equal(result.agents.filter(a=>a.role==='revisor').length,n>=3?1:0);assert.ok(result.agents.every(a=>a.runtimeId===null));}
});
test('reject invalid teams and path traversal',()=>{for(const n of [0,1.5,65,'abc'])assert.throws(()=>plan(project(),n,'task'));assert.throws(()=>createProject('../outside'),/Nome inválido/);});
test('reject symlink escape before writing',()=>{const p=project(),external=project();fs.symlinkSync(external,path.join(p,'.mazyos'),'junction');assert.throws(()=>attach(p),/Link simbólico/);assert.equal(fs.existsSync(path.join(p,'AGENTS.md')),false);});
test('verify source integrity and adapter links',()=>{const r=doctor(ROOT);assert.deepEqual(r.errors,[]);assert.equal(r.upstreamRepositories,11);assert.equal(r.specialties,31);});
test('doctor aceita hash calculado com line endings divergentes',()=>{
 const p=project();baseDoctor(p);
 const conteudo='linha 1\nlinha 2\n';
 fs.mkdirSync(path.join(p,'vendor/exemplo'),{recursive:true});
 fs.writeFileSync(path.join(p,'vendor/exemplo/a.md'),conteudo);
 fs.writeFileSync(path.join(p,'provenance.json'),JSON.stringify({files:[{path:'vendor/exemplo/a.md',sha256:sha(Buffer.from(conteudo.replaceAll('\n','\r\n')))}]}));
 assert.deepEqual(doctor(p).errors,[]);
});
test('doctor nao erra arquivo ausente ignorado pelo git',()=>{
 const p=project();baseDoctor(p);
 if(spawnSync('git',['init','-q'],{cwd:p}).status!==0)return;
 fs.writeFileSync(path.join(p,'.gitignore'),'*.bak\n');
 fs.writeFileSync(path.join(p,'provenance.json'),JSON.stringify({files:[{path:'ausente.bak',sha256:sha('x')}]}));
 assert.deepEqual(doctor(p).errors,[]);
});
test('doctor aceita adaptador gravado com CRLF',()=>{
 const p=project();baseDoctor(p);
 fs.mkdirSync(path.join(p,'vendor/exemplo'),{recursive:true});
 const arquivo=path.join(p,'.agents/skills/expx-buildx/SKILL.md');
 fs.mkdirSync(path.dirname(arquivo),{recursive:true});
 fs.writeFileSync(arquivo,'---\r\nname: expx-buildx\r\n---\r\nconteudo\r\n');
 fs.writeFileSync(path.join(p,'catalog.json'),JSON.stringify({schema:1,skills:[{id:'expx-buildx',source:'vendor/exemplo'}]}));
 fs.writeFileSync(path.join(p,'provenance.json'),JSON.stringify({files:[]}));
 assert.deepEqual(doctor(p).errors,[]);
});
test('fallback sem git reconhece padrao de .gitignore aninhado',()=>{
 const p=project();
 fs.mkdirSync(path.join(p,'vendor/exemplo/.claude'),{recursive:true});
 fs.writeFileSync(path.join(p,'vendor/exemplo/.gitignore'),'node_modules/\n.claude/settings.json.backup-*\n');
 assert.equal(ignoradoSemGit(p,'vendor/exemplo/.claude/settings.json.backup-2026-08-30'),true);
 assert.equal(ignoradoSemGit(p,'vendor/exemplo/.claude/settings.json'),false);
});
