const EventEmitter = require('events');

let isBusy = false;
let queue = [];

class Syncer extends EventEmitter {
  constructor(dataDir, subDir, gitUrl){
    super();
    this.refresh = this.refresh.bind(this);
    this.dataDir = dataDir;
    this.subDir = subDir;
    this.gitUrl = gitUrl;
    $.mkdir('-p', this.dataDir);
  }

  async initialize(){
    $.pushd(this.dataDir);
    if (!fs.existsSync(this.subDir)){
      if (!await $.git.clone(this.gitUrl)){
        $.fail(`failed to clone “${this.gitUrl}”`);
      } else {
        $.echo(β.green(`Repo “${this.gitUrl}” cloned`));
      }
    } else {
      $.pushd(this.subDir);
      if (!await $.git.pull('--rebase', { stdoutProc: x => `Repo “${this.gitUrl}”: ${x}` })){
        $.fail(`failed to pull “${this.gitUrl}”`);
      }
      $.popd();
    }
    $.popd();

    setTimeout(() => this.emit('update'), 1e2);
    setInterval(this.refresh, 5 * 60e3);
  }

  async refresh(){
    if (isBusy){
      queue.push(this);
      return;
    }

    isBusy = true;
    $.pushd(`${this.dataDir}/${this.subDir}`);
    let changed = true;
    if (!await $.git.pull('--rebase', { stdoutProc: x => {
      if (/Already up to date|Current branch master is up to date/.test(x)){
        changed = false;
        return null;
      } else {
        return `Repo “${this.gitUrl}”: ${x}`
      }
    } })){
      $.fail(`failed to pull “${this.gitUrl}”`);
    }
    $.popd();
    if (changed){
      setTimeout(() => this.emit('update'), 1e2);
    }
    isBusy = false;

    if (queue.length > 0){
      queue.shift().refresh();
    }
  }

  getDir(name){ 
    return name ? `${this.dataDir}/${this.subDir}/${name}` : `${this.dataDir}/${this.subDir}`; 
  }
}

module.exports = Syncer;