const parseIni = require('./ini-parser');

const textCache = {};
function readText(filename){
  let key = path.normalize(filename);
  if (textCache.hasOwnProperty(key)) return textCache[key];
  return textCache[key] = $.readText(key);
}

const inlinedLuts = {};
function inlineLut(filename){
  if (!filename){
    return null;
  }

  let key = filename;
  if (inlinedLuts.hasOwnProperty(key)) return inlinedLuts[key];

  let data = filename.split('\n');
  let result = '(';
  for (let line of data){
    let pieces = line.replace(/([#;]|\/\/).+/, '').trim().split('|');
    if (pieces.length != 2 || !/^[\d.-]/.test(pieces[0])){
      continue;
    }
    result += `|${pieces[0].trim()}=${pieces[1].replace(/[ \t]/g, '')}`;
  }
  return inlinedLuts[key] = result + '|)';
}

function resolveIncludesWithFiles(filename, dataDir, sourceUrl, warningCallback){
  let fullFilesList = [ filename ];
  let extraSearchDirs = [ path.dirname(filename) ];

  function findReferenced(name){
    try {
      let checked = {};
      for (let startingDir of extraSearchDirs){
        for (let dir = startingDir; /\w[\/\\]/.test(dir); dir = path.dirname(dir)){      
          if (checked[dir]) continue;
          checked[dir] = true;
          if (fs.existsSync(`${dir}/${name}`)) {
            if (name[name.length - 1] == '/' || name[name.length - 1] == '\\'){
              extraSearchDirs.push(`${dir}/${name.substr(0, name.length - 1)}`);
              return '';
            } else {
              let result = readText(`${dir}/${name}`);
              let foundDir = path.dirname(`${dir}/${name}`);
              if (!extraSearchDirs.contains(foundDir)) {
                extraSearchDirs.push(foundDir);
              }
              fullFilesList.push(`${dir}/${name}`);
              return result;
            }
          }
        }
      }
    } catch (e){ }
    warningCallback && warningCallback(`Included file is missing: ${name} (${filename.substr(dataDir.length + 1)})`);
    return '';
  }

  let data = $.readText(filename);
  let toAdd = [];

  do {
    toAdd = [];
    data = data.replace(/\bINCLUDE[ \t]*=[ \t]*(.+)/, (_, f) => { toAdd.push.apply(toAdd, f.split(',').map(x => x.trim())); return ''; });
    data = toAdd.map(findReferenced).join('\n\n') + '\n\n' + data;
  } while (toAdd.length);

  data = data.replace(/\w*LUT[ \t]*=[ \t]*([\w-]+\.lut)/, (_, f) => 'LUT=' + (inlineLut(findReferenced(f)) || f));
  const prefix = `; config was prepared automatically. source:\n; ${sourceUrl}\n`;
  const cleaned = data.replace(/;.+|\r/g, ``).replace(/\[\w+\]\s*\[/g, `[`).replace(/[ \t]*=[ \t]*/g, `=`).split(`\n`).map(x => x.trim()).filter(x => x).join(`\n`);
  return { data: prefix + cleaned, files: fullFilesList };
}

async function getExtraModels(parsedConfig){
  let result = [];
  for (let n of Object.keys(parsedConfig).filter(x => /^MODEL_REPLACEMENT_\d/.test(x))){
    result.push(parsedConfig[n]['INSERT']);
  }
  return result.filter(x => x).unique();
}

module.exports = {
  parseIni: parseIni,
  resolveIncludesWithFiles: resolveIncludesWithFiles,
  getExtraModels: getExtraModels,
}