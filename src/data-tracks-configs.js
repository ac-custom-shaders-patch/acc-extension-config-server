const DataProvider = require('./data-provider');
const INIHelper = require('./ini-helper');

class DataTracksConfigs extends DataProvider {
  async listEntries(dataDir, context){ 
    return (await $.globAsync(`${dataDir}/**/*.ini`)).filter(x => !/\/_|\/common\/|\/gen_/.test(x)); 
  }

  async processEntry(source, relativeName, context){
    let id = /([^\\\/]+)\.ini/.test(relativeName) ? RegExp.$1 : null;
    if (!id) return;

    let fullConfig = await this.getConfigInfo(source, id);
    let parsedConfig = INIHelper.parseIni(fullConfig.data);
    let info = await this.packExtraModels(id, source, fullConfig, parsedConfig);
    return this.includeAboutInfo(info, parsedConfig);
  }
}

module.exports = DataTracksConfigs;