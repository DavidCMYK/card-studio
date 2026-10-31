/** Tiny no-dependency bundle for the compiled CommonJS modules. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, '.build');
const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const modules = {};
for (const name of fs.readdirSync(source).filter(x => x.endsWith('.js'))) {
  modules[name.slice(0, -3)] = fs.readFileSync(path.join(source, name), 'utf8');
}
const factories = Object.entries(modules).map(([name, contents]) => `${JSON.stringify(name)}: function(module, exports, require) {\n${contents}\n}`).join(',\n');
const body = `/** Card Studio browser bundle. Source: src/*.ts */\n(function(){\n'use strict';\nconst factories={\n${factories}\n};\nconst cache={};\nfunction load(id){ id=id.replace(/^\\.\\//,'');if(cache[id])return cache[id].exports;const fn=factories[id];if(!fn)throw new Error('Missing module: '+id);const module={exports:{}};cache[id]=module;fn(module,module.exports,load);return module.exports;}\nload('main');\n})();\n`;
fs.writeFileSync(path.join(outDir, 'app.js'), body);
console.log(`Built ${Object.keys(modules).length} modules -> dist/app.js (${body.length.toLocaleString()} bytes)`);
