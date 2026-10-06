// Explicitly opt-in. Uses the freshly built local stdio server, never a published package.
// RUN_RESOURCE_LIVE=1 node test/integration/manual/resource-contracts.mjs
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
if (process.env.RUN_RESOURCE_LIVE !== '1' || !process.env.DOIT_OWN_CUSTOMER_API_KEY) throw new Error('Explicit opt-in and DOIT_OWN_CUSTOMER_API_KEY required');
const prefix = `mcp-contract-${randomUUID().slice(0, 8)}`;
const journal = join(tmpdir(), `${prefix}.json`);
const owned = [];
const evidence = [];
const client = new Client({name:'disposable-resource-validation',version:'1.0.0'});
const save = () => writeFileSync(journal, JSON.stringify({ prefix, owned, evidence }, null, 2), { mode: 0o600 });
const record = (entry) => { evidence.push(entry); save(); console.log(JSON.stringify(entry)); };
const textOf = (r) => r.content?.find(c=>c.type==='text')?.text ?? '';
const decode = (r) => { try { return JSON.parse(textOf(r)); } catch { return textOf(r); } };
const redact = (value) => {
 let text=JSON.stringify(value);
 for(const resource of owned) text=text.replaceAll(resource.id,`<${resource.kind}>`);
 return JSON.parse(text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'<owner-email>'));
};
async function call(name, args, allowConfirmation = false) {
 let result=await client.callTool({name,arguments:args});
 let data=decode(result);
 if(data?.status==='approval_required') {
   assert(allowConfirmation, `Unexpected approval for ${name}`);
   result=await client.callTool({name:'confirm_action',arguments:{token:data.approvalToken}});
   data=decode(result);
 }
 record({tool:name,input:redact(args),outcome:result.isError?'error':'success'});
 assert(!result.isError, `${name}: ${redact(textOf(result))}`);
 return data;
}
async function create(kind, name, args) {
 const data=await call(name,args);
 assert.equal(typeof data.id,'string', `${name} did not return an id`);
 owned.push({kind,id:data.id}); save();
 return data;
}
async function check(label, fn) {
 if (process.env.LIVE_RESOURCE_GROUP === 'allocations' && !label.startsWith('allocation') && !label.startsWith('cleanup') && !label.startsWith('active theme')) return;
 try { await fn(); record({assertion:label,outcome:'pass'}); }
 catch(error) { record({assertion:label,outcome:'failed',reason:redact(String(error.message))}); process.exitCode=1; }
}
await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../../../dist/index.js',import.meta.url))],cwd:tmpdir(),stderr:'ignore',env:{DOIT_API_KEY:process.env.DOIT_OWN_CUSTOMER_API_KEY,DOIT_DEBUG_LEVEL:'0'}}));
let originalActive;
try {
 originalActive=await call('get_active_theme',{});
 await check('allocation partial updates, group readback and list replacement',async()=>{
  const rule={components:[{key:'project_id',type:'fixed',values:[`${prefix}-never-match`],mode:'is'}],formula:'A'};
  const a=await create('allocation','create_allocation',{name:`${prefix}-single-a`,description:'Keep A',rule});
  const b=await create('allocation','create_allocation',{name:`${prefix}-single-b`,description:'Keep B',rule});
  await call('update_allocation',{id:a.id,description:''});
  const updated=await call('get_allocation',{id:a.id});
  assert.equal(updated.name,a.name); assert.equal(updated.description,'Keep A'); assert.deepEqual(updated.rule,a.rule);
  const c=await create('allocation','create_allocation',{name:`${prefix}-single-c`,rule:{components:[{key:'allocation_rule',type:'allocation_rule',values:[a.id],mode:'is'}],formula:'A'}});
  await call('update_allocation',{id:b.id,rule:{components:[{key:'project_id',type:'fixed',values:[`^${prefix}$`],mode:'regexp'}],formula:'A'}});
  assert.equal((await call('get_allocation',{id:b.id})).rule.components[0].mode,'regexp');
  const selected=[{action:'select',id:a.id},{action:'select',id:b.id}];
  const group=await create('allocation','create_allocation',{name:`${prefix}-group`,description:'Keep group',rules:[...selected,{action:'select',id:c.id}],unallocatedCosts:'Unmatched'});
  const before=await call('get_allocation',{id:group.id}); assert.equal(before.rules.length,3); assert.equal(before.unallocatedCosts,'Unmatched');
  await call('update_allocation',{id:group.id,unallocatedCosts:'Remaining'});
  const after=await call('get_allocation',{id:group.id}); assert.equal(after.name,before.name);assert.equal(after.description,before.description);assert.deepEqual(after.rules,before.rules);assert.equal(after.unallocatedCosts,'Remaining');
  await call('update_allocation',{id:group.id,rules:[...selected].reverse()});
  const reordered=await call('get_allocation',{id:group.id});assert.deepEqual(reordered.rules.map(r=>r.id),[b.id,a.id]);assert.equal(reordered.unallocatedCosts,'Remaining');
  await call('update_allocation',{id:group.id,rules:[{action:'update',id:a.id,name:`${prefix}-a-updated`,description:'Changed',...rule},{action:'select',id:b.id}]});
  assert.equal((await call('get_allocation',{id:a.id})).name,`${prefix}-a-updated`);
  await call('update_allocation',{id:group.id,unallocatedCosts:null});
  assert.equal((await call('get_allocation',{id:group.id})).unallocatedCosts,'Remaining');
 });
 await check('console label assignment, annotation offsets, omitted/null fields and empty lists',async()=>{
  const label=await create('label','create_label',{name:`${prefix}-label`,color:'blue'});
  await call('update_label',{id:label.id,name:null,color:'teal'});
  const savedLabel=await call('get_label',{id:label.id});assert.equal(savedLabel.name,label.name);assert.equal(savedLabel.color,'teal');
  const note=await create('annotation','create_annotation',{content:`${prefix}-note`,timestamp:'2026-10-05T12:00:00+01:00',labels:[label.id]});
  assert.equal(Date.parse(note.timestamp),Date.parse('2026-10-05T11:00:00Z'));
  const associations=await call('get_label_assignments',{id:label.id});assert(associations.assignments.some(a=>a.objectId===note.id&&a.objectType==='annotation'));
  await call('update_annotation',{id:note.id,content:`${prefix}-updated`});
  let saved=await call('get_annotation',{id:note.id});assert.deepEqual(saved.labels,note.labels);assert.equal(saved.timestamp,note.timestamp);assert.deepEqual(saved.reports,note.reports);
  await call('update_annotation',{id:note.id,content:saved.content,timestamp:null,labels:null,reports:null});
  const unchanged=await call('get_annotation',{id:note.id});assert.deepEqual(unchanged.labels,saved.labels);assert.equal(unchanged.timestamp,saved.timestamp);assert.deepEqual(unchanged.reports,saved.reports);
  await call('update_annotation',{id:note.id,content:saved.content,labels:[],reports:[]});
  saved=await call('get_annotation',{id:note.id});assert.deepEqual(saved.labels,[]);assert.deepEqual(saved.reports,[]);
  await call('assign_objects_to_label',{id:label.id,add:[{objectId:note.id,objectType:'annotation'}]});
  assert((await call('get_label_assignments',{id:label.id})).assignments.some(a=>a.objectId===note.id));
  await call('assign_objects_to_label',{id:label.id,remove:[{objectId:note.id,objectType:'annotation'}]});
  assert(!(await call('get_label_assignments',{id:label.id})).assignments.some(a=>a.objectId===note.id));
  for(const sortBy of ['id','content','timestamp']) { const page=await call('list_annotations',{maxResults:'1',sortBy,filter:`content:${saved.content}`});assert.equal(page.annotations[0]?.id,note.id); }
  const wrongCase=await call('list_annotations',{maxResults:'1',filter:`content:${saved.content.toUpperCase()}`});assert.equal(wrongCase.annotations.length,0);
 });
 await check('folder description clearing, omitted parent and owned-resource move',async()=>{
  const parent=await create('folder','create_folder',{name:`${prefix}-parent`,description:'Parent'});
  const child=await create('folder','create_folder',{name:`${prefix}-child`,description:'Keep',parentFolderId:parent.id});
  await call('update_folder',{id:child.id,description:null});
  let saved=await call('get_folder',{id:child.id});assert.equal(saved.description,'Keep');assert.equal(saved.parentFolderId,parent.id);
  await call('update_folder',{id:child.id,description:''});
  saved=await call('get_folder',{id:child.id});assert.equal(saved.description,'');assert.equal(saved.name,child.name);assert.equal(saved.parentFolderId,parent.id);
  await call('update_folder',{id:child.id,parentFolderId:'root'});
  saved=await call('get_folder',{id:child.id});assert.equal(saved.parentFolderId,'root');assert.equal(saved.name,child.name);
 });
 await check('update a new unused theme without switching the active theme',async()=>{
  const theme=await create('custom_theme','create_custom_theme',{name:`${prefix}-theme`,primaryColor:'#abc',colors:{light:['#123456'],dark:['#12345678']}});
  await call('update_theme',{id:theme.id,newName:`${prefix}-renamed`});
  let saved=await call('get_theme',{id:theme.id});assert.equal(saved.name,`${prefix}-renamed`);assert.equal(saved.primaryColor,theme.primaryColor);assert.deepEqual(saved.colors,theme.colors);
  await call('update_theme',{id:theme.id,primaryColor:'#ABCDEF88',colors:{light:['#abc'],dark:['#def']}});
  saved=await call('get_theme',{id:theme.id});assert.equal(saved.primaryColor,'#ABCDEF88');assert.deepEqual(saved.colors,{light:['#abc'],dark:['#def']});assert.equal(saved.name,`${prefix}-renamed`);
  assert.deepEqual(await call('get_active_theme',{}),originalActive);
 });
 await check('PUT permissions on a new private report retaining its sole owner',async()=>{
  const report=await create('report','create_report',{name:`${prefix}-private`,description:'Disposable permissions check',config:{}});
  const before=await call('get_resource_permissions',{resourceType:'reports',resourceId:report.id});
  assert(!before.public,'Fixture must already be private'); assert.equal(before.permissions.length,1);assert.equal(before.permissions[0].role,'owner');
  const args={resourceType:'reports',resourceId:report.id,permissions:before.permissions};
  await call('update_resource_permissions',{...args,public:null});
  let saved=await call('get_resource_permissions',{resourceType:'reports',resourceId:report.id});assert.deepEqual(saved.permissions,before.permissions);assert(!saved.public);
  await call('update_resource_permissions',args);
  saved=await call('get_resource_permissions',{resourceType:'reports',resourceId:report.id});assert.deepEqual(saved.permissions,before.permissions);assert(!saved.public);
 });
} finally {
 // The allowlist contains only IDs returned by this process's create calls. No blind write retries.
 for(const resource of [...owned].reverse()) {
  await check(`cleanup ${resource.kind}`,async()=>{
   await call(`delete_${resource.kind}`,{id:resource.id},true);
   const getName=resource.kind==='custom_theme'?'get_theme':resource.kind==='report'?'get_report_config':`get_${resource.kind}`;
   const result=await client.callTool({name:getName,arguments:{id:resource.id}});
   assert(result.isError, 'Deleted resource is still retrievable');
   resource.cleaned=true;save();
  });
 }
 if(originalActive) await check('active theme remained unchanged',async()=>assert.deepEqual(await call('get_active_theme',{}),originalActive));
 await client.close();
 console.log(JSON.stringify({journal,created:owned.length,cleaned:owned.filter(r=>r.cleaned).length}));
}
