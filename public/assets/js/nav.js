(()=>{
  const header=document.querySelector('.site-header');
  if(!header)return;
  const nav=header.querySelector('nav');
  const trigger=header.querySelector('.brand-mark');
  if(!nav||!trigger)return;

  if(!nav.id)nav.id='siteNav';
  trigger.setAttribute('aria-controls',nav.id);
  trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-label','Open navigation');

  /* The sticky header uses backdrop-filter, which creates a containing block for fixed
     descendants in mobile Chromium. Keep the drawer as a body-level overlay so its
     fixed top/bottom anchors always resolve against the viewport instead of the header. */
  nav.classList.add('site-nav-drawer');
  document.body.appendChild(nav);

  const backdrop=document.createElement('div');
  backdrop.className='site-nav-backdrop';
  backdrop.hidden=true;
  document.body.appendChild(backdrop);

  let open=false;
  const focusable=()=>[...nav.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node=>!node.hidden);
  const setOpen=(next,{returnFocus=false}={})=>{
    open=Boolean(next);
    nav.classList.toggle('nav-open',open);
    trigger.classList.toggle('menu-open',open);
    document.documentElement.classList.toggle('site-nav-open',open);
    document.body.classList.toggle('site-nav-open',open);
    trigger.setAttribute('aria-expanded',String(open));
    trigger.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    nav.setAttribute('aria-hidden',open?'false':'true');
    backdrop.hidden=!open;
    if(open){
      const first=focusable()[0];
      window.setTimeout(()=>first?.focus({preventScroll:true}),60);
    }else if(returnFocus){
      window.setTimeout(()=>trigger.focus({preventScroll:true}),0);
    }
  };

  /* Hidden Garden Keeper shortcut. This is only a convenience route; /admin.html still
     requires the normal Garden Keeper token before any protected action is available. */
  const finePointer=window.matchMedia('(pointer:fine)');
  const adminPath='/admin.html';
  const desktopClicks=[];
  let longPressTimer=0;
  let longPressStart=null;
  let suppressNextClick=false;

  const openAdmin=()=>{
    desktopClicks.length=0;
    if(longPressTimer)window.clearTimeout(longPressTimer);
    longPressTimer=0;
    longPressStart=null;
    suppressNextClick=true;
    setOpen(false);
    window.dispatchEvent(new CustomEvent('sg:navigationintent',{detail:{direction:'forward',target:adminPath}}));
    window.location.assign(adminPath);
  };

  const cancelLongPress=()=>{
    if(longPressTimer)window.clearTimeout(longPressTimer);
    longPressTimer=0;
    longPressStart=null;
  };

  trigger.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse')return;
    cancelLongPress();
    longPressStart={id:event.pointerId,x:event.clientX,y:event.clientY};
    longPressTimer=window.setTimeout(openAdmin,1500);
  });
  trigger.addEventListener('pointermove',event=>{
    if(!longPressStart||event.pointerId!==longPressStart.id)return;
    if(Math.hypot(event.clientX-longPressStart.x,event.clientY-longPressStart.y)>12)cancelLongPress();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(type=>trigger.addEventListener(type,cancelLongPress));

  trigger.addEventListener('click',event=>{
    event.preventDefault();
    if(suppressNextClick){suppressNextClick=false;return}

    if(finePointer.matches){
      const now=performance.now();
      desktopClicks.push(now);
      while(desktopClicks.length&&now-desktopClicks[0]>2000)desktopClicks.shift();
      if(desktopClicks.length>=5){openAdmin();return}
    }else desktopClicks.length=0;

    setOpen(!open,{returnFocus:open});
  });
  backdrop.addEventListener('click',()=>setOpen(false,{returnFocus:true}));

  document.addEventListener('keydown',event=>{
    if(!open)return;
    if(event.key==='Escape'){
      event.preventDefault();
      setOpen(false,{returnFocus:true});
      return;
    }
    if(event.key!=='Tab')return;
    const items=focusable();
    if(!items.length){event.preventDefault();trigger.focus();return}
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });

  nav.addEventListener('click',event=>{
    const control=event.target.closest('a,button');
    if(!control||control.closest('[data-nav-keep-open]'))return;
    window.setTimeout(()=>setOpen(false),0);
  });
  setOpen(false);
})();