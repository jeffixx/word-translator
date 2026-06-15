var LLMService = (function() {
  var API_ENDPOINT = '/llm';
  var isRequesting = false;

  // ========== 本地记忆策略（普通翻译用）==========

  // 词根词缀表
  var COMMON_ROOTS = {
    'un-': '不，否定', 'pre-': '前，预先', 'dis-': '不，相反',
    're-': '再，重新', 'in-': '不，向内', 'im-': '不，向内',
    'ex-': '出，外', 'sub-': '下，次', 'super-': '超，上',
    'inter-': '之间，相互', 'trans-': '跨越，转变', 'mis-': '错误，坏',
    'over-': '过度，在上', 'under-': '不足，在下', 'anti-': '反对，防止',
    'auto-': '自己，自动', 'bi-': '二，双', 'co-': '共同，一起',
    'de-': '向下，去除', 'multi-': '多', 'non-': '非，不',
    'out-': '超过，外', 'post-': '后', 'semi-': '半',
    'tele-': '远', 'micro-': '微小', 'macro-': '宏大',
    '-able': '能够...的', '-ible': '能够...的',
    '-tion': '名词后缀', '-sion': '名词后缀',
    '-ment': '名词后缀', '-ness': '名词后缀',
    '-er': '名词后缀', '-or': '名词后缀', '-ist': '名词后缀',
    '-ful': '形容词后缀', '-less': '形容词后缀',
    '-ous': '形容词后缀', '-ive': '形容词后缀', '-al': '形容词后缀',
    '-ly': '副词后缀', '-ize': '动词后缀', '-ify': '动词后缀', '-en': '动词后缀',
    'act': '行动，做', 'aud': '听', 'cap': '拿，取',
    'ced': '走，让步', 'cept': '拿，取', 'clud': '关闭',
    'cogn': '知道', 'cred': '相信', 'cur': '跑，发生',
    'dict': '说，言', 'duc': '引导，带来', 'fac': '做，制作',
    'fer': '带来，携带', 'fin': '结束，界限', 'form': '形状，形式',
    'gen': '产生，种类', 'graph': '写，画', 'ject': '投掷',
    'lect': '选择，收集', 'loc': '地方', 'log': '言语，学科',
    'mit': '发送', 'mov': '移动', 'nat': '出生',
    'oper': '工作，运作', 'pend': '悬挂，称重', 'port': '携带，运输',
    'pos': '放置', 'scrib': '写', 'sect': '切割',
    'sent': '感觉', 'sign': '标记', 'spect': '看',
    'struct': '建造', 'tract': '拉，拖', 'vac': '空',
    'val': '价值，强壮', 'vis': '看', 'vit': '生命',
    'nov': '新', 'vent': '来', 'voc': '声音，喊叫'
  };

  // 分析词根词缀
  function analyzeRoots(word) {
    var roots = [];
    var w = word.toLowerCase();
    var prefixes = ['un-', 'pre-', 'dis-', 're-', 'in-', 'im-', 'ex-', 'sub-', 'super-', 'inter-', 'trans-', 'mis-', 'over-', 'under-', 'anti-', 'auto-', 'co-', 'de-', 'multi-', 'non-', 'out-', 'post-', 'semi-', 'tele-', 'micro-', 'macro-', 'bi-'];
    for (var i = 0; i < prefixes.length; i++) {
      var prefix = prefixes[i];
      var prefixText = prefix.slice(0, -1);
      if (w.startsWith(prefixText) && w.length > prefixText.length + 2) {
        roots.push({ part: prefix, meaning: COMMON_ROOTS[prefix] });
        w = w.slice(prefixText.length);
        break;
      }
    }
    var suffixes = ['-tion', '-sion', '-ment', '-ness', '-able', '-ible', '-ful', '-less', '-ous', '-ive', '-al', '-ize', '-ify', '-en', '-er', '-or', '-ist', '-ly'];
    for (var i = 0; i < suffixes.length; i++) {
      var suffix = suffixes[i];
      var suffixText = suffix.slice(1);
      if (w.endsWith(suffixText) && w.length > suffixText.length + 2) {
        roots.push({ part: suffix, meaning: COMMON_ROOTS[suffix] });
        w = w.slice(0, -suffixText.length);
        break;
      }
    }
    var rootKeys = ['struct', 'spect', 'scrib', 'cept', 'clud', 'tract', 'ject', 'lect', 'cogn', 'cred', 'dict', 'duc', 'graph', 'oper', 'pend', 'port', 'sect', 'sent', 'sign', 'form', 'gen', 'mit', 'mov', 'nat', 'vac', 'val', 'vis', 'vit', 'act', 'aud', 'cap', 'ced', 'cur', 'fac', 'fer', 'fin', 'loc', 'log', 'pos', 'nov', 'vent', 'voc'];
    for (var i = 0; i < rootKeys.length; i++) {
      var root = rootKeys[i];
      if (w.includes(root)) {
        roots.push({ part: root, meaning: COMMON_ROOTS[root] });
        break;
      }
    }
    return roots;
  }

  // 拆分记忆（长词按音节拆分）
  function splitMemory(word, translation) {
    var w = word.toLowerCase();
    var parts = [];
    var prefix = '';
    var suffix = '';
    var middle = w;
    var prefixPatterns = ['con', 'com', 'pro', 'per', 'sur', 'sup', 'des', 'dec', 'rec', 'red', 'sub', 'tra', 'tri', 'bio', 'geo', 'phy', 'psy', 'neo', 'arc', 'inno'];
    for (var i = 0; i < prefixPatterns.length; i++) {
      if (middle.startsWith(prefixPatterns[i]) && middle.length > prefixPatterns[i].length + 3) {
        prefix = prefixPatterns[i];
        middle = middle.slice(prefix.length);
        break;
      }
    }
    var suffixPatterns = ['tion', 'sion', 'ment', 'ness', 'ance', 'ence', 'able', 'ible', 'ful', 'less', 'ous', 'ive', 'ial', 'ical', 'ize', 'ise', 'ify', 'ate', 'ent', 'ant', 'ary', 'ery', 'ory', 'ing'];
    for (var i = 0; i < suffixPatterns.length; i++) {
      if (middle.endsWith(suffixPatterns[i]) && middle.length > suffixPatterns[i].length + 2) {
        suffix = suffixPatterns[i];
        middle = middle.slice(0, -suffix.length);
        break;
      }
    }
    if (prefix) parts.push({ part: prefix, meaning: '前缀' });
    if (middle) parts.push({ part: middle, meaning: '词根' });
    if (suffix) parts.push({ part: suffix, meaning: '后缀' });
    if (parts.length > 1) {
      return {
        type: 'split',
        roots: parts,
        memory: parts.map(function(p) { return p.part; }).join(' + ') + ' → ' + translation
      };
    }
    return null;
  }

  // 混合记忆策略
  function generateMemory(data) {
    var word = data.word.toLowerCase().trim();
    var translation = data.translation || '';

    // 优先级1：已有词根词缀（来自本地词库）
    if (data.roots && data.roots.length > 0) {
      if (!data.memory) {
        var memoryParts = data.roots.map(function(r) {
          return r.part + '(' + r.meaning + ')';
        }).join('+');
        data.memory = memoryParts + '→' + translation;
      }
      data.memoryType = 'roots';
      return data;
    }

    // 优先级2：词根词缀分析
    var roots = analyzeRoots(word);
    if (roots.length > 0) {
      data.roots = roots;
      if (!data.memory) {
        var memoryParts = roots.map(function(r) {
          return r.part + '(' + r.meaning + ')';
        }).join('+');
        data.memory = memoryParts + '→' + translation;
      }
      data.memoryType = 'roots';
      return data;
    }

    // 优先级3：拆分记忆（长词>4字母）
    if (word.length > 4) {
      var split = splitMemory(word, translation);
      if (split) {
        data.roots = split.roots;
        data.memory = split.memory;
        data.memoryType = 'split';
        return data;
      }
    }

    // 优先级4：基础词汇提示
    data.roots = [];
    data.memory = '基础词汇，建议整体记忆';
    data.memoryType = 'basic';
    return data;
  }

  // 生成例句模板
  function generateExample(translation, pos) {
    var templates = {
      'v.': [
        'It is important to {meaning} in daily life.',
        'Learning to {meaning} requires patience.',
        'You should {meaning} when facing challenges.'
      ],
      'n.': [
        'The {meaning} is essential for development.',
        'A good {meaning} contributes to success.',
        'Understanding {meaning} helps us grow.'
      ],
      'adj.': [
        'This is a {meaning} approach to the problem.',
        'Being {meaning} is a valuable quality.',
        'The {meaning} solution impressed everyone.'
      ],
      'adv.': [
        'She acted {meaning} in the situation.',
        'The task was completed {meaning}.',
        'He {meaning} achieved his goals.'
      ]
    };
    var posTemplates = templates[pos] || templates['n.'];
    var template = posTemplates[Math.floor(Math.random() * posTemplates.length)];
    var meaning = translation.split('，')[0].split('；')[0].split('、')[0];
    return {
      en: template.replace('{meaning}', meaning),
      cn: '...（涉及' + meaning + '）'
    };
  }

  // ========== 普通翻译增强（本地策略）==========

  function enhanceWord(data, callback) {
    setTimeout(function() {
      console.log('[LLM] enhanceWord 输入:', data.word, 'roots:', data.roots ? data.roots.length : 0, 'example:', data.example ? 'yes' : 'no');

      // 使用混合记忆策略生成词根词缀
      data = generateMemory(data);

      // 生成例句（如果没有）
      if (!data.example || !data.example.cn || data.example.cn === '') {
        data.example = generateExample(data.translation, data.pos);
      }

      console.log('[LLM] enhanceWord 输出:', JSON.stringify({
        memoryType: data.memoryType, roots: data.roots.length,
        memory: data.memory, example: data.example ? 'yes' : 'no'
      }));

      callback(data);
    }, 100);
  }

  // ========== AI 翻译（调用大模型）==========

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
    enhanceWord: enhanceWord,
    callDeepSeek: callDeepSeek,
    isRequesting: function() { return isRequesting; }
  };
})();
