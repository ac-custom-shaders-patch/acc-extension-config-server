/**
 * Simple helper allowing to create scripts somewhat similar to shell scripts, but with JS.
 * Imports some libraries, modifies shelljs to behave more according to one’s expectations,
 * allows to use await in main level and captures exceptions.
 */

// Common libs:
global.fs = require('fs');
global.path = require('path');
global.os = require('os');
require('array-flat-polyfill');

let hrstart = process.hrtime();
process.on('beforeExit', () => {
  if (!global.β || !global.β.config.measureTime && !global.β.config.measureTimeCallback) return;
  console.info(β.grey(global.β.config.measureTimeCallback ? global.β.config.measureTimeCallback() : 'Took %d s'), β.hrToSeconds(process.hrtime(hrstart)).toFixed(2));
});

// Extended JS entities:
Array.prototype.groupBy = function(c) { return this.reduce((rv, x) => { let k = c(x); (rv[k] = rv[k] || []).push(x); return rv; }, {}); };
Array.prototype.contains = function(v) { for (let i = 0; i < this.length; i++) { if(this[i] === v) return true; } return false; };
Array.prototype.unique = function() { let arr = []; for (let i = 0; i < this.length; i++) { if(!arr.contains(this[i])) { arr.push(this[i]); } } return arr; }
String.prototype.tab = function (s) { if (typeof s === 'number') s = ' '.repeat(s); return s + this.replace(/\n/g, '\n' + s); }
Array.prototype.parallel = async function (fn, concurrency = 8) { 
  const PromisePool = require('es6-promise-pool')
  let index = 0;
  return new PromisePool(() => index >= this.length ? null : fn(this[index++]), concurrency).start();
};
path.extIs = (f, ...args) => args.indexOf(path.extname(f)) !== -1;

// Just https://github.com/nfischer/shelljs-exec-proxy, but supporting parameters:
const origShell = require('shelljs');
const proxyifyCmd = (target, ...cmdStart) => {
  const cmdArrayAttr = '__cmdStart__';
  const secureArgument = v => JSON.stringify(('' + v).replace(/\\/g, '/'));
  target = target || function _t(...args) {
    const argsList = [];
    let opts = {};
    for (let a of cmdStart.concat(args)){
      if (typeof a === 'object' && a) opts = Object.assign(opts, a);
      else argsList.push(secureArgument(a));
    }
    return origShell.exec.apply(this.stdout, [ argsList.join(' '), opts ]);
  };
  target[cmdArrayAttr] = cmdStart;
  const handler = {
    deleteProperty: (t, methodName) => {
      if (methodName === cmdArrayAttr) throw new Error(`Cannot delete reserved attribute '${methodName}'`);
      delete t[methodName];
    },
    set: (t, methodName, value) => {
      if (methodName === cmdArrayAttr) throw new Error(`Cannot modify reserved attribute '${methodName}'`);
      t[methodName] = value;
      return t[methodName];
    },
    has: (t, methodName) => (methodName in t),
    ownKeys: t => Object.keys(t),
    get: (t, methodName) => {
      if (methodName == 'withOptions') return o => proxyifyCmd(null, ...t[cmdArrayAttr], o);
      const noProxyifyList = ['inspect', 'valueOf'];
      return (methodName in t || noProxyifyList.includes(methodName)) ? t[methodName] : proxyifyCmd(null, ...t[cmdArrayAttr], methodName);
    },
  };
  return new Proxy(target, handler);
};
global.$ = proxyifyCmd(origShell);

// Different implementation of some things, working as one (me) would expect:
$.exec = (cmd, opts) => new Promise((resolve, reject) => {
  opts = Object.assign({
    cwd: path.resolve(process.cwd()).toString(),
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
    encoding: 'utf8',
  }, opts);

  if (opts.debug) $.echo(β.yellow(cmd));
  var c = require('child_process').exec(cmd, opts, (err, stdout, stderr) => {
    if (err && opts.fail) $.fail(`Command “${cmd}” failed: code=${err.code}`);
    resolve(!err);
  });

  if (!opts.silent && !opts.quiet) {
    c.stdout.on('data', c => {
      if (opts.stdoutCallback) {
        opts.stdoutCallback(opts.stdoutProc ? opts.stdoutProc(c) : c);
      } else {
        let msg = opts.stdoutProc ? opts.stdoutProc(c) : c;
        if (!msg) return;
        if (β.config.colorful) process.stdout.write('[1;30m');
        process.stdout.write(msg);
        if (β.config.colorful) process.stdout.write('[0m');
      }
    });
  }

  if (!opts.silent) {
    c.stderr.on('data', c => {
      if (opts.stderrCallback) {
        opts.stderrCallback(opts.stderrProc ? opts.stderrProc(c) : c);
      } else {
        let msg = opts.stderrProc ? opts.stderrProc(c) : c;
        if (!msg) return;
        if (β.config.colorful) process.stderr.write('[1;31m');
        process.stderr.write(msg);
        if (β.config.colorful) process.stderr.write('[0m');
      }
    });
  }
});

