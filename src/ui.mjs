const screen=document.querySelector('#loadingScreen'),app=document.querySelector('#app'),message=document.querySelector('#loadingText');
let hideTimer,toastTimer,recoveryTimer,previousFocus;
export function setLoading(active,text='読み込み中'){
  clearTimeout(hideTimer);clearTimeout(recoveryTimer);
  if(active){
    if(screen.hidden)previousFocus=document.activeElement;
    screen.hidden=false;screen.classList.remove('leaving');message.textContent=text;document.querySelector('#loadingClose').hidden=true;
    document.body.classList.add('loading');app.setAttribute('aria-busy','true');app.inert=true;
    requestAnimationFrame(()=>{const button=screen.querySelector('button:not([hidden])');if(button)button.focus({preventScroll:true});});
    recoveryTimer=setTimeout(()=>{if(!screen.hidden&&!screen.querySelector('#cancel:not([hidden])')){message.textContent='読み込みに時間がかかっています。通信状態を確認してください。';document.querySelector('#loadingClose').hidden=false;}},30000);
  }else{
    app.inert=false;app.setAttribute('aria-busy','false');document.body.classList.remove('loading');
    screen.classList.add('leaving');
    hideTimer=setTimeout(()=>{screen.hidden=true;screen.classList.remove('leaving');if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});},matchMedia('(prefers-reduced-motion: reduce)').matches?0:320);
  }
}
export function loadingMessage(text){message.textContent=text;}
export function toast(text){const element=document.querySelector('#toast');clearTimeout(toastTimer);element.textContent=text;element.hidden=false;toastTimer=setTimeout(()=>element.hidden=true,2600);}
export function resultReady(){
  toast('解析データを表示しました');
  const el=document.querySelector('#results-section');
  el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.querySelector('#metrics').animate([{opacity:.3,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:550,easing:'cubic-bezier(.2,.8,.2,1)'});
}
document.addEventListener('keydown',event=>{
  const label=event.target.closest('label[role="button"]');
  if(label&&(event.key==='Enter'||event.key===' ')){event.preventDefault();document.getElementById(label.htmlFor)?.click();}
  if(event.key==='Tab'&&!screen.hidden){const buttons=[...screen.querySelectorAll('button:not([hidden])')];if(buttons.length){event.preventDefault();buttons[0].focus();}}
});
document.addEventListener('click',event=>{
  const target=event.target.closest('button:not(:disabled),.dock a,.secondary,.icon-button');
  if(!target||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(target.tagName==='BUTTON'){
    const rect=target.getBoundingClientRect(),ripple=document.createElement('span');ripple.className='ripple';const size=Math.max(rect.width,rect.height);
    Object.assign(ripple.style,{width:size+'px',height:size+'px',left:(event.clientX-rect.left-size/2)+'px',top:(event.clientY-rect.top-size/2)+'px'});
    target.append(ripple);ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
  }
});
const sections=[document.querySelector('#video-section'),document.querySelector('#results-section')];
const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){const id=entry.target.id==='video-section'?'video':'results';document.querySelectorAll('[data-nav]').forEach(link=>{const active=link.dataset.nav===id;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}}},{rootMargin:'-10% 0px -50% 0px',threshold:0});
sections.forEach(section=>observer.observe(section));
document.querySelector('#loadingClose').onclick=()=>setLoading(false);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reducedMotion){
  document.body.classList.add('motion-ready');
  const revealObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}}},{threshold:.08});
  document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));
}
setLoading(true,'アプリを準備しています');
