const DataProvider = require('./data-provider');

class DataBackgrounds extends DataProvider {
  async prepareContext(){ 
    return { contributors: await this.loadContributors() }; 
  }

  async listEntries(dataDir, context){ 
    for (let f of await $.globAsync(`${dataDir}/*/+([0-9]).jpg`)){
      $.echo(f);
    }
    return await $.globAsync(`${dataDir}/*/+([0-9]).jpg`); 
  }

  async processEntry(source, relativeName, context){
    let id = relativeName.replace('/', '_').replace(/\.jpg$/i, '');
    return Object.assign({
      id: id,
      author: context.contributors[id],
      file: source
    }, await this.getInfo(source, id));
  }
}

module.exports = DataBackgrounds;