// Additional shell things:
$.silent = m => { $.config.silent = true; let r = m(); $.config.silent = false; return r; }
$.glob = (...args) => args.map(x => require('glob').sync(x)).flat();
$.globAsync = (...args) => new Promise((resolve, reject) => Promise.all(args.map(x => new Promise((resolve, reject) => 
  require('glob')(x, (er, files) => er ? reject(er) : resolve(files))))).then(values => resolve(values.flat(Infinity))));
$.fail = m => { $.echo(β.red((/^\w*error:\s+/i.test(m) ? '' : 'Error: ') + (m && m.stack || m))); $.exit(1); };
$.pushd = (function (m){ $.config.silent = true; let r = this(m); $.config.silent = false; return r; }).bind($.pushd);
$.popd = (function (m){ $.config.silent = true; let r = this(m); $.config.silent = false; return r; }).bind($.popd);
$.viewInExplorer = m => $.cd(path.dirname(m)) && $.exec(`explorer /select,"${path.basename(m)}"`);
$.cleanText = m => ('' + m).replace(/\r?\n|\r/g, '\n');
$.readText = m => $.cleanText(fs.readFileSync(m));

$.zip = (list, options) => new Promise((resolve, reject) => {
  if (!options) throw new Error('$.zip: second argument `options` is missing');
  if (typeof options == 'string') options = { to: options };
  const Zip = require('jszip');
  const p = new Zip();
  var H = null;
  list.forEach(L => {
    var Lkey = L.key || '';
    if (options.prefix) Lkey = options.prefix + '/' + Lkey;
    Lkey = Lkey.replace(/[\\\/]+/g, '/').replace(/^\/+|\/+$/, '')
    var P = JSON.parse(JSON.stringify(L));
    delete P.dir;
    if (L.dir) {
      $.glob(L.dir + '/' + (L.search || (L.rec ? '**/*.*' : '*.*'))).forEach(b => {
        var a = b.substr(L.dir.length).replace(/\\/g, '/').replace(/^\/+/, '');
        var k = !L.filter || (L.filter instanceof RegExp ? L.filter.test(a) :  L.filter(a));
        if (k) {
          // console.log(b);
          add((Lkey ? Lkey + '/' : '') + (k === true ? a : k), fs.readFileSync(b));
        }
      });
    } else if (L.file && Lkey){
      add(Lkey, fs.readFileSync(L.file));
    } else if (L.data && Lkey){
      add(Lkey, L.data);
    }
    function add(key, value){
      if (options.checksum){
        if (!H) H = require('xxhashjs').h32(0xABCD);
        H.update(key);
        H.update(value);
      }
      p.file(key, value, P);
    }
  });
  p.generateNodeStream({ 
    type: 'nodebuffer', comment: options.comment, 
    compression: 'DEFLATE', compressionOptions: { level: 9 }
  }).pipe(fs.createWriteStream(options.to)).on('finish', () => options.checksum ? resolve(H.digest().toString(16)) : resolve());
});

// Extra object for shell stuff:
global.β = { config: { colorful: true } };
β.grey = m => β.config.colorful ? '[1;30m' + m + '[0;1m' : m;
β.red = m => β.config.colorful ? '[1;31m' + m + '[0;1m' : m;
β.green = m => β.config.colorful ? '[1;32m' + m + '[0;1m' : m;
β.yellow = m => β.config.colorful ? '[1;33m' + m + '[0;1m' : m;
β.blue = m => β.config.colorful ? '[1;34m' + m + '[0;1m' : m;
β.magenta = m => β.config.colorful ? '[1;35m' + m + '[0;1m' : m;
β.invert = m => β.config.colorful ? '[7m' + m + '[0;1m' : m;
β.noinvert = m => β.config.colorful ? '[27m' + m + '[0;1m' : m;
β.hrToSeconds = m => m[0] + m[1] / 1000000000;
β.hrToMs = m => m[0] * 1e3 + Math.round(m[1] / 1000000);
β.extensionIs = function(){ let a = [].slice.call(arguments); return m => /(\.\w+)$/.test(m) && a.indexOf(RegExp.$1.toLowerCase()) !== -1 };

β.setStorage = (n, setGlobal = true) => {
  if (β.storage) throw new Error('β.setStorage: storage is already set');
  let store = {};
  try { store = fs.existsSync(n) ? JSON.parse(fs.readFileSync(n)) : {}; } catch (e){ $.fail(e); }
  let dirty = false, busy = false;
  let save = setTimeout.bind(null, () => {
    if (!dirty) return;
    if (busy) return save();
    dirty = false;
    busy = true;
    fs.writeFile(n + '.tmp', JSON.stringify(store), () => {
      $.mv(n + '.tmp', n);
      busy = false;
    });
  }, 100);
  β.storage = new Proxy({}, {
    get: (o, k) => store[k],
    set: (o, k, v) => { dirty = true; store[k] = v; save(); return true; },
    deleteProperty: (o, k) => { dirty = true; delete store[k]; save(); return true; },
    has: (o, k) => store.hasOwnProperty(k)
  });
  if (setGlobal){
    global.storage = β.storage;
  }
};

// From https://github.com/robertklep/top-level-await:
const Module = require('module').Module;
Module.wrap = function(...args){
  return this.apply(Module, [ `try { ${args[0]}; } catch (e){ $.fail(e); }` ].concat(args.slice(1))).replace(/^\(function/, '(async function');
}.bind(Module.wrap);