// setting up auto-restart for easy coding
const config = require('./config');
if (!config.dataDir) $.fail('configuration is missing');
if (config.autoReload) fs.watch(__dirname, { recursive: true }, () => process.exit(0));

// const dataDir = config.dataDir + '/acc-extension-config/config/cars';
// const filename = config.dataDir + '/acc-extension-config/config/cars/kunos/ks_bmw_m4.ini';
// console.log(require('./src/ini-helper').resolveIncludesWithFiles(filename, dataDir, 'nothing', this.error).data);

// setting up global storage
β.setStorage(`${config.dataDir}/data.json`);

// this thing would update files to FTP if enabled
const RemoteStorage = require('./src/remote-storage');

// syncers check git status and pull things from time to time
const Syncer = require('./src/syncer');
const syncerConfigs = new Syncer(config.dataDir, 'acc-extension-config', 'https://github.com/ac-custom-shaders-patch/acc-extension-config');
const syncerTracksVao = new Syncer(config.dataDir, 'acc-extension-extra-vao', 'https://github.com/ac-custom-shaders-patch/acc-extension-extra-vao');
const syncerCarsVao = new Syncer(config.dataDir, 'acc-extension-cars-vao', 'https://github.com/ac-custom-shaders-patch/acc-extension-cars-vao');

// these thingies listen to syncers, collect and process data and drop data to RemoteStorage
const dataCarsConfigs = new (require('./src/data-cars-configs'))(syncerConfigs, 'config/cars', new RemoteStorage('cars-configs', '.zip'));
const data = {
  'backgrounds': new (require('./src/data-backgrounds'))(syncerConfigs, 'backgrounds', new RemoteStorage('backgrounds', '.jpg')),
  'car-configs': dataCarsConfigs,
  'car-textures': new (require('./src/data-cars-textures'))(syncerConfigs, 'textures/cars', new RemoteStorage('cars-textures', '.zip'), dataCarsConfigs),
  'track-configs': new (require('./src/data-tracks-configs'))(syncerConfigs, 'config/tracks', new RemoteStorage('tracks-configs', '.zip')),
  'track-vao': new (require('./src/data-tracks-vao'))(syncerTracksVao, '', new RemoteStorage('tracks-vao', '.vao-patch')),
  'car-vao': new (require('./src/data-cars-vao'))(syncerCarsVao, '', new RemoteStorage('cars-vao', '.vao-patch')),
};

// optional server which would redirect requests to data collecting thingies
const Server = require('./src/server');
Server.run(data);

// data['car-configs'].onUpdate();

// launching syncers
await syncerConfigs.initialize();
await syncerTracksVao.initialize();
await syncerCarsVao.initialize();

if (!config.dataContinuousMonitoring) {
  setTimeout(() => process.exit(0), 5 * 60e3);
}
