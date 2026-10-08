/* 中国人日语速学 · v13：专项纠错与主动回忆 */
(function(){
'use strict';
var panel=document.getElementById('skillPanel');
var status=document.getElementById('skillStatus');
var hub=document.getElementById('skillHub');
if(!panel||!hub)return;
var db=null, session=[], pos=0, hits=0, locked=false, currentMode='';
var errorKey='jc_errors_v13', modeNames={endings:'句尾反射',particles:'助词秒选',traps:'汉字陷阱',confusions:'易混词辨析',listening:'关键词听力',mixed:'今日极速练习',errors:'易错题重练'};
var categories=['endings','particles','traps','confusions','listening'];
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a}
function readErrors(){try{return JSON.parse(localStorage.getItem(errorKey)||'{}')||{}}catch(e){return {}}}
function saveErrors(v){localStorage.setItem(errorKey,JSON.stringify(v))}
function key(q){return q.group+':'+q.id}
function allQuestions(){
  var a=[];categories.forEach(function(group){(db[group]||[]).forEach(function(q){a.push(Object.assign({group:group},q))})});return a
}
function pool(group){return (db[group]||[]).map(function(q){return Object.assign({group:group},q)})}
function weightedPick(items,count){
  var errs=readErrors();
  var ranked=shuffle(items).sort(function(a,b){
    var ea=errs[key(a)],eb=errs[key(b)];
    return (eb?2+(eb.misses||0):0)-(ea?2+(ea.misses||0):0);
  });
  return ranked.slice(0,count)
}
function oldWeakCount(){
  try {if(typeof getMastery!=='function'||typeof collectAllItems!=='function')return 0;
    var m=getMastery();return collectAllItems().filter(function(it){
      return m[it.type+'|'+it.day+'|'+it.text] && m[it.type+'|'+it.day+'|'+it.text].score<2
    }).length;
  }catch(e){return 0}
}
function refreshStats(){
  var n=Object.keys(readErrors()).length,w=oldWeakCount();
  status.textContent='专项待巩固 '+n+' 题 · 原有词句薄弱项 '+w+' 条（记录保存在本机）';
  var b=document.getElementById('weakVocabularyBtn');if(b)b.textContent='📌 原有薄弱词句 '+w+' 条';
}
function record(q,correct){
  var all=readErrors(),k=key(q);
  if(!correct){var old=all[k]||{misses:0,streak:0};all[k]={misses:(old.misses||0)+1,streak:0,last:Date.now()}}
  else if(all[k]){all[k].streak=(all[k].streak||0)+1;if(all[k].streak>=3)delete all[k]}
  saveErrors(all);refreshStats()
}
function buildChoices(q){
  if(q.group==='endings'){
    var poolOptions=db.endings.map(function(v){return v.answer}).filter(function(s){return s!==q.answer});
    return shuffle([q.answer].concat(shuffle(poolOptions).slice(0,3)))
  }
  if(q.group==='particles'){
    return shuffle([q.answer].concat(shuffle(['は','が','を','に','で','へ','と'].filter(function(t){return t!==q.answer})).slice(0,3)))
  }
  if(q.group==='traps'){
    var others=db.traps.map(function(v){return v.answer}).filter(function(s){return s!==q.answer&&s!==q.trap});
    return shuffle([q.answer,q.trap].concat(shuffle(others).slice(0,2)))
  }
  return shuffle(q.options)
}
function titleOf(q){
  if(q.group==='endings')return '听句子，判断说话人的意图或时间';
  if(q.group==='particles')return '选出最自然的助词';
  if(q.group==='traps')return '这个日语汉字词真正是什么意思？';
  if(q.group==='confusions')return '在这个现场场景里，哪个词最准确？';
  return '先听日语，不看原文，选最符合的关键词'
}
function frontOf(q){
  if(q.group==='endings'||q.group==='listening')return '<p class="note">请先播放音频，再选择答案；日文原句在作答后出现。</p>';
  if(q.group==='particles')return '<div class="drill-main">'+esc(q.prompt)+'</div>';
  if(q.group==='traps')return '<div class="drill-main">'+esc(q.word)+'</div>';
  return '<div class="drill-main drill-question">'+esc(q.prompt)+'</div>'
}
function audioBtn(q){
  // Grammar/terminology checks must not play the correct answer before choosing.
  if(q.group==='particles'||q.group==='confusions')return '';
  return q.audio?'<button class="pill" type="button" data-skill-play>▶ '+((q.group==='endings'||q.group==='listening')?'播放日语':'听日语')+'</button>':''
}
function detail(q){
  var full='';
  if(q.group==='endings')full='<b>'+esc(q.audio)+'</b><p>'+esc(q.why)+'</p>';
  else if(q.group==='particles')full='<b>'+esc(q.audio)+'</b><p>'+esc(q.why)+'</p>';
  else if(q.group==='traps')full='<b>'+esc(q.word)+'</b>：'+esc(q.answer)+'<p>小心中文联想：'+esc(q.trap)+'</p><p>例：'+esc(q.example)+'</p>';
  else if(q.group==='confusions')full='<b>'+esc(q.answer)+'</b><p>'+esc(q.why)+'</p>';
  else full='<b>'+esc(q.audio)+'</b><p>听力意思：'+esc(q.meaning)+'</p><p>关键词：'+esc(q.answer)+'</p>';
  return '<div class="skill-explanation">'+full+'</div>'+((q.group==='particles'||q.group==='confusions')?'<button class="pill" type="button" data-skill-play>▶ 听正确日语</button>':'')
}
function renderQuestion(scroll){
  locked=false;
  if(pos>=session.length){showComplete();return}
  var q=session[pos],opts=buildChoices(q);
  var html='<div class="card skill-study" id="skillQuestion"><div class="row" style="justify-content:space-between;align-items:center">'
    +'<div class="section-title" style="margin:0">'+esc(modeNames[currentMode])+'</div>'
    +'<span class="badge">'+(pos+1)+' / '+session.length+'</span></div>'
    +'<div class="progress" style="margin:12px 0"><div class="bar" style="width:'+(pos/session.length*100)+'%"></div></div>'
    +'<div class="mini">'+esc(titleOf(q))+'</div>'+frontOf(q)
    +'<div class="row" style="margin:10px 0">'+audioBtn(q)+'</div>'
    +'<div class="skill-options">'+opts.map(function(c,i){return '<button type="button" class="skill-option" data-skill-option="'+i+'">'+esc(c)+'</button>'}).join('')+'</div>'
    +'<div id="skillFeedback" class="hidden" aria-live="polite"></div>'
    +'<div class="row" style="margin-top:12px"><button type="button" class="pill" data-skill-close>退出练习</button></div>'
    +'</div>';
  panel.innerHTML=html;
  session[pos].choices=opts;
  if(scroll)panel.scrollIntoView({behavior:'smooth',block:'start'})
}
function grade(index){
  if(locked||pos>=session.length)return;
  var q=session[pos],sel=q.choices[index],correct=sel===q.answer;locked=true;
  if(correct)hits++;
  record(q,correct);
  Array.prototype.forEach.call(panel.querySelectorAll('[data-skill-option]'),function(b){
    b.disabled=true;
    if(b.textContent===q.answer)b.classList.add('skill-correct');
    else if(+b.dataset.skillOption===index)b.classList.add('skill-wrong');
  });
  var err=readErrors()[key(q)],msg=correct?'回答正确 ✓':'这题要加强';
  var progress=err?'<div class="mini">易错库巩固进度：'+err.streak+'/3 次连续答对</div>':'';
  var div=document.getElementById('skillFeedback');
  div.classList.remove('hidden');
  div.innerHTML='<div class="skill-result"><b>'+msg+'</b> · 正确答案：'+esc(q.answer)+'</div>'
    +detail(q)+progress
    +'<div class="row"><button type="button" class="pill primary" data-skill-next>'+(pos+1<session.length?'下一题 →':'查看训练结果')+'</button></div>';
}
function start(mode){
  if(!db){panel.innerHTML='<div class="card note">练习题库尚未加载，请检查网络后重试。</div>';return}
  currentMode=mode;pos=0;hits=0;locked=false;
  if(mode==='mixed'){
    var plan={endings:3,particles:3,traps:2,confusions:2,listening:2},all=[];
    categories.forEach(function(g){all=all.concat(weightedPick(pool(g),plan[g]))});
    session=shuffle(all)
  }else if(mode==='errors'){
    var errors=readErrors(),set=allQuestions().filter(function(q){return !!errors[key(q)]});
    session=weightedPick(set,20)
  }else session=weightedPick(pool(mode),10);
  if(!session.length){panel.innerHTML='<div class="card"><div class="section-title">暂无错题</div><div class="note">当前没有专项错题。做错的题会自动加入，连续答对3次后自动退出。</div></div>';panel.scrollIntoView({behavior:'smooth',block:'start'});return}
  renderQuestion(true)
}
function showComplete(){
  var total=session.length;
  panel.innerHTML='<div class="card skill-study"><div class="section-title">本轮训练完成</div>'
    +'<div class="drill-main">'+hits+' / '+total+'</div>'
    +'<p class="note">正确率：'+Math.round(hits/total*100)+'%。答错的题已进入易错库；每次复练答对会累计巩固，连续答对3次退出。</p>'
    +'<div class="row"><button type="button" class="pill primary" data-skill-restart>再练一轮</button>'
    +'<button type="button" class="pill" data-skill-errors>查看易错库</button>'
    +'<button type="button" class="pill" data-skill-close>结束</button></div></div>';
  refreshStats()
}
function showErrorBook(){
  if(!db)return;
  var err=readErrors(),all=allQuestions(),selected=all.filter(function(q){return !!err[key(q)]});
  selected.sort(function(a,b){return (err[key(b)].last||0)-(err[key(a)].last||0)});
  var rows=selected.slice(0,30).map(function(q){
    var e=err[key(q)];
    var label=q.word||q.prompt||q.ending||q.audio;
    return '<div class="skill-error-row"><div><b>'+esc(label)+'</b><div class="mini">'+esc(modeNames[q.group])+' · 连续答对 '+e.streak+'/3 · 曾错 '+e.misses+' 次</div></div></div>';
  }).join('');
  panel.innerHTML='<div class="card skill-study"><div class="section-title">我的易错库 · '+selected.length+'题</div>'
   +'<div class="note">不熟悉的内容由系统记录；下次优先抽取错题，连续答对3次后自动移出。</div>'
   +(selected.length?rows:'<p class="note">暂无专项错题，可以先做今日极速练习。</p>')
   +'<div class="row" style="margin-top:12px"><button type="button" class="pill primary" data-skill-errors '+(selected.length?'':'disabled')+'>▶ 练习易错题</button>'
   +'<button type="button" class="pill" id="oldWeakNow">📌 练习旧版薄弱词句（'+oldWeakCount()+'）</button>'
   +'<button type="button" class="pill" data-skill-close>收起</button></div></div>';
  panel.scrollIntoView({behavior:'smooth',block:'start'})
}
function openOldWeak(){
  if(typeof getMastery!=='function'||typeof collectAllItems!=='function'||typeof renderReview!=='function')return;
  var m=getMastery(),list=collectAllItems(function(it){
    var v=m[it.type+'|'+it.day+'|'+it.text];return v&&v.score<2
  });
  renderReview(list,'旧版待巩固词句');
  var old=document.getElementById('reviewPanel');if(old)old.scrollIntoView({behavior:'smooth',block:'start'})
}
hub.addEventListener('click',function(e){
  var btn=e.target.closest('[data-skill-start]');if(btn)start(btn.dataset.skillStart)
});
panel.addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-skill-play')){
    var q=session[pos];if(q&&q.audio&&typeof speak==='function')speak(q.audio);return
  }
  if(b.hasAttribute('data-skill-option')){grade(+b.dataset.skillOption);return}
  if(b.hasAttribute('data-skill-next')){pos++;renderQuestion(false);return}
  if(b.hasAttribute('data-skill-restart')){start(currentMode);return}
  if(b.hasAttribute('data-skill-errors')){start('errors');return}
  if(b.id==='oldWeakNow'){openOldWeak();return}
  if(b.hasAttribute('data-skill-close')){panel.innerHTML='';return}
});
var errorsOpen=document.getElementById('skillErrorBookBtn');
if(errorsOpen)errorsOpen.addEventListener('click',showErrorBook);
var weakOpen=document.getElementById('weakVocabularyBtn');
if(weakOpen)weakOpen.addEventListener('click',openOldWeak);
fetch('./data/practice-v13.json',{cache:'no-store'})
 .then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.json()})
 .then(function(d){db=d;refreshStats()})
 .catch(function(e){status.textContent='训练题库加载失败：'+e.message});
})();
