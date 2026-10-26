import {mid,good,angle} from './coaching.mjs?v=5';
export function renderOverlay(canvas,frame,report,segment,layers,thickness=3){
  const w=report.width,h=report.height;
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.lineCap='round';ctx.lineJoin='round';
  const baseline=segment.segment.address==null?segment.frames[0]:segment.frames.reduce((a,b)=>!a||Math.abs(b.t-segment.segment.address)<Math.abs(a.t-segment.segment.address)?b:a,null);
  const scale=Math.max(.001,Math.min((canvas.clientWidth||w)/w,(canvas.clientHeight||h)/h)),unit=1/scale,p=frame.p,reference=baseline?.p??p;
  function stroke(color,multiplier=1,dashed=false){
    ctx.setLineDash(dashed?[7*unit,6*unit]:[]);
    ctx.strokeStyle='#081b2da6';ctx.lineWidth=(thickness*multiplier+1.5)*unit;ctx.stroke();
    ctx.strokeStyle=color;ctx.lineWidth=thickness*multiplier*unit;ctx.stroke();ctx.setLineDash([]);
  }
  function line(a,b,color,multiplier=1,dashed=false){ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);stroke(color,multiplier,dashed);}
  const connections=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32]];
  function skeleton(q,color){connections.forEach(([a,b])=>{if(good(q,[a,b]))line(q[a],q[b],color)});q.forEach((a,i)=>{if(i>=11&&(a.visibility??1)>.55){ctx.beginPath();ctx.fillStyle='#102532';ctx.arc(a.x*w,a.y*h,(thickness+1)*unit,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.fillStyle=color;ctx.arc(a.x*w,a.y*h,thickness*unit,0,Math.PI*2);ctx.fill();}});}
  if(layers.ghost)skeleton(reference,'#ffffff80');
  if(layers.trail){
    for(const [ids,color]of [[[0],'#ffffffbd'],[[15,16],'#ffcf7ac9']]){
      ctx.beginPath();let previous=null;
      for(const item of segment.frames){if(item.t>frame.t)break;if(!good(item.p,ids)){previous=null;continue;}const point=ids.length===1?item.p[0]:mid(item.p[15],item.p[16]);if(!previous||item.t-previous.t>.25)ctx.moveTo(point.x*w,point.y*h);else ctx.lineTo(point.x*w,point.y*h);previous=item;}
      stroke(color,.85);
    }
  }
  if(layers.skeleton)skeleton(p,'#b4f589');
  if(layers.axis){const s=mid(p[11],p[12]),hip=mid(p[23],p[24]),origin=mid(reference[23],reference[24]);line({x:origin.x,y:0},{x:origin.x,y:1},'#ffe08ac9',.85,true);line(s,hip,'#ffe08a',1.3);}
  if(layers.planes){line(p[11],p[12],'#88e5ef',1.15);line(p[23],p[24],'#edacda',1.15);}
  if(layers.angles){
    ctx.font=`600 ${12*unit}px system-ui`;
    for(const[a,b,c]of [[23,25,27],[24,26,28],[11,13,15],[12,14,16]]){
      if(!good(p,[a,b,c]))continue;
      const text=Math.round(angle(p[a],p[b],p[c],w,h))+'°',textWidth=ctx.measureText(text).width,x=Math.min(w-textWidth-7*unit,Math.max(4*unit,p[b].x*w+8*unit)),y=Math.max(20*unit,Math.min(h-5*unit,p[b].y*h));
      ctx.fillStyle='#102532e8';ctx.fillRect(x-3*unit,y-15*unit,textWidth+7*unit,20*unit);ctx.fillStyle='#fff';ctx.fillText(text,x,y);
    }
  }
}
