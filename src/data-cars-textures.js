const DataProvider = require('./data-provider');
const INIHelper = require('./ini-helper');

class DataCarsTextures extends DataProvider {
  constructor(syncer, subDir, remoteStorage, carsConfigs) {
    super(syncer, subDir, remoteStorage);
    this.onCarsUpdated = this.onCarsUpdated.bind(this);
    this.carsConfigs = carsConfigs;
    this.carsConfigs.on('update', this.onCarsUpdated);
  }

  onCarsUpdated() {
    this.onUpdate(100);
  }

  async preRefresh() {
    return this.carsConfigs.isReady();
  }

  async postRefresh(items){
    for (let carId in this.carsConfigs.items){
      let missing = this.carsConfigs.items[carId].textures.filter(x => !items.hasOwnProperty(x));
      if (missing.length > 0){
        this.warn(`Textures pack for ${carId} is missing: ${missing.join(', ')}`, this.carsConfigs.sourceUrls[carId]);
      }
    }
  }

  async listEntries(dataDir, context) {
    return (await $.globAsync(`${dataDir}/**/*.@(dds|png|jpg|jpeg)`)).map(x => path.dirname(x)).filter(x => !/\/_/.test(x));
  }

  async processEntry(source, relativeName, context) {
    let id = path.basename(relativeName);
    let usedBy = Object.keys(this.carsConfigs.items).filter(x => this.carsConfigs.items[x].textures.contains(id));
    let textures = await $.globAsync(`${source}/*.@(dds|png|jpg|jpeg)`);
    let info = Object.assign({ usedBy: usedBy }, await this.packFiles(id, 0, textures.map(x => ({ key: path.basename(x), file: x }))));
    if (fs.existsSync(`${source}/Manifest.ini`)){
      info = this.includeAboutInfo(info, INIHelper.parseIni($.readText(`${source}/Manifest.ini`)));
    }
    return info;
  }
}

module.exports = DataCarsTextures;