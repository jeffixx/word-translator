var LLMService = (function() {
  var API_ENDPOINT = '';
  var API_KEY = '';

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
    'val': '价值，强壮', 'vis': '看', 'vit': '生命'
  };

  // 谐音记忆表（常见短词）
  var HOMOPHONE_TIPS = {
    'abandon': '谐音"阿班等"→阿班等不到人→放弃',
    'about': '谐音"阿抱他"→跑去抱他→关于',
    'abuse': '谐音"阿Q死"→阿Q被虐待→滥用',
    'admit': '谐音"阿的密"→阿的密室→承认',
    'afraid': '谐音"阿福累的"→阿福累得害怕→害怕',
    'anger': '谐音"安哥"→安哥很生气→愤怒',
    'attack': '谐音"阿塔克"→阿塔克发动攻击→攻击',
    'avoid': '谐音"阿瓦伊"→阿瓦伊躲开了→避免',
    'bad': '谐音"败的"→打败了→坏的',
    'bear': '谐音"贝尔"→贝尔熊→熊/忍受',
    'beat': '谐音"逼他"→逼他认输→打败',
    'bomb': '谐音"砰"→爆炸声→炸弹',
    'boss': '谐音"抱死"→抱死老板大腿→老板',
    'bread': '谐音"不赖的"→不赖的面包→面包',
    'busy': '谐音"逼急"→逼急了很忙→忙碌',
    'cake': '谐音"凯克"→凯克吃蛋糕→蛋糕',
    'calm': '谐音"卡姆"→卡姆很冷静→冷静',
    'cheat': '谐音"欺他"→欺骗他→欺骗',
    'cool': '谐音"酷"→酷→凉爽的',
    'copy': '谐音"拷贝"→拷贝→复制',
    'dance': '谐音"当斯"→当斯跳舞→跳舞',
    'dead': '谐音"戴德"→戴德死了→死的',
    'deep': '谐音"迪普"→迪普很深→深的',
    'duty': '谐音"丢提"→丢提责任→责任',
    'evil': '谐音"伊维尔"→伊维尔邪恶→邪恶',
    'fail': '谐音"费尔"→费尔失败了→失败',
    'fate': '谐音"费特"→费特命运→命运',
    'fear': '谐音"菲尔"→菲尔害怕→害怕',
    'gene': '谐音"基因"→基因→基因',
    'gift': '谐音"给夫特"→给夫特礼物→礼物',
    'gold': '谐音"够的"→够的金子→金子',
    'golf': '谐音"高尔夫"→高尔夫→高尔夫',
    'good': '谐音"古德"→古德好的→好的',
    'hack': '谐音"哈克"→哈克砍→砍',
    'harm': '谐音"哈姆"→哈姆伤害→伤害',
    'hate': '谐音"海特"→海特讨厌→讨厌',
    'idea': '谐音"爱迪尔"→爱迪尔的想法→想法',
    'iron': '谐音"爱恩"→爱恩铁→铁',
    'jazz': '谐音"爵士"→爵士→爵士乐',
    'joke': '谐音"乔克"→乔克笑话→笑话',
    'kill': '谐音"基尔"→基尔杀→杀',
    'king': '谐音"金"→金国王→国王',
    'lack': '谐音"莱克"→莱克缺乏→缺乏',
    'lazy': '谐音"莱济"→莱济懒惰→懒惰的',
    'luck': '谐音"拉克"→拉克运气→运气',
    'mark': '谐音"马克"→马克标记→标记',
    'milk': '谐音"米尔克"→米尔克牛奶→牛奶',
    'murder': '谐音"默德"→默德谋杀→谋杀',
    'pain': '谐音"佩恩"→佩恩疼痛→疼痛',
    'pest': '谐音"拍死它"→拍死害虫→害虫',
    'pick': '谐音"皮克"→皮克挑选→挑选',
    'quit': '谐音"奎特"→奎特退出→退出',
    'race': '谐音"雷斯"→雷斯赛跑→赛跑',
    'rage': '谐音"雷吉"→雷吉愤怒→愤怒',
    'rich': '谐音"瑞奇"→瑞奇富有→富有的',
    'risk': '谐音"里斯克"→里斯克风险→风险',
    'rock': '谐音"罗克"→罗克岩石→岩石',
    'safe': '谐音"塞夫"→塞夫安全→安全的',
    'salt': '谐音"索尔特"→索尔特盐→盐',
    'shark': '谐音"沙克"→沙克鲨鱼→鲨鱼',
    'silk': '谐音"西尔克"→西尔克丝绸→丝绸',
    'tank': '谐音"坦克"→坦克→坦克',
    'taxi': '谐音"塔克西"→塔克西出租车→出租车',
    'test': '谐音"特斯特"→特斯特测试→测试',
    'tire': '谐音"泰尔"→泰尔轮胎→轮胎',
    'tool': '谐音"图尔"→图尔工具→工具',
    'tour': '谐音"图尔"→图尔旅行→旅行',
    'volt': '谐音"伏特"→伏特→伏特',
    'vote': '谐音"沃特"→沃特投票→投票',
    'wade': '谐音"韦德"→韦德涉水→涉水',
    'wave': '谐音"韦夫"→韦夫波浪→波浪',
    'zero': '谐音"泽罗"→泽罗零→零',
    'zone': '谐音"佐恩"→佐恩区域→区域',
    'zoom': '谐音"祖姆"→祖姆缩放→缩放'
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

    var rootKeys = ['struct', 'spect', 'scrib', 'cept', 'clud', 'tract', 'ject', 'lect', 'cogn', 'cred', 'dict', 'duc', 'graph', 'oper', 'pend', 'port', 'sect', 'sent', 'sign', 'form', 'gen', 'mit', 'mov', 'nat', 'vac', 'val', 'vis', 'vit', 'act', 'aud', 'cap', 'ced', 'cur', 'fac', 'fer', 'fin', 'loc', 'log', 'pos'];
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

    var prefixPatterns = ['con', 'com', 'pro', 'per', 'sur', 'sup', 'des', 'dec', 'rec', 'red', 'sub', 'tra', 'tri', 'bio', 'geo', 'phy', 'psy', 'neo', 'arc'];
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

  // 谐音记忆
  function homophoneMemory(word, translation) {
    var w = word.toLowerCase().trim();
    if (HOMOPHONE_TIPS[w]) {
      return {
        type: 'homophone',
        memory: HOMOPHONE_TIPS[w],
        roots: []
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

    // 优先级4：谐音记忆（短词≤6字母）
    if (word.length <= 6) {
      var homo = homophoneMemory(word, translation);
      if (homo) {
        data.memory = homo.memory;
        data.roots = [];
        data.memoryType = 'homophone';
        return data;
      }
    }

    // 优先级5：基础词汇提示
    data.roots = [];
    data.memory = '基础词汇，建议整体记忆';
    data.memoryType = 'basic';
    return data;
  }

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
    return template.replace('{meaning}', translation.split('，')[0].split('；')[0]);
  }

  function enhanceWord(data, callback) {
    setTimeout(function() {
      console.log('[LLM] enhanceWord 输入:', data.word, 'roots:', data.roots ? data.roots.length : 0, 'example:', data.example ? 'yes' : 'no');

      // 使用混合记忆策略
      data = generateMemory(data);

      // 生成例句
      if (!data.example) {
        data.example = {
          en: generateExample(data.translation, data.pos),
          cn: data.translation + '的例句'
        };
      }

      console.log('[LLM] enhanceWord 输出:', JSON.stringify({
        memoryType: data.memoryType, roots: data.roots.length,
        memory: data.memory, example: data.example ? 'yes' : 'no'
      }));

      callback(data);
    }, 100);
  }

  function translateWithLLM(word, callback) {
    callback({
      word: word,
      translation: '正在开发中...',
      phonetic: '',
      pos: '',
      level: '',
      source: 'llm'
    });
  }

  return {
    enhanceWord: enhanceWord,
    translateWithLLM: translateWithLLM,
    isConfigured: function() {
      return API_ENDPOINT !== '' && API_KEY !== '';
    }
  };
})();