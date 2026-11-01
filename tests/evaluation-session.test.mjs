import test from 'node:test';import assert from 'node:assert/strict';
import {setEvaluationPhase} from '../src/evaluation-session.mjs';
import {coachingHTML} from '../src/coaching.mjs';
import {validateReport} from '../src/report.mjs';
function fixture(){
 const frames=Array.from({length:25},(_,i)=>({t:i/12,segment:0,p:Array.from({length:33},(_,j)=>({x:j===11?.6:j===12?.7:.5,y:j<23?.3:.6,visibility:.99}))}));
 return {format:'swing-lab',version:2,created:'2026-11-01T00:00:00Z',view:'side',hand:'right',width:640,height:480,duration:2,samples:25,segments:[{start:0,end:2,samples:25,address:null,impact:null}],frames};
}
test('post-analysis markers reuse exact frames, validate, and leave original report unchanged',()=>{
 const r=fixture(),a=setEvaluationPhase(r,0,'address',0),b=setEvaluationPhase(a,0,'impact',1.5);
 assert.equal(b.frames,r.frames);assert.equal(r.segments[0].address,null);assert.equal(b.segments[0].impact,1.5);assert.equal(validateReport(b),b);
});
test('out-of-range and reversed markers are rejected without discarding previous markers',()=>{
 const r=setEvaluationPhase(fixture(),0,'address',1);
 for(const t of [-1,.5,3,NaN])assert.throws(()=>setEvaluationPhase(r,0,'impact',t));
 assert.equal(r.segments[0].address,1);assert.equal(r.segments[0].impact,null);assert.throws(()=>setEvaluationPhase(r,3,'address',0));
});
test('legacy reports gain phase metadata with segment mapping and keep inference coordinates',()=>{
 const r=fixture();r.version=1;delete r.segments;r.frames=r.frames.map(({segment,...f})=>f);
 const a=setEvaluationPhase(r,0,'address',0);assert.equal(a.version,2);assert.ok(a.frames.every(f=>f.segment===0));assert.equal(a.frames[0].p,r.frames[0].p);assert.equal(validateReport(a),a);
});
test('missing phases show reason, actionable setup, and form advice together',()=>{
 const html=coachingHTML(fixture());assert.match(html,/構え・打球の時刻が未指定/);assert.match(html,/data-review-score="0"/);assert.match(html,/再解析は不要/);assert.match(html,/修正・確認練習/);assert.match(html,/評価の状態/);
});
test('front view and low detection never produce an unexplained blank evaluation',()=>{
 const r=fixture();r.view='front';r.samples=250;r.segments[0].samples=250;
 const html=coachingHTML(r);assert.match(html,/正面動画では前傾角の点数を出せません/);assert.match(html,/最優先：映像の検出状態/);assert.doesNotMatch(html,/data-review-score/);
});
