const DataProvider = require('./data-provider');
const INIHelper = require('./ini-helper');
const defines = require('../patch-defines');

class DataTracksConfigs extends DataProvider {
  async listEntries(dataDir, context) {
    return (await $.globAsync(`${dataDir}/**/*.ini`)).filter(x => !/\/_|\/common\/|\/gen_/.test(x));
  }

  analyzeForWarnings(source, sourceUrl, parsedConfig) {
    let readSource = $.readText(source);
    let duplicateSections = [];
    INIHelper.parseIni(readSource, {
      newSection: (key, existing) => {
        if (existing && /\w_/.test(key)) {
          this.warn(`Overlapping section: ${key}`, sourceUrl);
        }
      },
      duplicateValue: (section, key, newValue, oldValue) => {
        if (oldValue != newValue && !duplicateSections.contains(section)) {
          duplicateSections.push(section);
          this.warn(`For “${section}/${key}”, first value “${oldValue}” will be used instead of “${newValue}”`, sourceUrl);
        }
      },
      comment: (data, index, sectionKey, valueKey) => {
        if (data[index] === ';') return;
        let prep = data[index - 1];
        if (index > 0 && prep != ' ' && prep != '\n') {
          this.warn(`Could be an unwanted comment “${sectionKey}/${valueKey}”, “${data[index]}”`, sourceUrl);
        }
      }
    });

    if (!parsedConfig) parsedConfig = readSource;
    let conditions = Object.keys(parsedConfig).filter(x => /^CONDITION_\d/.test(x));
    let conditionNames = conditions.map(x => parsedConfig[x]['NAME']);

    let objBasic = parsedConfig['BASIC'];
    if (objBasic){
      for (let u of Object.keys(objBasic).filter(x => !defines.trackBasicKeys.contains(x))) {
        this.warn(`Unknown key “${u}” for BASIC`);
      }
    }

    let objLighting = parsedConfig['LIGHTING'];
    if (objLighting){
      for (let u of Object.keys(objLighting).filter(x => !defines.trackLightingKeys.contains(x))) {
        if (u === 'ACTIVE' && obj[u] === '1') continue;
        this.warn(`Unknown key “${u}” for “LIGHTING”`);
      }
    }

    for (let k of Object.keys(parsedConfig).filter(x => /^(?:MODEL_REPLACEMENT)_/.test(x))) {
      let obj = parsedConfig[k];
      for (let u of Object.keys(obj).filter(x => !defines.trackModelReplacementKeys.contains(x))) {
        this.warn(`Unknown key “${u}” for “${k}”`);
      }
      if (obj['INSERT'] && !obj['INSERT_AFTER']) {
        this.warn(`To insert extra mesh “${obj['INSERT']}”, don’t forget to use “INSERT_AFTER” as well`);
      }
      if (obj['INSERT'] && obj['FILE'] === '') {
        this.warn(`To insert extra mesh “${obj['INSERT']}”, don’t forget to set “FILE” to specify where to insert it`);
      }
    }

    for (let k of Object.keys(parsedConfig).filter(x => /^LIGHT_\d/.test(x))) {
      let obj = parsedConfig[k];
      for (let u of Object.keys(obj).filter(x => !/^(?:UV_FILTER_)$/.test(x) && !defines.trackLightKeys.contains(x))) {
        if (u === 'COLOR_OFF' && obj[u] === '0') continue;
        this.warn(`Unknown key “${u}” for “${k}”`);
      }
      if (!obj.hasOwnProperty('MESH') && !obj.hasOwnProperty('POSITION') && !(obj.hasOwnProperty('LINE_FROM') && obj.hasOwnProperty('LINE_TO'))) {
        this.warn(`Light source “${k}” has to have either “MESH”, “POSITION” or “LINE_FROM” and “LINE_TO” values`);
      }
    }

    for (let k of Object.keys(parsedConfig).filter(x => /^LIGHT_SERIES_\d/.test(x))) {
      let obj = parsedConfig[k];
      for (let u of Object.keys(obj).filter(x => !/^(?:UV_FILTER_|POSITION_|DIRECTION_)$/.test(x) && !defines.trackLightSeriesKeys.contains(x))) {
        if (u === 'COLOR_OFF' && obj[u] === '0') continue;
        this.warn(`Unknown key “${u}” for “${k}”`);
      }
      if (obj['CLUSTER_THRESHOLD'] && obj['CLUSTER_THRESHOLD'] < 0.1) {
        this.warn(`Cluster threshold might be too small: ${obj['CLUSTER_THRESHOLD']}`);
      }
      if (!obj.hasOwnProperty('MESHES') && !obj.hasOwnProperty('MATERIALS') && !Object.keys(obj).some(x => /^(?:POSITION_|DIRECTION_)$/.test(x))) {
        this.warn(`Light series “${k}” has to have either “MESHES”, “MATERIALS” or “POSITION_N” values`);
      }
    }

    for (let k of Object.keys(parsedConfig).filter(x => /^MESH_ADJUSTMENT_\d/.test(x))) {
      let obj = parsedConfig[k];
      if (!obj.hasOwnProperty('MESHES')) {
        this.warn(`Mesh adjustment “${k}” has to have “MESHES”`);
      }
      for (let u of Object.keys(obj).filter(x => !defines.meshAdjustmentKeys.contains(x))) {
        this.warn(`Unknown key “${u}” for “${k}”`);
      }
    }

    for (let k of Object.keys(parsedConfig).filter(x => /^MATERIAL_ADJUSTMENT_\d/.test(x))) {
      let obj = parsedConfig[k];

      if (!obj.hasOwnProperty('MESHES') && !obj.hasOwnProperty('MATERIALS')) {
        this.warn(`Material adjustment “${k}” has to have either “MESHES” or “MATERIALS”`);
      }

      for (let u of Object.keys(obj).filter(x => !/^(?:(?:KEY_|VALUE_|OFF_VALUE_)\d+|VALUE_\d+_OFF)$/.test(x) && !defines.trackMaterialAdjustmentKeys.contains(x))) {
        this.warn(`Unknown key “${u}” for “${k}”`);
      }

      if (obj['BLEND_MODE'] && !/^(?:ALPHA_TEST|ALPHA_BLEND|ALPHA_ADD|ALPHA_MULTIPLY|OPAQUE|NONE|DISABLED|OFF|nothing)$/.test(obj['BLEND_MODE'])){
        this.warn(`Possibly incorrect value for “BLEND_MODE” in “${k}”: “${obj['BLEND_MODE']}”`);
      }

      if (obj['DEPTH_MODE'] && !/^(?:DEPTH_NOWRITE|DEPTH_OFF|DEPTH_LESSEQUAL|DEPTH_NORMAL|NORMAL)$/.test(obj['DEPTH_MODE'])){
        this.warn(`Possibly incorrect value for “DEPTH_MODE” in “${k}”: “${obj['DEPTH_MODE']}”`);
      }

      for (let i = 0; i < 100; i++) {
        let key = `KEY_${i}`;
        let value = `VALUE_${i}`;
        let valueOff1 = `OFF_VALUE_${i}`;
        let valueOff2 = `VALUE_${i}_OFF`;
        if (obj.hasOwnProperty(key)) {
          if (!defines.knownShaderProperties.contains(obj[key])) {
            this.warn(`Unknown shader property “${obj[key]}” in “${k}”`);
          }
        } else {
          if (obj.hasOwnProperty(value)) {
            this.warn(`Key for material adjustment value “${value}” in “${k}” is missing`);
          } else if (obj.hasOwnProperty(valueOff1)) {
            this.warn(`Key for material adjustment value “${valueOff1}” in “${k}” is missing`);
          } else if (obj.hasOwnProperty(valueOff2)) {
            this.warn(`Key for material adjustment value “${valueOff2}” in “${k}” is missing`);
          }
        }

        const testValue = value => {
          if (!value || value === 'ORIGINAL' || /^0\s*,\s*0\s*,\s*0$/.test(value)) return;

          let pieces = value.split(',').map(x => parseFloat(x));
          if (pieces.some(x => Number.isNaN(x))) {
            this.warn(`Possibly incorrect value for “${obj[key]}” in “${k}”: “${value}”`);
          } else if (obj[key] === 'ksAlphaRef') {
            if (pieces.length != 1 || Number.isNaN(+value) || Math.abs(+value) > 10 && value != -193) {
              this.warn(`Possibly incorrect value for “ksAlphaRef” in “${k}”: “${value}”`);
            }
          } else if (obj[key] === 'ksEmissive') {
            if (pieces.length > 4) {
              this.warn(`Possibly incorrect value for “${obj[key]}” in “${k}”: “${value}”`);
            }
          } else if (pieces.length !== 1) {
            this.warn(`Possibly incorrect value for “${obj[key]}” in “${k}”: “${value}”`);
          }
        };

        testValue(obj[value]);
        testValue(obj[valueOff1]);
        testValue(obj[valueOff2]);
      }
    }

    for (let k of Object.keys(parsedConfig).filter(x => /^(?:LIGHT|LIGHT_SERIES|MATERIAL_ADJUSTMENT)_\d/.test(x))) {
      let condition = parsedConfig[k]['CONDITION'];
      if (condition && !conditionNames.contains(condition)) {
        this.warn(`Condition for “${k}” is not defined: “${condition}”`);
      }
    }

    for (let k of conditions) {
      let obj = parsedConfig[k];
      if (!obj.hasOwnProperty('NAME')) {
        this.warn(`Conditions require “NAME” to work: ${k}`);
      }
      let input = obj['INPUT'];
      if (!defines.knownConditionInputs.contains(input)) {
        this.warn(`Unknown input for “${k}” (“${parsedConfig[k]['NAME'] || '?'}”): “${input || '?'}”`);
      }
      let lagDelayFunc = obj['LAG_DELAY_FUNC'];
      if (lagDelayFunc && !defines.trackConditionFunc.contains(lagDelayFunc)) {
        this.warn(`Unknown lag delay function for “${k}” (“${parsedConfig[k]['NAME'] || '?'}”): “${lagDelayFunc || '?'}”`);
      }
      let lut = obj['LUT'];
      if (lut && (/^\(\|?(.+?)\|?\)$/.test(lut) ? RegExp.$1.split('|').some(x => x.split('=').length != 2) : !/[\w-]+\.lut/.test(lut))) {
        this.warn(`Invalid LUT for “${k}” (“${parsedConfig[k]['NAME'] || '?'}”): ${lut}`);
      }
      for (let u of Object.keys(obj).filter(x => !defines.trackConditionKeys.contains(x))) {
        this.warn(`Unknown key “${u}” for “${k}” (“${parsedConfig[k]['NAME'] || '?'}”)`);
      }
    }
  }

  async preRefresh() {
    for (let file of await $.globAsync(`${this.dataDir}/common/*.ini`)) {
      this.analyzeForWarnings(file, this.getSourceUrl(file.substr(this.dataDir.length + 1)));
    }
    // this.analyzeForWarnings(source, parsedConfig);
  }

  async processEntry(source, relativeName, context) {
    let id = /([^\\\/]+)\.ini/.test(relativeName) ? RegExp.$1 : null;
    if (!id) return;

    let fullConfig = await this.getConfigInfo(source, id);
    let parsedConfig = INIHelper.parseIni(fullConfig.data);
    this.analyzeForWarnings(source, null, parsedConfig);
    let info = await this.packExtraModels(id, source, fullConfig, parsedConfig);
    return this.includeAboutInfo(info, parsedConfig);
  }
}

module.exports = DataTracksConfigs;