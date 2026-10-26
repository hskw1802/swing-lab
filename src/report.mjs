import {normalizeRanges,includesTime} from './ranges.mjs?v=5';
export function validateReport(r){
  if(typeof r?.created!=='string'||!Number.isFinite(Date.parse(r.created)))throw new Error('解析日時のデータが不正です。');
  if(r?.format!=='swing-lab'||![1,2].includes(r.version)||!['front','side'].includes(r.view)||!['left','right'].includes(r.hand)||!Number.isFinite(r.width)||!Number.isFinite(r.height)||r.width<1||r.height<1||r.width>8000||r.height>8000||!Number.isFinite(r.duration)||r.duration<=0||r.duration>180||!Number.isInteger(r.samples)||r.samples<1||r.samples>2400||!Array.isArray(r.frames)||r.frames.length<5||r.frames.length>r.samples||!r.frames.every((f,i)=>Number.isFinite(f.t)&&f.t>=0&&f.t<=r.duration&&(!i||f.t>r.frames[i-1].t)&&Array.isArray(f.p)&&f.p.length===33&&f.p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<10&&Math.abs(p.y)<10&&Number.isFinite(p.visibility)&&p.visibility>=0&&p.visibility<=1)))throw new Error('有効なSwing Lab解析ファイルを選んでください。');
  if(r.version===2){
    const ranges=normalizeRanges(r.segments,r.duration);
    if(r.segments.some((s,i)=>s.start!==ranges[i].start||s.end!==ranges[i].end||!Number.isInteger(s.samples)||s.samples<0)||r.segments.reduce((sum,s)=>sum+s.samples,0)!==r.samples||r.frames.some(f=>!Number.isInteger(f.segment)||f.segment<0||f.segment>=ranges.length||!includesTime(f.t,[ranges[f.segment]]))||r.segments.some((s,i)=>r.frames.filter(f=>f.segment===i).length>s.samples))throw new Error('解析区間のデータが不正です。');
  }else if(r.segments!==undefined)throw new Error('解析ファイルのバージョンを確認してください。');
  return r;
}
