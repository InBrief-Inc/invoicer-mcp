import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readableModules } from '../scripts/readable-modules.mjs';

function compare(source, maxBytes = 550) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicer-module-semantics-'));
  try {
    const original = path.join(temp, 'original'), modular = path.join(temp, 'modular');
    for (const directory of [original, modular]) {
      fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}');
      fs.writeFileSync(path.join(directory, 'fixture.json'), '{"number":42}');
    }
    fs.writeFileSync(path.join(original, 'cli.js'), source);
    const files = readableModules(source, { maxBytes });
    assert.deepEqual([...files], [...readableModules(source, { maxBytes })], 'deterministic output');
    for (const [name, text] of files) {
      const target = path.join(modular, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
    }
    const run = directory => execFileSync(process.execPath, [path.join(directory, 'cli.js')], { encoding: 'utf8' });
    assert.equal(run(modular), run(original));
    assert.ok(files.size > 2, 'exercise references across multiple files');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

test('preserves hoisting, redeclarations, writes, loop captures and local shadowing', () => compare(`
const result = [];
result.push(before());
var repeated;
var repeated = { b: [3], r: [4] };
var constructor;
var __proto__;
result.push(constructor === undefined, __proto__ === undefined);
var first = repeated.b, second = repeated.r;
function before() { return 'hoisted'; }
var total = 0;
for (var i = 0; i < 4; i++) total += i;
for (var key in {a:1,b:2}) result.push(key);
for (var value of [2,3]) total += value;
function local(total) { var i = 8; return total + i; }
function mutate() { total++; return total; }
result.push(first[0], second[0], i, total, local(4), mutate(), {total});
console.log(JSON.stringify(result));
`));

test('preserves receivers, recursion, class constructors and property keys', () => compare(`
function receiver() { return this === undefined; }
function tag(strings) { return this === undefined && strings[0]; }
function factorial(n) { return n < 2 ? 1 : n * factorial(n - 1); }
var obj = { number: 3, method() { return this.number; } };
var Base = class { constructor(value) { this.value = value; } };
var Derived = class extends Base { number() { return this.value; } };
console.log(JSON.stringify([receiver(), receiver?.(), tag\`yes\`, factorial(5), obj.method(), new Derived(7).number()]));
`));

test('preserves native imports, relative assets and top-level await ordering', () => compare(`
import {readFileSync} from 'node:fs';
var events = [];
var unused = async () => { await Promise.resolve(); return 1; };
events.push('first');
queueMicrotask(() => events.push('microtask'));
events.push('second');
var data = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
await Promise.resolve();
events.push(data.number, import.meta.url.endsWith('/cli.js'));
console.log(JSON.stringify(events));
`, 300));

test('refuses an oversized statement instead of encoding executable code', () => {
  assert.throws(() => readableModules(`var text = '${'a'.repeat(1000)}';`, { maxBytes: 100 }), /statement exceeds/);
});
