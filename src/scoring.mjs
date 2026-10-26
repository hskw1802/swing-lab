import {good,measures} from './coaching.mjs?v=5';
export const RUBRIC={version:'angle-control-1',tolerance:5,zeroAt:20,maxGap:.18,minCoverage:.8};
const clamp=x=>Math.max(0,Math.min(1,x));
// A transparent 2D posture-control heuristic, not a validated golf skill score.
export function evaluateSwing(report,segment,frames){
  const unavailable=reason=>({score:null,reason});
  if(report.view!=='side')return unavailable('正面では前傾を測れません。後方からの動画で採点してください。肩の傾きや膝は回転に伴って変わるため、一定角度を良い姿勢として採点しません。');
  if(segment.address==null||segment.impact==null)return unavailable('「構えをここに」と「打球をここに」を指定して再解析してください。各区間を1スイングにすると採点できます。');
  const duration=segment.impact-segment.address;
  if(duration<.5||duration>5)return unavailable('構えは動き出す直前、打球は接触の瞬間を指定してください。評価する時間は0.5〜5秒です。');
  const rows=frames.filter(f=>good(f.p,[11,12,23,24])).map(f=>({t:f.t,axis:measures(f.p,report.width,report.height,report.hand).axis,p:f.p}));
  const nearest=t=>rows.reduce((a,b)=>!a||Math.abs(b.t-t)<Math.abs(a.t-t)?b:a,null);
  const address=nearest(segment.address),impact=nearest(segment.impact);
  if(!address||!impact||Math.abs(address.t-segment.address)>.12||Math.abs(impact.t-segment.impact)>.12)return unavailable('構えまたは打球の前後0.12秒に肩・腰の検出がありません。骨格が重なる映像で再解析してください。');
  const window=rows.filter(r=>r.t>=address.t&&r.t<=impact.t);
  if(window.length<8)return unavailable('評価区間の有効な肩・腰の計測が8フレーム未満です。');
  const torso=Math.hypot((address.p[11].x-address.p[23].x)*report.width,(address.p[11].y-address.p[23].y)*report.height);
  const wrists=window.filter(r=>good(r.p,[15,16]));
  const wrist=report.hand==='left'?16:15;
  const travel=wrists.length?Math.max(...wrists.map(r=>Math.hypot((r.p[wrist].x-address.p[wrist].x)*report.width,(r.p[wrist].y-address.p[wrist].y)*report.height))):0;
  if(torso<Math.max(report.width,report.height)*.05||!good(address.p,[15,16])||wrists.length/window.length<.8||travel<torso*.35)return unavailable('上体と手首の動きを十分に確認できません。静止姿勢だけでは採点しません。1スイング全体と両手が映るように撮影してください。');
  const baseline=address.axis,pieces=[];let valid=0,held=0,longest=0,run=0,worst=address;
  for(let i=1;i<window.length;i++){
    const a=window[i-1],b=window[i],gap=b.t-a.t,dt=Math.min(b.t,segment.impact)-Math.max(a.t,segment.address);
    if(dt<=0||gap>RUBRIC.maxGap){run=0;continue;}
    const deviation=Math.max(Math.abs(a.axis-baseline),Math.abs(b.axis-baseline));
    valid+=dt;pieces.push({deviation,dt});
    if(deviation<=RUBRIC.tolerance){held+=dt;run+=dt;longest=Math.max(longest,run);}else run=0;
    if(Math.abs(b.axis-baseline)>Math.abs(worst.axis-baseline))worst=b;
  }
  const coverage=valid/duration;
  if(coverage<RUBRIC.minCoverage)return unavailable('評価時間の80%以上を連続計測できませんでした。検出の空白は維持時間として数えません。');
  const sorted=pieces.sort((a,b)=>a.deviation-b.deviation);let sum=0,p95=0;
  for(const p of sorted){sum+=p.dt;p95=p.deviation;if(sum>=valid*.95)break;}
  const delta=Math.abs(impact.axis-baseline),quality=d=>1-clamp((d-RUBRIC.tolerance)/(RUBRIC.zeroAt-RUBRIC.tolerance));
  const components={hold:Math.round(50*held/valid),impact:Math.round(30*quality(delta)),excursion:Math.round(20*quality(p95))};
  return {score:components.hold+components.impact+components.excursion,components,baseline,impact:impact.axis,delta,p95,held,longest,valid,duration,coverage,ratio:held/valid,worstTime:worst.t,rows:window.map(({t,axis})=>({t,axis})),reason:null};
}
