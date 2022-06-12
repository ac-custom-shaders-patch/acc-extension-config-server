const EventEmitter = require('events');
const xxhashjs = require('xxhashjs');
const zlib = require('zlib');
const config = require('../config');
const INIHelper = require('./ini-helper');
const KN5 = require('./kn5-helper').KN5;

class DataProvider extends EventEmitter {
  constructor(syncer, subDir, remoteStorage) {
    super();

    this.suggestion = this.suggestion.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
    this.info = this.info.bind(this);
    this.onUpdate = this.onUpdate.bind(this);

    this._tempDirCreated = false;
    this._requestResponse = null;
    this._requestWarningsResponse = null;
    this._currentEntrySourceUrl = null;
    this._refreshing = false;
    this._syncingWithRemote = false;
    this._fileInfoCache = {};
    this._expectingUpdate = false;
    this._lastBuildTime = 'none';

    this.syncer = syncer;
    this.subDir = subDir;
    this.storageGroup = subDir;
    this.remoteStorage = remoteStorage;
    this.dataDir = syncer.getDir(subDir);
    this.tempDir = subDir ? `${config.tempDir}/${subDir}` : `${config.tempDir}`;
    this.files = {};
    this.sourceUrls = {};
    this.items = {};
    this.warnings = [];

    syncer.on('update', this.onUpdate);
  }

  suggestion(msg, source, hint) {
    // $.echo(`[${this.remoteStorage.dir}] ${msg}`);
    // if (config.printSource) {
    //   $.echo(β.grey(`  source: ${source || this._currentEntrySourceUrl}`));
    // }
    if (!this.warnings.contains(msg)) {
      this.warnings.push({ message: msg, severity: 'suggestion', source: source || this._currentEntrySourceUrl, hint: hint });
    }
  }

  warn(msg, source, hint) {
    // $.echo(β.yellow(`[${this.remoteStorage.dir}] ${msg}`));
    // if (config.printSource) {
    //   $.echo(β.grey(`  source: ${source || this._currentEntrySourceUrl}`));
    // }
    if (!this.warnings.contains(msg)) {
      this.warnings.push({ message: msg, severity: 'warning', source: source || this._currentEntrySourceUrl, hint: hint });
    }
  }

  error(msg, source, hint) {
    $.echo(β.red(`[${this.remoteStorage.dir}] ${msg}`));
    if (config.printSource) {
      $.echo(β.grey(`  source: ${source || this._currentEntrySourceUrl}`));
    }
    if (!this.warnings.contains(msg)) {
      this.warnings.push({ message: msg, severity: 'error', source: source || this._currentEntrySourceUrl, hint: hint });
    }
  }

  info(msg, source) {
    $.echo(β.blue(`[${this.remoteStorage.dir}] ${msg}`));
  }

  _resetFileInfoCache() {
    this._fileInfoCache = {};
  }

  async getFileInfo(filename) {
    const k = path.normalize(filename).toLowerCase();
    if (this._fileInfoCache.hasOwnProperty(k)) {
      return this._fileInfoCache[k];
    }

    let stats = await fs.promises.stat(filename);
    let fingerprint = (+stats.mtime * 397) ^ stats.size;
    let storageKeyFingerprint = `fileInfo:fingerprint:${k}`;
    let storageKeyChecksum = `fileInfo:checksum:${k}`;
    if (storage[storageKeyFingerprint] === fingerprint) {
      return this._fileInfoCache[k] = { checksum: storage[storageKeyChecksum], size: stats.size };
    }

    let data = await fs.promises.readFile(filename);
    let checksum = xxhashjs.h32(0x1234).update(data).digest().toString(32);
    storage[storageKeyFingerprint] = fingerprint;
    storage[storageKeyChecksum] = checksum;
    return this._fileInfoCache[k] = { checksum: checksum, size: stats.size };
  }

  async extendFileInfo(info, extraFiles) {
    let checksum = parseInt(info.checksum, 32);
    for (let included of extraFiles.slice(1).unique()) {
      checksum = (checksum * 397) ^ parseInt((await this.getFileInfo(included)).checksum, 32);
    }
    return Object.assign({}, info, { checksum: Math.abs(checksum).toString(32) });
  }

  getListResponse() {
    return this._requestResponse;
  }

  getWarningsListResponse() {
    return this._requestWarningsResponse;
  }

  getName() {
    return this.remoteStorage.dir.replace(/-|\bdev\b/g, ' ').replace(/\bvao\b/, _ => _.toUpperCase())
      .replace(/\b([a-z])([a-z])/g, (_, a, b) => a.toUpperCase() + b).trim();
  }

