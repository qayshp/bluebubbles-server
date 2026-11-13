// Run using Electron with ELECTRON_RUN_AS_NODE=1. All database rows are synthetic.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const Module = require('node:module'), assert = require('node:assert/strict');
const ts = require('typescript'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../src');
const resourcesIndex = process.argv.indexOf('--resources');
const resources = resourcesIndex < 0 ? null : path.resolve(process.argv[resourcesIndex + 1]);
const packaged = resources ? Module.createRequire(path.join(resources, 'app.asar/package.json')) : require;
const packagedModules = {};
if (resources) {
    const provenance = JSON.parse(fs.readFileSync(path.join(resources, 'custom-build.json'), 'utf8'));
    const archive = path.join(resources, 'app.asar');
    const entry = packaged('./package.json').main;
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(archive, entry))).digest('hex'), provenance.server_sha256);
    // Resolve from the actual package, rather than accidentally loading checkout copies.
    for (const name of ['better-sqlite3', 'typeorm', 'node-mac-contacts', 'node-mac-permissions']) {
        assert(packaged.resolve(name).startsWith(archive + path.sep), name + ' escaped the packaged application');
        packaged(name);
    }
    for (const name of ['typeorm', 'better-sqlite3', 'reflect-metadata']) packagedModules[name] = packaged(name);
}
const resolve = Module._resolveFilename, load = Module._load, previousTs = Module._extensions['.ts'];
Module._resolveFilename = function(name, parent, ...rest) {
    if (name.startsWith('@server/')) name = path.join(root, 'server', name.slice(8));
    return resolve.call(this, name, parent, ...rest);
};
Module._load = function(name, parent, main) {
    if (name === '@server') return { Server: () => ({ log: () => {} }) };
    if (Object.hasOwn(packagedModules, name)) return packagedModules[name];
    return load.call(this, name, parent, main);
};
Module._extensions['.ts'] = function(mod, filename) {
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
            experimentalDecorators: true, emitDecoratorMetadata: true }
    }).outputText, filename);
};
(async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-db-smoke-'));
    let db;
    try {
        require('reflect-metadata');
        const { DataSource } = packaged('typeorm'), Native = packaged('better-sqlite3');
        const entities = Object.values(require('../src/server/databases/server/entity/index.ts'));
        const migrations = fs.readdirSync(path.join(root, 'server/databases/server/migrations'))
            .filter(f => f.endsWith('.ts')).flatMap(f => Object.values(require(path.join(root, 'server/databases/server/migrations', f))));
        const file = path.join(tmp, 'config.db');
        const fixture = new Native(file);
        fixture.exec('CREATE TABLE config(name TEXT PRIMARY KEY, value TEXT); CREATE TABLE webhook(id INTEGER PRIMARY KEY);');
        fixture.prepare('INSERT INTO config VALUES (?, ?)').run('synthetic-setting', 'preserve-me');
        fixture.close();
        db = new DataSource({ type: 'better-sqlite3', database: file, entities, migrations,
            migrationsRun: true, synchronize: false, migrationsTableName: 'migrations' });
        await db.initialize();
        assert.equal(await db.getRepository(entities.find(e => e.name === 'Config')).count(), 1);
        assert.equal((await db.query('SELECT value FROM config WHERE name = ?', ['synthetic-setting']))[0].value, 'preserve-me');
        const names = (await db.query('pragma table_info(webhook)')).map(r => r.name);
        for (const column of ['block_private_addresses', 'require_https', 'follow_redirects']) assert(names.includes(column));
        assert((await db.query('pragma table_info(contact)')).some(r => r.name === 'external_id'));
        assert.equal((await db.query('pragma quick_check'))[0].quick_check, 'ok');
        console.log('PASS: packaged native modules, synthetic configuration startup and migrations');
    } finally {
        if (db?.isInitialized) await db.destroy();
        fs.rmSync(tmp, { recursive: true, force: true });
        Module._resolveFilename = resolve;
        Module._load = load;
        if (previousTs) Module._extensions['.ts'] = previousTs;
        else delete Module._extensions['.ts'];
    }
})().catch(err => { console.error(err.message); process.exitCode = 1; });
