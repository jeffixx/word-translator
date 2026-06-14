var TranslationAPI = (function() {
  var PROXY_BASE = 'https://word-translator-production.up.railway.app';

  var FREEDICT_DIRECT = 'https://api.dictionaryapi.dev/api/v2/entries/en';
  var MYMEMORY_DIRECT = 'https://api.mymemory.translated.net/get';

  var useProxy = true;

  function fetchFreeDict(word, callback) {
    var directUrl = FREEDICT_DIRECT + '/' + encodeURIComponent(word);
    var proxyUrl = PROXY_BASE + '/freedict/' + encodeURIComponent(word);
    var url = useProxy ? proxyUrl : directUrl;

    console.log('[API] Free Dictionary 请求:', url);

    fetch(url)
      .then(function(response) {
        console.log('[API] Free Dictionary 状态:', response.status);
        if (!response.ok) {
          throw new Error('请求失败: ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        if (Array.isArray(data) && data.length > 0) {
          var entry = data[0];
          var result = {
            word: entry.word || word,
            phonetic: '',
            pos: '',
            level: '',
            roots: [],
            memory: '',
            example: null
          };

          if (entry.phonetic) {
            result.phonetic = entry.phonetic;
          } else if (entry.phonetics && entry.phonetics.length > 0) {
            var phoneticWithText = entry.phonetics.find(function(p) { return p.text; });
            if (phoneticWithText) {
              result.phonetic = phoneticWithText.text;
            }
          }

          if (entry.meanings && entry.meanings.length > 0) {
            var meaning = entry.meanings[0];
            result.pos = meaning.partOfSpeech ? meaning.partOfSpeech + '.' : '';

            if (meaning.definitions && meaning.definitions.length > 0) {
              result.enDefinition = meaning.definitions[0].definition;

              if (meaning.definitions[0].example) {
                result.example = {
                  en: meaning.definitions[0].example,
                  cn: ''
                };
              }
            }
          }

          console.log('[API] Free Dictionary 结果:', result.phonetic, result.pos, result.example ? '有例句' : '无例句');
          callback({ success: true, data: result });
        } else {
          console.log('[API] Free Dictionary: 未找到单词');
          callback({ success: false, error: '未找到单词' });
        }
      })
      .catch(function(error) {
        console.log('[API] Free Dictionary 错误:', error.message);
        if (useProxy) {
          useProxy = false;
          console.log('[API] 切换到直连模式');
          fetchFreeDict(word, callback);
        } else {
          callback({ success: false, error: error.message });
        }
      });
  }

  function fetchMyMemory(word, callback) {
    var directUrl = MYMEMORY_DIRECT + '?q=' + encodeURIComponent(word) + '&langpair=en|zh-CN';
    var proxyUrl = PROXY_BASE + '/mymemory/' + encodeURIComponent(word);
    var url = useProxy ? proxyUrl : directUrl;

    console.log('[API] MyMemory 请求:', url);

    fetch(url)
      .then(function(response) {
        console.log('[API] MyMemory 状态:', response.status);
        if (!response.ok) {
          throw new Error('请求失败: ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        if (data.responseStatus === 200 && data.responseData) {
          console.log('[API] MyMemory 翻译:', data.responseData.translatedText);
          callback({
            success: true,
            data: {
              translation: data.responseData.translatedText || '未找到翻译'
            }
          });
        } else {
          callback({ success: false, error: '翻译失败' });
        }
      })
      .catch(function(error) {
        console.log('[API] MyMemory 错误:', error.message);
        if (useProxy) {
          useProxy = false;
          console.log('[API] 切换到直连模式');
          fetchMyMemory(word, callback);
        } else {
          callback({ success: false, error: error.message });
        }
      });
  }

  function translate(word, callback) {
    console.log('[API] 开始翻译:', word);

    var finalResult = {
      word: word,
      translation: '',
      phonetic: '',
      pos: '',
      level: '',
      roots: [],
      memory: '',
      example: null
    };

    var completedCount = 0;
    var totalRequests = 2;

    function checkComplete() {
      completedCount++;
      if (completedCount >= totalRequests) {
        console.log('[API] 合并结果:', JSON.stringify({
          word: finalResult.word,
          phonetic: finalResult.phonetic,
          pos: finalResult.pos,
          translation: finalResult.translation,
          example: finalResult.example
        }));
        if (finalResult.translation) {
          callback({ success: true, data: finalResult });
        } else {
          callback({ success: false, error: '无法获取翻译结果' });
        }
      }
    }

    fetchFreeDict(word, function(result) {
      if (result.success && result.data) {
        finalResult.phonetic = result.data.phonetic || finalResult.phonetic;
        finalResult.pos = result.data.pos || finalResult.pos;
        if (result.data.enDefinition) {
          finalResult.enDefinition = result.data.enDefinition;
        }
        if (result.data.example) {
          finalResult.example = result.data.example;
        }
      }
      checkComplete();
    });

    fetchMyMemory(word, function(result) {
      if (result.success && result.data) {
        finalResult.translation = result.data.translation || finalResult.translation;
      }
      checkComplete();
    });
  }

  return {
    translate: translate,
    isConfigured: function() { return true; },
    showConfigModal: function() {
      alert('使用免费在线翻译服务：\n\n1. Free Dictionary API - 提供音标、词性、英文释义、例句\n2. MyMemory API - 提供中文翻译\n\n完全免费，无需配置API密钥！');
    },
    getConfig: function() { return { provider: 'combined' }; }
  };
})();
