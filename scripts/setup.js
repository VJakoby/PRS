const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const projectRoot = path.resolve(__dirname, '..');
const templatePath = path.join(projectRoot, 'sources.json.template');
const sourcesPath = path.join(projectRoot, 'sources.json');
const envPath = path.join(projectRoot, '.env');
const dockerMode = process.argv.includes('--docker');

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

function isYes(answer) {
  return ['y', 'yes'].includes(answer.toLowerCase());
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function loadTemplate() {
  const contents = await fs.readFile(templatePath, 'utf8');
  return JSON.parse(contents);
}

function updateEnv(contents, values) {
  const lines = contents ? contents.replace(/\n$/, '').split('\n') : [];
  const remaining = new Map(Object.entries(values));
  const updated = lines.map(line => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !remaining.has(match[1])) return line;
    const value = remaining.get(match[1]);
    remaining.delete(match[1]);
    return `${match[1]}=${value}`;
  });

  for (const [key, value] of remaining) updated.push(`${key}=${value}`);
  return `${updated.join('\n')}\n`;
}

async function configureDocker(config, notesPath, hostPort) {
  const primarySource = config.offline_sources?.[0];
  if (primarySource) {
    primarySource.enabled = Boolean(notesPath);
    primarySource.path = '/app/notes';
  }

  const hostNotesPath = notesPath
    ? path.resolve(projectRoot, notesPath)
    : './notes';
  const envContents = await fileExists(envPath) ? await fs.readFile(envPath, 'utf8') : '';
  const uid = typeof process.getuid === 'function' ? process.getuid() : 1000;
  const gid = typeof process.getgid === 'function' ? process.getgid() : 1000;
  const output = updateEnv(envContents, {
    NOTES_PATH: hostNotesPath,
    ENGRAM_PORT: hostPort,
    PUID: uid,
    PGID: gid,
    NOTES_PATH_2: './.docker-empty/notes-2',
    NOTES_PATH_3: './.docker-empty/notes-3'
  });

  await fs.writeFile(envPath, output, { encoding: 'utf8', mode: 0o600 });
  await Promise.all([
    fs.mkdir(path.join(projectRoot, 'data'), { recursive: true }),
    fs.mkdir(path.join(projectRoot, '.docker-empty', 'notes-2'), { recursive: true }),
    fs.mkdir(path.join(projectRoot, '.docker-empty', 'notes-3'), { recursive: true })
  ]);
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    if (await fileExists(sourcesPath)) {
      const overwrite = await ask(rl, 'sources.json already exists. Overwrite it? [y/N] ');
      if (!isYes(overwrite)) {
        console.log('Setup cancelled. Existing sources.json was not changed.');
        return;
      }
    }

    const config = await loadTemplate();
    const prompt = dockerMode
      ? 'Host notes directory (leave blank to disable local indexing): '
      : 'Local notes directory (leave blank to disable local indexing): ';
    const notesPath = await ask(rl, prompt);
    const hostPort = dockerMode
      ? (await ask(rl, 'Host port [3002]: ')) || '3002'
      : null;

    if (dockerMode) {
      if (!/^\d+$/.test(hostPort) || Number(hostPort) < 1 || Number(hostPort) > 65535) {
        throw new Error('Host port must be a number between 1 and 65535');
      }
      await configureDocker(config, notesPath, hostPort);
    } else if (config.offline_sources?.[0]) {
      config.offline_sources[0].enabled = Boolean(notesPath);
      if (notesPath) config.offline_sources[0].path = notesPath;
    }

    const output = `${JSON.stringify(config, null, 2)}\n`;
    JSON.parse(output);
    await fs.writeFile(sourcesPath, output, { encoding: 'utf8', mode: 0o600 });

    console.log('\nCreated sources.json with valid JSON.');
    console.log('Review enabled sources, then run:');
    if (dockerMode) {
      console.log('  docker network create pragma-net  # Skip if it already exists');
      console.log('  docker compose build');
      console.log('  npm run docker:index:force');
      console.log('  npm run docker:up');
      console.log(`  Open: http://localhost:${hostPort}`);
    } else {
      console.log('  npm run index -- --force');
      console.log('  npm start');
    }
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error(`Setup failed: ${error.message}`);
  process.exitCode = 1;
});
