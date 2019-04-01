// Started as fast C# parser, then was moved to C++ and got some extensions, and now it’s in JS

function parseIni(data, callbacks){
  callbacks = callbacks || {};

  let sections = {};
  let currentSectionKey = null;
  let currentSection = null;
  let indexStarted = -1;
  let indexNonSpace = -1;
  let waitForClosingQuote = -1;
  let upcomingValueKey = null;

  for (let i = 0; i < data.length; i++){
    const c = data[i];
    switch (c){
      case '[':{
        if (waitForClosingQuote !== -1 || isSolidValue(indexStarted)) {
          caseDefault();
          break;
        }

        finishValue();
        const s = ++i;
        if (s === data.length) break;
        for (; i < data.length && data[i] !== ']'; i++){}
        currentSectionKey = data.substr(s, i - s);
        if (/_\.\.\.$/.test(currentSectionKey)) currentSectionKey = currentSectionKey.substr(0, currentSectionKey.length - 3) + ':$SEQ:' + Math.random();
        callbacks.newSection && callbacks.newSection(currentSectionKey, sections[currentSectionKey]);
        currentSection = (sections[currentSectionKey] || (sections[currentSectionKey] = {}));
        break;
      }
      case '\n':{
        if (waitForClosingQuote !== -1) {
          caseDefault();
          break;
        }
        finishValue();
        break;
      }
      case '=':{
        if (waitForClosingQuote !== -1 || isSolidValue(indexStarted)) {
          caseDefault();
          break;
        }
        if (indexStarted !== -1 && upcomingValueKey === null && currentSection !== null){
          upcomingValueKey = data.substr(indexStarted, 1 + indexNonSpace - indexStarted);
          indexStarted = -1;
          waitForClosingQuote = -1;
        }
        break;
      }
      case '/':{        
        if (waitForClosingQuote !== -1 || isSolidValue(indexStarted)) {
          caseDefault();
          break;
        }
        if (i + 1 < data.length && data[i + 1] === '/'){
          caseComment();
        } else {
          caseDefault();
        }
        break;
      }
      case ';':{
        if (waitForClosingQuote !== -1 || isSolidValue(indexStarted)) {
          caseDefault();
          break;
        }
        caseComment();
        break;
      }
      case '"':
      case '\'':
      case '`':{
        if (upcomingValueKey !== null){
          if (indexStarted === -1){
            waitForClosingQuote = c;
            indexStarted = i + 1;
            indexNonSpace = i + 1;
          } else if (c === waitForClosingQuote){
            indexNonSpace = i - 1;
            finishValue();
          }
        }
      }

      default: caseDefault();
    }

    function caseComment(){
      callbacks.comment && callbacks.comment(data, i, currentSectionKey, upcomingValueKey);
      finishValue();
      for (i++; i < data.length && data[i] !== '\n'; i++) {}
    }

    function caseDefault(){
      if (c != ' ' && c != '\t' && c != '\r')
      {
        indexNonSpace = i;
        if (indexStarted === -1)
        {
          indexStarted = i;
        }
      }
    }
  }

  finishValue();

  let result = {};
  for (let upcomingValueKey in sections){
    let fixedKey = upcomingValueKey;
    let index = upcomingValueKey.indexOf(':$SEQ:');
    if (index !== -1){
      let prefix = upcomingValueKey.substr(0, index);
      for (let i = 0; i < 1e4; i++){
        let candidate = prefix + i;
        if (!sections.hasOwnProperty(candidate) && !result.hasOwnProperty(candidate)){
          fixedKey = candidate;
          break;
        }
      }
    }
    result[fixedKey] = sections[upcomingValueKey];
  }

  return result;

  function finishValue(){
    if (upcomingValueKey && currentSection){
      let value = null;
      if (indexStarted !== -1){
        let length = 1 + indexNonSpace - indexStarted;
        value = length < 0 ? '' : data.substr(indexStarted, length);
      } else value = '';

      const new_key = !currentSection.hasOwnProperty(upcomingValueKey);
      if (!new_key){
        callbacks.duplicateValue && callbacks.duplicateValue(currentSectionKey, upcomingValueKey, value, currentSection[upcomingValueKey]);
      }
      if (new_key && !isSolidValue(indexStarted) && waitForClosingQuote === -1){
        currentSection[upcomingValueKey] = value;
      }
      upcomingValueKey = null;
    }
    indexStarted = -1;
    waitForClosingQuote = -1;
  }

  function isSolidValue(index){
    return index >= 0 && data.substr(index, 22) === 'data:image/png;base64,';
  }
}

module.exports = parseIni;