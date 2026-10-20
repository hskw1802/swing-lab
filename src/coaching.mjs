import {formatTime} from './ranges.mjs?v=4';
export const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export const good=(p,ids)=>ids.every(i=>p[i]&&(p[i].visibility??1)>.55);
export function angle(a,b,c,w,h){const u=[(a.x-b.x)*w,(a.y-b.y)*h],v=[(c.x-b.x)*w,(c.y-b.y)*h];return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)||1))))*180/Math.PI;}
export function measures(p,w,h,hand){const shoulders=mid(p[11],p[12]),hips=mid(p[23],p[24]),k=hand==='right'?25:26;return {axis:Math.atan2((shoulders.x-hips.x)*w,(hips.y-shoulders.y)*h)*180/Math.PI,shoulder:Math.atan2(Math.abs(p[11].y-p[12].y)*h,Math.abs(p[11].x-p[12].x)*w)*180/Math.PI,knee:good(p,[k-2,k,k+2])?angle(p[k-2],p[k],p[k+2],w,h):null};}
const cache=new WeakMap();
export function segmentStats(report){
  if(cache.has(report))return cache.get(report);
  const segments=report.segments?.length?report.segments:[{start:0,end:report.duration,impact:null,samples:report.samples}];
  const result=segments.map((segment,index)=>{
    const frames=report.frames.filter(f=>report.version===2?f.segment===index:f.t>=segment.start-.001&&f.t<=segment.end+.001),rows=frames.map(f=>({t:f.t,...measures(f.p,report.width,report.height,report.hand)}));
    const axes=rows.map(x=>x.axis),knees=rows.filter(x=>x.knee!==null),heads=frames.filter(f=>good(f.p,[0]));
    const stance=frames.find(f=>good(f.p,[27,28])),span=stance?Math.abs(stance.p[27].x-stance.p[28].x):0;
    const headXs=heads.map(f=>f.p[0].x),sway=report.view==='front'&&heads.length>=5&&span>=.08?(Math.max(...headXs)-Math.min(...headXs))/span*100:null;
    const extent=(key,data)=>data.length?{min:data.reduce((a,b)=>a[key]<b[key]?a:b),max:data.reduce((a,b)=>a[key]>b[key]?a:b)}:null;
    const impact=segment.impact==null||!rows.length?null:rows.reduce((a,b)=>Math.abs(a.t-segment.impact)<Math.abs(b.t-segment.impact)?a:b);
    return {index,segment,frames,rows,count:frames.length,coverage:segment.samples?frames.length/segment.samples:null,axis:extent('axis',rows),axisRange:axes.length?Math.max(...axes)-Math.min(...axes):0,knee:extent('knee',knees),sway,impact:impact&&Math.abs(impact.t-segment.impact)<=.2?impact:null};
  });cache.set(report,result);return result;
}
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jump=(time,label='映像を確認')=>`<button class="secondary memo-jump" data-jump="${Number(time).toFixed(3)}">${esc(label)} ${formatTime(time)}</button>`;
const card=(title,tone,observed,meaning,practice,recheck,time)=>`<article class="coach-card ${tone}"><h4>${title}</h4><dl><dt>観測</dt><dd>${observed}</dd><dt>見るポイント</dt><dd>${meaning}</dd><dt>修正・確認練習</dt><dd>${practice}</dd><dt>次の撮影で確認</dt><dd>${recheck}</dd></dl>${time==null?'':jump(time)}</article>`;
export function coachingHTML(report){
  const stats=segmentStats(report);
  return `<div class="coach-report"><h3>解析メモ <span class="tag">参考評価</span></h3><p>各区間の計測から確認する順番を提案します。フォームの良否や打球への影響を、この映像だけで断定するものではありません。</p>${stats.map(s=>{
    const {segment}=s,low=s.count<5||(s.coverage!==null&&s.coverage<.7),coverage=s.coverage===null?'検出率は未記録':`検出率 ${Math.round(s.coverage*100)}%`;
    let html=`<section class="coach-segment"><div class="coach-segment-heading"><h3>区間 ${s.index+1} · ${formatTime(segment.start)}–${formatTime(segment.end)}</h3>${jump(segment.start,'区間の開始へ')}</div><p>${s.count}フレーム検出 · ${coverage} · ${report.view==='front'?'正面':'後方'} · ${report.hand==='right'?'右':'左'}打ち</p>`;
    if(low){
      html+=card('最優先：映像の検出状態を整える','warn',`この区間は${s.count}フレーム検出できました。${coverage}で、姿勢の変化を評価するには情報が不足しています。`,'線が体から外れている場面では、角度の大きさをフォームの課題として扱わないでください。','全身と両足が映る位置でカメラを固定します。体が隠れない明るさで1スイングだけ撮影し、区間の開始をアドレス付近に合わせます。','骨格が肩・腰・膝に重なり、トップと打球付近でも線が飛ばないことを確認してから、下の項目を見直します。',segment.start);
      return html+'</section>';
    }
    const focus=s.axisRange>=12?'体軸の変化が大きい場面':s.sway!==null&&s.sway>=25?'頭と腰の横移動の関係':'打球前後の姿勢の再現性';
    html+=`<div class="coach-priority"><b>今回、最初に確認すること</b><p>${focus}を確認します。一度に全項目を直さず、下の映像確認で実際に気になる動きが見えた1項目だけを練習します。</p></div>`;
    const baseline=s.rows[0],impact=s.impact,axis=s.axis;
    const axisObserved=`画面内の体軸角は ${axis.min.axis.toFixed(1)}°（${formatTime(axis.min.t)}）〜${axis.max.axis.toFixed(1)}°（${formatTime(axis.max.t)}）、変動幅 ${s.axisRange.toFixed(1)}°です。${impact?`指定した打球時刻に近い ${formatTime(impact.t)} は ${impact.axis.toFixed(1)}°、区間最初から ${Math.abs(impact.axis-baseline.axis).toFixed(1)}°変化しています。`:'打球時刻は未指定のため、アドレスからインパクトまでの変化とは断定できません。'}`;
    const axisTime=impact?.t??(Math.abs(axis.max.axis-baseline.axis)>=Math.abs(axis.min.axis-baseline.axis)?axis.max.t:axis.min.t);
    html+=card(s.axisRange<12?'良い点の候補：体軸の変化が比較的小さい':'確認候補：体軸が変わるタイミング',s.axisRange<12?'good':'warn',axisObserved,
      report.view==='side'?'体軸と「最初の姿勢を重ねる」を表示し、打球前に胸や腰が急に起き上がるかを0.25倍速で確認します。回転やフィニッシュに伴う自然な変化を、悪い動きとして数えないでください。':'体軸・肩・骨盤ラインを一緒に表示し、回転の途中で上体だけが急に傾くかを確認します。正面の映像では前傾角そのものは測れません。',
      '映像で急な起き上がりが確認できた場合は、鏡の前でアドレスを作り、小さなハーフスイングをゆっくり5回行います。上体を固めず、胸と骨盤が回る途中の姿勢を見比べます。',
      '同じ撮影方向・カメラ位置で撮り直し、アドレスから打球直前までを比較します。フィニッシュまで角度を一定にすることは目標にしません。',axisTime);
    if(s.sway!==null){
      const firstHead=s.frames.find(f=>good(f.p,[0])),farthest=s.frames.filter(f=>good(f.p,[0])).reduce((a,b)=>Math.abs(a.p[0].x-firstHead.p[0].x)>Math.abs(b.p[0].x-firstHead.p[0].x)?a:b);
      html+=card(s.sway<25?'良い点の候補：頭の横移動が比較的小さい':'確認候補：横移動と回転のバランス',s.sway<25?'good':'warn',`頭の横移動幅は、最初に検出した両足首の画面内の幅の ${s.sway.toFixed(0)}%です。頭が最初の位置から大きく離れる候補は ${formatTime(farthest.t)} です。`,
        '頭の軌跡と骨盤ラインを重ね、頭と腰が一緒に大きく横へ流れるか、回転の中で自然に動いているかを見分けます。この数値から足裏の荷重は分かりません。',
        '横へ流れる動きが映像でも確認できた場合は、鏡の前で足幅を変えず、小さな素振りを5回行います。頭を固定するのではなく、上体の向きと骨盤の回転をゆっくり合わせます。',
        '同じ区間の取り方で、横移動のタイミングとフィニッシュのバランスを比較します。移動幅をゼロにすることは目標にしません。',farthest.t);
    }else{
      html+=card('横移動は今回の映像では評価を控える','neutral','後方撮影、足幅が小さく映る、頭が隠れるなどの条件では、スタンス幅に対する頭の横移動を安定して計算できません。','横移動を確認したい場合は正面から、両足と頭を同時に映してください。','今回は体軸と肩・骨盤ラインの変化を優先して見返します。未計測の横移動を直そうとする必要はありません。','正面動画を追加したときに、頭と腰の動きをセットで確認します。',null);
    }
    if(s.knee){const k=s.knee;
      html+=card('膝：角度よりも変化のタイミングを確認','neutral',`リード膝は ${k.min.knee.toFixed(0)}°（${formatTime(k.min.t)}）〜${k.max.knee.toFixed(0)}°（${formatTime(k.max.t)}）です。${impact?.knee!=null?`打球付近は ${impact.knee.toFixed(0)}°です。`:''}`,
        '膝はスイング中に自然に曲がったり伸びたりします。最小・最大の数値だけを理由に、曲げる・伸ばすとは決めません。骨格線が正しく膝に重なることを先に確認します。',
        '切り返しから打球までを0.25倍速で見返し、上体の起き上がりと膝の変化が同時に急に起きていないか確認します。該当する場合は小さな素振りで、そのタイミングだけをゆっくり再現します。',
        '膝を一律の角度に固定せず、同じスイング局面で比較します。自然に回れている動きを数値だけで変えないでください。',impact?.t??k.max.t);
    }
    html+=`<div class="coach-next"><h4>次の1本でやること</h4><ol><li>区間の開始をアドレス、終了をフィニッシュ直後に設定します。</li><li>可能なら打球の瞬間を「インパクト」に指定します。</li><li>${focus}を映像で確認し、該当する練習を1つだけ行います。</li><li>同じカメラ位置で撮り直し、同じ局面の変化を比較します。</li></ol></div></section>`;
    return html;
  }).join('')}<p class="coach-limit">角度・移動幅の閾値は映像を見返す目安です。診断済みのゴルフ基準ではありません。最初の検出姿勢もアドレスの自動判定ではありません。</p><details class="coach-sources"><summary>練習の参考資料</summary><p><a href="https://www.pga.com/story/golf-tips-perfect-your-posture-with-this-simple-drill" target="_blank" rel="noopener">PGA：姿勢を鏡で確認する練習</a><br><a href="https://www.pga.com/story/a-little-leg-action-goes-a-long-way" target="_blank" rel="noopener">PGA：スイング中の膝の動き</a></p></details></div>`;
}
