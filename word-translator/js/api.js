var TranslationAPI = (function() {
  var PROXY_BASE = 'https://word-translator-production.up.railway.app';
  var FREEDICT_DIRECT = 'https://api.dictionaryapi.dev/api/v2/entries/en';
  var MYMEMORY_DIRECT = 'https://api.mymemory.translated.net/get';
  var useProxy = true;

  function cleanTranslation(text) {
    if (!text) return '';
    var cleaned = text.replace(/<[^>]+>/g, '');
    cleaned = cleaned.replace(/狗窝吧提供繁简体汉化服务/g, '');
    cleaned = cleaned.replace(/提供繁简体汉化服务/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  }

  function fetchFreeDict(word, callback) {
    var directUrl = FREEDICT_DIRECT + '/' + encodeURIComponent(word);
    var proxyUrl = PROXY_BASE + '/freedict/' + encodeURIComponent(word);
    var url = useProxy ? proxyUrl : directUrl;
    fetch(url)
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function(data) {
        if (Array.isArray(data) && data.length > 0) {
          var entry = data[0];
          var result = { word: entry.word||word, phonetic:'', pos:'', level:'', roots:[], memory:'', example:null };
          if (entry.phonetic) { result.phonetic = entry.phonetic; }
          else if (entry.phonetics && entry.phonetics.length > 0) {
            var p = entry.phonetics.find(function(x){return x.text;});
            if (p) result.phonetic = p.text;
          }
          if (entry.meanings && entry.meanings.length > 0) {
            var m = entry.meanings[0];
            result.pos = m.partOfSpeech ? m.partOfSpeech+'.' : '';
            if (m.definitions && m.definitions.length > 0) {
              result.enDefinition = m.definitions[0].definition;
              if (m.definitions[0].example) {
                result.example = { en: m.definitions[0].example, cn: '' };
              }
            }
          }
          callback({ success: true, data: result });
        } else {
          callback({ success: false, error: '未找到单词' });
        }
      })
      .catch(function(error) {
        if (useProxy) { useProxy = false; fetchFreeDict(word, callback); }
        else { callback({ success: false, error: error.message }); }
      });
  }

  function fetchMyMemory(word, callback) {
    var directUrl = MYMEMORY_DIRECT + '?q=' + encodeURIComponent(word) + '&langpair=en|zh-CN';
    var proxyUrl = PROXY_BASE + '/mymemory/' + encodeURIComponent(word);
    var url = useProxy ? proxyUrl : directUrl;
    fetch(url)
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function(data) {
        if (data.responseStatus === 200 && data.responseData) {
          var raw = data.responseData.translatedText || '未找到翻译';
          callback({ success: true, data: { translation: cleanTranslation(raw) } });
        } else {
          callback({ success: false, error: '翻译失败' });
        }
      })
      .catch(function(error) {
        if (useProxy) { useProxy = false; fetchMyMemory(word, callback); }
        else { callback({ success: false, error: error.message }); }
      });
  }

  function translate(word, callback) {
    var finalResult = { word:word, translation:'', phonetic:'', pos:'', level:'', roots:[], memory:'', example:null };
    var done = 0;
    function check() {
      done++;
      if (done >= 2) {
        if (finalResult.translation) callback({ success:true, data:finalResult });
        else callback({ success:false, error:'无法获取翻译结果' });
      }
    }
    fetchFreeDict(word, function(r) {
      if (r.success && r.data) {
        finalResult.phonetic = r.data.phonetic || finalResult.phonetic;
        finalResult.pos = r.data.pos || finalResult.pos;
        if (r.data.enDefinition) finalResult.enDefinition = r.data.enDefinition;
        if (r.data.example) finalResult.example = r.data.example;
      }
      check();
    });
    fetchMyMemory(word, function(r) {
      if (r.success && r.data) finalResult.translation = r.data.translation || finalResult.translation;
      check();
    });
  }

  return { translate: translate, isConfigured: function(){return true;} };
})();
