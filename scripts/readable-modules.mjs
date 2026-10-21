import assert from 'node:assert/strict';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';

const traverse = traverseModule.default;
const generate = generateModule.default;
const stateName = '__invoicerModuleState';
const state = () => t.identifier(stateName);
const field = name => t.memberExpression(state(), t.identifier(name));
const print = node => generate(node, { comments: true, compact: false, minified: false }).code;

/**
 * Split readable JavaScript at complete statement boundaries. No strings of code
 * are evaluated, decoded or downloaded. Explicit shared bindings preserve the
 * original bundle's closures, writes and execution order across small files.
 * Function declarations are installed first, as JavaScript hoisting requires.
 */
export function readableModules(source, { maxBytes = 190 * 1024 } = {}) {
  const ast = parse(source, { sourceType: 'module' });
  for (const comment of ast.comments) comment.value = comment.value.replace(/[\t ]+$/gm, '');
  let program;
  traverse(ast, { Program(path) { program = path; path.stop(); } });
  assert.ok(!program.scope.hasBinding(stateName), 'Reserved state identifier');
  const imports = ast.program.body.filter(node => t.isImportDeclaration(node));
  const bindings = Object.values(program.scope.bindings);
  const bindingByName = new Map(bindings.map(binding => [binding.identifier.name, binding]));
  const importedNames = imports.flatMap(node => node.specifiers.map(specifier => specifier.local.name));
  const globalDeclarations = new WeakSet();
  traverse(ast, { VariableDeclarator(path) {
    if (t.isIdentifier(path.node.id)
      && path.scope.getBinding(path.node.id.name) === bindingByName.get(path.node.id.name)) {
      globalDeclarations.add(path.node);
    }
  } });

  // Only references belonging to the top-level binding are changed. Locals,
  // parameters, object keys and class names keep their original lexical scopes.
  for (const binding of bindings) {
    for (const reference of binding.referencePaths) {
      const unboundCall = ((reference.parentPath.isCallExpression() || reference.parentPath.isOptionalCallExpression()) && reference.key === 'callee')
        || (reference.parentPath.isTaggedTemplateExpression() && reference.key === 'tag');
      const replacement = field(binding.identifier.name);
      // `f()` must remain unbound; `state.f()` would change the receiver.
      reference.replaceWith(unboundCall ? t.sequenceExpression([t.numericLiteral(0), replacement]) : replacement);
    }
    for (const violation of binding.constantViolations) {
      // Repeated `var` initializers and loop declarations are rewritten below.
      if (violation.isVariableDeclarator()) continue;
      const target = violation.isAssignmentExpression() ? violation.get('left')
        : violation.isUpdateExpression() ? violation.get('argument')
        : violation.isForXStatement() ? violation.get('left') : null;
      if (target?.isVariableDeclaration() || target?.isMemberExpression()) continue;
      assert.ok(target?.isIdentifier(), `Unsupported write to ${binding.identifier.name}`);
      target.replaceWith(field(binding.identifier.name));
    }
  }
  traverse(ast, {
    TemplateLiteral(path) {
      if (path.parentPath.isTaggedTemplateExpression()) return;
      // Keep significant PDF xref spaces without trailing whitespace in source.
      for (const quasi of path.node.quasis) {
        quasi.value.raw = quasi.value.raw.replace(/[\t ]+(?=\r?\n)/g,
          spaces => [...spaces].map(character => character === ' ' ? '\\x20' : '\\t').join(''));
      }
    },
    VariableDeclaration(path) {
      const declarations = path.node.declarations;
      const global = declarations.filter(declaration => globalDeclarations.has(declaration));
      if (!global.length) return;
      assert.equal(global.length, declarations.length, 'Mixed local/global declaration');
      const assignments = global.filter(declaration => declaration.init).map(declaration =>
        t.assignmentExpression('=', field(declaration.id.name), declaration.init));
      if (path.parentPath.isForXStatement() && path.key === 'left') {
        assert.equal(global.length, 1);
        path.replaceWith(field(global[0].id.name));
      } else if (path.parentPath.isForStatement() && path.key === 'init') {
        if (assignments.length) path.replaceWith(assignments.length === 1 ? assignments[0] : t.sequenceExpression(assignments));
        else path.remove();
      } else {
        // A bare `var x` never resets an already assigned hoisted binding.
        const replacements = assignments.map(assignment => t.expressionStatement(assignment));
        if (replacements.length) path.replaceWithMultiple(replacements);
        else path.remove();
      }
    },
    MemberExpression(path) {
      if (t.isMetaProperty(path.node.object) && path.node.object.meta.name === 'import') {
        assert.ok(!path.node.computed && t.isIdentifier(path.node.property, { name: 'url' }), 'Unsupported import.meta access');
        path.replaceWith(field('moduleUrl'));
      }
    },
  });

  const statements = [];
  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node)) continue;
    if (t.isFunctionDeclaration(node)) {
      assert.ok(node.id, 'A declaration must be named');
      const value = t.functionExpression(t.cloneNode(node.id), node.params, node.body, node.generator, node.async);
      const assignment = t.expressionStatement(t.assignmentExpression('=', field(node.id.name), value));
      assignment.leadingComments = node.leadingComments;
      statements.push({ phase: 'declare', code: print(assignment), async: false });
    } else {
      assert.ok(!t.isExportDeclaration(node) && !t.isClassDeclaration(node), 'Unsupported module declaration');
      const topLevelAwait = child => {
        if (!child || t.isFunction(child)) return false;
        if (t.isAwaitExpression(child) || (t.isForOfStatement(child) && child.await)) return true;
        return (t.VISITOR_KEYS[child.type] || []).some(key => Array.isArray(child[key])
          ? child[key].some(topLevelAwait) : topLevelAwait(child[key]));
      };
      const hasAwait = topLevelAwait(node);
      statements.push({ phase: 'initialize', code: print(node), async: hasAwait });
    }
  }

  // A statement stays whole, including font tables and license comments. Reject
  // an oversized statement rather than hiding it in encoded or binary data.
  const chunks = [];
  let current = [], size = 0;
  for (const statement of statements) {
    const bytes = Buffer.byteLength(statement.code) + 2;
    assert.ok(bytes < maxBytes, 'A statement exceeds the readable-module budget');
    if (size + bytes >= maxBytes && current.length) { chunks.push(current); current = []; size = 0; }
    current.push(statement); size += bytes;
  }
  if (current.length) chunks.push(current);

  const files = new Map();
  const headers = [];
  const declarations = [], initializers = [];
  chunks.forEach((chunk, index) => {
    const name = `runtime-${String(index + 1).padStart(3, '0')}.js`;
    const declared = chunk.filter(statement => statement.phase === 'declare');
    const initialized = chunk.filter(statement => statement.phase === 'initialize');
    const async = initialized.some(statement => statement.async);
    files.set(`modules/${name}`, [
      '// Readable Invoicer MCP runtime. Generated by scripts/build.mjs.',
      '// Dependencies are included as source. This file never downloads or decodes executable code.',
      `export function declare(${stateName}) {\n${declared.map(s => s.code).join('\n\n')}\n}`,
      `export ${async ? 'async ' : ''}function initialize(${stateName}) {\n${initialized.map(s => s.code).join('\n\n')}\n}\n`,
    ].join('\n\n'));
    headers.push(`import { declare as declare${index}, initialize as initialize${index} } from './modules/${name}';`);
    declarations.push(`declare${index}(${stateName});`);
    initializers.push(`${async ? 'await ' : ''}initialize${index}(${stateName});`);
  });
  const nativeImports = imports.map(print).join('\n');
  const stateProperties = importedNames.map(name => `${name}`).join(', ');
  files.set('cli.js', [
    '#!/usr/bin/env node',
    '// Node starts only this MCP server. All executable modules are committed readable JavaScript.',
    nativeImports, ...headers,
    `const ${stateName} = Object.assign(Object.create(null), { moduleUrl: import.meta.url, ${stateProperties} });`,
    '// Match declaration hoisting before executing the original statements in order.',
    ...declarations, ...initializers, '',
  ].join('\n'));
  return files;
}
