const DataProvider = require('./data-provider');

class DataTracksVao extends DataProvider {
  async prepareContext(){ 
    return { 
      contributors: await this.loadContributors()
    }; 
  }

  async listEntries(dataDir, context){ 
    return await $.globAsync(`${dataDir}/*.vao-patch`); 
  }

  async processEntry(source, relativeName, context){
    let id = relativeName.replace(/\.vao-patch$/i, '');
    return Object.assign({
      id: id,
      author: context.contributors[id],
      file: source
    }, await this.getInfo(source, id));
  }
}

module.exports = DataTracksVao;