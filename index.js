// setting up auto-restart for easy coding
const config = require('./config');
if (!config.dataDir) $.fail('configuration is missing');
if (config.autoReload) fs.watch(__dirname, { recursive: true }, () => process.exit(0));

// setting up global storage
β.setStorage(`${config.dataDir}/data.json`);

// this thing would update files to FTP if enabled
const RemoteStorage = require('./src/remote-storage')
await RemoteStorage.connect();

// syncers check git status and pull things from time to time
const Syncer = require('./src/syncer');
const syncerConfigs = new Syncer(config.dataDir, 'acc-extension-config', 'https://github.com/ac-custom-shaders-patch/acc-extension-config');
const syncerVao = new Syncer(config.dataDir, 'acc-extension-extra-vao', 'https://github.com/ac-custom-shaders-patch/acc-extension-extra-vao');

// these thingies listen to syncers, collect and process data and drop data to RemoteStorage
const dataBackgrounds = new (require('./src/data-backgrounds'))(syncerConfigs, 'backgrounds', new RemoteStorage('backgrounds', '.jpg'));
const dataCarsConfigs = new (require('./src/data-cars-configs'))(syncerConfigs, 'config/cars', new RemoteStorage('cars-configs', '.zip'));
const dataCarsTextures = new (require('./src/data-cars-textures'))(syncerConfigs, 'textures/cars', new RemoteStorage('cars-textures', '.zip'), dataCarsConfigs);
const dataTracksConfigs = new (require('./src/data-tracks-configs'))(syncerConfigs, 'config/tracks', new RemoteStorage('tracks-configs', '.zip'));
const dataTracksVao = new (require('./src/data-tracks-vao'))(syncerVao, '', new RemoteStorage('tracks-vao', '.vao-patch'));

// optional server which would redirect requests to data collecting thingies
const Server = require('./src/server');
Server.run({
  'backgrounds': dataBackgrounds,
  'car-configs': dataCarsConfigs,
  'car-textures': dataCarsTextures,
  'track-configs': dataTracksConfigs,
  'track-vao': dataTracksVao,
});

// launching syncers
await syncerConfigs.initialize();
await syncerVao.initialize();
