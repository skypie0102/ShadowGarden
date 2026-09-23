/* Shadow Garden — reliable terminal handoff for the stateful upload workflow.
 *
 * The base batch uploader can briefly write COMPLETE before its final renderQueue() replaces that
 * pill with WAITING/READY. Treat q.running as the authoritative transaction boundary instead.
 */
(()=>{
  const q=state?.batch;
  const dialog=document.querySelector('#addBooksDialog');
  const stage=document.querySelector('#uploadWorkflowStage');
  const uploadState=document.querySelector('#uploadState');
  if(!q||!dialog||!stage||!uploadState)return;

  let observedRunning=false;
  let completionSent=false;

  function uploadingStageVisible(){
    return dialog.classList.contains('sg-workflow-stage')&&Boolean(stage.querySelector('.upload-state-uploading'));
  }

  function check(){
    if(!uploadingStageVisible()){
      observedRunning=false;
      completionSent=false;
      return;
    }

    if(q.running){
      observedRunning=true;
      completionSent=false;
      return;
    }

    if(!observedRunning||completionSent)return;
    completionSent=true;
    setTimeout(()=>{
      if(!uploadingStageVisible()||q.running){completionSent=false;return}
      uploadState.textContent='COMPLETE';
      uploadState.className='state-pill ready';
      observedRunning=false;
    },0);
  }

  const timer=setInterval(check,160);
  dialog.addEventListener('close',()=>{observedRunning=false;completionSent=false});
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  check();
})();
