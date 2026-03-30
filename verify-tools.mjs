import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  env: { ...process.env, DOIT_API_KEY: 'test-key' }
});

const client = new Client({ name: 'verifier', version: '1.0' }, { capabilities: {} });
try {
  await client.connect(transport);
} catch (e) {
  console.error('Connect failed:', e.message);
  process.exit(1);
}

let result;
try {
  result = await client.listTools();
} catch (e) {
  console.error('listTools failed:', e.message);
  process.exit(1);
}

const tools = result.tools;
console.log(`Total tools: ${tools.length}`);

const missing = [], partial = [];
for (const tool of tools) {
  const a = tool.annotations;
  if (!a) { missing.push(tool.name); continue; }
  const prob = [];
  if (typeof a.readOnlyHint !== 'boolean') prob.push('readOnlyHint');
  if (typeof a.destructiveHint !== 'boolean') prob.push('destructiveHint');
  if (typeof a.openWorldHint !== 'boolean') prob.push('openWorldHint');
  if (prob.length) partial.push(`${tool.name}: ${prob.join(', ')}`);
}

if (!missing.length && !partial.length) {
  console.log('✅ All tools have complete annotations');
} else {
  missing.forEach(t => console.log(`❌ No annotations: ${t}`));
  partial.forEach(t => console.log(`❌ Partial: ${t}`));
}

console.log('\nAnnotations:');
for (const t of tools) {
  const a = t.annotations ?? {};
  console.log(`  ${t.name.padEnd(38)} RO=${String(a.readOnlyHint??'?').padEnd(5)} D=${String(a.destructiveHint??'?').padEnd(5)} OW=${a.openWorldHint??'?'}`);
}

transport.close();
