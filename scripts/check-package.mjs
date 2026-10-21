import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUtf8 } from 'node:buffer';
import { createHash } from 'node:crypto';
import { parse } from '@babel/parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function checkPackage(plugin = path.join(root, 'plugins/invoicer')) {
  const files = [];
  function visit(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      assert.ok(!item.isSymbolicLink(), `No symbolic links: ${absolute}`);
      if (item.isDirectory()) visit(absolute);
      else files.push(path.relative(plugin, absolute));
    }
  }
  visit(plugin);
  assert.ok(files.length <= 512, 'Claude accepts at most 512 plugin files for automatic inspection');
  let maxTextBytes = 0;
  for (const name of files) {
    const bytes = fs.readFileSync(path.join(plugin, name));
    if (/\.(png|ttf)$/.test(name)) continue;
    assert.ok(isUtf8(bytes) && !bytes.includes(0), `Not readable UTF-8: ${name}`);
    assert.ok(bytes.length < 256 * 1024, `Exceeds Claude's 256 KiB text limit: ${name}`);
    maxTextBytes = Math.max(maxTextBytes, bytes.length);
    if (name.endsWith('.js')) parse(bytes.toString(), { sourceType: 'module' });
  }
  const build = JSON.parse(fs.readFileSync(path.join(plugin, 'server/BUILD.json'), 'utf8'));
  for (const [name, recorded] of Object.entries(build.files)) {
    const bytes = fs.readFileSync(path.join(plugin, 'server/dist', name));
    assert.equal(bytes.length, recorded.bytes, name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), recorded.sha256, name);
  }
  for (const name of ['plugin.json', '.claude-plugin/plugin.json']) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(plugin, name))).version, build.version);
  }
  return { version: build.version, files: files.length, maxTextBytes, maxAllowedTextBytes: 256 * 1024 };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(checkPackage(), null, 2));
