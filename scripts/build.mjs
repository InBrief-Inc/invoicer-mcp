import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { readableModules } from './readable-modules.mjs';
import { dependencyNotices } from './notices.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugins/invoicer');
const source = path.resolve(path.dirname(fileURLToPath(import.meta.resolve('@invoicer/cli/mcp'))), '../..');
const packageJson = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const entry = `import { createProjectPaths } from ${JSON.stringify(path.join(source, 'dist/core/paths.js'))};
import { createExecutor } from ${JSON.stringify(path.join(source, 'dist/mcp/operations.js'))};
import { runStdio } from ${JSON.stringify(path.join(source, 'dist/mcp/server.js'))};
if (process.argv[2] === '--version') {
  console.log(${JSON.stringify(version)});
} else if (process.argv[2] && process.argv[2] !== 'mcp') {
  throw new Error('This plugin serves MCP only. Use Invoicer or @invoicer/cli for other commands.');
} else {
  await runStdio(createExecutor(createProjectPaths()));
}`;
const result = await build({
  absWorkingDir: root,
  stdin: { contents: entry, resolveDir: root, sourcefile: 'server-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22.18',
  mainFields: ['module', 'main'], minify: false, keepNames: true,
  legalComments: 'inline', metafile: true, write: false,
  external: ['@napi-rs/keyring'],
  banner: { js: "import { createRequire as __invoicerCreateRequire } from 'node:module'; const require = __invoicerCreateRequire(import.meta.url);" },
});
const files = readableModules(result.outputFiles[0].text);
files.set('THIRD_PARTY_NOTICES.txt', dependencyNotices(root, result.metafile.inputs));
for (const [name, code] of files) {
  if (Buffer.byteLength(code) >= 256 * 1024) throw new Error(`Unreadable size: ${name}`);
}
const destination = path.join(plugin, 'server/dist');
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
for (const [name, code] of files) {
  const target = path.join(destination, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, code);
}
fs.cpSync(path.join(source, 'dist/pdf-assets'), path.join(destination, 'pdf-assets'), { recursive: true });
fs.writeFileSync(path.join(plugin, 'server/package.json'), JSON.stringify({ name: 'invoicer-mcp-runtime', version, private: true, type: 'module' }, null, 2) + '\n');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(path.join(plugin, 'server/BUILD.json'), JSON.stringify({
  version, sourcePackage: `${packageJson.name}@${packageJson.version}`,
  sourcePackageIntegrity: lock.packages['node_modules/@invoicer/cli'].integrity,
  runtime: 'Node.js >=22.18.0', transport: 'MCP stdio',
  packaging: 'Readable JavaScript modules; no minification, runtime install or executable decoding',
  files: Object.fromEntries([...files].map(([name, code]) => [name, { bytes: Buffer.byteLength(code), sha256: sha256(code) }])),
}, null, 2) + '\n');
for (const manifest of ['plugin.json', '.claude-plugin/plugin.json']) {
  const target = path.join(plugin, manifest);
  const json = JSON.parse(fs.readFileSync(target, 'utf8'));
  json.version = version;
  fs.writeFileSync(target, JSON.stringify(json, null, 2) + '\n');
}
console.log(`Built plugin ${version} from ${packageJson.name}@${packageJson.version}: ${files.size} runtime source and notice files.`);
