// Decode in playback order. Do not depend on seeked events for frame extraction.
export async function primeVideo(video, {timeoutMs=30000, cancelled=()=>false}={}) {
  video.muted=true;
  video.defaultMuted=true;
  video.playsInline=true;
  const playback=video.play(); // Called inside the user's Analyze click, before model loading.
  let timer,poll;
  try {
    await Promise.race([playback,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('動画の再生を開始できませんでした。「再生」を一度押してから再度解析してください。')),timeoutMs);
      poll=setInterval(()=>{if(cancelled())reject(new Error('解析を中止しました。'));},100);
    })]);
  } catch(error) {
    if(error.name==='NotAllowedError')throw new Error('再生が許可されませんでした。「再生」を一度押してから再度解析してください。');
    throw error;
  } finally {
    clearTimeout(timer);clearInterval(poll);video.pause();
  }
}

export function analyzePlayback(video, {onFrame,onProgress=()=>{},cancelled=()=>false,isHidden=()=>document.hidden,stallMs=30000,interval=1/12}={}) {
  return new Promise((resolve,reject)=>{
    const oldRate=video.playbackRate;
    let frameId=null,poll,lastTime=-Infinity,lastProgress=Date.now(),done=false;
    const hasFrameCallback=typeof video.requestVideoFrameCallback==='function';
    function finish(error) {
      if(done)return;
      done=true;
      clearInterval(poll);
      if(frameId!==null){
        if(hasFrameCallback)video.cancelVideoFrameCallback(frameId);
        else cancelAnimationFrame(frameId);
      }
      video.removeEventListener('ended',ended);
      video.removeEventListener('error',failed);
      video.pause();video.playbackRate=oldRate;
      error?reject(error):resolve();
    }
    function ended(){finish();}
    function failed(){finish(new Error('動画をデコードできません。MP4（H.264）で保存した動画をお試しください。'));}
    function schedule(){if(!done)frameId=hasFrameCallback?video.requestVideoFrameCallback(frame):requestAnimationFrame(frame);}
    function frame(_now,metadata) {
      frameId=null;
      if(done)return;
      if(cancelled()){finish(new Error('解析を中止しました。'));return;}
      const t=metadata?.mediaTime??video.currentTime;
      // A seek can briefly expose an old frame. Wait for the reset to finish.
      if(!video.seeking&&video.readyState>=2&&Number.isFinite(t)&&t>=0&&t<=video.duration&&t-lastTime>=interval-0.00001){
        try{onFrame(t);lastTime=t;lastProgress=Date.now();onProgress(t/video.duration);}catch(error){finish(error);return;}
      }
      if(video.ended){finish();return;}
      schedule();
    }
    video.addEventListener('ended',ended);
    video.addEventListener('error',failed);
    poll=setInterval(()=>{
      if(cancelled())finish(new Error('解析を中止しました。'));
      else if(isHidden())finish(new Error('画面が閉じられたため解析を中止しました。この画面を表示したまま再度解析してください。'));
      else if(Date.now()-lastProgress>stallMs)finish(new Error('動画の再生が止まっています。「再生」で映像を確認してから再試行してください。改善しない場合はMP4（H.264）で保存し直してください。'));
    },100);
    try {
      video.pause();
      video.currentTime=0;
      video.playbackRate=0.5;
      schedule();
      Promise.resolve(video.play()).catch(error=>finish(error.name==='NotAllowedError'?new Error('再生が許可されませんでした。「再生」を一度押してから再度解析してください。'):error));
    } catch(error){finish(error);}
  });
}
