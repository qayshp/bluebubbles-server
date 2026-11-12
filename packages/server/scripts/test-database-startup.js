// Run with ELECTRON_RUN_AS_NODE=1 using the built Electron executable.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module');
const assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'../src');
const resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(name,parent,...rest){
 if(name.startsWith('@server/'))name=path.join(root,'server',name.slice(8));
 return resolve.call(this,name,parent,...rest);
};
Module._load=function(name,parent,main){if(name==='@server')return {Server:()=>({log:()=>{}})};return load.call(this,name,parent,main);};
Module._extensions['.ts']=function(mod,filename){mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText,filename);};
require('reflect-metadata');
const {DataSource}=require('typeorm');const Native=require('better-sqlite3');
const entities=Object.values(require('../src/server/databases/server/entity/index.ts'));
const migrations=fs.readdirSync(path.join(root,'server/databases/server/migrations')).filter(f=>f.endsWith('.ts')).flatMap(f=>Object.values(require(path.join(root,'server/databases/server/migrations',f))));
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bb-db-smoke-'));const file=path.join(tmp,'config.db');
 // A consistent SQLite backup, never a write to the live configuration database.
 const src=new Native(path.join(os.homedir(),'Library/Application Support/bluebubbles-server/config.db'),{readonly:true});await src.backup(file);src.close();
 const before=new Native(file);const count=before.prepare('select count(*) n from config').get().n;before.close();
 const db=new DataSource({type:'better-sqlite3',database:file,entities,migrations,migrationsRun:true,synchronize:false,migrationsTableName:'migrations'});
 await db.initialize();assert.equal(await db.getRepository(entities.find(e=>e.name==='Config')).count(),count);
 const names=(await db.query('pragma table_info(webhook)')).map(r=>r.name);
 for(const c of ['block_private_addresses','require_https','follow_redirects'])assert(names.includes(c));
 assert((await db.query('pragma table_info(contact)')).some(r=>r.name==='external_id'));
 await db.destroy();console.log('PASS: copied configuration database startup, entity metadata and migration schema');
})().catch(err=>{console.error(err.message);process.exitCode=1;});
