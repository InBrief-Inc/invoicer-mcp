import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';

/** Preserve dependency license text and embedded copyright notices. */
export function dependencyNotices(root, inputs) {
  const packages = new Map(), embedded = new Map();
  for (const input of Object.keys(inputs).sort()) {
    const file = path.resolve(root, input);
    if (!file.includes(`${path.sep}node_modules${path.sep}`)) continue;
    let directory = path.dirname(file);
    while (directory.includes(`${path.sep}node_modules`)) {
      const manifest = path.join(directory, 'package.json');
      if (fs.existsSync(manifest)) {
        const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        if (data.name) { packages.set(`${data.name}@${data.version}`, { directory, data }); break; }
      }
      directory = path.dirname(directory);
    }
    if (!/\.[cm]?js$/.test(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const { comments } = parse(source, { sourceType: 'unambiguous', allowReturnOutsideFunction: true });
    const notices = [];
    for (let index = 0; index < comments.length; index++) {
      const comment = comments[index];
      if (!/copyright|@license|@preserve|licensed under/i.test(comment.value)) continue;
      let end = comment.end;
      while (index + 1 < comments.length && /^\s*$/.test(source.slice(end, comments[index + 1].start))) {
        end = comments[++index].end;
      }
      notices.push(source.slice(comment.start, end));
    }
    if (notices.length) embedded.set(input, notices.join('\n\n'));
  }
  const sections = ['# Bundled dependency notices\n\nGenerated from the pinned npm artifacts. Source copyright comments are retained below.'];
  for (const [name, { directory, data }] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
    const licenses = fs.readdirSync(directory).filter(name => /^(licen[sc]e|notice|copying)(\.|$)/i.test(name));
    const author = typeof data.author === 'string' ? data.author : data.author?.name;
    sections.push(`## ${name}\n\nDeclared license: ${data.license}\n${author ? `Author: ${author}\n` : ''}`);
    for (const license of licenses) sections.push(fs.readFileSync(path.join(directory, license), 'utf8'));
    if (!licenses.length) {
      sections.push('The npm artifact does not include a standalone license file. Its package metadata and source notices are preserved here.');
      if (data.name === '@invoicer/cli') sections.push(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
    }
  }
  for (const [name, notice] of embedded) sections.push(`## Embedded notices: ${name}\n\n${notice}`);
  return sections.join('\n\n').replace(/[\t ]+$/gm, '') + '\n';
}
