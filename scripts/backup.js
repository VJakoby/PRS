const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');

function getTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function getDefaultBackupPath() {
    return path.join(projectRoot, `data.backup-${getTimestamp()}.zip`);
}

function createBackup(outputPath = getDefaultBackupPath()) {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            resolve({
                outputPath,
                bytes: archive.pointer()
            });
        });

        output.on('error', reject);
        archive.on('error', reject);

        archive.pipe(output);
        archive.directory(dataDir, 'data');
        archive.finalize();
    });
}

module.exports = {
    createBackup,
    getDefaultBackupPath
};

if (require.main === module) {
    createBackup()
        .then(({ outputPath, bytes }) => {
            console.log(`✅ Backup created: ${path.basename(outputPath)}`);
            console.log(`   Location: ${outputPath}`);
            console.log(`   Size: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
        })
        .catch((err) => {
            console.error(`❌ Backup failed: ${err.message}`);
            process.exit(1);
        });
}
