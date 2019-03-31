const FTP = require("basic-ftp")
const config = require('../config');

const Readable = require('stream').Readable;

let ftp = null;
let busy = false;
let queue = [];
setInterval(() => {
  if (queue.length > 0 && !busy) {
    let item = queue.shift();
    item.instance.sync(item.manifest, item.warnings, item.files);
  }
}, 1000);

class RemoteStorage {
  static async connect() {
    if (!config.ftpHost) {
      $.echo(β.yellow('FTP credentials are missing'));
      return;
    }
    ftp = new FTP.Client();
    await ftp.access({
      host: config.ftpHost,
      user: config.ftpUser,
      password: config.ftpPassword,
      autoReconnect: true,
      secure: false
    });
    $.echo(β.green('Connected to FTP server'))
  }

  constructor(dir, defaultExt = '') {
    this.dir = dir;
    this.defaultExt = defaultExt;
  }

  async store(data, id) {
    if (!ftp) return;
    let remoteFilename = `/patch/_${this.dir}/${id}`;
    if (typeof data === 'string') {
      await ftp.upload(fs.createReadStream(data), remoteFilename);
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
    if (!ftp) return;

    if (busy) {
      queue = queue.filter(x => x.instance != this);
      queue.push({ instance: this, manifest: manifest, warnings: warnings, files: files });
      return;
    }

    try {
      busy = true;
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
    }
  }
}

module.exports = RemoteStorage;