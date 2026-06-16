(function() {
  var clipboardEnabled = true;
  var lastClipboard = '';
  var clipboardInterval = null;

  var elements = {
    wordInput: document.getElementById('word-input'),
    searchBtn: document.getElementById('search-btn'),
    aiTranslateBtn: document.getElementById('ai-translate-btn'),
    clearBtn: document.getElementById('clear-btn'),
    clearCacheBtn: document.getElementById('clear-cache-btn'),
    clipboardCheck: document.getElementById('clipboard-check'),
    cardSection: document.getElementById('card-section'),
    cardWord: document.getElementById('card-word'),
    cardPhonetic: document.getElementById('card-phonetic'),
    cardPos: document.getElementById('card-pos'),
    cardMeaning: document.getElementById('card-meaning'),
    cardLevel: document.getElementById('card-level'),
    cardRoots: document.getElementById('card-roots'),
    rootsContent: document.getElementById('roots-content'),
    cardExample: document.getElementById('card-example'),
    exampleContent: document.getElementById('example-content'),
    favBtn: document.getElementById('fav-btn'),
    sourceTag: document.getElementById('source-tag'),
    dictCount: document.getElementById('dict-count'),
    historyList: document.getElementById('history-list'),
    historyPanel: document.getElementById('history-panel'),
    historyToggle: document.getElementById('history-toggle'),
    clearHistory: document.getElementById('clear-history'),
    favList: document.getElementById('fav-list'),
    favPanel: document.getElementById('fav-panel'),
    favToggle: document.getElementById('fav-toggle'),
    exportTxt: document.getElementById('export-txt'),
    exportJson: document.getElementById('export-json'),
    toast: document.getElementById('toast')
  };

  var currentWord = '';
  var currentData = null;

  function init() {
    try { elements.dictCount.textContent = getDictCount() + ' 词'; } catch(e) { console.warn('getDictCount error:', e); }
    renderHistory();
    renderFavorites();
    bindEvents();
    startClipboardWatch();
  }

  function bindEvents() {
    elements.searchBtn.addEventListener('click', search);
    if (elements.aiTranslateBtn) {
      elements.aiTranslateBtn.addEventListener('click', aiTranslate);
    }
    elements.clearBtn.addEventListener('click', clearInput);
    elements.clearCacheBtn.addEventListener('click', clearCacheHandler);
    elements.wordInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') search();
    });
    elements.clipboardCheck.addEventListener('change', function() {
      clipboardEnabled = this.checked;
      if (clipboardEnabled) startClipboardWatch(); else stopClipboardWatch();
    });
    elements.favBtn.addEventListener('click', toggleFavorite);
    elements.historyToggle.addEventListener('click', toggleHistory);
    elements.clearHistory.addEventListener('click', clearHistoryHandler);
    elements.favToggle.addEventListener('click', toggleFavorites);
    elements.exportTxt.addEventListener('click', function() { exportFavorites('txt'); });
    elements.exportJson.addEventListener('click', function() { exportFavorites('json'); });
  }

  function startClipboardWatch() {
    if (clipboardInterval) return;
    clipboardInterval = setInterval(checkClipboard, 1000);
  }

  function stopClipboardWatch() {
    if (clipboardInterval) { clearInterval(clipboardInterval); clipboardInterval = null; }
  }

  function checkClipboard() {
    if (!clipboardEnabled) return;
    navigator.clipboard.readText().then(function(text) {
      var cleaned = text.trim().toLowerCase().replace(/[^a-z]/g, '');
      if (cleaned && cleaned !== lastClipboard && cleaned.length < 30) {
        lastClipboard = cleaned;
        if (/^[a-z]{2,}$/.test(cleaned)) { elements.wordInput.value = cleaned; search(); }
      }
    }).catch(function() {});
  }

  function search() {
    var word = elements.wordInput.value.trim();
    if (!word) return;
    currentWord = word;
    var result = CacheManager.queryWithOnline(word, lookupLocalDict, function(asyncResult) {
      if (asyncResult.data) {
        LLMService.enhanceWord(asyncResult.data, function(enhancedData) {
          currentData = enhancedData;
          showCard(enhancedData, asyncResult.source);
          CacheManager.addHistory(word);
          CacheManager.saveToCache(word, enhancedData);
          renderHistory();
        });
      } else {
        showNotFound(word, asyncResult.error);
      }
    });
    if (result.async) { showLoading(word); return; }
    if (result.data) {
      LLMService.enhanceWord(result.data, function(enhancedData) {
        currentData = enhancedData;
        showCard(enhancedData, result.source);
        CacheManager.addHistory(word);
        CacheManager.saveToCache(word, enhancedData);
        renderHistory();
      });
    } else {
      showLoading(word);
    }
  }

  function aiTranslate() {
    var word = elements.wordInput.value.trim();
    if (!word) { showToast('请先输入单词'); return; }
    currentWord = word;
    showLoadingAI(word);
    LLMService.callDeepSeek(word, function(result) {
      if (result.success && result.data) {
        currentData = result.data;
        showCard(result.data, 'L4');
        CacheManager.addHistory(word);
        CacheManager.saveToCache(word, result.data);
        renderHistory();
        showToast('AI 翻译完成');
      } else {
        showNotFound(word, result.error || 'AI翻译失败');
      }
    });
  }

  function showLoading(word) {
    elements.cardSection.classList.remove('hidden');
    elements.cardWord.textContent = word;
    elements.cardPhonetic.textContent = '';
    elements.cardPos.textContent = '';
    elements.cardMeaning.textContent = '正在查询...';
    elements.cardLevel.style.display = 'none';
    elements.cardRoots.classList.add('hidden');
    elements.cardExample.classList.add('hidden');
    elements.sourceTag.textContent = '查询中';
    elements.sourceTag.className = 'source-tag';
  }

  function showLoadingAI(word) {
    elements.cardSection.classList.remove('hidden');
    elements.cardWord.textContent = word;
    elements.cardPhonetic.textContent = '';
    elements.cardPos.textContent = '';
    elements.cardMeaning.textContent = '🤖 AI 正在翻译...';
    elements.cardLevel.style.display = 'none';
    elements.cardRoots.classList.add('hidden');
    elements.cardExample.classList.add('hidden');
    elements.sourceTag.textContent = 'AI翻译中';
    elements.sourceTag.className = 'source-tag llm';
  }

  function showNotFound(word, error) {
    elements.cardSection.classList.remove('hidden');
    elements.cardWord.textContent = word;
    elements.cardPhonetic.textContent = '';
    elements.cardPos.textContent = '';
    elements.cardMeaning.textContent = error ? '翻译失败: '+error : '未找到该单词';
    elements.cardLevel.style.display = 'none';
    elements.cardRoots.classList.add('hidden');
    elements.cardExample.classList.add('hidden');
    elements.favBtn.textContent = '☆';
    elements.favBtn.classList.remove('on');
    elements.sourceTag.textContent = '未找到';
    elements.sourceTag.className = 'source-tag';
  }

  function showCard(data, source) {
    elements.cardSection.classList.remove('hidden');
    elements.cardWord.textContent = data.word;
    elements.cardPhonetic.textContent = data.phonetic || '';
    elements.cardPos.textContent = data.pos || '';
    elements.cardMeaning.textContent = data.translation;
    if (data.level) { elements.cardLevel.textContent = data.level; elements.cardLevel.style.display = ''; }
    else { elements.cardLevel.style.display = 'none'; }

    var mt = data.memoryType || 'roots';
    var st = mt==='roots'?'🧠 词根拆解':mt==='split'?'✂️ 拆分记忆':mt==='homophone'?'🔊 谐音记忆':mt==='basic'?'💡 记忆提示':'🧠 词根拆解';

    if (data.roots && data.roots.length > 0) {
      var h = '<div class="section-title">'+st+'</div><div class="roots-flow">';
      data.roots.forEach(function(r){ h+='<div class="root-item"><span class="root-part">'+r.part+'</span><span class="root-meaning">'+r.meaning+'</span></div>'; });
      h += '</div>';
      if (data.memory) h += '<div class="memory-tip">'+data.memory+'</div>';
      elements.rootsContent.innerHTML = h;
      elements.cardRoots.classList.remove('hidden');
    } else if (data.memory) {
      elements.rootsContent.innerHTML = '<div class="section-title">'+st+'</div><div class="memory-tip">'+data.memory+'</div>';
      elements.cardRoots.classList.remove('hidden');
    } else {
      elements.cardRoots.classList.add('hidden');
    }

    if (data.example) {
      elements.exampleContent.innerHTML = '<p class="example-en">'+data.example.en+'</p><p class="example-cn">'+data.example.cn+'</p>';
      elements.cardExample.classList.remove('hidden');
    } else {
      elements.cardExample.classList.add('hidden');
    }

    updateFavoriteBtn();
    var sm = {'L1':{text:'内存缓存',cls:'cache'},'L2':{text:'本地缓存',cls:'cache'},'L3':{text:'本地词库',cls:'local'},'L4':{text:'在线翻译',cls:'llm'}};
    var si = sm[source] || {text:'未知',cls:''};
    elements.sourceTag.textContent = si.text;
    elements.sourceTag.className = 'source-tag ' + si.cls;
  }

  function updateFavoriteBtn() {
    if (CacheManager.isFavorite(currentWord)) { elements.favBtn.textContent='★'; elements.favBtn.classList.add('on'); }
    else { elements.favBtn.textContent='☆'; elements.favBtn.classList.remove('on'); }
  }

  function toggleFavorite() {
    if (!currentData) return;
    if (CacheManager.isFavorite(currentWord)) { CacheManager.removeFavorite(currentWord); showToast('已取消收藏'); }
    else { CacheManager.addFavorite(currentData); showToast('已添加收藏'); }
    updateFavoriteBtn(); renderFavorites();
  }

  function clearInput() { elements.wordInput.value=''; elements.wordInput.focus(); }
  function toggleHistory() { elements.historyToggle.classList.toggle('collapsed'); elements.historyPanel.classList.toggle('collapsed'); }
  function toggleFavorites() { elements.favToggle.classList.toggle('collapsed'); elements.favPanel.classList.toggle('collapsed'); }
  function clearHistoryHandler() { CacheManager.clearHistory(); renderHistory(); showToast('历史记录已清空'); }

  function clearCacheHandler() {
    var stats = CacheManager.getCacheStats();
    var total = stats.l1 + stats.l2;
    if (total === 0) { showToast('缓存为空'); return; }
    var sw = currentWord, sd = currentData;
    CacheManager.clearCache();
    currentWord = sw; currentData = sd;
    if (sd) showCard(sd, 'L1');
    showToast('已清空 '+total+' 条缓存');
  }

  function renderHistory() {
    var history = CacheManager.getHistory();
    if (!history.length) { elements.historyList.innerHTML='<span class="empty-tip">暂无历史记录</span>'; return; }
    elements.historyList.innerHTML = history.map(function(w){return '<span class="tag-item" data-word="'+w+'">'+w+'</span>';}).join('');
    elements.historyList.querySelectorAll('.tag-item').forEach(function(el){
      el.addEventListener('click',function(){elements.wordInput.value=this.dataset.word;search();});
    });
  }

  function renderFavorites() {
    var favs = CacheManager.getFavorites();
    if (!favs.length) { elements.favList.innerHTML='<span class="empty-tip">暂无收藏</span>'; return; }
    elements.favList.innerHTML = favs.map(function(i){return '<span class="tag-item" data-word="'+i.word+'">'+i.word+'</span>';}).join('');
    elements.favList.querySelectorAll('.tag-item').forEach(function(el){
      el.addEventListener('click',function(){elements.wordInput.value=this.dataset.word;search();});
    });
  }

  function exportFavorites(format) {
    var content = CacheManager.exportFavorites(format);
    var filename = 'favorites.'+(format==='txt'?'txt':'json');
    var blob = new Blob([content],{type:format==='txt'?'text/plain':'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href=url; a.download=filename; a.click();
    URL.revokeObjectURL(url);
    showToast('已导出 '+filename);
  }

  function showToast(msg) {
    elements.toast.textContent = msg;
    elements.toast.classList.remove('hidden');
    setTimeout(function(){ elements.toast.classList.add('hidden'); }, 2000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
