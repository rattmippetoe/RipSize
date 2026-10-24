/**
 * Simulated firmware transactions check OCR insertion and irreversible delete
 * ordering. Device acceptance remains necessary; mocks are not hardware.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {convertSelection, savedTextMatches, selectedStrokesStillPresent} = require('../src/core/convert');
function rig(override={}) {
 const events=[];
 let insert=null;
 const strokes=override.strokes || [{type:0,numInPage:2,uuid:'a'},{type:0,numInPage:3,uuid:'b'}];
 const lassoRect={left:100,top:150,right:300,bottom:220};
 const response=result=>({success:true,result});
 const comm={
  getLassoElementTypeCounts:async()=>response({trailNum:2,trailLinkNum:0,titleNum:0}),
  getLassoElements:async()=>response(strokes),
  getLassoRect:async()=>response(lassoRect),
  getCurrentFilePath:async()=>response('/example.note'),
  getCurrentPageNum:async()=>response(1),
  recognizeElements:async(els,page)=>{events.push('recognize');assert.equal(page.width,1404);return response(override.recognized===undefined?'recognized words':override.recognized);},
  setLassoBoxState:async()=>{events.push('release');return response(true);},
  reloadFile:async()=>{events.push('reload');return response(true);},
 };
 const file={
  getPageSize:async()=>response({width:1404,height:1872}),
  getElements:async()=>{events.push('verify');return response([
   ...strokes,
   ...(override.missingText||!insert?[]:[{type:500,numInPage:9,textBox:{textContentFull:insert.textContentFull,fontSize:override.wrongFont?99:insert.fontSize}}]),
  ]);},
  deleteElements:async(_path,_page,nums)=>{events.push('delete');assert.deepEqual(nums,[2,3]);return response(true);},
 };
 const note={
  insertText:async payload=>{events.push('insert');if(override.failInsert) return {success:false,error:{message:'refused'}}; insert=payload;return response(true);},
  saveCurrentNote:async()=>{events.push('save');return response(true);},
 };
 return {sdk:{comm,file,note},events, getInsert:()=>insert};
}
test('successful conversion OCRs before insert, saves and verifies before deleting',async()=>{
 const {sdk,events,getInsert}=rig();
 const result=await convertSelection(sdk,26);
 assert.equal(result.status,'success');
 assert.equal(result.inkRemoved,true);
 assert.equal(getInsert().fontSize,26);
 assert.ok(events.indexOf('insert')<events.indexOf('save'));
 assert.ok(events.indexOf('save')<events.indexOf('verify'));
 assert.ok(events.indexOf('verify')<events.indexOf('delete'));
 assert.ok(events.indexOf('delete')<events.indexOf('reload'));
});
test('Manta takes its selected value verbatim',async()=>{
 const {sdk,getInsert}=rig();
 const result=await convertSelection(sdk,36);
 assert.equal(result.status,'success');
 assert.equal(getInsert().fontSize,36);
});
test('recognizer returns empty: ink never deleted',async()=>{
 const {sdk,events}=rig({recognized:'  '});
 assert.equal((await convertSelection(sdk,26)).status,'recognition-empty');
 assert.ok(!events.includes('delete'));
});
test('mixed content is rejected before OCR without deletions',async()=>{
 const {sdk,events}=rig({strokes:[{type:0,numInPage:2},{type:500,numInPage:3,textBox:{}}]});
 assert.equal((await convertSelection(sdk,26)).status,'unsupported-selection');
 assert.ok(!events.includes('delete'));
 assert.ok(!events.includes('recognize'));
});
test('insertion rejection preserves original ink',async()=>{
 const {sdk,events}=rig({failInsert:true});
 await assert.rejects(convertSelection(sdk,26),/insertText/);
 assert.ok(!events.includes('delete'));
});
test('unverified insertion preserves original ink',async()=>{
 const {sdk,events}=rig({missingText:true});
 assert.equal((await convertSelection(sdk,26)).status,'insert-unverified');
 assert.ok(!events.includes('delete'));
});
test('wrong persisted font size does not authorize deletion',async()=>{
 const {sdk,events}=rig({wrongFont:true});
 assert.equal((await convertSelection(sdk,26)).status,'insert-unverified');
 assert.ok(!events.includes('delete'));
});
test('preview mode saves typed text but does not remove ink',async()=>{
 const {sdk,events}=rig();
 const result=await convertSelection(sdk,26,{preserveInk:true});
 assert.equal(result.status,'success-preview');
 assert.ok(!events.includes('delete'));
});
test('saved text requires same content and font size',()=>{
 const arr=[{type:500,textBox:{textContentFull:'Hello',fontSize:36}}];
 assert.ok(savedTextMatches(arr,'Hello',36));
 assert.equal(savedTextMatches(arr,'Other',36),false);
 assert.equal(savedTextMatches(arr,'Hello',26),false);
});
test('changed original stroke UUID prevents deletion',()=>{
 const selected=[{type:0,numInPage:5,uuid:'before'}];
 assert.equal(selectedStrokesStillPresent([{type:0,numInPage:5,uuid:'after'}],selected),false);
});
