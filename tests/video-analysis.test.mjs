import test from 'node:test';
import assert from 'node:assert/strict';
import {primeVideo,analyzePlayback} from '../src/video-analysis.mjs';

class FakeVideo extends EventTarget {
  constructor({frameAPI=true,stalled=false,denied=false}={}) {
    super();this.readyState=1;this.duration=1;this.playbackRate=1;this.paused=true;this.ended=false;this.seeking=false;
    this.t=0;this.resets=0;this.cancelledCallbacks=0;this.index=0;this.pending=new Map();this.serial=0;
    this.stalled=stalled;this.denied=denied;
    if(!frameAPI)this.requestVideoFrameCallback=undefined;
  }
  get currentTime(){return this.t;}
  set currentTime(t){this.t=t;this.index=0;this.ended=false;this.resets++;} // Intentionally emits NO seeked event.
  play(){if(this.denied)return Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}));this.paused=false;this.tick();return Promise.resolve();}
  pause(){this.paused=true;clearTimeout(this.timer);}
  tick(){if(this.paused||this.stalled)return;this.timer=setTimeout(()=>{
    if(this.paused)return;
    this.readyState=2;this.t=this.index/10;
    const callbacks=[...this.pending.values()];this.pending.clear();callbacks.forEach(cb=>cb(performance.now(),{mediaTime:this.t}));
    this.index++;
    if(this.index===11){this.ended=true;this.dispatchEvent(new Event('ended'));}else this.tick();
  },7);}
  requestVideoFrameCallback(cb){const id=++this.serial;this.pending.set(id,cb);return id;}
  cancelVideoFrameCallback(id){this.cancelledCallbacks++;this.pending.delete(id);}
}

test('decodes an unprimed video without waiting for seeked, restores speed, cleans callbacks',async()=>{
  const video=new FakeVideo(),times=[];video.playbackRate=.25;
  await primeVideo(video);assert.equal(video.paused,true);assert.equal(video.playsInline,true);assert.equal(video.muted,true);
  await analyzePlayback(video,{onFrame:t=>times.push(t),isHidden:()=>false});
  assert.equal(video.resets,1);assert.ok(times.length>=10);assert.equal(times[0],0);assert.equal(times.at(-1),1);
  assert.equal(video.playbackRate,.25);assert.equal(video.paused,true);assert.equal(video.pending.size,0);
});
test('uses decoded frame time rather than an unrelated currentTime',async()=>{
  const video=new FakeVideo();video.tick=function(){this.timer=setTimeout(()=>{this.readyState=2;this.t=.8;const callbacks=[...this.pending.values()];this.pending.clear();callbacks.forEach(cb=>cb(0,{mediaTime:.2}));this.ended=true;this.dispatchEvent(new Event('ended'));},5);};
  const times=[];await analyzePlayback(video,{onFrame:t=>times.push(t),isHidden:()=>false});assert.deepEqual(times,[.2]);
});
test('old browser fallback processes unique advancing frames',async()=>{
  globalThis.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),3);globalThis.cancelAnimationFrame=clearTimeout;
  const video=new FakeVideo({frameAPI:false}),times=[];
  try{await analyzePlayback(video,{onFrame:t=>times.push(t),isHidden:()=>false});assert.ok(times.length>=5);assert.equal(new Set(times).size,times.length);}
  finally{delete globalThis.requestAnimationFrame;delete globalThis.cancelAnimationFrame;}
});
test('cancel works even when no decoded frame arrives',async()=>{
  const video=new FakeVideo({stalled:true});let cancelled=false;setTimeout(()=>cancelled=true,20);
  await assert.rejects(analyzePlayback(video,{onFrame(){},cancelled:()=>cancelled,isHidden:()=>false}),/中止/);
  assert.equal(video.paused,true);assert.equal(video.pending.size,0);
});
test('stalled video produces actionable recovery guidance and releases resources',async()=>{
  const video=new FakeVideo({stalled:true});
  await assert.rejects(analyzePlayback(video,{onFrame(){},isHidden:()=>false,stallMs:20}),/再生.*MP4/);
  assert.equal(video.paused,true);assert.equal(video.pending.size,0);
});
test('hidden page stops analysis with a specific message',async()=>{
  const video=new FakeVideo({stalled:true});
  await assert.rejects(analyzePlayback(video,{onFrame(){},isHidden:()=>true}),/画面が閉じられた/);
});
test('denied initial playback tells the user how to retry',async()=>{
  const video=new FakeVideo({denied:true});await assert.rejects(primeVideo(video),/「再生」/);assert.equal(video.paused,true);
});
