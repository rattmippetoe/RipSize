/** Pure configuration and geometry tests runnable without Supernote hardware. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core/config');
const G = require('../src/core/layout');
const S = require('../src/platform/settings');
const P = require('../src/platform/permissions');
const E = require('../src/platform/events');

test('Nomad defaults to 26',()=>assert.equal(C.defaultFontSize(4),26));
test('Manta defaults to 36',()=>assert.equal(C.defaultFontSize(5),36));
test('Other model does not pretend to be Nomad',()=>assert.equal(C.defaultFontSize(-1),36));
test('Sizes are exact integers from 1 to 50',()=>{
 assert.equal(C.normalizeFontSize(1),1);
 assert.equal(C.normalizeFontSize(50),50);
 for(const val of [0,51,-2,1.5,NaN,'26',undefined]) assert.equal(C.normalizeFontSize(val),null);
});
test('Device preferences use distinct filenames',()=>{
 assert.notEqual(C.settingsFilename(4),C.settingsFilename(5));
});
test('Text box stays inside native note page',()=>{
 const rect=G.planTextRect({left:200,top:300,right:450,bottom:345},{width:1404,height:1872},'Some sample text\nSecond line',26);
 assert.equal(rect.left,200);
 assert.equal(rect.top,300);
 assert.ok(rect.right>450);
 assert.ok(rect.bottom>345);
 assert.ok(rect.right<=1404 && rect.bottom<=1872);
});
test('Tight boundary is clipped',()=>{
 const rect=G.planTextRect({left:1300,top:1800,right:1400,bottom:1860},{width:1404,height:1872},'very long sentence here\nsecond line\nthird line',36);
 assert.equal(rect.right,1404);
 assert.equal(rect.bottom,1872);
});
test('Invalid lasso geometry fails safely',()=>{
 assert.throws(()=>G.planTextRect({left:5,top:10,right:2,bottom:20},{width:1404,height:1872},'abc',26));
});
test('Settings round-trip stays per device',async()=>{
 const files=new Map();
 const fs={mkdir:async()=>{},exists:async p=>files.has(p),readFile:async p=>files.get(p),writeFile:async(p,v)=>{files.set(p,v);}};
 assert.equal(await S.loadSize(fs,'/data/plugins/abc',4),26);
 assert.equal(await S.loadSize(fs,'/data/plugins/abc',5),36);
 await S.saveSize(fs,'/data/plugins/abc',4,27);
 assert.equal(await S.loadSize(fs,'/data/plugins/abc',4),27);
 assert.equal(await S.loadSize(fs,'/data/plugins/abc',5),36);
 await S.saveSize(fs,'/data/plugins/abc',5,37);
 assert.equal(await S.loadSize(fs,'/data/plugins/abc',5),37);
 assert.equal(await S.loadSize(fs,'/data/plugins/abc',4),27);
});
test('Corrupt saved preference falls back safely',async()=>{
 const fs={DocumentDirectoryPath:'/private',exists:async()=>true,readFile:async()=>'{not json'};
 assert.equal(await S.loadSize(fs,'/data/plugins/abc',4),26);
});
test('Early plugin button press is retained until listener mounts',()=>{
 E.recordPress(200);
 const received=[];
 const unsubscribe=E.observePresses(n=>received.push(n));
 E.recordPress(100);
 unsubscribe();
 assert.deepEqual(received,[200,100]);
});
test('Permission prompt only occurs when not already granted',async()=>{
 const calls=[];
 const sdk={hasPermission:async p=>p===P.READ?1:0,requestPermission:async p=>{calls.push(p);return 2;}};
 await P.ensureNotePermissions(sdk,'Access selected note');
 assert.deepEqual(calls,[P.WRITE]);
});
test('Permission denial aborts conversion eligibility',async()=>{
 const sdk={hasPermission:async()=>0,requestPermission:async()=>0};
 await assert.rejects(P.ensureNotePermissions(sdk,'Access selected note'),/not granted/);
});
test('Private storage path is under SDK-provided folder',()=>{
 assert.equal(S.settingsPath('/data/plugin/onlyme',4),'/data/plugin/onlyme/settings/RecognizeSize-device-4.json');
 assert.throws(()=>S.settingsPath('',4),/unavailable/);
});
