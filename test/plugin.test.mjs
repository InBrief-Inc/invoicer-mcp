import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { checkPackage } from '../scripts/check-package.mjs';

const plugin = path.resolve('plugins/invoicer');
const publishedCli = path.resolve('node_modules/@invoicer/cli/scripts/invoice.mjs');
const catalog = JSON.parse(fs.readFileSync('node_modules/@invoicer/cli/dist/mcp/catalog.json', 'utf8'));

test('all distributed files are readable, below size limits and match recorded hashes', () => checkPackage(plugin));

test('standalone plugin exercises all 15 tools and matches the published CLI', { timeout: 30000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicer readable plugin '));
  const copy = path.join(temp, 'plugin with spaces'), workspace = path.join(temp, 'workspace');
  fs.cpSync(plugin, copy, { recursive: true });
  assert.ok(!fs.existsSync(path.join(copy, 'node_modules')));
  fs.mkdirSync(workspace);
  fs.writeFileSync(path.join(workspace, 'config.json'), JSON.stringify({
    version: 1, client: [{ id: 'acme', name: 'Acme', currency: 'USD', defaultRate: 100,
      invoiceAutomation: { autoSend: true, dueDays: 14 } }],
    from: { name: 'Example Business', email: 'example@example.com', smtpPass: 'private-fixture-value' },
    invoicePrefix: 'INV',
  }));
  let client;
  async function connect(entry) {
    const connected = new Client({ name: 'readable-plugin-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath, args: [entry, 'mcp'], cwd: temp,
      env: { ...process.env, NODE_PATH: '', INVOICER_WORKSPACE: workspace }, stderr: 'pipe',
    });
    let errors = '';
    transport.stderr.on('data', bytes => { errors += bytes.toString(); });
    try { await connected.connect(transport); }
    catch (error) { throw new Error(`${error.message}\n${errors}`); }
    return connected;
  }
  const covered = new Set();
  async function call(name, args = {}) {
    covered.add(name);
    const reply = await client.callTool({ name, arguments: args });
    assert.ok(!reply.isError, `${name}: ${JSON.stringify(reply.content)}`);
    assert.ok(!JSON.stringify(reply).includes('private-fixture-value'), 'credentials stay private');
    return reply.structuredContent;
  }
  const entry = path.join(copy, 'server/dist/cli.js');
  try {
    client = await connect(entry);
    const tools = (await client.listTools()).tools;
    assert.deepEqual(tools.map(tool => tool.name), catalog.map(tool => tool.name));
    assert.equal((await call('get_workspace_status')).connected, true);
    assert.equal((await call('list_clients')).items[0].id, 'acme');
    assert.equal((await call('get_timer')).timer, null);
    const args = { requestId: randomUUID(), clientId: 'acme', date: '2026-09-01', hours: 2, description: 'Website update · تحديث الموقع' };
    const logged = await call('log_time', args);
    assert.deepEqual(await call('log_time', args), logged);
    assert.equal((await call('list_time_entries')).total, 1);
    assert.equal((await call('get_unbilled_summary')).clients[0].amount, 200);
    await call('start_timer', { requestId: randomUUID(), clientId: 'acme', description: 'Timer check' });
    const timerPath = path.join(workspace, 'data/active-timer.json');
    const timer = JSON.parse(fs.readFileSync(timerPath, 'utf8'));
    timer.startedAt = new Date(Date.now() - 120000).toISOString();
    fs.writeFileSync(timerPath, JSON.stringify(timer));
    assert.ok((await call('pause_timer', { requestId: randomUUID() })).timer.pausedAt);
    await call('resume_timer', { requestId: randomUUID() });
    await call('stop_timer', { requestId: randomUUID() });
    assert.equal((await call('get_timer')).timer, null);
    const selection = { clientId: 'acme', periodFrom: '2026-09-01', periodTo: '2026-09-30', entryIds: [logged.entry.id] };
    const preview = await call('preview_invoice', selection);
    assert.equal(preview.draft.total, 200);
    const draftArgs = { ...selection, previewToken: preview.previewToken, requestId: randomUUID() };
    const draft = await call('create_invoice_draft', draftArgs);
    assert.equal(draft.status, 'draft'); assert.equal(draft.autoSend, false); assert.equal(draft.scheduledSendDate, null);
    assert.deepEqual(await call('create_invoice_draft', draftArgs), draft);
    assert.equal((await call('list_invoices')).total, 1);
    assert.equal((await call('get_invoice', { invoiceId: draft.id })).id, draft.id);
    const pdf = await client.callTool({ name: 'export_invoice_pdf', arguments: { invoiceId: draft.id } });
    covered.add('export_invoice_pdf');
    assert.ok(!pdf.isError, JSON.stringify(pdf));
    assert.equal(pdf.content[0].resource.mimeType, 'application/pdf');
    assert.equal(Buffer.from(pdf.content[0].resource.blob, 'base64').subarray(0, 4).toString(), '%PDF');
    assert.equal(covered.size, 15);
    const denied = await client.callTool({ name: 'get_timer', arguments: { workspace: '/' } });
    assert.equal(denied.isError, true);
    const changed = await client.callTool({ name: 'log_time', arguments: { ...args, hours: 3 } });
    assert.equal(changed.isError, true);
    await client.close();
    client = await connect(entry);
    assert.deepEqual(await call('log_time', args), logged, 'retry survives reconnect');
    const currentClients = await client.callTool({ name: 'list_clients', arguments: {} });
    await client.close();
    client = await connect(publishedCli);
    assert.deepEqual((await client.listTools()).tools, tools, 'tool schema matches the published CLI');
    assert.deepEqual(await client.callTool({ name: 'list_clients', arguments: {} }), currentClients);
    assert.deepEqual(await client.callTool({ name: 'export_invoice_pdf', arguments: { invoiceId: draft.id } }), pdf,
      'Latin and Arabic PDF bytes match the original published implementation');
    await client.close();
    client = await connect(entry);
    fs.writeFileSync(path.join(workspace, 'data/mcp-requests.json'), '[]');
    const malformed = await client.callTool({ name: 'log_time', arguments: { ...args, requestId: randomUUID() } });
    assert.equal(malformed.isError, true, 'malformed request history fails closed');
  } finally { if (client) await client.close(); fs.rmSync(temp, { recursive: true, force: true }); }
});
