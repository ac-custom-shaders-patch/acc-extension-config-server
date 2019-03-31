function parseIni(data){
  return data ? data.split(/\[(?=[A-Z\d_])/).slice(1)
      .map(x => x.match(/^([A-Z\d_]+)\]([\s\S]+)/))
      .filter(x => x)
      .reduce((a, b) => {
        a[b[1]] = b[2].split('\n')
            .map(x => x.match(/^\s*(\w+)\s*=\s*([^;]*)/))
            .filter(x => x)
            .reduce((a, b) => (a[b[1]] = b[2].trim(), a), {});
        return a;
      }, {}) : {};
}

function resolveIncludesWithFiles(filename, dataDir, sourceUrl, warningCallback){
  let fullFilesList = [ filename ];

  function findReferenced(name){
    try {
      for (let dir = path.dirname(filename); /\w[\/\\]/.test(dir); dir = path.dirname(dir)){      
        if (fs.existsSync(`${dir}/${name}`)) {
          let result = $.readText(`${dir}/${name}`);
          fullFilesList.push(`${dir}/${name}`);
          return result;
        }
      }
    } catch (e){ }
    warningCallback(`Included file is missing: ${name} (${filename.substr(dataDir.length + 1)})`);
    return '';
  }

  let data = $.readText(filename);
  let toAdd = [];

  do {
    toAdd = [];
    data = data.replace(/\bINCLUDE[ \t]*=[ \t]*(.+)/, (_, f) => { toAdd.push.apply(toAdd, f.split(',').map(x => x.trim())); return ''; });
    data = toAdd.map(findReferenced).join('\n\n') + '\n\n' + data;
  } while (toAdd.length);

  const prefix = `; config was prepared automatically. source:\n; ${sourceUrl}\n`;
  const cleaned = data.replace(/;.+|\r/g, ``).replace(/\[\w+\]\s*\[/g, `[`).replace(/[ \t]*=[ \t]*/g, `=`).split(`\n`).map(x => x.trim()).filter(x => x).join(`\n`);
  return { data: prefix + cleaned, files: fullFilesList };
}

function getExtraModels(parsedConfig){
  let result = [];
  for (let n in parsedConfig){
    if (/^MODEL_REPLACEMENT_/.test(n)){
      result.push(parsedConfig[n]['INSERT']);
    }
  }
  return result.filter(x => x).unique();
}

module.exports = {
  parseIni: parseIni,
  resolveIncludesWithFiles: resolveIncludesWithFiles,
  getExtraModels: getExtraModels,
}