import {normalizeRanges,totalDuration,formatTime} from './ranges.mjs?v=5';
export function createRangeEditor(video,{onChange=()=>{},isBusy=()=>false}={}){
  const $=id=>document.getElementById(id),root=$('rangeEditor');
  let duration=0,registered=[],impact=null,address=null,editing=-1;
  function draft(){return {start:Number($('rangeStart').value),end:Number($('rangeEnd').value),impact,address};}
  function getRanges(){const active=registered.length?registered.map((r,i)=>i===editing?draft():r):[draft()];return normalizeRanges(active,duration);}
  function status(){
    try{const ranges=getRanges(),kept=totalDuration(ranges);$('rangeSummary').textContent=`${registered.length?'登録済み'+ranges.length+'区間':'編集中の1区間'}を解析 · ${kept.toFixed(1)}秒 / 元動画 ${duration.toFixed(1)}秒 · 除外 ${(duration-kept).toFixed(1)}秒${editing>=0?' · 区間'+(editing+1)+'の変更を反映中':''}`;$('rangeError').textContent='';}
    catch(error){$('rangeSummary').textContent='開始・終了を確認してください。';$('rangeError').textContent=error.message;}
    $('addressTime').textContent=address===null?'未指定':formatTime(address);
    $('impactTime').textContent=impact===null?'未指定':formatTime(impact);
  }
  function changed(){status();onChange();}
  function render(){
    $('rangeList').replaceChildren();
    registered.forEach((r,index)=>{
      const row=document.createElement('div');row.className='range-row';
      const label=document.createElement('span');label.textContent=`${index+1}. ${formatTime(r.start)} → ${formatTime(r.end)}${r.address==null?'':' · 構え '+formatTime(r.address)}${r.impact===null?'':' · 打球 '+formatTime(r.impact)}`;
      const jump=document.createElement('button');jump.className='secondary';jump.textContent='編集';jump.setAttribute('aria-label',`区間${index+1}を編集`);jump.onclick=()=>{editing=index;$('rangeStart').value=r.start;$('rangeEnd').value=r.end;impact=r.impact;address=r.address??null;$('addRange').textContent='変更を保存';video.pause();video.currentTime=r.start;changed();};
      const remove=document.createElement('button');remove.className='secondary';remove.textContent='削除';remove.setAttribute('aria-label',`区間${index+1}を削除`);remove.onclick=()=>{registered.splice(index,1);if(editing===index){editing=-1;$('addRange').textContent='この区間を追加';}else if(editing>index)editing--;render();changed();};
      row.append(label,jump,remove);$('rangeList').append(row);
    });
  }
  for(const id of ['rangeStart','rangeEnd'])$(id).onchange=()=>{const r=draft();if(address!==null&&(address<r.start||address>r.end))address=null;if(impact!==null&&(impact<r.start||impact>r.end))impact=null;changed();};
  $('markStart').onclick=()=>{$('rangeStart').value=video.currentTime.toFixed(2);if(impact!==null&&impact<video.currentTime)impact=null;changed();};
  $('markEnd').onclick=()=>{$('rangeEnd').value=video.currentTime.toFixed(2);if(impact!==null&&impact>video.currentTime)impact=null;changed();};
  $('markImpact').onclick=()=>{const r=draft();if(video.currentTime<r.start||video.currentTime>r.end){$('rangeError').textContent='区間内の打球の瞬間に移動してから指定してください。';return;}impact=Number(video.currentTime.toFixed(2));changed();};
  $('markAddress').onclick=()=>{const r=draft();if(video.currentTime<r.start||video.currentTime>r.end){$('rangeError').textContent='区間内の構えた瞬間に移動してから指定してください。';return;}address=Number(video.currentTime.toFixed(2));changed();};
  $('clearAddress').onclick=()=>{address=null;changed();};
  $('clearImpact').onclick=()=>{impact=null;changed();};
  $('addRange').onclick=()=>{try{const next=normalizeRanges(editing>=0?registered.map((r,i)=>i===editing?draft():r):[...registered,draft()],duration);registered=next;editing=-1;$('addRange').textContent='この区間を追加';render();changed();}catch(error){$('rangeError').textContent=error.message;}};
  $('resetRanges').onclick=()=>{registered=[];impact=null;address=null;editing=-1;$('addRange').textContent='この区間を追加';$('rangeStart').value=0;$('rangeEnd').value=duration.toFixed(3);$('previewOnly').checked=false;render();changed();};
  $('previewRanges').onclick=async()=>{try{const ranges=getRanges();$('previewOnly').checked=true;video.currentTime=ranges[0].start;await video.play();}catch(error){$('rangeError').textContent=error.message;}};
  video.addEventListener('timeupdate',()=>{
    if(isBusy()||video.paused||!$('previewOnly').checked)return;
    try{const ranges=getRanges(),t=video.currentTime;if(ranges.some(r=>t>=r.start-.001&&t<r.end))return;const next=ranges.find(r=>r.start>t);if(next)video.currentTime=next.start;else{video.pause();if(Math.abs(t-ranges.at(-1).end)>.05)video.currentTime=ranges.at(-1).end;}}catch{video.pause();}
  });
  return {getRanges,hide(){root.hidden=true;},reset(value){duration=value;registered=[];impact=null;address=null;editing=-1;$('addRange').textContent='この区間を追加';$('rangeStart').value=0;$('rangeEnd').value=duration.toFixed(3);$('rangeStart').max=duration;$('rangeEnd').max=duration;$('previewOnly').checked=false;root.hidden=false;render();status();}};
}
