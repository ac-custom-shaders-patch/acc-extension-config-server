const DataProvider = require('./data-provider');
const INIHelper = require('./ini-helper');
const config = require('../config');

function getTexturePacks(parsedConfig){
  let result = [];
  for (let n in parsedConfig){
    if (/^TYRES_FX_CUSTOMTEXTURE_/.test(n)){
      result.push(parsedConfig[n]['TXDIFFUSE']);
      result.push(parsedConfig[n]['TXBLUR']);
      result.push(parsedConfig[n]['TXNORMAL']);
      result.push(parsedConfig[n]['TXNORMALBLUR']);
    }
  }
  return result.map(x => /(\w+)(\.zip::|[\/\\][\w-]+\.dds)/.test(x) ? RegExp.$1 : null).filter(x => x).unique();
}

class DataCarsConfigs extends DataProvider {
  async listEntries(dataDir, context){
    return (await $.globAsync(`${dataDir}/**/*.ini`)).filter(x => !/\/_|\/common\/|\/gen_/.test(x)); 
  }

  async getOriginalModels(source){
    let id = path.basename(source, '.ini');
    let targetObj = `${config.acRootDir}/content/cars/${id}`;
    return fs.existsSync(targetObj) ? await $.globAsync(`${targetObj}/*.kn5`) : [];
  }

  async processEntry(source, relativeName, context){
    let id = /([^\\\/]+)\.ini/.test(relativeName) ? RegExp.$1 : null;
    if (!id) return;

    let fullConfig = await this.getConfigInfo(source, id);
    let parsedConfig = INIHelper.parseIni(fullConfig.data);
    let info = await this.packExtraModels(id, source, fullConfig, parsedConfig);

    info.textures = getTexturePacks(parsedConfig);
    info.features = [];
    if (Object.keys(parsedConfig).some(x => /^EMISSIVE_TURNSIGNAL_LEFT_/.test(x))) info.features.push('TurnSignals');
    if (Object.keys(parsedConfig).some(x => /^EMISSIVE_HANDBRAKE_/.test(x))) info.features.push('ExtraIndicators');
    if (Object.keys(parsedConfig).some(x => /^DEFORMING_/.test(x))) info.features.push('DeformingMesh');
    if (Object.keys(parsedConfig).some(x => /^ADJUSTABLE_WING_/.test(x))) info.features.push('AdjustableWings');
    if (Object.keys(parsedConfig).some(x => /^ODOMETER_/.test(x))) info.features.push('Odometer');
    if (info.textures.length > 0) info.features.push('TyresTextures');
    
    return this.includeAboutInfo(info, parsedConfig);
  }
}

module.exports = DataCarsConfigs;