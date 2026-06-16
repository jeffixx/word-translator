var LLMService = (function() {
  var API_ENDPOINT = '/llm';
  var isRequesting = false;

  var COMMON_ROOTS = {
    'un-':'不，否定','pre-':'前，预先','dis-':'不，相反','re-':'再，重新',
    'in-':'不，向内','im-':'不，向内','ex-':'出，外','sub-':'下，次',
    'super-':'超，上','inter-':'之间，相互','trans-':'跨越，转变',
    'mis-':'错误，坏','over-':'过度，在上','under-':'不足，在下',
    'anti-':'反对，防止','auto-':'自己，自动','bi-':'二，双','co-':'共同，一起',
    'de-':'向下，去除','multi-':'多','non-':'非，不','out-':'超过，外',
    'post-':'后','semi-':'半','tele-':'远','micro-':'微小','macro-':'宏大',
    '-able':'能够...的','-ible':'能够...的','-tion':'名词后缀','-sion':'名词后缀',
    '-ment':'名词后缀','-ness':'名词后缀','-er':'名词后缀','-or':'名词后缀',
    '-ist':'名词后缀','-ful':'形容词后缀','-less':'形容词后缀',
    '-ous':'形容词后缀','-ive':'形容词后缀','-al':'形容词后缀',
    '-ly':'副词后缀','-ize':'动词后缀','-ify':'动词后缀','-en':'动词后缀',
    'act':'行动，做','aud':'听','cap':'拿，取','ced':'走，让步',
    'cept':'拿，取','clud':'关闭','cogn':'知道','cred':'相信',
    'cur':'跑，发生','dict':'说，言','duc':'引导，带来','fac':'做，制作',
    'fer':'带来，携带','fin':'结束，界限','form':'形状，形式',
    'gen':'产生，种类','graph':'写，画','ject':'投掷','lect':'选择，收集',
    'loc':'地方','log':'言语，学科','mit':'发送','mov':'移动',
    'nat':'出生','oper':'工作，运作','pend':'悬挂，称重',
    'port':'携带，运输','pos':'放置','scrib':'写','sect':'切割',
    'sent':'感觉','sign':'标记','spect':'看','struct':'建造',
    'tract':'拉，拖','vac':'空','val':'价值，强壮','vis':'看',
    'vit':'生命','nov':'新','vent':'来','voc':'声音，喊叫'
  };

  function analyzeRoots(word) {
    var roots = [];
    var w = word.toLowerCase();
    var prefixes = ['un-','pre-','dis-','re-','in-','im-','ex-','sub-','super-','inter-','trans-','mis-','over-','under-','anti-','auto-','co-','de-','multi-','non-','out-','post-','semi-','tele-','micro-','macro-','bi-'];
    for (var i = 0; i < prefixes.length; i++) {
      var pt = prefixes[i].slice(0,-1);
      if (w.startsWith(pt) && w.length > pt.length+2) {
        roots.push({part:prefixes[i], meaning:COMMON_ROOTS[prefixes[i]]});
        w = w.slice(pt.length); break;
      }
    }
    var suffixes = ['-tion','-sion','-ment','-ness','-able','-ible','-ful','-less','-ous','-ive','-al','-ize','-ify','-en','-er','-or','-ist','-ly'];
    for (var i = 0; i < suffixes.length; i++) {
      var st = suffixes[i].slice(1);
      if (w.endsWith(st) && w.length > st.length+2) {
        roots.push({part:suffixes[i], meaning:COMMON_ROOTS[suffixes[i]]});
        w = w.slice(0,-st.length); break;
      }
    }
    var rks = ['struct','spect','scrib','cept','clud','tract','ject','lect','cogn','cred','dict','duc','graph','oper','pend','port','sect','sent','sign','form','gen','mit','mov','nat','vac','val','vis','vit','act','aud','cap','ced','cur','fac','fer','fin','loc','log','pos','nov','vent','voc'];
    for (var i = 0; i < rks.length; i++) {
      if (w.includes(rks[i])) { roots.push({part:rks[i], meaning:COMMON_ROOTS[rks[i]]}); break; }
    }
    return roots;
  }

  function splitMemory(word, translation) {
    var w = word.toLowerCase(), parts=[], prefix='', suffix='', middle=w;
    var pp = ['con','com','pro','per','sur','sup','des','dec','rec','red','sub','tra','tri','bio','geo','phy','psy','neo','arc','inno'];
    for (var i=0;i<pp.length;i++) { if(middle.startsWith(pp[i])&&middle.length>pp[i].length+3){prefix=pp[i];middle=middle.slice(prefix.length);break;} }
    var sp = ['tion','sion','ment','ness','ance','ence','able','ible','ful','less','ous','ive','ial','ical','ize','ise','ify','ate','ent','ant','ary','ery','ory','ing'];
    for (var i=0;i<sp.length;i++) { if(middle.endsWith(sp[i])&&middle.length>sp[i].length+2){suffix=sp[i];middle=middle.slice(0,-suffix.length);break;} }
    if(prefix) parts.push({part:prefix,meaning:'前缀'});
    if(middle) parts.push({part:middle,meaning:'词根'});
    if(suffix) parts.push({part:suffix,meaning:'后缀'});
    if(parts.length>1) return {type:'split',roots:parts,memory:parts.map(function(p){return p.part;}).join(' + ')+' → '+translation};
    return null;
  }

  function generateMemory(data) {
    var word = data.word.toLowerCase().trim();
    var translation = data.translation || '';
    if (data.roots && data.roots.length > 0) {
      if (!data.memory) data.memory = data.roots.map(function(r){return r.part+'('+r.meaning+')';}).join('+')+'→'+translation;
      data.memoryType = 'roots'; return data;
    }
    var roots = analyzeRoots(word);
    if (roots.length > 0) {
      data.roots = roots;
      data.memory = roots.map(function(r){return r.part+'('+r.meaning+')';}).join('+')+'→'+translation;
      data.memoryType = 'roots'; return data;
    }
    if (word.length > 4) {
      var split = splitMemory(word, translation);
      if (split) { data.roots=split.roots; data.memory=split.memory; data.memoryType='split'; return data; }
    }
    data.roots = []; data.memory = '基础词汇，建议整体记忆'; data.memoryType = 'basic'; return data;
  }

  function generateExample(translation, pos) {
    var t = {
      'v.':['It is important to {m} in daily life.','Learning to {m} requires patience.','You should {m} when facing challenges.'],
      'n.':['The {m} is essential for development.','A good {m} contributes to success.','Understanding {m} helps us grow.'],
      'adj.':['This is a {m} approach to the problem.','Being {m} is a valuable quality.','The {m} solution impressed everyone.'],
      'adv.':['She acted {m} in the situation.','The task was completed {m}.','He {m} achieved his goals.']
    };
    var arr = t[pos] || t['n.'];
    var tpl = arr[Math.floor(Math.random()*arr.length)];
    var m = translation.split('，')[0].split('；')[0].split('、')[0];
    return { en: tpl.replace('{m}',m), cn: '（涉及'+m+'）' };
  }

  function enhanceWord(data, callback) {
    setTimeout(function() {
      data = generateMemory(data);
      if (!data.example || !data.example.cn) {
        data.example = generateExample(data.translation, data.pos);
      }
      callback(data);
    }, 50);
  }

  function callDeepSeek(word, callback) {
    if (isRequesting) { callback({success:false,error:'请求进行中'}); return; }
    isRequesting = true;
    var prompt = '请为单词 "'+word+'" 提供以下信息，以JSON格式返回：\n'+
      '{"translation":"中文翻译","phonetic":"音标","pos":"词性","roots":[{"part":"词根","meaning":"含义"}],"memory":"记忆方法","example":{"en":"英文例句","cn":"中文翻译"}}\n'+
      '只返回JSON，不要其他文字。';
    var messages = [
      {role:'system',content:'你是英语单词学习助手，只返回JSON。'},
      {role:'user',content:prompt}
    ];
    fetch(API_ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages:messages})
    })
    .then(function(r){ isRequesting=false; if(!r.ok) throw new Error('AI请求失败:'+r.status); return r.json(); })
    .then(function(data){
      if(data.choices&&data.choices[0]&&data.choices[0].message){
        var c=data.choices[0].message.content;
        var m=c.match(/\{[\s\S]*\}/);
        if(m){try{var r=JSON.parse(m[0]);callback({success:true,data:{word:word,translation:r.translation||'',phonetic:r.phonetic||'',pos:r.pos||'',roots:r.roots||[],memory:r.memory||'',example:r.example||null}});}catch(e){callback({success:false,error:'AI格式错误'});}}
        else callback({success:false,error:'AI返回无法解析'});
      } else callback({success:false,error:'AI返回异常'});
    })
    .catch(function(e){ isRequesting=false; callback({success:false,error:e.message}); });
  }

  return { enhanceWord:enhanceWord, callDeepSeek:callDeepSeek };
})();
