import {normalizeRanges} from './ranges.mjs?v=6';

// Change phase metadata only: preserve the exact inferred frame objects and times.
export function setEvaluationPhase(report,index,phase,time){
  if(!['address','impact'].includes(phase)||!Number.isInteger(index))throw new Error('指定する局面を確認してください。');
  const segments=report.version===2?report.segments:[{start:0,end:report.duration,address:null,impact:null,samples:report.samples}];
  if(!segments[index])throw new Error('対象のスイングがありません。');
  const changed=segments.map((s,i)=>i===index?{...s,[phase]:time}:s);
  const ranges=normalizeRanges(changed,report.duration);
  return {...report,version:2,segments:changed.map((s,i)=>({...s,...ranges[i]})),frames:report.version===2?report.frames:report.frames.map(f=>({...f,segment:0}))};
}
