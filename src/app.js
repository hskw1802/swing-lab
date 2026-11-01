import {setLoading,loadingMessage,toast,resultReady} from './ui.mjs?v=6';
import {primeVideo,analyzePlayback} from './video-analysis.mjs?v=6';
import {createRangeEditor} from './range-editor.mjs?v=6';
import {totalDuration,formatTime} from './ranges.mjs?v=6';
import {measures,good,segmentStats,coachingHTML} from './coaching.mjs?v=6';
import {renderOverlay} from './overlay.mjs?v=6';
import {validateReport} from './report.mjs?v=6';
import {setEvaluationPhase} from './evaluation-session.mjs?v=6';
const $=s=>document.querySelector(s),video=$('#video'),canvas=$('#overlay'),ctx=canvas.getContext('2d');
let report=null,url=null,engine=null,busy=false,stopped=false,imported=false,thickness=3,animationId=null,lastDraw=-Infinity;
let scoreSegment=null;
const poseCache=new Map(),layers={skeleton:true,axis:true,planes:true,angles:true,trail:true,ghost:false};
const initialFeedback=$('#feedback').innerHTML,metricCards=[...document.querySelectorAll('#metrics article')],metricNotes=metricCards.map(el=>el.querySelector('p').textContent);
const editor=createRangeEditor(video,{isBusy:()=>busy,onChange(){if(report)$('#mode').textContent='区間変更・再解析が必要';}});
function state(text){$('#status').textContent=text;loadingMessage(text);}
function download(blob,name){const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();toast('ファイルを保存しました');setTimeout(()=>URL.revokeObjectURL(u),30000);}
function metric(index,value,note=metricNotes[index]){const strong=metricCards[index].querySelector('strong');if(strong.firstChild.nodeValue!==value)strong.firstChild.nodeValue=value;const caption=metricCards[index].querySelector('p');if(caption.textContent!==note)caption.textContent=note;}
function clearMetrics(){metricCards.forEach((_,i)=>metric(i,'—'));ctx.clearRect(0,0,canvas.width,canvas.height);}
function nearest(t){
  if(!report?.frames.length)return null;
  const frames=report.frames;let low=0,high=frames.length-1;
  while(low<high){const middle=Math.floor((low+high)/2);if(frames[middle].t<t)low=middle+1;else high=middle;}
  return low>0&&Math.abs(frames[low-1].t-t)<Math.abs(frames[low].t-t)?frames[low-1]:frames[low];
}
function draw(){
  const t=+$('#seek').value,f=nearest(t);$('#time').textContent=t.toFixed(2)+' s';
  if(!report||!f||Math.abs(f.t-t)>.16){clearMetrics();return;}
  const stats=segmentStats(report),segment=report.version===2?stats[f.segment]:stats[0];
  if(!segment){clearMetrics();return;}
  renderOverlay(canvas,f,report,segment,layers,thickness);
  const m=measures(f.p,report.width,report.height,report.hand);
  metric(0,Math.abs(m.axis).toFixed(1));metric(1,m.shoulder.toFixed(1));metric(2,m.knee==null?'—':m.knee.toFixed(0));metric(3,segment.sway==null?'—':segment.sway.toFixed(0),'この区間のスタンス幅に対する移動');
}
function unlock(reveal=true){
  $('#seek').max=report.duration;$('#seek').disabled=false;$('#export').disabled=false;$('#shot').disabled=false;$('#mode').textContent=imported?'保存した解析':'解析済み';
  $('#feedback').innerHTML=coachingHTML(report);$('#feedback').classList.add('is-visible');draw();if(reveal)resultReady();
}
$('#feedback').onclick=event=>{
  const review=event.target.closest('[data-review-score]');
  if(review&&report){
    scoreSegment=Number(review.dataset.reviewScore);const segment=segmentStats(report)[scoreSegment];if(!segment)return;
    $('#scoreSetup').hidden=false;$('#scoreSetupError').textContent='';updateScoreSetup();
    const t=segment.segment.address??segment.segment.start;video.pause();$('#seek').value=t;if(!imported)video.currentTime=t;draw();
    $('#video-section').scrollIntoView({behavior:'instant',block:'start'});$('#seek').focus({preventScroll:true});return;
  }
  const button=event.target.closest('[data-jump]');if(!button||!report)return;
  const t=Number(button.dataset.jump);if(!Number.isFinite(t)||t<0||t>report.duration)return;
  video.pause();$('#seek').value=t;if(!imported)video.currentTime=t;draw();$('#video-section').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
};
function updateScoreSetup(){
  const s=segmentStats(report)[scoreSegment];if(!s)return;
  $('#scoreSetupTitle').textContent=`スイング${scoreSegment+1}の採点時刻`;
  $('#scoreSetupStatus').textContent=`対象 ${formatTime(s.segment.start)}〜${formatTime(s.segment.end)} · 構え ${s.segment.address==null?'未指定':formatTime(s.segment.address)} · 打球 ${s.segment.impact==null?'未指定':formatTime(s.segment.impact)} · ${s.evaluation.score===null?'採点待ち':s.evaluation.score+' / 100点'}`;
  $('#scoreSetupReason').textContent=s.evaluation.reason??'採点と改善ポイントを更新しました。「評価結果へ」で確認できます。';
}
for(const [id,phase]of [['scoreAddress','address'],['scoreImpact','impact']])$('#'+id).onclick=()=>{
  if(!report||scoreSegment===null)return;
  try{report=setEvaluationPhase(report,scoreSegment,phase,Number($('#seek').value));if(!imported){const {address,impact}=report.segments[scoreSegment];editor.setPhases(scoreSegment,{address,impact});}unlock(false);updateScoreSetup();$('#scoreSetupError').textContent='';toast('時刻を保存し、評価を更新しました');}
  catch(error){$('#scoreSetupError').textContent=error.message;}
};
$('#scoreBack').onclick=()=>resultReady();
$('#file').onchange=()=>{
  const file=$('#file').files[0];if(!file||busy)return;if(file.size>500*1024*1024){state('500MB以下の動画を選んでください。');return;}
  setLoading(true,'動画を読み込んでいます…');$('#stage').classList.remove('has-video');editor.hide();poseCache.clear();scoreSegment=null;$('#scoreSetup').hidden=true;
  video.pause();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);report=null;$('#feedback').innerHTML=initialFeedback;imported=false;video.hidden=false;video.muted=true;video.playsInline=true;video.src=url;video.load();$('#empty').hidden=true;
  for(const id of ['export','shot','analyze','play','seek'])$('#'+id).disabled=true;
  clearMetrics();state('動画を読み込んでいます…');
};
video.onloadedmetadata=()=>{
  setLoading(false);$('#stage').classList.add('has-video');$('#stage').style.setProperty('--video-ratio',video.videoWidth+'/'+video.videoHeight);
  if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>180){state('3分以内の動画を選んでください。');return;}
  for(const id of ['analyze','play','seek'])$('#'+id).disabled=false;
  $('#seek').max=video.duration;$('#seek').value=0;editor.reset(video.duration);$('#mode').textContent='解析準備OK';state(`${video.duration.toFixed(1)}秒の動画。必要な区間を選び、解析してください。`);
};
video.onerror=()=>{setLoading(false);state('この端末で動画を再生できません。MP4（H.264）で保存した動画をお試しください。');$('#analyze').disabled=true;};
$('#play').onclick=async()=>{if(video.paused){try{await video.play();}catch{state('動画を再生できませんでした。');}}else video.pause();};
function playbackDraw(now){if(video.paused)return;if(!busy&&now-lastDraw>80){lastDraw=now;$('#seek').value=video.currentTime;draw();}animationId=requestAnimationFrame(playbackDraw);}
video.onplay=()=>{$('#play').textContent='Ⅱ 一時停止';cancelAnimationFrame(animationId);animationId=requestAnimationFrame(playbackDraw);};
video.onpause=()=>{$('#play').textContent='▶ 再生';cancelAnimationFrame(animationId);};
video.ontimeupdate=()=>{if(!busy){$('#seek').value=video.currentTime;draw();}};
video.onseeked=()=>{if(!busy){$('#seek').value=video.currentTime;draw();}};
$('#speed').onchange=()=>video.playbackRate=+$('#speed').value;
$('#seek').oninput=()=>{if(!imported)video.currentTime=+$('#seek').value;draw();};
document.querySelectorAll('[data-layer]').forEach(el=>el.onchange=()=>{layers[el.dataset.layer]=el.checked;draw();});
$('#lineWidth').oninput=()=>{thickness=+$('#lineWidth').value;$('#lineWidthValue').textContent=thickness.toFixed(1)+' px';draw();};
$('#cancel').onclick=()=>stopped=true;
$('#analyze').onclick=async()=>{
  if(busy)return;
  let selection;try{selection=editor.getRanges();}catch(error){state(error.message);return;}
  const cacheKey=r=>JSON.stringify([r.start,r.end]),needsInference=selection.some(r=>!poseCache.has(cacheKey(r)));
  busy=true;stopped=false;report=null;scoreSegment=null;$('#scoreSetup').hidden=true;
  for(const id of ['analyze','file','import','seek','play','view','hand','speed','export','shot'])$('#'+id).disabled=true;
  $('#cancel').hidden=false;$('#progress').hidden=false;$('#progress').value=0;setLoading(true,'解析を準備しています…');$('#mode').textContent='解析準備中';$('#feedback').innerHTML=initialFeedback;clearMetrics();
  try{
    if(needsInference){
      state('動画の再生を準備しています…');await primeVideo(video,{cancelled:()=>stopped});if(stopped)throw new Error('解析を中止しました。');
      state('姿勢推定モデルを準備しています…（初回は通信が必要です）');
      if(!engine){const {PoseLandmarker,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');engine=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'},runningMode:'IMAGE',numPoses:1});}
    }
    if(stopped)throw new Error('解析を中止しました。');
    const input=document.createElement('canvas'),scale=Math.min(1,960/Math.max(video.videoWidth,video.videoHeight));input.width=Math.max(1,Math.round(video.videoWidth*scale));input.height=Math.max(1,Math.round(video.videoHeight*scale));const pixels=input.getContext('2d');
    const total=totalDuration(selection),frames=[],segments=[];let completed=0,samples=0;
    for(let index=0;index<selection.length;index++){
      if(stopped)throw new Error('解析を中止しました。');
      const range=selection[index],key=cacheKey(range);let data=poseCache.get(key);
      if(!data){
        const segmentFrames=[];let segmentSamples=0,lastProgressUI=-Infinity;
        await analyzePlayback(video,{start:range.start,end:range.end,cancelled:()=>stopped,
          onFrame(t){pixels.drawImage(video,0,0,input.width,input.height);const result=engine.detect(input),p=result.landmarks?.[0];segmentSamples++;if(p&&good(p,[11,12,23,24]))segmentFrames.push({t,p:p.map(({x,y,visibility})=>({x,y,visibility}))});},
          onProgress(fraction){const now=performance.now();if(now-lastProgressUI<200&&fraction<1)return;lastProgressUI=now;const overall=(completed+fraction*(range.end-range.start))/total;$('#progress').value=overall;$('#mode').textContent=`解析中 ${Math.round(overall*100)}%`;state(`区間 ${index+1}/${selection.length} · ${Math.round(overall*100)}% · 元動画 ${formatTime(video.currentTime)} · この画面を開いたままお待ちください。`);}
        });
        data={frames:segmentFrames,samples:segmentSamples};poseCache.set(key,data);
        // Bound session memory. Evicting a cached interval only causes fresh inference next time.
        while([...poseCache.values()].reduce((n,entry)=>n+entry.frames.length,0)>5000&&poseCache.size>1)poseCache.delete(poseCache.keys().next().value);
      }
      for(const f of data.frames)if(!frames.length||f.t>frames.at(-1).t)frames.push({...f,segment:index});
      segments.push({...range,samples:data.samples});samples+=data.samples;completed+=range.end-range.start;$('#progress').value=completed/total;
    }
    if(frames.length<5)throw new Error('全身の姿勢を十分に検出できませんでした。区間内に全身が映るかを確認してください。');
    report={format:'swing-lab',version:2,created:new Date().toISOString(),view:$('#view').value,hand:$('#hand').value,width:video.videoWidth,height:video.videoHeight,duration:video.duration,samples,segments,frames};
    video.currentTime=frames[0].t;$('#seek').value=frames[0].t;unlock();state(`解析完了 · 対象 ${total.toFixed(1)}秒 / 元動画 ${video.duration.toFixed(1)}秒${needsInference?'':' · 保存済みの同一区間の姿勢を再利用'}`);
  }catch(error){
    const message=error.message||'解析に失敗しました。動画と通信状態を確認してください。';$('#mode').textContent='解析を再試行';state(message);
    const heading=document.createElement('h3'),detail=document.createElement('p'),next=document.createElement('p'),box=document.createElement('div');
    heading.textContent=stopped?'解析を中止しました':'点数・フォーム評価を作成できませんでした';detail.textContent=message;
    next.textContent=stopped?'動画は選択済みです。「解析する」で再開できます。':'全身・両足・手が区間内に映ることを確認し、1スイングを選んで再解析してください。モデルの読込に失敗した場合は通信を確認してください。';
    box.append(heading,detail,next);$('#feedback').replaceChildren(box);$('#feedback').classList.add('is-visible');resultReady();
  }
  finally{video.pause();busy=false;for(const id of ['analyze','file','import','seek','play','view','hand','speed'])$('#'+id).disabled=false;$('#cancel').hidden=true;$('#progress').hidden=true;setLoading(false);}
};
$('#export').onclick=()=>{if(report)download(new Blob([JSON.stringify(report)],{type:'application/json'}),'swing-lab-'+report.created.slice(0,10)+'.json');};
$('#import').onchange=async()=>{
  const file=$('#import').files[0];if(!file||busy)return;
  try{if(file.size>20*1024*1024)throw new Error('解析ファイルが大きすぎます。');const parsed=validateReport(JSON.parse(await file.text()));video.pause();video.removeAttribute('src');video.load();video.hidden=true;editor.hide();scoreSegment=null;$('#scoreSetup').hidden=true;$('#stage').classList.add('has-video');$('#stage').style.setProperty('--video-ratio',parsed.width+'/'+parsed.height);report=parsed;$('#view').value=parsed.view;$('#hand').value=parsed.hand;imported=true;$('#empty').hidden=true;$('#seek').max=parsed.duration;$('#seek').value=parsed.frames[0].t;$('#play').disabled=true;$('#analyze').disabled=true;unlock();state('保存した解析を表示中です。元動画は含まれません。');}
  catch(error){state(error.message||'有効なSwing Lab解析ファイルを選んでください。');}
};
$('#shot').onclick=()=>{if(!report)return;const output=document.createElement('canvas');output.width=report.width;output.height=report.height;const pixels=output.getContext('2d');pixels.fillStyle='#13202a';pixels.fillRect(0,0,output.width,output.height);if(!imported)pixels.drawImage(video,0,0,output.width,output.height);pixels.drawImage(canvas,0,0);output.toBlob(blob=>{if(blob)download(blob,'swing-lab-frame.png');});};
new ResizeObserver(()=>{if(report&&!busy)draw();}).observe($('#stage'));
requestAnimationFrame(()=>setLoading(false));
