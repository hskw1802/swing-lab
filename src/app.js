import {setLoading,loadingMessage,toast,resultReady} from './ui.mjs?v=3';
import {primeVideo,analyzePlayback} from './video-analysis.mjs?v=3';
const $=s=>document.querySelector(s),video=$('#video'),canvas=$('#overlay'),ctx=canvas.getContext('2d');
let report=null,url=null,engine=null,busy=false,stopped=false,imported=false;
const layers={skeleton:true,axis:true,planes:true,angles:true,trail:true,ghost:false};
const initialMetrics=$('#metrics').innerHTML,initialFeedback=$('#feedback').innerHTML;
const connections=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32]];
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const good=(p,ids)=>ids.every(i=>p[i]&&(p[i].visibility??1)>.55);
function angle(a,b,c,w,h){let u=[(a.x-b.x)*w,(a.y-b.y)*h],v=[(c.x-b.x)*w,(c.y-b.y)*h];return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)||1))))*180/Math.PI}
function measures(p,w,h,hand){const shoulders=mid(p[11],p[12]),hips=mid(p[23],p[24]),k=hand==='right'?25:26;return {axis:Math.atan2((shoulders.x-hips.x)*w,(hips.y-shoulders.y)*h)*180/Math.PI,shoulder:Math.atan2(Math.abs(p[11].y-p[12].y)*h,Math.abs(p[11].x-p[12].x)*w)*180/Math.PI,knee:good(p,[k-2,k,k+2])?angle(p[k-2],p[k],p[k+2],w,h):null}}
function download(blob,name){const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();toast('ファイルを保存しました');setTimeout(()=>URL.revokeObjectURL(u),30000)}
function state(text){$('#status').textContent=text;loadingMessage(text)}
function nearest(t){if(!report?.frames.length)return null;return report.frames.reduce((a,b)=>Math.abs(a.t-t)<Math.abs(b.t-t)?a:b)}
function draw(){const r=report,f=nearest(+$('#seek').value);if(!r||!f){ctx.clearRect(0,0,canvas.width,canvas.height);$('#metrics').innerHTML=initialMetrics;return}if(!imported&&Math.abs(f.t-(+$('#seek').value))>.16){ctx.clearRect(0,0,canvas.width,canvas.height);$('#metrics').innerHTML=initialMetrics;return}const w=r.width,h=r.height;canvas.width=w;canvas.height=h;const p=f.p;ctx.lineCap='round';
function line(a,b,color,dash=false){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,w/350);ctx.setLineDash(dash?[8,7]:[]);ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);ctx.stroke();ctx.setLineDash([])}
function skeleton(q,col){connections.forEach(([a,b])=>{if(good(q,[a,b]))line(q[a],q[b],col)});q.forEach((a,i)=>{if(i>=11&&(a.visibility??1)>.55){ctx.beginPath();ctx.fillStyle=col;ctx.arc(a.x*w,a.y*h,Math.max(3,w/220),0,7);ctx.fill()}})}
if(layers.ghost)skeleton(r.frames[0].p,'#ffffff55');if(layers.skeleton)skeleton(p,'#b4f589');
const s=mid(p[11],p[12]),hip=mid(p[23],p[24]);if(layers.axis){line(s,hip,'#ffe08a');const origin=mid(r.frames[0].p[23],r.frames[0].p[24]);line({x:origin.x,y:0},{x:origin.x,y:1},'#ffe08a88',true)}if(layers.planes){line(p[11],p[12],'#88e5ef');line(p[23],p[24],'#edacda')}
if(layers.trail){const history=r.frames.filter(x=>x.t<=f.t);for(let i=1;i<history.length;i++){let a=history[i-1],b=history[i];if(b.t-a.t>.25)continue;if(good(a.p,[0])&&good(b.p,[0]))line(a.p[0],b.p[0],'#ffffff66');if(good(a.p,[15,16])&&good(b.p,[15,16]))line(mid(a.p[15],a.p[16]),mid(b.p[15],b.p[16]),'#ffd28788')}}
if(layers.angles){ctx.font=`600 ${Math.max(13,w/48)}px sans-serif`;for(const [a,b,c]of [[23,25,27],[24,26,28],[11,13,15],[12,14,16]]){if(!good(p,[a,b,c]))continue;const text=Math.round(angle(p[a],p[b],p[c],w,h))+'°',x=p[b].x*w+8,y=p[b].y*h;ctx.fillStyle='#142f28dd';ctx.fillRect(x-3,y-20,ctx.measureText(text).width+8,26);ctx.fillStyle='#fff';ctx.fillText(text,x,y)}}
const m=measures(p,w,h,r.hand),sway=getSway(r);$('#metrics').innerHTML=[['体軸の傾き',Math.abs(m.axis).toFixed(1),'°','画面の垂直線に対する傾き'],['肩ラインの傾き',m.shoulder.toFixed(1),'°','画面の水平線に対する傾き'],['リード膝の角度',m.knee==null?'—':m.knee.toFixed(0),'°','股関節・膝・足首のなす角'],['頭の横移動幅',sway==null?'—':sway.toFixed(0),'%','最初のスタンス幅に対する移動幅']].map(([label,n,u,note])=>`<article><small>${label}</small><strong>${n}<sup>${u}</sup></strong><p>${note}</p></article>`).join('');$('#time').textContent=(+$('#seek').value).toFixed(2)+' s';}
function getSway(r){const heads=r.frames.filter(f=>good(f.p,[0]));const first=r.frames.find(f=>good(f.p,[27,28]));if(heads.length<5||!first)return null;const span=Math.abs(first.p[27].x-first.p[28].x);if(span<.08)return null;const xs=heads.map(f=>f.p[0].x);return (Math.max(...xs)-Math.min(...xs))/span*100}
function feedback(){const r=report,coverage=r.frames.length/r.samples,axes=r.frames.map(f=>measures(f.p,r.width,r.height,r.hand).axis),range=Math.max(...axes)-Math.min(...axes),sway=getSway(r);const findings=[];if(coverage<.7)findings.push(['要確認','検出できない場面が多くあります。明るい場所で全身を映して撮り直すと、比較しやすくなります。',true]);if(range<12)findings.push(['良い点の候補',`検出した範囲では、体軸の傾きの変動が${range.toFixed(1)}°でした。画面内で体軸の向きを比較的一定に保てています。`,false]);else findings.push(['見直す候補',`体軸の傾きが動画全体で${range.toFixed(1)}°変化しています。トップやフィニッシュでは自然に変化するため、インパクト前後をスロー再生し、意図しない起き上がりがないか確認しましょう。`,true]);if(r.view==='front'&&sway!=null)findings.push(sway<25?['良い点の候補',`頭の横移動幅はスタンス幅の約${sway.toFixed(0)}%。頭の位置の変化が比較的小さく見えます。`,false]:['見直す候補',`頭の横移動幅はスタンス幅の約${sway.toFixed(0)}%。手の軌跡と合わせ、体全体が横へ流れていないか確認しましょう。`,true]);if(r.view==='side')findings.push(['後方動画の見方','体軸と最初の検出姿勢を重ね、アドレスからインパクト付近まで前傾の変化を確認してください。正面の横移動とは評価を分けます。',false]);$('#feedback').innerHTML=`<div style="width:100%"><h3>解析メモ <span class="tag">参考評価</span></h3><p>${r.frames.length}フレーム検出 / ${r.samples}フレーム解析 · 検出率 ${Math.round(coverage*100)}% · ${r.view==='front'?'正面':'後方'} · ${r.hand==='right'?'右':'左'}打ち</p>${findings.map(([a,b,w])=>`<div class="finding ${w?'warn':''}"><h3>${a}</h3><p>${b}</p></div>`).join('')}<p>最初の検出姿勢は自動判定したアドレスではありません。閾値はコーチによる診断基準ではなく、動きを見返すための目安です。</p></div>`}
function unlock(){const max=report.duration;$('#seek').max=max;$('#seek').disabled=false;$('#export').disabled=false;$('#shot').disabled=false;$('#mode').textContent=imported?'保存した解析':'解析済み';feedback();draw();resultReady()}
$('#file').onchange=()=>{const file=$('#file').files[0];if(!file||busy)return;if(file.size>500*1024*1024){state('500MB以下の動画を選んでください。');return}setLoading(true,'動画を読み込んでいます…');$('#stage').classList.remove('has-video');if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);report=null;$('#feedback').innerHTML=initialFeedback;imported=false;video.hidden=false;video.muted=true;video.playsInline=true;video.src=url;video.load();$('#empty').hidden=true;$('#export').disabled=true;$('#shot').disabled=true;$('#analyze').disabled=true;$('#play').disabled=true;draw();state('動画を読み込んでいます…');};
video.onloadedmetadata=()=>{setLoading(false);$('#stage').classList.add('has-video');$('#stage').style.setProperty('--video-ratio',video.videoWidth+'/'+video.videoHeight);if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>180){state('3分以内の動画を選んでください。');return}$('#analyze').disabled=false;$('#play').disabled=false;$('#seek').disabled=false;$('#seek').max=video.duration;$('#seek').value=0;$('#mode').textContent='解析準備OK';state(`${video.duration.toFixed(1)}秒の動画。撮影方向を選び、解析してください。`)};
video.onerror=()=>{setLoading(false);state('この端末で動画を再生できません。MP4（H.264）で書き出してお試しください。');$('#analyze').disabled=true};
$('#play').onclick=async()=>{if(video.paused){try{await video.play()}catch{state('動画を再生できませんでした。')}}else video.pause()};video.onplay=()=>$('#play').textContent='Ⅱ 一時停止';video.onpause=()=>$('#play').textContent='▶ 再生';video.ontimeupdate=()=>{if(!busy){$('#seek').value=video.currentTime;$('#time').textContent=video.currentTime.toFixed(2)+' s';draw()}};$('#speed').onchange=()=>video.playbackRate=+$('#speed').value;$('#seek').oninput=()=>{if(!imported)video.currentTime=+$('#seek').value;draw()};document.querySelectorAll('[data-layer]').forEach(el=>el.onchange=()=>{layers[el.dataset.layer]=el.checked;draw()});
$('#cancel').onclick=()=>stopped=true;
$('#analyze').onclick=async()=>{
  if(busy)return;
  busy=true;stopped=false;report=null;
  for(const id of ['analyze','file','import','seek','play','view','hand','speed','export','shot'])$('#'+id).disabled=true;
  $('#cancel').hidden=false;$('#progress').hidden=false;$('#progress').value=0;
  setLoading(true,'動画の再生を準備しています…');$('#mode').textContent='再生準備中';$('#feedback').innerHTML=initialFeedback;draw();
  $('#stage').scrollIntoView({block:'center'});
  try{
    state('動画の再生を準備しています…');
    await primeVideo(video,{cancelled:()=>stopped});
    if(stopped)throw new Error('解析を中止しました。');
    state('姿勢推定モデルを準備しています…（初回は通信が必要です）');
    if(!engine){
      const{PoseLandmarker,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
      engine=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'},runningMode:'IMAGE',numPoses:1});
    }
    if(stopped)throw new Error('解析を中止しました。');
    // Reduce inference input only; overlays retain the original video's aspect ratio.
    const input=document.createElement('canvas'),scale=Math.min(1,960/Math.max(video.videoWidth,video.videoHeight));
    input.width=Math.max(1,Math.round(video.videoWidth*scale));input.height=Math.max(1,Math.round(video.videoHeight*scale));
    const pixels=input.getContext('2d');let samples=0;const frames=[];
    $('#mode').textContent='順次解析中';
    state('動画を順に再生して解析します。画面を開いたままお待ちください。');
    await analyzePlayback(video,{
      cancelled:()=>stopped,
      onFrame(t){
        pixels.drawImage(video,0,0,input.width,input.height);
        const result=engine.detect(input),p=result.landmarks?.[0];samples++;
        if(p&&good(p,[11,12,23,24]))frames.push({t,p:p.map(({x,y,visibility})=>({x,y,visibility}))});
      },
      onProgress(fraction){
        $('#progress').value=fraction;$('#seek').value=video.currentTime;$('#time').textContent=video.currentTime.toFixed(2)+' s';$('#mode').textContent=`解析中 ${Math.round(fraction*100)}%`;
        state(`解析中 ${Math.round(fraction*100)}% · ${video.currentTime.toFixed(1)} / ${video.duration.toFixed(1)}秒 · この画面を表示したままお待ちください。`);
      }
    });
    if(frames.length<5)throw new Error('全身の姿勢を十分に検出できませんでした。全身が明るく映る動画をお試しください。');
    report={format:'swing-lab',version:1,created:new Date().toISOString(),view:$('#view').value,hand:$('#hand').value,width:video.videoWidth,height:video.videoHeight,duration:video.duration,samples,frames};
    video.currentTime=frames[0].t;$('#seek').value=frames[0].t;unlock();
    state('解析完了。スロー再生や表示レイヤーでフォームを確認しましょう。');
  }catch(e){$('#mode').textContent='解析を再試行';state(e.message||'解析に失敗しました。通信状態と動画形式を確認してください。');}
  finally{
    video.pause();busy=false;
    for(const id of ['analyze','file','import','seek','play','view','hand','speed'])$('#'+id).disabled=false;
    $('#cancel').hidden=true;$('#progress').hidden=true;setLoading(false);
  }
};
$('#export').onclick=()=>{if(report)download(new Blob([JSON.stringify(report)],{type:'application/json'}),'swing-lab-'+report.created.slice(0,10)+'.json')};
$('#import').onchange=async()=>{const f=$('#import').files[0];if(!f||busy)return;try{if(f.size>15*1024*1024)throw Error();const r=JSON.parse(await f.text());if(r.format!=='swing-lab'||r.version!==1||!['front','side'].includes(r.view)||!['left','right'].includes(r.hand)||!Number.isFinite(r.width)||!Number.isFinite(r.height)||r.width<1||r.height<1||r.width>8000||r.height>8000||!Number.isFinite(r.duration)||r.duration<=0||r.duration>180||!Number.isInteger(r.samples)||r.samples<1||r.samples>2161||!Array.isArray(r.frames)||r.frames.length<5||r.frames.length>r.samples||!r.frames.every((f,i)=>Number.isFinite(f.t)&&f.t>=0&&f.t<=r.duration&&(!i||f.t>r.frames[i-1].t)&&Array.isArray(f.p)&&f.p.length===33&&f.p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<10&&Math.abs(p.y)<10&&Number.isFinite(p.visibility)&&p.visibility>=0&&p.visibility<=1)))throw Error();video.pause();video.removeAttribute('src');video.load();video.hidden=true;$('#stage').classList.add('has-video');$('#stage').style.setProperty('--video-ratio',r.width+'/'+r.height);report=r;imported=true;$('#empty').hidden=true;$('#seek').value=r.frames[0].t;$('#play').disabled=true;$('#analyze').disabled=true;unlock();state('保存した解析を表示中です。スライダーで姿勢を確認できます。動画を選ぶと新しい解析を始めます。')}catch{state('有効なSWING LAB解析ファイルを選んでください。')}};
$('#shot').onclick=()=>{if(!report)return;const c=document.createElement('canvas');c.width=report.width;c.height=report.height;const x=c.getContext('2d');x.fillStyle='#142f28';x.fillRect(0,0,c.width,c.height);if(!imported)x.drawImage(video,0,0,c.width,c.height);x.drawImage(canvas,0,0);c.toBlob(b=>{if(b)download(b,'swing-lab-frame.png')})};




requestAnimationFrame(()=>setLoading(false));
