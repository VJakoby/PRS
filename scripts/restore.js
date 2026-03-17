const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const projectRoot = path.join(__dirname, '..');

// Find zip - either passed as argument or auto-find latest in ./data
const zipArg = process.argv[2];
let zipPath;

if (zipArg) {
    zipPath = path.resolve(zipArg);
} else {
    const files = fs.readdirSync(dataDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.zip'))
        .sort()
        .reverse();

    if (files.length === 0) {
        console.error('❌ No backup files found in ./data');
        process.exit(1);
    }

    zipPath = path.join(dataDir, files[0]);
    console.log(`📦 Auto-selected: ${files[0]}`);
}

if (!fs.existsSync(zipPath)) {
    console.error(`❌ File not found: ${zipPath}`);
    process.exit(1);
}

console.log(`🔄 Restoring from: ${path.basename(zipPath)}`);

try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(projectRoot, /*overwrite=*/true);
    console.log('✅ Restore complete');
    console.log('   Run "npm run info" to verify');
} catch (err) {
    console.error('❌ Restore failed:', err.message);
    process.exit(1);
}