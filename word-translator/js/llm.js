var LLMService = (function() {
  var API_ENDPOINT = '/llm';
  var isRequesting = false;

  // 调用 DeepSeek API（通过后端代理）
  function callDeepSeek(word, callback) {
    if (isRequesting) {
      callback({ success: false, error: '请求进行中，请稍候...' });
      return;
    }
    isRequesting = true;

    var prompt = '请为单词 "' + word + '" 提供以下信息，以JSON格式返回：\n' +
      '{\n' +
      '  "translation": "中文翻译（简洁准确）",\n' +
      '  "phonetic": "音标",\n' +
      '  "pos": "词性缩写（如 n./v./adj./adv.）",\n' +
      '  "roots": [{"part": "词根/词缀", "meaning": "含义"}],\n' +
      '  "memory": "记忆方法（词根拆解或谐音记忆，一句话）",\n' +
      '  "example": {"en": "英文例句", "cn": "中文翻译"}\n' +
      '}\n' +
      '要求：\n' +
      '1. roots 至少包含2-3个词根或词缀拆解\n' +
      '2. memory 用中文解释记忆逻辑\n' +
      '3. example 要贴近日常生活\n' +
      '4. 只返回 JSON，不要其他文字。';

    var messages = [
      { role: 'system', content: '你是一个英语单词学习助手，只返回JSON格式数据。' },
      { role: 'user', content: prompt }
    ];

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages })
    })
    .then(function(response) {
      isRequesting = false;
      if (!response.ok) {
        throw new Error('AI服务请求失败: ' + response.status);
      }
      return response.json();
    })
    .then(function(data) {
      if (data.choices && data.choices[0] && data.choices[0].message) {
        var content = data.choices[0].message.content;
        // 提取 JSON
        var jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            var result = JSON.parse(jsonMatch[0]);
            callback({
              success: true,
              data: {
                word: word,
                translation: result.translation || '',
                phonetic: result.phonetic || '',
                pos: result.pos || '',
                roots: result.roots || [],
                memory: result.memory || '',
                example: result.example || null,
                source: 'llm'
              }
            });
          } catch (e) {
            callback({ success: false, error: 'AI返回格式错误' });
          }
        } else {
          callback({ success: false, error: 'AI返回内容无法解析' });
        }
      } else {
        callback({ success: false, error: 'AI服务返回异常' });
      }
    })
    .catch(function(error) {
      isRequesting = false;
      console.error('[LLM] 请求错误:', error);
      callback({ success: false, error: error.message });
    });
  }

  return {
    callDeepSeek: callDeepSeek,
    isRequesting: function() { return isRequesting; }
  };
})();