  getWarningsHtmlResponse() {
    function formatItem(x) {
      let hint = x.hint ? ` <span onclick='alert(${JSON.stringify(x.hint)})' style='cursor:pointer;text-decoration:underline'>(more)</span>` : '';
      return `<li${x.severity === 'error' ? ' style="color:brown"' : x.severity === 'suggestion' ? ' style="color:cadetblue"' : ''}>${x.message}${hint}</li>`;
    }

    let content = null;
    if (!this._requestWarningsResponse) {
      content = '<p>Not ready yet…</p>';
    } else if (this.warnings.length === 0) {
      content = `<p>No warnings 👌</p>`;
    } else {
      content = '';
      let grouped = this.warnings.groupBy(x => x.source);
      for (let g in grouped) {
        content += `<h4><a href="${g}">${g.match(/([^\\//]+)(\.\w+)?$/)[1]}</a></h4>`;
        content += `<ul>${grouped[g].map(formatItem).join('')}</ul>`;
      }
    }

    // const content = !this._requestWarningsResponse ? '<p>Not ready yet…</p>' : this.warnings.length > 0 ? `<ul>${this.warnings.map(formatItem).join('')}</ul>` : `<p>No warnings 👌</p>`;
    const fixTimeScript = `<script>with(document.querySelector('#date'))textContent=new Date(textContent).toLocaleString()</script>`;
    const style = `<style>body{font-family:sans-serif;margin:20px 80px}li:after{content:";"}li:last-child:after{content:"."}
      div{position:fixed;top:0;left:0;right:0;bottom:0;overflow-y:auto;padding:20px 80px;background:white;white-space:pre-line}
      button{position:fixed;top:20px;right:20px}</style>`;
    const script = `<script>function alert(msg){
      document.body.appendChild(document.createElement('div')).innerHTML = msg;
      document.querySelector('div').appendChild(document.createElement('button')).textContent = '×';
      document.querySelector('button').onclick = () => document.body.removeChild(document.querySelector('div'));
      }</script>`;
    const footer = !this._requestWarningsResponse ? '' : `<footer><p>Last build time: <span id='date'>${this._lastBuildTime}</span>${fixTimeScript}</p></footer>`;
    return `<meta charset="utf-8">${style}${script}<h1>${this.getName()}</h1>${content}${footer}`;
  }

