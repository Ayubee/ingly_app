const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const babel = require('../../mobile/node_modules/@babel/core');
const root = path.resolve(__dirname, '../..');
function load(file, dependencies, globals = {}) {
  const code = babel.transformSync(fs.readFileSync(path.join(root, file), 'utf8'), {
    filename: file, babelrc: false, configFile: false, plugins: [
      require.resolve('../../mobile/node_modules/@babel/plugin-transform-react-jsx'),
      require.resolve('../../mobile/node_modules/@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = { exports: {}, console, Date, Map, Set, Math, Promise, AbortController, setTimeout, clearTimeout,
    process: { env: {} }, __DEV__: false, ...globals,
    require: name => { assert(name in dependencies, 'Unmocked import: ' + name); return dependencies[name]; } };
  vm.runInNewContext(code, context, { filename: file });
  return context.exports;
}
function hooks() {
  const states = [], refs = [], effects = [];
  let stateIndex = 0, refIndex = 0;
  const React = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
    createElement: (type, props, ...children) => ({ type, ...props, children }),
    useState: value => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = value;
      return [states[index], next => states[index] = typeof next === 'function' ? next(states[index]) : next];
    },
    useRef: value => refs[refIndex++] ||= { current: value },
    useEffect: callback => { if (!effects.length) effects.push(callback); },
  };
  return { React, states, effects, render: callback => { stateIndex = 0; refIndex = 0; return callback(); } };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.children)];
}
function textOf(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  return node && typeof node === 'object' ? textOf(node.children) : '';
}
function screen(api) {
  const h = hooks(), alerts = [];
  const names = ['View','Text','TextInput','TouchableOpacity','ScrollView','SafeAreaView','KeyboardAvoidingView'];
  const native = Object.fromEntries(names.map(name => [name, name]));
  const module = load('mobile/src/screens/AuthScreen.js', {
    react: h.React, 'react-native': { ...native, StyleSheet: { create: value => value }, Platform: { OS: 'android' }, Alert: { alert: (...args) => alerts.push(args) } },
    '../theme.js': { colors: { primary: { DEFAULT: '#000' } } }, '../context/UserContext.js': { useUser: () => api },
  });
  const render = () => h.render(() => module.default());
  return { render, alerts,
    input: (placeholder, value) => nodes(render()).find(node => node.type === 'TextInput' && node.placeholder === placeholder).onChangeText(value),
    press: label => nodes(render()).find(node => node.type === 'TouchableOpacity' && textOf(node) === label).onPress(),
  };
}
module.exports = { load, hooks, nodes, textOf, screen, flush: () => new Promise(resolve => setImmediate(resolve)) };
