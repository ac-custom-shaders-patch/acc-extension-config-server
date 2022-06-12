const DataProvider = require('./data-provider');
const StreamZip = require('node-stream-zip');

class DataCarsVao extends DataProvider {
  async prepareContext(){ 
    return { 
      contributors: await this.loadContributors()
    }; 
  }

  async listEntries(dataDir, context){ 
    return await $.globAsync(`${dataDir}/*.vao-patch`); 
  }

  async testPatch(filename){
    return new Promise((resolve, reject) => {
      const zip = new StreamZip({ file: filename, storeEntries: false });
      let done = false;
      zip.on('error', reject);
      zip.on('entry', e => {
        if (/^Patch(_v\d+)?\.data$/.test(e.name) && !e.isDirectory){
          zip.close();
          if (!done) { resolve(); done = true; }
        }
      });

      zip.on('ready', () => {
        zip.close();
        if (!done) { reject('Patch.data not found'); done = true; }
      });
    });
  }

  async processEntry(source, relativeName, context){
    let id = relativeName.replace(/\.vao-patch$/i, '');
    await this.testPatch(source);
    return Object.assign({
      id: id,
      author: context.contributors[id],
      file: source
    }, await this.getInfo(source, id));
  }
}

module.exports = DataCarsVao;