  getWarningsSvgResponse() {
    let name = this.getName().toLowerCase();
    let msg, color;
    let warnings = this.warnings.filter(x => x.severity !== 'suggestion').length;
    if (!this._requestWarningsResponse) {
      msg = 'not ready yet'
      color = '#9f9f9f';
    } else if (warnings == 0) {
      msg = 'no warnings';
      color = '#4c1';
    } else {
      msg = warnings === 1 ? '1 warning' : `${warnings} warnings`;
      color = this.warnings.some(x => x.severity === 'error') ? '#e05d44' : '#fe7d37';
    }
    let prefixWidth = name.length * 6 + 8;
    if (name == 'backgrounds') prefixWidth += 10;
    // let prefixWidth = name.length * 6 + [].filter.call(name, x => x === x.toUpperCase()).length + 8;
    let msgWidth = msg.length * 6 + 8;
    let imgWidth = prefixWidth + msgWidth;
    let prefixX = prefixWidth / 2;
    let msgX = (imgWidth + prefixWidth) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${imgWidth}" height="20">
  <linearGradient id="a" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <rect rx="3" width="${imgWidth}" height="20" fill="#555"/>
  <rect rx="3" x="${prefixWidth}" width="${imgWidth - prefixWidth}" height="20" fill="${color}"/>
  <path fill="${color}" d="M${prefixWidth} 0h4v20h-4z"/>
  <rect rx="3" width="${imgWidth}" height="20" fill="url(#a)"/>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${prefixX}" y="15" fill="#010101" fill-opacity=".3">${name}</text>
    <text x="${prefixX}" y="14">${name}</text>
    <text x="${msgX}" y="15" fill="#010101" fill-opacity=".3">${msg}</text>
    <text x="${msgX}" y="14">${msg}</text>
  </g>
</svg>`;
  }

  getPiece(path) {
    return this.files.hasOwnProperty(path) ? this.files[path] : null;
  }

  getSourceUrl(relativeName) {
    return `${this.syncer.gitUrl}/blob/master/${this.subDir}/${relativeName}`;
  }

  getPackedFilename(id) {
    if (!this._tempDirCreated) {
      $.mkdir('-p', this.tempDir);
      this._tempDirCreated = true;
    }
    return `${this.tempDir}/${id}.zip`;
  }

  _getCurrentVersionInfo(id) {
    let storageKeyChecksum = `${this.storageGroup}/${id}.checksum`;
    let storageKeyVersion = `${this.storageGroup}/${id}.version`;
    return { version: +(storage[storageKeyVersion] || 0) + config.versionOffset, checksum: storage[storageKeyChecksum] };
  }

  setVersionForInfo(info, id) {
    let storageKeyChecksum = `${this.storageGroup}/${id}.checksum`;
    let storageKeyVersion = `${this.storageGroup}/${id}.version`;
    let version = +(storage[storageKeyVersion] || 0);
    let isNew = false;
    if (info.checksum !== storage[storageKeyChecksum]) {
      version++;
      storage[storageKeyVersion] = version;
      storage[storageKeyChecksum] = info.checksum;
      isNew = true;
    }
    return { version: '' + (version + config.versionOffset), checksum: info.checksum, size: info.size, isNew: isNew };
  }

  async getInfo(filename, id) {
    return this.setVersionForInfo(await this.getFileInfo(filename), id);
  }

  async getConfigInfo(filename, id) {
    let config = INIHelper.resolveIncludesWithFiles(filename, this.dataDir, this.getSourceUrl(filename.substr(this.dataDir.length + 1)), this.error);
    let result = await this.extendFileInfo(await this.getFileInfo(filename), config.files);
    return Object.assign(result, { data: config.data });
  }

  async _toResponse(obj) {
    return new Promise((resolve, reject) => {
      const response = { raw: new Buffer(JSON.stringify(obj), 'utf-8'), gzip: null, deflate: null };
      zlib.gzip(response.raw, (_, result) => { response.gzip = result; if (response.deflate) resolve(response); });
      zlib.deflate(response.raw, (_, result) => { response.deflate = result; if (response.gzip) resolve(response); });
    });
  }

  async loadContributors() {
    const contributors = {};
    try {
      for (let line of ('' + await fs.promises.readFile(`${this.dataDir}/contributors.txt`)).split('\n')) {
        let splat = line.split(':');
        if (splat.length < 2) continue;
        let id = splat[0].trim();
        let name = splat.slice(1).join(':').trim();
        if (!id || id[0] === '#' || !name) continue;
        contributors[id.replace('/', '_')] = name;
      }
    } catch (e) {
      this.error(`Failed to get list of contributors: ${e}`);
    }
    return contributors;
  }

  async _syncWithRemote() {
    if (this._syncingWithRemote) {
      setTimeout(() => this._syncWithRemote(), 5e3);
      return;
    }
    this._syncingWithRemote = true;
    await this.remoteStorage.sync(this._requestResponse.raw, {
      svg: new Buffer(this.getWarningsSvgResponse(), 'utf-8'),
      html: new Buffer(this.getWarningsHtmlResponse(), 'utf-8'),
      json: this._requestWarningsResponse.raw,
    }, this.files);
    this._syncingWithRemote = false;
  }

  async preRefresh() { }
  async postRefresh() { }

  async _refresh() {
    try {
      if (this._refreshing) {
        setTimeout(() => this.refresh(), 5e3);
        return;
      }
      let start = Date.now();
      this._refreshing = true;
      this._resetFileInfoCache();
      if (await this.preRefresh() === false) {
        this._refreshing = false;
        return;
      }
      let original = await this._refreshInner();
      let result = {};
      this.files = {};
      this.sourceUrls = {};
      for (let id in original) {
        if (!await fs.existsSync(original[id].file)) {
          this.warn(`File is missing: ${original[id].file}`);
          continue;
        }
        let filtered = {};
        for (var n in original[id]) {
          if (n !== 'file' && n !== 'isNew' && n !== 'sourceUrl' && original[id][n] !== undefined) {
            filtered[n] = original[id][n];
          }
        }
        result[id] = filtered;
        this.files[id] = original[id].file;
        this.sourceUrls[id] = original[id].sourceUrl;
      }
      await this.postRefresh(result, this.files);
      this.items = result;
      this._requestResponse = await this._toResponse(result);
      this._requestWarningsResponse = await this._toResponse(this.warnings);
      this._lastBuildTime = '' + new Date().toGMTString();
      this._refreshing = false;
      this._syncWithRemote();
      this.info(`Refreshed: ${((Date.now() - start) / 1e3).toFixed(2)} s`);
    } catch (e) {
      this.error(`Refresh failed: ${this.remoteStorage.dir}: ${e}`);
    }
    this.emit('update');
  }

  async prepareContext() { }

  async getOriginalModels(source) {
    throw new Error(`Not implemented: getOriginalModels`);
  }

  async listEntries(dataDir, context) {
    throw new Error(`Not implemented: listEntries`);
  }

  async processEntry(source, relativeName, context) {
    throw new Error(`Not implemented: processEntry`);
  }

  async _refreshInner() {
    const context = await this.prepareContext();
    let result = {};
    // let garbage = fs.readdirSync(this.tempDir);
    for (let file of (await this.listEntries(this.dataDir, context)).unique()) {
      try {
        this._currentEntrySourceUrl = this.getSourceUrl(file.substr(this.dataDir.length + 1));
        let R = await this.processEntry(file, file.substr(this.dataDir.length + 1), context)
        if (R != null) {
          result[R.id] = R;
          // garbage = garbage.filter(x => x != R.id + '.zip');
          R.sourceUrl = this._currentEntrySourceUrl;
          delete R.id;
        }
      } catch (e) {
        this.error(`Failed to add item ${file.substr(this.dataDir.length + 1)}: ${e}`);
      } finally {
        this._currentEntrySourceUrl = null;
      }
    }
    // $.echo(garbage);
    return result;
  }

  onUpdate(delay = null) {
    if (this._expectingUpdate) return;
    this._expectingUpdate = true;

    if (!this.isReady) {
      $.mkdir('-p', this.dataDir);
      if (config.dataAutoReload) {
        fs.watch(this.dataDir, { recursive: true }, this.onUpdate);
      }
    }

    setTimeout(() => {
      this._expectingUpdate = false;
      this._refresh();
    }, delay == null ? (this.isReady() ? 3e3 : 0) : delay);
  }

  isReady() {
    return Object.keys(this.files).length > 0;
  }

  // specialized helpers:

  includeAboutInfo(info, parsedConfig) {
    return Object.assign({
      name: (parsedConfig['ABOUT'] || {})['NAME'],
      author: (parsedConfig['ABOUT'] || {})['AUTHOR'],
      version: (parsedConfig['ABOUT'] || {})['VERSION'],
      dateRelease: (parsedConfig['ABOUT'] || {})['DATE_RELEASE'],
      notes: (parsedConfig['ABOUT'] || {})['NOTES']
    }, info);
  }

  async packFiles(id, baseChecksum, files) {
    let packed = this.getPackedFilename(id);
    let extraFiles = files.map(x => x.file).filter(x => x);
    let info = this.setVersionForInfo(await this.extendFileInfo({ checksum: baseChecksum }, extraFiles), id);
    const storageKeySize = `${packed}:size`;
    if (info.isNew || !fs.existsSync(packed)) {
      for (let item of files) {
        if (item.dataCallback) {
          item.data = await item.dataCallback();
        }
      }
      await $.zip(files, { to: `${packed}.tmp` });
      storage[storageKeySize] = info.size = (await fs.promises.stat(`${packed}.tmp`)).size;
      $.mv(`${packed}.tmp`, packed);
    } else {
      info = Object.assign({
        size: +(storage[storageKeySize] || (await fs.promises.stat(packed)).size)
      }, this._getCurrentVersionInfo(id));
    }
    return Object.assign(info, { id: id, file: packed });
  }

  async packExtraModels(id, source, fullConfig, parsedConfig) {
    let extraModelsRaw = await INIHelper.getExtraModels(parsedConfig);
    let extraModels = [];
    // let originalModels = await Promise.all((await this.getOriginalModels(source)).map(x => KN5.create(x)));

    for (let x of extraModelsRaw) {
      const filename = `${path.dirname(source)}/${x}`;
      if (!fs.existsSync(filename)) {
        this.error(`Included file is missing: “${filename.substr(this.dataDir.length + 1)}”`);
        continue;
      }

      // const stats = await fs.promises.stat(filename);
      // if (stats.size > 50e6) {
      //   this.warn(`Included file is too big: “${filename.substr(this.dataDir.length + 1)}”`, null, `Please try to avoid reusing original meshes in an extension KN5 too much.`);
      // }

      // let info = await KN5.create(filename);
      // if (!info) {
      //   this.error(`Included file is invalid: “${filename.substr(this.dataDir.length + 1)}”`);
      //   continue;
      // }

      // let duplicated = Object.keys(info.texturesMap).filter(x => originalModels.some(y => y.texturesMap.hasOwnProperty(x)));
      // if (duplicated.length > 0) {
      //   extraModels.push({ key: x, file: filename, dataCallback: ((filename, duplicated) => KN5.excludeTextures(filename, duplicated)).bind(null, filename, duplicated) });
      // } else {
      //   extraModels.push({ key: x, file: filename });
      // }

      const optimizedFilename = path.dirname(filename) + '/.optimized/' + path.basename(filename);
      if (fs.existsSync(optimizedFilename)){
        $.echo('Using optimized model: ' + optimizedFilename);
        extraModels.push({ key: x, file: optimizedFilename });
      } else {
        extraModels.push({ key: x, file: filename });
      }
    }

    return await this.packFiles(id, fullConfig.checksum, [
      { key: `${id}.ini`, data: fullConfig.data }
    ].concat(extraModels));
  }
}

module.exports = DataProvider;