const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
process.resourcesPath=process.resourcesPath || '/custom-resources';
let checks=0,installs=0,opened=0,custom=true,metadata=false;
const updater={on:()=>{},checkForUpdates:async()=>{checks++;return null},quitAndInstall:()=>{installs++}};
const mocks={
 fs:{existsSync:p=>p.endsWith('custom-build.json')?custom:metadata},path,
 electron:{app:{getVersion:()=> '1.9.12'},shell:{openExternal:async()=>{opened++}}},
 'electron-updater':{autoUpdater:updater},semver:require('semver'),
 '@server':{},'@server/events':{},'@server/lib/ScheduledService':{},
 '@server/lib/logging/Loggable':{Loggable:class{log={debug:()=>{},info:()=>{},warn:()=>{},error:()=>{}};}},axios:{}
};
const source=path.resolve(__dirname,'../src/server/services/updateService/index.ts');const moduleObject={exports:{}};
const compiled=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
new Function('require','module','exports',compiled)(name=>{if(!(name in mocks))throw Error(name);return mocks[name]},moduleObject,moduleObject.exports);
(async()=>{
 const a=new moduleObject.exports.UpdateService(null);await a.checkWithUpdater();await a.installUpdate();assert.equal(checks,0);assert.equal(installs,0);assert.equal(opened,1);
 custom=false;const b=new moduleObject.exports.UpdateService(null);await b.checkWithUpdater();assert.equal(checks,0,'missing updater metadata must not generate an updater error');
 metadata=true;await b.checkWithUpdater();assert.equal(checks,1,'normal distribution keeps the updater');console.log('PASS: custom update protection and distribution fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
