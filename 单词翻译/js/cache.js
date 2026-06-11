var CacheManager = (function() {
  var L1_CACHE = new Map();
  var L1_EXPIRE = 30 * 60 * 1000;
  var L1_MAX_SIZE = 100;

  var HISTORY_KEY = 'word_translator_history';
  var FAVORITES_KEY = 'word_translator_favorites';
  var CACHE_KEY = 'word_translator_cache';
  var MAX_HISTORY = 50;
  var MAX_CACHE = 200;

  function isExpired(timestamp) {
    return Date.now() - timestamp > L1_EXPIRE;
  }

  function cleanL1() {
    if (L1_CACHE.size >= L1_MAX_SIZE) {
      var firstKey = L1_CACHE.keys().next().value;
      L1_CACHE.delete(firstKey);
    }
  }

  function setL1(word, data) {
    cleanL1();
    L1_CACHE.set(word.toLowerCase(), {
      data: data,
      timestamp: Date.now()
    });
  }

  function getL1(word) {
    var entry = L1_CACHE.get(word.toLowerCase());
    if (!entry) return null;
    if (isExpired(entry.timestamp)) {
      L1_CACHE.delete(word.toLowerCase());
      return null;
    }
    return entry.data;
  }

  function setL2Cache(word, data) {
    try {
      var cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      cache[word.toLowerCase()] = {
        data: data,
        timestamp: Date.now()
      };
      var keys = Object.keys(cache);
      if (keys.length > MAX_CACHE) {
        var sortedKeys = keys.sort(function(a, b) {
          return cache[b].timestamp - cache[a].timestamp;
        });
        for (var i = MAX_CACHE; i < sortedKeys.length; i++) {
          delete cache[sortedKeys[i]];
        }
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('L2 cache error:', e);
    }
  }

  function getL2Cache(word) {
    try {
      var cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      var entry = cache[word.toLowerCase()];
      if (!entry) return null;
      if (isExpired(entry.timestamp)) {
        delete cache[word.toLowerCase()];
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        return null;
      }
      return entry.data;
    } catch (e) {
      return null;
    }
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function addHistory(word) {
    var history = getHistory();
    var filtered = history.filter(function(item) {
      return item.toLowerCase() !== word.toLowerCase();
    });
    filtered.unshift(word);
    if (filtered.length > MAX_HISTORY) {
      filtered = filtered.slice(0, MAX_HISTORY);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  function clearCache() {
    L1_CACHE.clear();
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (e) {
      console.warn('Clear L2 cache error:', e);
    }
  }

  function getCacheStats() {
    var l2Count = 0;
    try {
      var cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      l2Count = Object.keys(cache).length;
    } catch (e) {}
    return {
      l1: L1_CACHE.size,
      l2: l2Count
    };
  }

  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function isFavorite(word) {
    var favorites = getFavorites();
    return favorites.some(function(item) {
      return item.toLowerCase() === word.toLowerCase();
    });
  }

  function addFavorite(wordData) {
    var favorites = getFavorites();
    var filtered = favorites.filter(function(item) {
      return item.word.toLowerCase() !== wordData.word.toLowerCase();
    });
    filtered.unshift(wordData);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  }

  function removeFavorite(word) {
    var favorites = getFavorites();
    var filtered = favorites.filter(function(item) {
      return item.word.toLowerCase() !== word.toLowerCase();
    });
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  }

  function exportFavorites(format) {
    var favorites = getFavorites();
    if (format === 'txt') {
      var txt = favorites.map(function(item) {
        return item.word + '\t' + item.phonetic + '\t' + item.pos + '\t' + item.translation;
      }).join('\n');
      return '单词\t音标\t词性\t释义\n' + txt;
    } else {
      return JSON.stringify(favorites, null, 2);
    }
  }

  function query(word, localDictLookup) {
    var w = word.toLowerCase().trim();

    var cached = getL1(w);
    if (cached) {
      return { source: 'L1', data: cached };
    }

    cached = getL2Cache(w);
    if (cached) {
      setL1(w, cached);
      return { source: 'L2', data: cached };
    }

    var localData = localDictLookup(w);
    if (localData) {
      setL1(w, localData);
      setL2Cache(w, localData);
      return { source: 'L3', data: localData };
    }

    return { source: 'L4', data: null };
  }

  function queryWithOnline(word, localDictLookup, callback) {
    var w = word.toLowerCase().trim();

    var cached = getL1(w);
    if (cached) {
      return { source: 'L1', data: cached };
    }

    cached = getL2Cache(w);
    if (cached) {
      setL1(w, cached);
      return { source: 'L2', data: cached };
    }

    var localData = localDictLookup(w);
    if (localData) {
      setL1(w, localData);
      setL2Cache(w, localData);
      return { source: 'L3', data: localData };
    }

    if (callback) {
      TranslationAPI.translate(word, function(result) {
        if (result.success && result.data) {
          setL1(w, result.data);
          setL2Cache(w, result.data);
          callback({ source: 'L4', data: result.data });
        } else {
          callback({ source: 'L4', data: null, error: result.error });
        }
      });
    }

    return { source: 'L4', data: null, async: !!callback };
  }

  function saveToCache(word, data) {
    var w = word.toLowerCase().trim();
    setL1(w, data);
    setL2Cache(w, data);
  }

  return {
    query: query,
    queryWithOnline: queryWithOnline,
    saveToCache: saveToCache,
    clearCache: clearCache,
    getCacheStats: getCacheStats,
    getHistory: getHistory,
    addHistory: addHistory,
    clearHistory: clearHistory,
    getFavorites: getFavorites,
    isFavorite: isFavorite,
    addFavorite: addFavorite,
    removeFavorite: removeFavorite,
    exportFavorites: exportFavorites
  };
})();