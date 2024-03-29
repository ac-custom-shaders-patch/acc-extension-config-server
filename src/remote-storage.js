const FTP = require('basic-ftp');
const config = require('../config');

const Readable = require('stream').Readable;

let _ftp = null;
async function connect() {
  if (!config.ftpHost) {
    if (!_ftp){
      _ftp = {};
      $.echo(β.yellow('FTP credentials are missing'));
    }
    return null;
  }

  if (_ftp && !_ftp.closed) return _ftp;
  _ftp = new FTP.Client();
  await _ftp.access({
    host: config.ftpHost,
    user: config.ftpUser,
    password: config.ftpPassword,
    autoReconnect: true,
    secure: false
  });
  return _ftp;
}

let busy = false;
let queue = [];
setInterval(() => {
  if (queue.length > 0 && !busy) {
    let item = queue.shift();
    item.instance.sync(item.manifest, item.warnings, item.files);
  }
}, 1000);

class RemoteStorage {
  constructor(dir, defaultExt = '') {
    this.dir = dir;
    this.defaultExt = defaultExt;
  }

  async store(data, id) {
    const ftp = await connect();
    if (!ftp) return;

    let remoteFilename = `/acstuff.ru/public_html/patch/_${this.dir}/${id}`;
    if (typeof data === 'string') {
      fs.utimesSync(data, new Date(), new Date());
      await ftp.upload(fs.createReadStream(data), remoteFilename);
      // $.echo(β.yellow(`Uploaded: ${data}→${remoteFilename}`)); 
    } else {
      const readable = new Readable();
      readable._read = () => { }
      readable.push(data);
      readable.push(null);
      await ftp.upload(readable, remoteFilename);
    }
    // $.echo(β.yellow(`Uploaded: ${data}→${remoteFilename}`));
  }

  async sync(manifest, warnings, files) {
    if (busy) {
      queue = queue.filter(x => x.instance != this);
      queue.push({ instance: this, manifest: manifest, warnings: warnings, files: files });
      return;
    }

    let ftp = null;

    try {
      busy = true;

      ftp = await connect();
      if (!ftp) return;

      await ftp.ensureDir(`/patch/_${this.dir}/warnings`);
      await this.store(warnings.svg, 'warnings/icon.svg');
      await this.store(warnings.html, 'warnings/list.html');
      await this.store(warnings.json, 'warnings/list.json');
      await ftp.ensureDir(`/patch/_${this.dir}`);
      let list = await ftp.list(`/patch/_${this.dir}`);
      // $.echo(this.dir, list.map(x => x.name));
      for (let id in files) {
        let name = id + this.defaultExt;
        let existing = list.filter(x => x.name == name)[0];
        if (!existing) {
          $.echo(β.green(`New item: ${id}`));
          await this.store(files[id], name);
        } else {
          existing.actual = true;
          let stats = await fs.promises.stat(files[id]);
          let removeDateRaw = new Date(`${existing.date} ${stats.mtime.getFullYear()}`);
          let remoteDate = new Date(+removeDateRaw - removeDateRaw.getTimezoneOffset() * 60e3 + 5 * 60e3);
          if (stats.mtime > remoteDate || existing.size != stats.size) {
            $.echo(β.green(`Changed: ${id}`));
            // $.echo(β.green(`Changed: ${id} (local: ${stats.mtime.toISOString()}, ${stats.size} bytes; remote: ${remoteDate.toISOString()}, ${existing.size} bytes)`));
            // $.echo(β.green(files[id]));
            await this.store(files[id], name);
          }
        }
      }
      await this.store(manifest, 'Manifest.json');
      for (let item of list) {
        if (item.actual || /\.(json|svg|html)$/.test(item.name) || item.name === 'warnings') continue;
        $.echo(β.yellow(`Removing obsolete: ${item.name}`));
        await ftp.remove(`/patch/_${this.dir}/${item.name}`);
      }
    } catch (e) {
      $.fail(e)
    } finally {
      busy = false;
      ftp && ftp.close();
    }
  }
}

module.exports = RemoteStorage;