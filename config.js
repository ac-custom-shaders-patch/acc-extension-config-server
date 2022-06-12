let configPath = process.env['ACEXTDATA_CONFIG_PATH'] || `${require('os').homedir()}/.acc-extension-config-server.json`;
if (fs.existsSync(configPath)){
  try {
    module.exports = JSON.parse('' + fs.readFileSync(configPath));
  } catch (e){
    $.fail(`failed to read config: ${e}`);
  }
} else {
  module.exports = {
    versionOffset: +(process.env['ACEXTDATA_VERSION_OFFSET'] || 0),
    autoReload: false,
    dataAutoReload: false,
    dataAutoPull: 0,
    dataContinuousMonitoring: false,
    printSource: false,
    acRootDir: process.env['ACEXTDATA_ACROOTDIR'],
    dataDir: process.env['ACEXTDATA_STORAGE'],
    tempDir: process.env['ACEXTDATA_STORAGE'] + '/temp',
    serverPort: +(process.env['ACEXTDATA_SERVER_PORT'] || 0),
    ftpHost: process.env['ACEXTDATA_FTP_HOST'], 
    ftpUser: process.env['ACEXTDATA_FTP_USER'], 
    ftpPassword: process.env['ACEXTDATA_FTP_PASS'], 
  };
}