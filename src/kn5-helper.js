const {gzip, ungzip} = require('node-gzip');
const config = require('../config');
const kn5Parse = require('./kn5-parser');

const kn5CacheDir = `${config.dataDir}/kn5cache`;
const kn5Cache = {};

async function loadKn5Info(filename){
  let cached = `${kn5CacheDir}/${path.basename(path.dirname(filename))}__${path.basename(filename, '.kn5')}.json`;
  if (kn5Cache.hasOwnProperty(filename)) return kn5Cache[filename];

  try {
    let cacheStats = await fs.promises.stat(cached);
    let mainStats = await fs.promises.stat(filename);
    if (cacheStats.mtime > mainStats.mtime){
      return kn5Cache[filename] = JSON.parse(await ungzip(await fs.promises.readFile(cached)));
    }
  } catch (e){}

  try {
    $.mkdir('-p', kn5CacheDir);
    let data = kn5Parse(await fs.promises.readFile(filename));
    await fs.promises.writeFile(cached, await gzip(JSON.stringify(data)));
    return kn5Cache[filename] = data;
  } catch (e){
    return kn5Cache[filename] = null;
  }
}

class KN5 {
  constructor(filename, info){
    this.filename = filename;
    this.version = info.version;
    this.root = info.root;
    this.materials = info.materials;
    this.textures = info.textures;
    this.texturesMap = this.textures.reduce((o, v) => { o[v.name] = v; return o; }, {});
  }

  static async excludeTextures(filename, textures){
    $.echo(`Preparing “${filename}” by removing ${textures.join(', ')}`);
    let result = [];
    let input = await fs.promises.readFile(filename);
    let kn5 = await KN5.create(filename);
    let offset = kn5.version == 6 ? 18 : 14;
    result.push(input.slice(0, kn5.version == 6 ? 14 : 10));

    let texturesLeft = kn5.textures.filter(x => !textures.contains(x.name));
    let texturesCount = Buffer.allocUnsafe(4);
    texturesCount.writeUInt32LE(texturesLeft.length);
    result.push(texturesCount);

    for (let t of kn5.textures){
      let start = offset;
      let size = 4 + 4 + t.name.length + 4 + t.size;
      if (!textures.contains(t.name)){
        result.push(input.slice(start, start + size));
      }
      offset += size;
    }

    result.push(input.slice(offset));
    input = null;
    return Buffer.concat(result);
  }

  static async create(filename){
    let info = await loadKn5Info(filename);
    return info ? new KN5(filename, info) : null;
  }

  findMeshes(query){
    let regExp = new RegExp(/^`(.+)`$/.test(query) ? RegExp.$1 : `^${query.replace(/[-\/\\^$*+.()|[\]{}]/g, '\\$&').replace(/\?/g, '.*')}$`, '');
    return this.meshes().filter(x => regExp.test(x.name));
  }

  findMaterials(query){
    let regExp = new RegExp(/^`(.+)`$/.test(query) ? RegExp.$1 : `^${query.replace(/[-\/\\^$*+.()|[\]{}]/g, '\\$&').replace(/\?/g, '.*')}$`, '');
    return this.materials.filter(x => regExp.test(x.name));
  }
  
  meshes(){
    let result = [];
    process(this.root);
    return result;

    function process(node){
      if (node.nodeClass == 2) result.push(node);
      if (node.nodeClass > 1) return;
      for (let c of node.data.children){
        process(c);
      }
    }
  }
  
  nodes(){
    let result = [];
    process(this.root);
    return result;

    function process(node){
      result.push(node);
      if (node.nodeClass > 1) return;
      for (let c of node.data.children){
        process(c);
      }
    }
  }
}

module.exports = { KN5: KN5 };