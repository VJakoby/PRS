const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outputPath = path.join(__dirname, '..', `data.backup-${timestamp}.zip`);

const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
    console.log(`✅ Backup created: ${path.basename(outputPath)}`);
    console.log(`   Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

archive.on('error', err => { throw err; });

archive.pipe(output);
archive.directory(dataDir, 'data');
archive.finalize();