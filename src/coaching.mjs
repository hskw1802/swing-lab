import {formatTime} from './ranges.mjs?v=5';
import {evaluateSwing,RUBRIC} from './scoring.mjs?v=5';
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
    return {index,segment,frames,rows,evaluation:evaluateSwing(report,segment,frames),count:frames.length,coverage:segment.samples?frames.length/segment.samples:null,axis:extent('axis',rows),axisRange:axes.length?Math.max(...axes)-Math.min(...axes):0,knee:extent('knee',knees),sway,impact:impact&&Math.abs(impact.t-segment.impact)<=.2?impact:null};
  });cache.set(report,result);return result;
}
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jump=(time,label='映像を確認')=>`<button class="secondary memo-jump" data-jump="${Number(time).toFixed(3)}">${esc(label)} ${formatTime(time)}</button>`;
const card=(title,tone,observed,meaning,practice,recheck,time)=>`<article class="coach-card ${tone}"><h4>${title}</h4><dl><dt>観測</dt><dd>${observed}</dd><dt>見るポイント</dt><dd>${meaning}</dd><dt>修正・確認練習</dt><dd>${practice}</dd><dt>次の撮影で確認</dt><dd>${recheck}</dd></dl>${time==null?'':jump(time)}</article>`;
function scoreHTML(s){
  const e=s.evaluation;
  if(e.score===null)return `<div class="swing-score pending"><span class="score-value">—<small> / 100</small></span><div><h4>角度コントロール · 採点待ち</h4><p>${esc(e.reason)}</p></div></div>`;
  const max=Math.max(10,...e.rows.map(r=>Math.abs(r.axis-e.baseline)))*1.15;
  const x=t=>20+260*Math.max(0,Math.min(1,(t-s.segment.address)/e.duration)),y=a=>60-40*(a-e.baseline)/max;
  return `<div class="swing-score"><span class="score-value">${e.score}<small> / 100</small></span><div><h4>角度コントロール参考点</h4><p>スイング ${s.index+1} · 構え〜打球のみ · 計測できた時間 ${Math.round(e.coverage*100)}%</p><p>打球の結果・スイング全体の技量・構えの適否を示す点数ではありません。</p></div></div>
  <div class="angle-facts"><div><b>${e.baseline.toFixed(1)}° → ${e.impact.toFixed(1)}°</b><span>構え → 打球の画面内体軸角</span></div><div><b>${(e.ratio*100).toFixed(0)}% · ${e.held.toFixed(2)}秒</b><span>構えの角度 ±${RUBRIC.tolerance}° 内 / 有効 ${e.valid.toFixed(2)}秒</span></div><div><b>${e.longest.toFixed(2)}秒</b><span>連続して維持した最長時間</span></div><div><b>${e.delta.toFixed(1)}°</b><span>構えと打球の差</span></div></div>
  <figure class="angle-chart"><svg viewBox="0 0 300 125" role="img" aria-label="構えから打球までの体軸角の変化。中央線が構えの角度、帯がプラスマイナス5度。検出の空白は線をつなぎません。"><rect x="20" y="${y(e.baseline+5)}" width="260" height="${400/max}" fill="#dcefe9"/><path d="M20 60H280" stroke="#819b94" stroke-dasharray="4 4"/>${e.rows.slice(1).map((r,i)=>r.t-e.rows[i].t<=RUBRIC.maxGap?`<path d="M${x(e.rows[i].t)} ${y(e.rows[i].axis)}L${x(r.t)} ${y(r.axis)}" fill="none" stroke="#238274" stroke-width="2.5"/>`:'').join('')}<text x="20" y="119">構え ${formatTime(s.segment.address)}</text><text x="180" y="119">打球 ${formatTime(s.segment.impact)}</text></svg><figcaption>体軸角の変化 · 緑の帯は構え ±5°（アプリの確認幅）</figcaption></figure>
  ${card(e.ratio>=.8&&e.delta<=5?'良い点：打球まで角度の変化が小さい':'改善ポイント：打球前の姿勢の変化を減らす',e.ratio>=.8&&e.delta<=5?'good':'warn',`維持率 ${(e.ratio*100).toFixed(0)}%、打球での差 ${e.delta.toFixed(1)}°、時間の95%を含む変化幅 ${e.p95.toFixed(1)}°。大きく変わった計測位置は ${formatTime(e.worstTime)} です。`,'まず映像で線が肩と腰に重なっているか確認します。後方の体軸線は前傾の代用指標で、回転や側屈による見え方の変化も含みます。点数だけでアーリーエクステンションとは診断しません。',e.ratio>=.8&&e.delta<=5?'今の構えで小さな素振りを5回行い、胸と骨盤を回しながら同じ動きを再現します。角度を固定するために体を固める必要はありません。':'体軸と最初の姿勢を重ねて打球前を0.25倍速で確認します。胸が急に起きる動きも見えたら、鏡の前で股関節から構え、小さなハーフスイングをゆっくり5回。腰をボールへ押し出さず回転する感覚を確認します。','同じクラブ・カメラ位置・局面指定で再撮影します。維持率と打球の差が改善し、実際の映像でも姿勢が安定するか確認します。フィニッシュの伸び上がりは減点しません。',e.worstTime)}
  <details class="score-rubric"><summary>採点の内訳・計算方法</summary><p>維持時間 ${e.components.hold}/50点 · 打球の差 ${e.components.impact}/30点 · 95%変化幅 ${e.components.excursion}/20点</p><p>維持点 = ±5°以内の秒数 ÷ 有効秒数 ×50。残る2項目は差5°以下で満点、20°以上で0点、その間を直線配点します。0.18秒を超える検出間隔は除外し、有効時間80%未満は採点しません。判定は隣接する両フレームが幅内の時間を使用します。</p><p>±5°・20°・配点はアプリ独自の暫定基準です。研究で検証された合格点や、理想の前傾角ではありません。高得点でも構えが適切とは限りません。基準 ${RUBRIC.version}</p></details>`;
}
const researchHTML=`<details class="coach-sources"><summary>良い姿勢の考え方・参考角度</summary><p>TPIは、構えから姿勢が大きく変わることを確認項目に挙げ、姿勢を支えながら回転することを重視しています。打球前に腰がボール側へ出て上体が起きる動きも確認します。膝・肩の角度やフィニッシュまで同じ角度に固定することは、このアプリの目標にしません。</p><p>男性プロ11名の研究では、基準のボール位置で構えの体幹前傾は平均41.5±2.9°でした。これは実験集団の測定値で、全員の理想値ではありません。ボールとの距離を変えると姿勢角も変わりました。本アプリの肩・腰の中点を結ぶ2D角度とは測定方法が異なるため、41.5°に近いほど加点する採点はしません。</p><p>構えは股関節から上体を傾け、無理なく回転できる状態を鏡・後方動画で確認します。クラブ・体格・カメラ位置で見え方が変わるため、適切な絶対角の確定には指導者と同じ条件での確認が必要です。</p><p><a href="https://www.mytpi.com/improve-my-game/swing-characteristics/loss-of-posture" target="_blank" rel="noopener">TPI：Loss of Posture</a> · <a href="https://www.mytpi.com/improve-my-game/swing-characteristics/early-extension" target="_blank" rel="noopener">TPI：Early Extension</a> · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6243633/" target="_blank" rel="noopener">Kimほか（2018）：ボール位置と構えの角度</a></p></details>`;
export function coachingHTML(report){
  const stats=segmentStats(report);
  return `<div class="coach-report"><h3>スイング評価 <span class="tag">角度からの参考評価</span></h3><p>後方動画の構え〜打球で、角度の維持を評価します。各区間に1スイングと、構え・打球の時刻を指定してください。</p>${researchHTML}${stats.map(s=>{
    const {segment}=s,low=s.count<5||(s.coverage!==null&&s.coverage<.7),coverage=s.coverage===null?'検出率は未記録':`検出率 ${Math.round(s.coverage*100)}%`;
    let html=`<section class="coach-segment"><div class="coach-segment-heading"><h3>区間 ${s.index+1} · ${formatTime(segment.start)}–${formatTime(segment.end)}</h3>${jump(segment.start,'区間の開始へ')}</div><p>${s.count}フレーム検出 · ${coverage} · ${report.view==='front'?'正面':'後方'} · ${report.hand==='right'?'右':'左'}打ち</p>`;
    html+=scoreHTML(s);
    if(low){
      html+=card('最優先：映像の検出状態を整える','warn',`この区間は${s.count}フレーム検出できました。${coverage}で、姿勢の変化を評価するには情報が不足しています。`,'線が体から外れている場面では、角度の大きさをフォームの課題として扱わないでください。','全身と両足が映る位置でカメラを固定します。体が隠れない明るさで1スイングだけ撮影し、区間の開始をアドレス付近に合わせます。','骨格が肩・腰・膝に重なり、トップと打球付近でも線が飛ばないことを確認してから、下の項目を見直します。',segment.start);
      return html+'</section>';
    }
    const focus=s.evaluation.score===null?'構え・打球の指定と撮影条件':'構えから打球までの姿勢の再現性';
    html+=`<div class="coach-priority"><b>今回、最初に確認すること</b><p>${focus}を確認します。一度に全項目を直さず、下の映像確認で実際に気になる動きが見えた1項目だけを練習します。</p></div>`;
    const baseline=s.rows[0],impact=s.impact,axis=s.axis;
    const axisObserved=`フィニッシュを含む区間全体の画面内体軸角は ${axis.min.axis.toFixed(1)}°（${formatTime(axis.min.t)}）〜${axis.max.axis.toFixed(1)}°（${formatTime(axis.max.t)}）、変動幅 ${s.axisRange.toFixed(1)}°です。${impact?`指定した打球時刻に近い ${formatTime(impact.t)} は ${impact.axis.toFixed(1)}°、区間最初から ${Math.abs(impact.axis-baseline.axis).toFixed(1)}°変化しています。`:'打球時刻は未指定のため、アドレスからインパクトまでの変化とは断定できません。'}`;
    const axisTime=impact?.t??(Math.abs(axis.max.axis-baseline.axis)>=Math.abs(axis.min.axis-baseline.axis)?axis.max.t:axis.min.t);
    html+=card('区間全体の体軸角（採点対象外）','neutral',axisObserved,
      report.view==='side'?'体軸と「構え・最初の姿勢を重ねる」を表示し、打球前に胸や腰が急に起き上がるかを0.25倍速で確認します。回転やフィニッシュに伴う自然な変化を、悪い動きとして数えないでください。':'体軸・肩・骨盤ラインを一緒に表示し、回転の途中で上体だけが急に傾くかを確認します。正面の映像では前傾角そのものは測れません。',
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
    html+=`<div class="coach-next"><h4>次の1本でやること</h4><ol><li>区間の開始をアドレス、終了をフィニッシュ直後に設定します。</li><li>構えと打球の瞬間を、それぞれ「アドレス」「インパクト」に指定します。</li><li>${focus}を映像で確認し、該当する練習を1つだけ行います。</li><li>同じカメラ位置で撮り直し、同じ局面の変化を比較します。</li></ol></div></section>`;
    return html;
  }).join('')}<p class="coach-limit">角度・移動幅の閾値は映像を見返す目安です。診断済みのゴルフ基準ではありません。最初の検出姿勢もアドレスの自動判定ではありません。</p><details class="coach-sources"><summary>練習の参考資料</summary><p><a href="https://www.pga.com/story/golf-tips-perfect-your-posture-with-this-simple-drill" target="_blank" rel="noopener">PGA：姿勢を鏡で確認する練習</a><br><a href="https://www.pga.com/story/a-little-leg-action-goes-a-long-way" target="_blank" rel="noopener">PGA：スイング中の膝の動き</a></p></details></div>`;
}
