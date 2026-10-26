import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateSwing} from '../src/scoring.mjs';
import {validateReport} from '../src/report.mjs';
import {normalizeRanges} from '../src/ranges.mjs';
function fixture(fn=()=>30){
 const report={format:'swing-lab',version:2,created:'2026-10-26T00:00:00Z',view:'side',hand:'right',width:1000,height:1000,duration:3,samples:37,segments:[{start:0,end:3,address:0,impact:2,samples:37}],frames:[]};
 report.frames=Array.from({length:37},(_,i)=>{const t=i/12,a=fn(t)*Math.PI/180;const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));for(const id of [11,12])p[id]={x:.5+.25*Math.sin(a),y:.6-.25*Math.cos(a),visibility:.99};for(const id of [23,24])p[id]={x:.5,y:.6,visibility:.99};for(const id of [15,16])p[id]={x:.4+.22*Math.sin(t*2),y:.7-.15*Math.sin(t*2),visibility:.99};return {t,p,segment:0};});return report;
}
const evaluate=r=>evaluateSwing(r,r.segments[0],r.frames);
test('stable projected axis receives full control score, excludes changing finish',()=>{const e=evaluate(fixture(t=>t>2?75:30));assert.equal(e.score,100);assert.equal(e.longest,2);assert.equal(e.ratio,1);assert.ok(Math.abs(e.baseline-30)<1e-9);});
test('preimpact posture change lowers score and identifies actual frame',()=>{const e=evaluate(fixture(t=>30+10*t));assert.ok(e.score<50);assert.ok(e.delta>19.9);assert.equal(e.worstTime,2);assert.ok(e.ratio<.3);});
test('absolute angle is not graded against research population average',()=>{assert.equal(evaluate(fixture(()=>15)).score,evaluate(fixture(()=>40)).score);});
test('front view, missing markers, reversed markers and long setup are not scored',()=>{for(const mutate of [r=>r.view='front',r=>r.segments[0].address=null,r=>r.segments[0].impact=null,r=>r.segments[0].address=2.5]){const r=fixture();mutate(r);assert.equal(evaluate(r).score,null);}assert.throws(()=>normalizeRanges([{start:0,end:3,address:2,impact:1}],3));});
test('confidence holes and missing endpoint suppress scores',()=>{const r=fixture();r.frames.forEach(f=>{if(f.t>.4&&f.t<1.3)f.p[11].visibility=.1;});assert.equal(evaluate(r).score,null);const endpoint=fixture();endpoint.frames=endpoint.frames.filter(f=>f.t>.2);assert.equal(evaluate(endpoint).score,null);});
test('static pose does not earn a score',()=>{const r=fixture();r.frames.forEach(f=>{f.p[15]={...r.frames[0].p[15]};f.p[16]={...r.frames[0].p[16]};});assert.equal(evaluate(r).score,null);});
test('irregular sampling uses seconds rather than frame count and does not bridge gaps',()=>{const r=fixture(t=>t>.5&&t<1?40:30);const e=evaluate(r);const sparse=fixture();sparse.frames=sparse.frames.filter(f=>f.t<=.5||f.t>=1);assert.equal(evaluate(sparse).score,null);assert.ok(e.held>1&&e.held<1.7);assert.ok(e.longest<2);});
test('v2 preserves new markers and rejects invalid marker values while legacy remains readable',()=>{const r=fixture();assert.equal(validateReport(r),r);r.segments[0].address='0';assert.throws(()=>validateReport(r));r.segments[0].address=null;assert.equal(validateReport(r),r);});
