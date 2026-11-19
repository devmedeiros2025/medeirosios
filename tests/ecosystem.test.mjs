import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {attach,plan,createProject,doctor,ROOT} from '../scripts/ecosystem.mjs';
function project(){return fs.mkdtempSync(path.join(os.tmpdir(),'mazyos-test-'));}
test('attach preserves rules, makes backups and is idempotent',()=>{
 const p=project();fs.writeFileSync(path.join(p,'AGENTS.md'),'Regra própria: manter testes.\n');const first=attach(p);assert.equal(first.changed.length,4);assert.ok(first.backup);assert.equal(fs.readFileSync(path.join(first.backup,'AGENTS.md'),'utf8'),'Regra própria: manter testes.\n');assert.match(fs.readFileSync(path.join(p,'AGENTS.md'),'utf8'),/^Regra própria/);assert.equal(attach(p).changed.length,0);
});
test('conflict preflight leaves original files intact',()=>{
 const p=project();fs.writeFileSync(path.join(p,'AGENTS.md'),'Existing');fs.mkdirSync(path.join(p,'.agents/skills/mazyos-ecosystem'),{recursive:true});fs.writeFileSync(path.join(p,'.agents/skills/mazyos-ecosystem/SKILL.md'),'User skill');assert.throws(()=>attach(p),/Skill local/);assert.equal(fs.readFileSync(path.join(p,'AGENTS.md'),'utf8'),'Existing');assert.equal(fs.existsSync(path.join(p,'CLAUDE.md')),false);
});
test('reject malformed instruction blocks',()=>{const p=project();fs.writeFileSync(path.join(p,'AGENTS.md'),'<!-- MAZYOS-EXPX:BEGIN -->');assert.throws(()=>attach(p),/Bloco MazYos/);});
test('team total includes coordinator and does not invent started agents',()=>{
 for(const n of [1,2,3,6]){const result=plan(project(),n,'Entrega verificável');assert.equal(result.agents.length,n);assert.equal(result.startedAgents,0);assert.equal(result.agents.filter(a=>a.role==='orquestrador').length,1);assert.equal(result.agents.filter(a=>a.role==='revisor').length,n>=3?1:0);assert.ok(result.agents.every(a=>a.runtimeId===null));}
});
test('reject invalid teams and path traversal',()=>{for(const n of [0,1.5,65,'abc'])assert.throws(()=>plan(project(),n,'task'));assert.throws(()=>createProject('../outside'),/Nome inválido/);});
test('reject symlink escape before writing',()=>{const p=project(),external=project();fs.symlinkSync(external,path.join(p,'.mazyos'),'junction');assert.throws(()=>attach(p),/Link simbólico/);assert.equal(fs.existsSync(path.join(p,'AGENTS.md')),false);});
test('verify source integrity and adapter links',()=>{const r=doctor(ROOT);assert.deepEqual(r.errors,[]);assert.equal(r.upstreamRepositories,11);assert.equal(r.specialties,31);});
