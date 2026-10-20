export function normalizeRanges(ranges,duration){
  if(!Number.isFinite(duration)||duration<=0||duration>180||!Array.isArray(ranges)||ranges.length<1||ranges.length>20)throw new Error('解析する区間を1〜20個指定してください。');
  const sorted=ranges.map(range=>{
    if(!Number.isFinite(range.start)||!Number.isFinite(range.end)||range.start<0||range.end>duration+.001||range.end-range.start<.5)throw new Error('開始・終了は動画内で指定し、区間を0.5秒以上にしてください。');
    const impact=range.impact??null;
    if(impact!==null&&(!Number.isFinite(impact)||impact<range.start||impact>range.end))throw new Error('インパクトは区間の開始・終了の間で指定してください。');
    return {start:range.start,end:Math.min(range.end,duration),impact};
  }).sort((a,b)=>a.start-b.start);
  if(sorted.some((range,i)=>i&&range.start<sorted[i-1].end-.001))throw new Error('区間が重なっています。重ならない時間を指定してください。');
  return sorted;
}
export const totalDuration=ranges=>ranges.reduce((sum,r)=>sum+r.end-r.start,0);
export const includesTime=(t,ranges)=>ranges.some(r=>t>=r.start-.001&&t<=r.end+.001);
export const formatTime=t=>`${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,'0')}`;
