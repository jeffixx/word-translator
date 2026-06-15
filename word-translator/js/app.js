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
    elements.dictCount.textContent = getDictCount() + ' 词';
    renderHistory();
    renderFavorites();
    bindEvents();
    startClipboardWatch();
  }

  function bindEvents() {
    elements.searchBtn.addEventListener('click', search);
    elements.aiTranslateBtn.addEventListener('click', aiTranslate);
    elements.clearBtn.addEventListener('click', clearInput);
    elements.clearCacheBtn.addEventListener('click', clearCacheHandler);
    elements.wordInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') search();
    });
    elements.clipboardCheck.addEventListener('change', function() {
      clipboardEnabled = this.checked;
      if (clipboardEnabled) {
        startClipboardWatch();
      } else {
        stopClipboardWatch();
      }
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
    if (clipboardInterval) {
      clearInterval(clipboardInterval);
      clipboardInterval = null;
    }
  }

  function checkClipboard() {
    if (!clipboardEnabled) return;
    navigator.clipboard.readText().then(function(text) {
      var cleaned = text.trim().toLowerCase().replace(/[^a-z]/g, '');
      if (cleaned && cleaned !== lastClipboard && cleaned.length < 30) {
        lastClipboard = cleaned;
        var isWord = /^[a-z]{2,}$/.test(cleaned);
        if (isWord) {
          elements.wordInput.value = cleaned;
          search();
        }
      }
    }).catch(function() {});
  }

  // 普通翻译（本地 + 在线API）
  function search() {
    var word = elements.wordInput.value.trim();
    if (!word) return;
    currentWord = word;

    var result = CacheManager.queryWithOnline(word, lookupLocalDict, function(asyncResult) {
      if (asyncResult.data) {
        currentData = asyncResult.data;
        showCard(asyncResult.data, asyncResult.source);
        CacheManager.addHistory(word);
        CacheManager.saveToCache(word, asyncResult.data);
        renderHistory();
      } else {
        showNotFound(word, asyncResult.error);
      }
    });

    if (result.async) {
      showLoading(word);
      return;
    }

    if (result.data) {
      currentData = result.data;
      showCard(result.data, result.source);
      CacheManager.addHistory(word);
      CacheManager.saveToCache(word, result.data);
      renderHistory();
    } else {
      showLoading(word);
    }
  }

  // AI 翻译（手动触发，调用大模型）
  function aiTranslate() {
    var word = elements.wordInput.value.trim();
    if (!word) {
      showToast('请先输入单词');
      return;
    }
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
    var message = error ? '翻译失败: ' + error : '未找到该单词';
    elements.cardMeaning.textContent = message;
    elements.cardLevel.style.display = 'none';
    elements.cardRoots.classList.add('hidden');
    elements.cardExample.classList.add('hidden');
    elements.favBtn.textContent = '☆';
    elements.favBtn.classList.remove('on');
    elements.sourceTag.textContent = '未找到';
    elements.sourceTag.className = 'source-tag';
    if (!error) {
      showToast('未找到单词: ' + word);
    }
  }

  function showCard(data, source) {
    console.log('[APP] showCard:', JSON.stringify({
      word: data.word, phonetic: data.phonetic, pos: data.pos,
      translation: data.translation, roots: data.roots ? data.roots.length : 0,
      example: data.example, source: source
    }));
    elements.cardSection.classList.remove('hidden');
    elements.cardWord.textContent = data.word;
    elements.cardPhonetic.textContent = data.phonetic || '';
    elements.cardPos.textContent = data.pos || '';
    elements.cardMeaning.textContent = data.translation;
    if (data.level) {
      elements.cardLevel.textContent = data.level;
      elements.cardLevel.style.display = '';
    } else {
      elements.cardLevel.style.display = 'none';
    }

    var memoryType = data.memoryType || 'roots';
    var sectionTitle = '';
    if (memoryType === 'roots') {
      sectionTitle = '🧠 词根拆解';
    } else if (memoryType === 'split') {
      sectionTitle = '✂️ 拆分记忆';
    } else if (memoryType === 'homophone') {
      sectionTitle = '🔊 谐音记忆';
    } else if (memoryType === 'basic') {
      sectionTitle = '💡 记忆提示';
    } else {
      sectionTitle = '🧠 词根拆解';
    }

    if (data.roots && data.roots.length > 0) {
      var rootsHtml = '<div class="section-title">' + sectionTitle + '</div>';
      rootsHtml += '<div class="roots-flow">';
      data.roots.forEach(function(r) {
        rootsHtml += '<div class="root-item"><span class="root-part">' + r.part + '</span><span class="root-meaning">' + r.meaning + '</span></div>';
      });
      rootsHtml += '</div>';
      if (data.memory) {
        rootsHtml += '<div class="memory-tip">' + data.memory + '</div>';
      }
      elements.rootsContent.innerHTML = rootsHtml;
      elements.cardRoots.classList.remove('hidden');
    } else if (data.memory) {
      var memHtml = '<div class="section-title">' + sectionTitle + '</div>';
      memHtml += '<div class="memory-tip">' + data.memory + '</div>';
      elements.rootsContent.innerHTML = memHtml;
      elements.cardRoots.classList.remove('hidden');
    } else {
      elements.cardRoots.classList.add('hidden');
    }

    if (data.example) {
      elements.exampleContent.innerHTML = '<p class="example-en">' + data.example.en + '</p><p class="example-cn">' + data.example.cn + '</p>';
      elements.cardExample.classList.remove('hidden');
    } else {
      elements.cardExample.classList.add('hidden');
    }

    updateFavoriteBtn();
    updateSourceTag(source);
  }

  function updateFavoriteBtn() {
    if (CacheManager.isFavorite(currentWord)) {
      elements.favBtn.textContent = '★';
      elements.favBtn.classList.add('on');
    } else {
      elements.favBtn.textContent = '☆';
      elements.favBtn.classList.remove('on');
    }
  }

  function updateSourceTag(source) {
    var sourceMap = {
      'L1': { text: '内存缓存', class: 'cache' },
      'L2': { text: '本地缓存', class: 'cache' },
      'L3': { text: '本地词库', class: 'local' },
      'L4': { text: '在线翻译', class: 'llm' }
    };
    var info = sourceMap[source] || { text: '未知', class: '' };
    elements.sourceTag.textContent = info.text;
    elements.sourceTag.className = 'source-tag ' + info.class;
  }

  function toggleFavorite() {
    if (!currentData) return;
    if (CacheManager.isFavorite(currentWord)) {
      CacheManager.removeFavorite(currentWord);
      showToast('已取消收藏');
    } else {
      CacheManager.addFavorite(currentData);
      showToast('已添加收藏');
    }
    updateFavoriteBtn();
    renderFavorites();
  }

  function clearInput() {
    elements.wordInput.value = '';
    elements.wordInput.focus();
  }

  function toggleHistory() {
    elements.historyToggle.classList.toggle('collapsed');
    elements.historyPanel.classList.toggle('collapsed');
  }

  function toggleFavorites() {
    elements.favToggle.classList.toggle('collapsed');
    elements.favPanel.classList.toggle('collapsed');
  }

  function clearHistoryHandler() {
    CacheManager.clearHistory();
    renderHistory();
    showToast('历史记录已清空');
  }

  function clearCacheHandler() {
    var stats = CacheManager.getCacheStats();
    var total = stats.l1 + stats.l2;
    if (total === 0) {
      showToast('缓存为空，无需清空');
      return;
    }
    var savedCurrentWord = currentWord;
    var savedCurrentData = currentData;
    CacheManager.clearCache();
    currentWord = savedCurrentWord;
    currentData = savedCurrentData;
    if (savedCurrentData) {
      showCard(savedCurrentData, 'L1');
    }
    showToast('已清空 ' + total + ' 条临时翻译缓存');
  }

  function renderHistory() {
    var history = CacheManager.getHistory();
    if (history.length === 0) {
      elements.historyList.innerHTML = '<span class="empty-tip">暂无历史记录</span>';
      return;
    }
    elements.historyList.innerHTML = history.map(function(word) {
      return '<span class="tag-item" data-word="' + word + '">' + word + '</span>';
    }).join('');
    elements.historyList.querySelectorAll('.tag-item').forEach(function(el) {
      el.addEventListener('click', function() {
        elements.wordInput.value = this.dataset.word;
        search();
      });
    });
  }

  function renderFavorites() {
    var favorites = CacheManager.getFavorites();
    if (favorites.length === 0) {
      elements.favList.innerHTML = '<span class="empty-tip">暂无收藏</span>';
      return;
    }
    elements.favList.innerHTML = favorites.map(function(item) {
      return '<span class="tag-item" data-word="' + item.word + '">' + item.word + '</span>';
    }).join('');
    elements.favList.querySelectorAll('.tag-item').forEach(function(el) {
      el.addEventListener('click', function() {
        elements.wordInput.value = this.dataset.word;
        search();
      });
    });
  }

  function exportFavorites(format) {
    var content = CacheManager.exportFavorites(format);
    var filename = 'favorites.' + (format === 'txt' ? 'txt' : 'json');
    var blob = new Blob([content], { type: format === 'txt' ? 'text/plain' : 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出 ' + filename);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden');
    setTimeout(function() {
      elements.toast.classList.add('hidden');
    }, 2000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
