/******************************************
 * 多电表版-网上国网🌏 
 *****************************************
 修改适配homeassistant，通过mqtt发送消息至homeassistant
 *****************************************
 环境变量设置
 export WSGW_USERNAME="" #网上国网账号（手机号）
 export WSGW_PASSWORD="" #网上国网密码
 export WSGW_RECENT_ELC_FEE="true" #是否获取最近电费
 export WSGW_mqtt_host="" #mqtt服务器地址 192.168.1.7
 export WSGW_mqtt_port="" #mqtt服务器端口 1883
 export WSGW_mqtt_username="" #mqtt服务器用户名
 export WSGW_mqtt_password="" #mqtt服务器密码
 # 新增：解决RK001超时配置
 export WSGW_REQUEST_TIMEOUT="10000" # 请求超时（毫秒，默认10s）
 export WSGW_HTTP_PROXY="" # Node.js代理（可选，格式：http://ip:端口）
 *****************************************
 * mqtt订阅主题：nodejs/state-grid/{用电户号}
 *****************************************
 脚本声明:
 1. 本脚本仅用于学习研究，禁止用于商业用途
 2. 本脚本不保证准确性、可靠性、完整性和及时性
 3. 任何个人或组织均可无需经过通知而自由使用
 4. 作者对任何脚本问题概不负责，包括由此产生的任何损失
 5. 如果任何单位或个人认为该脚本可能涉嫌侵犯其权利，应及时通知并提供身份证明、所有权证明，我将在收到认证文件确认后删除
 6. 请勿将本脚本用于商业用途，由此引起的问题与作者无关
 7. 本脚本及其更新版权归原作者所有，RK001超时修复基于原脚本优化
 *****************************************
 * 原作者 𝒀𝒖𝒉𝒆𝒏𝒈 https://github.com/Yuheng0101/X
 * 修复：网络连接超时（RK001）、请求头缺失、无重试机制等问题
 ******************************************/
const getEnv = () =>
  'undefined' != typeof $environment && $environment['surge-version']
    ? 'Surge'
    : 'undefined' != typeof $environment && $environment['stash-version']
      ? 'Stash'
      : eval('typeof process !== "undefined"')
        ? 'Node.js'
        : 'undefined' != typeof $task
          ? 'Quantumult X'
          : 'undefined' != typeof $loon
            ? 'Loon'
            : 'undefined' != typeof $rocket
              ? 'Shadowrocket'
              : void 0,
  isSurge = () => 'Surge' === getEnv(),
  isLoon = () => 'Loon' === getEnv(),
  isStash = () => 'Stash' === getEnv(),
  isNode = () => 'Node.js' === getEnv();

/******************************************
 * 全局配置：解决RK001超时核心
 *****************************************/
const REQUEST_TIMEOUT = isNode() ? (process.env.WSGW_REQUEST_TIMEOUT || 10000) : 10000; // 全局请求超时10s
const RETRY_TIMES = 3; // 核心接口重试次数
const RETRY_INTERVAL = 1000; // 重试间隔1s
const HTTP_PROXY = isNode() ? process.env.WSGW_HTTP_PROXY : ''; // Node.js代理配置

class Logger {
  constructor(e = '日志输出', o = 'info') {
    (this.prefix = e),
      (this.levels = ['trace', 'debug', 'info', 'warn', 'error']),
      this.setLevel(o);
  }
  setLevel(e) {
    this.currentLevelIndex = this.levels.indexOf(e);
  }
  log(e, ...o) {
    this.levels.indexOf(e) >= this.currentLevelIndex &&
      console.log(
        `${this.prefix ? `[${this.prefix}] ` : ''}[${e.toUpperCase()}]\n` +
        [...o].join('\n')
      );
  }
  trace(...e) {
    this.log('trace', ...e);
  }
  debug(...e) {
    this.log('debug', ...e);
  }
  info(...e) {
    this.log('info', ...e);
  }
  warn(...e) {
    this.log('warn', ...e);
  }
  error(...e) {
    this.log('error', ...e);
  }
}

/******************************************
 * 修复：网络请求函数（补充请求头+超时+代理，解决RK001）
 *****************************************/
const request$1 = async (request = {} || '', option = {}) => {
  switch (request.constructor) {
    case Object:
      request = { ...request, ...option };
      break;
    case String:
      request = { url: request, ...option };
  }
  // 基础配置：默认GET、超时、禁止缓存
  request.method || ((request.method = 'GET'), (request.body ?? request.bodyBytes) && (request.method = 'POST'));
  request.timeout = request.timeout || REQUEST_TIMEOUT;
  delete request.headers?.['Content-Length'], delete request.headers?.['content-length'];
  
  // 补充：网上国网必选请求头（接口校验必备，解决RK001核心原因）
  request.headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://www.95598.cn',
    'Referer': 'https://www.95598.cn/95598/web/pages/login/login.html',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Connection': 'keep-alive',
    ...request.headers
  };
  
  const method = request.method.toLocaleLowerCase();
  switch (getEnv()) {
    case 'Loon':
    case 'Surge':
    case 'Stash':
    case 'Shadowrocket':
    default:
      return (
        delete request.id,
        request.policy && (isLoon() && (request.node = request.policy), isStash() && (request.headers || (request.headers = {}), (request.headers['X-Stash-Selected-Proxy'] = encodeURI(request.policy)))),
        ArrayBuffer.isView(request.body) && (request['binary-mode'] = !0),
        isSurge() && (request.timeout = Number(request.timeout) / 1e3),
        await new Promise((e, o) => {
          $httpClient[method](request, (r, s, n) => {
            r ? o(r) : ((s.ok = /^2\d\d$/.test(s.status)), (s.statusCode = s.status), n && ((s.body = n), 1 == request['binary-mode'] && (s.bodyBytes = n)), e(s));
          });
        })
      );
    case 'Quantumult X':
      switch ((request?.headers?.['Content-Type'] ?? request?.headers?.['content-type'])?.split(';')?.[0]) {
        default: delete request.bodyBytes; break;
        case 'application/protobuf': case 'application/x-protobuf': case 'application/vnd.google.protobuf': case 'application/grpc': case 'application/grpc+proto': case 'application/octet-stream':
          delete request.body, ArrayBuffer.isView(request.bodyBytes) && (request.bodyBytes = request.bodyBytes.buffer.slice(request.bodyBytes.byteOffset, request.bodyBytes.byteLength + request.bodyBytes.byteOffset));
        case void 0:
      }
      return await Promise.race([
        $task.fetch(request).then(e => ((e.ok = /^2\d\d$/.test(e.statusCode)), (e.status = e.statusCode), e), e => Promise.reject(e.error)),
        new Promise((e, o) => setTimeout(o, request.timeout, `超时(${request.timeout}ms)：RK001`)),
      ]);
    case 'Node.js':
      const got = eval('require("got")');
      let iconv = eval('require("iconv-lite")');
      const { url: url, ...option } = request;
      // 新增：Node.js代理配置+DNS超时+重试
      const gotOptions = {
        ...option,
        timeout: { request: Number(request.timeout) },
        dnsLookupTimeout: 5000, // DNS解析超时5s
        retry: { limit: 0 }, // 交给自定义重试函数处理
        headers: request.headers
      };
      // 代理配置生效
      if (HTTP_PROXY) gotOptions.proxy = HTTP_PROXY;
      return await got[method](url, gotOptions).then(
        e => ((e.statusCode = e.status), (e.body = iconv.decode(e.rawBody, request?.encoding || 'utf-8')), (e.bodyBytes = e.rawBody), e),
        e => {
          if (e.response && 500 === e.response.statusCode) return Promise.reject(e.response.body);
          Promise.reject(e.message || `网络连接超时（RK001）`);
        }
      );
  }
};

class Store {
  constructor(NAMESPACE) {
    if (
      ((this.env = getEnv()),
        (this.Store = './store'),
        NAMESPACE && (this.Store = `./store/${NAMESPACE}`),
        'Node.js' === this.env)
    ) {
      const { LocalStorage: LocalStorage } = eval(
        'require("node-localstorage")'
      );
      this.localStorage = new LocalStorage(this.Store);
    }
  }
  get(e) {
    switch (this.env) {
      case 'Surge':
      case 'Loon':
      case 'Stash':
      case 'Shadowrocket':
        return $persistentStore.read(e);
      case 'Quantumult X':
        return $prefs.valueForKey(e);
      case 'Node.js':
        return this.localStorage.getItem(e);
      default:
        return null;
    }
  }
  set(e, o) {
    switch (this.env) {
      case 'Surge':
      case 'Loon':
      case 'Stash':
      case 'Shadowrocket':
        return $persistentStore.write(o, e);
      case 'Quantumult X':
        return $prefs.setValueForKey(o, e);
      case 'Node.js':
        return this.localStorage.setItem(e, o), !0;
      default:
        return null;
    }
  }
  clear(e) {
    switch (this.env) {
      case 'Surge':
      case 'Loon':
      case 'Stash':
      case 'Shadowrocket':
        return $persistentStore.write(null, e);
      case 'Quantumult X':
        return $prefs.removeValueForKey(e);
      case 'Node.js':
        return this.localStorage.removeItem(e), !0;
      default:
        return null;
    }
  }
}

const notify = (e = '', o = '', r = '', s = {}) => {
  const n = e => {
    const { $open: o, $copy: r, $media: s, $mediaMime: n } = e;
    switch (typeof e) {
      case void 0:
        return e;
      case 'string':
        switch (getEnv()) {
          case 'Surge':
          case 'Stash':
          default:
            return { url: e };
          case 'Loon':
          case 'Shadowrocket':
            return e;
          case 'Quantumult X':
            return { 'open-url': e };
          case 'Node.js':
            return;
        }
      case 'object':
        switch (getEnv()) {
          case 'Surge':
          case 'Stash':
          case 'Shadowrocket':
          default: {
            const t = {};
            let c = e.openUrl || e.url || e['open-url'] || o;
            c && Object.assign(t, { action: 'open-url', url: c });
            let a = e['update-pasteboard'] || e.updatePasteboard || r;
            if (
              (a && Object.assign(t, { action: 'clipboard', text: a }), s)
            ) {
              let e, o, r;
              if (s.startsWith('http')) e = s;
              else if (s.startsWith('data:')) {
                const [e] = s.split(';'),
                  [, n] = s.split(',');
                (o = n), (r = e.replace('data:', ''));
              } else {
                (o = s),
                  (r = (e => {
                    const o = {
                      JVBERi0: 'application/pdf',
                      R0lGODdh: 'image/gif',
                      R0lGODlh: 'image/gif',
                      iVBORw0KGgo: 'image/png',
                      '/9j/': 'image/jpg',
                    };
                    for (var r in o) if (0 === e.indexOf(r)) return o[r];
                    return null;
                  })(s));
              }
              Object.assign(t, {
                'media-url': e,
                'media-base64': o,
                'media-base64-mime': n ?? r,
              });
            }
            return (
              Object.assign(t, {
                'auto-dismiss': e['auto-dismiss'],
                sound: e.sound,
              }),
              t
            );
          }
          case 'Loon': {
            const r = {};
            let n = e.openUrl || e.url || e['open-url'] || o;
            n && Object.assign(r, { openUrl: n });
            let t = e.mediaUrl || e['media-url'];
            return (
              s?.startsWith('http') && (t = s),
              t && Object.assign(r, { mediaUrl: t }),
              console.log(JSON.stringify(r)),
              r
            );
          }
          case 'Quantumult X': {
            const n = {};
            let t = e['open-url'] || e.url || e.openUrl || o;
            t && Object.assign(n, { 'open-url': t });
            let c = e['media-url'] || e.mediaUrl;
            s?.startsWith('http') && (c = s),
              c && Object.assign(n, { 'media-url': c });
            let a = e['update-pasteboard'] || e.updatePasteboard || r;
            return (
              a && Object.assign(n, { 'update-pasteboard': a }),
              console.log(JSON.stringify(n)),
              n
            );
          }
          case 'Node.js':
            return;
        }
      default:
        return;
    }
  };
  switch (getEnv()) {
    case 'Surge':
    case 'Loon':
    case 'Stash':
    case 'Shadowrocket':
    default:
      $notification.post(e, o, r, n(s));
      break;
    case 'Quantumult X':
      $notify(e, o, r, n(s));
    case 'Node.js':
  }
  let t = ['', '==============📣系统通知📣=============='];
  t.push(e), o && t.push(o), r && t.push(r), console.log(t.join('\n'));
};

const done = (e = {}) => {
  switch (getEnv()) {
    case 'Surge':
    case 'Loon':
    case 'Stash':
    case 'Shadowrocket':
    case 'Quantumult X':
    default:
      $done(e);
      break;
    case 'Node.js':
      process.exit(1);
  }
};

const SERVER_HOST = 'https://api.120399.xyz',
  BASE_URL = 'https://www.95598.cn',
  request = async e => {
    try {
      const o = {
        url: `${SERVER_HOST}/wsgw/encrypt`,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ yuheng: e }),
      };
      const r = await Encrypt(o);
      switch (e.url) {
        case '/api/oauth2/oauth/authorize':
          Object.assign(r, { body: r.body.replace(/^\"|\"$/g, '') });
          break;
        case '/api/oauth2/outer/getWebToken':
          o.headers['content-type'] = 'text/plain;charset=UTF-8';
      }
      let { body: s } = await request$1(r);
      try {
        s = JSON.parse(s);
      } catch { }
      if (
        s.code &&
        (10010 == s.code ||
          (10002 === s.code && 'WEB渠道KeyCode已失效' == s.message) ||
          30010 === s.code ||
          '20103' === s.code ||
          (10002 === s.code && bizrt.token && 'Token 为空！' == s.message))
      )
        return Promise.reject(s.message);
      const n = { config: { ...e }, data: s };
      if ('/api/oauth2/outer/c02/f02' === e.url)
        Object.assign(n.config, { headers: { encryptKey: r.encryptKey } });
      const t = {
        url: `${SERVER_HOST}/wsgw/decrypt`,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ yuheng: n }),
      };
      return await Decrypt(t);
    } catch (e) {
      return Promise.reject(e);
    }
  },
  Encrypt = async e =>
    request$1(e).then(({ body: e }) => {
      try {
        e = JSON.parse(e);
      } catch { }
      return (
        (e.data.url = BASE_URL + e.data.url),
        (e.data.body = JSON.stringify(e.data.data)),
        delete e.data.data,
        e.data
      );
    }),
  Decrypt = async e =>
    request$1(e).then(({ body: o }) => {
      let r = JSON.parse(o);
      const { code: s, message: n, data: t } = r.data;
      return '' + s == '1'
        ? t
        : e.url.indexOf('oauth2/oauth/authorize') > -1 &&
          t &&
          s &&
          '' != s &&
          (10015 === s ||
            10108 === s ||
            10009 === s ||
            10207 === s ||
            10005 === s ||
            10010 === s ||
            30010 === s ||
            (10002 === s && 'WEB渠道KeyCode已失效' == n) ||
            (10002 === s && bizrt.token && 'Token 为空！' == n))
          ? Promise.reject(`重新获取: ${n}`)
          : Promise.reject(n);
    }),
  Recoginze = async e => {
    const o = {
      url: `${SERVER_HOST}/wsgw/get_x`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ yuheng: e }),
    };
    return request$1(o).then(({ body: e }) => JSON.parse(e));
  },
  getBeforeDate = e => {
    const o = new Date();
    o.setDate(o.getDate() - e);
    return `${o.getFullYear()}-${String(o.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(o.getDate()).padStart(2, '0')}`;
  },
  jsonParse = e => {
    try {
      return JSON.parse(e);
    } catch {
      return e;
    }
  },
  jsonStr = (e, ...o) => {
    if ('string' == typeof e) return e;
    try {
      return JSON.stringify(e, ...o);
    } catch {
      return e;
    }
  },
  isTrue = e => !0 === e || 'true' === e || 1 === e || '1' === e,
  // 新增：请求重试函数（解决RK001超时）
  retryRequest = async (fn, times = RETRY_TIMES, interval = RETRY_INTERVAL) => {
    let error;
    for (let i = 0; i < times; i++) {
      try {
        return await fn();
      } catch (err) {
        error = err;
        log.warn(`请求失败，第${i+1}次重试，原因：${err}`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    return Promise.reject(error);
  };

// 接口地址配置
const $api = {
  getKeyCode: '/oauth2/outer/c02/f02',
  getAuth: '/oauth2/oauth/authorize',
  getWebToken: '/oauth2/outer/getWebToken',
  searchUser: '/osg-open-uc0001/member/c9/f02',
  accapi: '/osg-open-bc0001/member/c05/f01',
  busInfoApi: '/osg-web0004/member/c24/f01',
  loginVerifyCodeNew: '/osg-web0004/open/c44/f05',
  loginTestCodeNew: '/osg-web0004/open/c44/f06'
};

// 系统配置
const $configuration = {
  uscInfo: {
    member: '0902',
    devciceIp: '',
    devciceId: '',
    tenant: 'state_grid',
  },
  source: 'SGAPP',
  target: '32101',
  channelCode: '0902',
  userInform: { serviceCode: '0101183', source: 'SGAPP' },
  getday: {
    channelCode: '0902',
    clearCache: '11',
    funcCode: 'WEBALIPAY_01',
    promotCode: '1',
    promotType: '1',
    serviceCode: 'BCP_000026',
    source: 'app',
  },
  mouthOut: {
    channelCode: '0902',
    clearCache: '11',
    funcCode: 'WEBALIPAY_01',
    promotCode: '1',
    promotType: '1',
    serviceCode: 'BCP_000026',
    source: 'app',
  },
  account: { channelCode: '0902', funcCode: 'WEBA1007200' }
};

// 全局变量初始化
const SCRIPTNAME = '网上国网',
  NAMESPACE = 'ONZ3V',
  store = new Store(NAMESPACE),
  Global =
    'undefined' != typeof globalThis
      ? globalThis
      : 'undefined' != typeof window
        ? window
        : 'undefined' != typeof global
          ? global
          : 'undefined' != typeof self
            ? self
            : {};
Global.bizrt = jsonParse(store.get('95598_bizrt')) || {};
const log = new Logger(
  SCRIPTNAME,
  isTrue(isNode() ? process.env.WSGW_LOG_DEBUG : store.get('95598_log_debug'))
    ? 'debug'
    : 'info'
);
// 环境变量读取
const USERNAME =
  (isNode() ? process.env.WSGW_USERNAME : store.get('95598_username')) || '',
  PASSWORD =
    (isNode() ? process.env.WSGW_PASSWORD : store.get('95598_password')) || '',
  SHOW_RECENT = isTrue(
    isNode()
      ? process.env.WSGW_RECENT_ELC_FEE
      : store.get('95598_recent_elc_fee')
  );

// 业务函数：获取KeyCode
async function getKeyCode() {
  console.log('⏳ 获取keyCode和publicKey...');
  try {
    const res = await retryRequest(async () => {
      const e = { url: `/api${$api.getKeyCode}`, method: 'post', headers: {} };
      return await request(e);
    });
    Global.requestKey = res;
    if (!Global.requestKey) throw new Error('requestKey为空');
    log.info('✅ 获取keyCode和publicKey成功'),
    log.debug(`🔑 keyCode&publicKey: ${jsonStr(Global.requestKey, null, 2)}`);
  } catch (e) {
    return Promise.reject(`获取keyCode和PublicKey失败: ${e}`);
  } finally {
    console.log('🔚 获取keyCode和publicKey结束');
  }
}

// 业务函数：获取验证码
async function getVerifyCode() {
  console.log('⏳ 获取验证码...');
  try {
    if (!Global.requestKey) throw new Error('requestKey未初始化，请重新获取');
    const res = await retryRequest(async () => {
      const e = {
        url: `/api${$api.loginVerifyCodeNew}`,
        method: 'post',
        data: { password: PASSWORD, account: USERNAME, canvasHeight: 200, canvasWidth: 310 },
        headers: { ...Global.requestKey },
      };
      return await request(e);
    });
    log.info('✅ 获取验证码凭证成功'), log.debug(`🔑 验证码凭证: ${res.ticket}`);
    const { data: r } = await Recoginze(res.canvasSrc);
    return (log.info('✅ 识别验证码成功'), log.debug(`🔑 验证码: ${r}`), { code: r, ticket: res.ticket });
  } catch (e) {
    return Promise.reject('获取验证码失败: ' + e);
  } finally {
    console.log('🔚 获取验证码结束');
  }
}

// 业务函数：登录
async function login(e, o) {
  console.log('⏳ 登录中...');
  try {
    if (!Global.requestKey) throw new Error('requestKey未初始化，请重新获取');
    const res = await retryRequest(async () => {
      const r = {
        url: `/api${$api.loginTestCodeNew}`,
        method: 'post',
        headers: { ...Global.requestKey },
        data: {
          loginKey: e, code: o,
          params: {
            uscInfo: { devciceIp: '', tenant: 'state_grid', member: '0902', devciceId: '' },
            quInfo: { optSys: 'android', pushId: '000000', addressProvince: '110100', password: PASSWORD, addressRegion: '110101', account: USERNAME, addressCity: '330100' },
          },
          Channels: 'web',
        },
      };
      return await request(r);
    });
    const { bizrt: s } = res;
    if (!(s?.userInfo?.length > 0)) return Promise.reject('登录失败: 请检查信息填写是否正确! ');
    store.set('95598_bizrt', jsonStr(s)), (Global.bizrt = s),
    log.info('✅ 登录成功'),
    log.debug(`🔑 用户凭证: ${s.token}`, `👤 用户信息: ${s.userInfo[0].nickname || s.userInfo[0].loginAccount}`);
  } catch (e) {
    return /验证错误/.test(e)
      ? (log.error(`滑块验证出错, 重新登录: ${e}`), await doLogin())
      : Promise.reject(`登陆失败: ${e}`);
  } finally {
    console.log('🔚 登录结束');
  }
}

// 业务函数：获取授权码
async function getAuthcode() {
  console.log('⏳ 获取授权码...');
  try {
    const e = {
      url: `/api${$api.getAuth}`,
      method: 'post',
      headers: { ...Global.requestKey, token: Global.bizrt.token },
    };
    const { redirect_url: o } = await request(e);
    (Global.authorizecode = o.split('?code=')[1]),
      log.info('✅ 获取授权码成功'),
      log.debug(`🔑 授权码: ${Global.authorizecode}`);
  } catch (e) {
    return Promise.reject(`获取授权码失败: ${e}`);
  } finally {
    console.log('🔚 获取授权码结束');
  }
}

// 业务函数：获取AccessToken
async function getAccessToken() {
  console.log('⏳ 获取凭证...');
  try {
    const e = {
      url: `/api${$api.getWebToken}`,
      method: 'post',
      headers: {
        ...Global.requestKey,
        token: Global.bizrt.token,
        authorizecode: Global.authorizecode,
      },
    };
    (Global.accessToken = await request(e).then(e => e.access_token)),
      log.info('✅ 获取凭证成功'),
      log.debug(`🔑 AccessToken: ${Global.accessToken}`);
  } catch (e) {
    return Promise.reject(`获取凭证失败: ${e}`);
  } finally {
    console.log('🔚 获取凭证结束');
  }
}

// 业务函数：获取绑定信息
async function getBindInfo() {
  console.log('⏳ 查询绑定信息...');
  try {
    const e = {
      url: `/api${$api.searchUser}`,
      method: 'post',
      headers: { ...Global.requestKey, token: Global.bizrt.token, acctoken: Global.accessToken },
      data: {
        serviceCode: $configuration.userInform.serviceCode,
        source: $configuration.source,
        target: $configuration.target,
        uscInfo: $configuration.uscInfo,
        quInfo: { userId: Global.bizrt.userInfo[0].userId },
        token: Global.bizrt.token,
        Channels: 'web',
      },
    };
    (Global.bindInfo = await request(e).then(e => e.bizrt)),
      log.info('✅ 获取绑定信息成功'),
      log.debug(`🔑 用户绑定信息: ${jsonStr(Global.bindInfo, null, 2)}`);
  } catch (e) {
    return Promise.reject(`获取绑定信息失败: ${e}`);
  } finally {
    console.log('🔚 查询绑定信息结束');
  }
}

// 业务函数：查询电费
async function getElcFee(e) {
  console.log('⏳ 查询电费...');
  try {
    const o = Global.bindInfo.powerUserList[e],
      [r] = Global.bizrt.userInfo,
      s = {
        url: `/api${$api.accapi}`,
        method: 'post',
        headers: { ...Global.requestKey, token: Global.bizrt.token, acctoken: Global.accessToken },
        data: {
          data: {
            srvCode: '',
            serialNo: '',
            channelCode: $configuration.account.channelCode,
            funcCode: $configuration.account.funcCode,
            acctId: r.userId,
            userName: r.loginAccount ? r.loginAccount : r.nickname,
            promotType: '1',
            promotCode: '1',
            userAccountId: r.userId,
            list: [
              {
                consNoSrc: o.consNo_dst,
                proCode: o.proNo,
                sceneType: o.constType,
                consNo: o.consNo,
                orgNo: o.orgNo,
              },
            ],
          },
          serviceCode: '0101143',
          source: $configuration.source,
          target: o.proNo || o.provinceId,
        },
      };
    (Global.eleBill = await request(s).then(e => e.list[0])),
      log.info('✅ 查询电费成功'),
      log.debug(`🔑 电费信息: ${jsonStr(Global.eleBill, null, 2)}`);
  } catch (e) {
    return Promise.reject(`查询电费失败: ${e}`);
  } finally {
    console.log('🔚 查询电费结束');
  }
}

// 业务函数：获取日用电量
async function getDayElecQuantity(e) {
  console.log('⏳ 获取日用电量...');
  try {
    const o = Global.bindInfo.powerUserList[e],
      [r] = Global.bizrt.userInfo,
      s = getBeforeDate(8),
      n = getBeforeDate(1),
      t = {
        url: `/api${$api.busInfoApi}`,
        method: 'post',
        headers: { ...Global.requestKey, token: Global.bizrt.token, acctoken: Global.accessToken },
        data: {
          params1: {
            serviceCode: $configuration.userInform.serviceCode,
            source: $configuration.source,
            target: $configuration.target,
            uscInfo: $configuration.uscInfo,
            quInfo: { userId: r.userId },
            token: Global.bizrt.token,
          },
          params3: {
            data: {
              acctId: r.userId,
              consNo: o.consNo_dst,
              consType: '02' == o.constType ? '02' : '01',
              endTime: n,
              orgNo: o.orgNo,
              queryYear: new Date().getFullYear().toString(),
              proCode: o.proNo || o.provinceId,
              serialNo: '',
              srvCode: '',
              startTime: s,
              userName: r.nickname ? r.nickname : r.loginAccount,
              funcCode: $configuration.getday.funcCode,
              channelCode: $configuration.getday.channelCode,
              clearCache: $configuration.getday.clearCache,
              promotCode: $configuration.getday.promotCode,
              promotType: $configuration.getday.promotType,
            },
            serviceCode: $configuration.getday.serviceCode,
            source: $configuration.getday.source,
            target: o.proNo || o.provinceId,
          },
          params4: '010103',
        },
      },
      c = await request(t);
    log.info('✅ 获取日用电量成功'),
      log.debug(jsonStr(c, null, 2)),
      (Global.dayElecQuantity = c);
  } catch (e) {
    return Promise.reject('获取日用电量失败: ' + e);
  } finally {
    console.log('🔚 获取日用电量结束');
  }
}

// 业务函数：获取月用电量
async function getMonthElecQuantity(e) {
  console.log('⏳ 获取月用电量...');
  const o = Global.bindInfo.powerUserList[e],
    [r] = Global.bizrt.userInfo;
  try {
    let queryYear = new Date().getFullYear().toString();
    let eReq = {
      url: `/api${$api.busInfoApi}`,
      method: 'post',
      headers: { ...Global.requestKey, token: Global.bizrt.token, acctoken: Global.accessToken },
      data: {
        params1: {
          serviceCode: $configuration.userInform.serviceCode,
          source: $configuration.source,
          target: $configuration.target,
          uscInfo: $configuration.uscInfo,
          quInfo: { userId: r.userId },
          token: Global.bizrt.token,
        },
        params3: {
          data: {
            acctId: r.userId,
            consNo: o.consNo_dst,
            consType: '02' == o.constType ? '02' : '01',
            orgNo: o.orgNo,
            proCode: o.proNo || o.provinceId,
            provinceCode: o.proNo || o.provinceId,
            queryYear: queryYear,
            serialNo: '',
            srvCode: '',
            userName: r.nickname ? r.nickname : r.loginAccount,
            funcCode: $configuration.mouthOut.funcCode,
            channelCode: $configuration.mouthOut.channelCode,
            clearCache: $configuration.mouthOut.clearCache,
            promotCode: $configuration.mouthOut.promotCode,
            promotType: $configuration.mouthOut.promotType,
          },
          serviceCode: $configuration.mouthOut.serviceCode,
          source: $configuration.mouthOut.source,
          target: o.proNo || o.provinceId,
        },
        params4: '010102',
      },
    };
    const s = await request(eReq);
    if (!s.mothEleList || s.mothEleList.length < 12) {
      queryYear = (new Date().getFullYear() - 1).toString();
      eReq.data.params3.data.queryYear = queryYear;
      const prevYearData = await request(eReq);
      let arr = s.mothEleList || []
      s.mothEleList = prevYearData.mothEleList.concat(arr);
    }
    log.info('✅ 获取月用电量成功'),
      log.debug(jsonStr(s, null, 2)),
      (Global.monthElecQuantity = s);
  } catch (e) {
    return Promise.reject(`获取月用电量失败: ${e}`);
  } finally {
    console.log('🔚 获取月用电量结束');
  }
}

// 登录入口
async function doLogin() {
  const { code: e, ticket: o } = await getVerifyCode();
  await login(o, e);
}

// 格式化日期
function formatDate(dateStr) {
  var year = dateStr.substring(0, 4);
  var month = dateStr.substring(4, 6);
  var day = dateStr.substring(6, 8);
  return year + '-' + month + (day ? '-' + day : '');
}

// 发送MQTT消息到HomeAssistant
async function sendMsg(e, eleBill, dayList, monthElecQuantity) {
  const host =
    (isNode() ? process.env.WSGW_mqtt_host : store.get('95598_mqtt_host')) || '',
    port =
      (isNode() ? process.env.WSGW_mqtt_port : store.get('95598_mqtt_port')) || '',
    mqtt_username = (isNode() ? process.env.WSGW_mqtt_username : store.get('95598_mqtt_username')) || '',
    mqtt_password = (isNode() ? process.env.WSGW_mqtt_password : store.get('95598_mqtt_password')) || '';

  if (!host || !port) {
    log.error('MQTT配置缺失，请检查WSGW_mqtt_host和WSGW_mqtt_port');
    return;
  }

  const mqtt = require('mqtt')
  const clientId = 'mqtt_qldocker_' + Math.random().toString(16).substr(2, 8)

  const connectUrl = `mqtt://${host}:${port}`
  const client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 5000,
    username: mqtt_username,
    password: mqtt_password,
    reconnectPeriod: 1000,
  })

  const topic = 'nodejs/state-grid/' + eleBill.consNo
  let data = eleBill;
  dayList = dayList.filter(val => {
    return val.dayElePq != '-'
  }).map(val => {
    val.day = formatDate(val.day)
    return val
  })
  let monthList = []
  if (monthElecQuantity.mothEleList) {
    monthList = monthElecQuantity.mothEleList.map(val => {
      val.month = formatDate(val.month)
      return val
    })
  }

  data.dayList = dayList;
  data.monthList = monthList;
  data.totalEleNum = monthElecQuantity?.dataInfo?.totalEleNum || 0;
  data.totalEleCost = monthElecQuantity?.dataInfo?.totalEleCost || 0;
  
  client.on('connect', () => {
    console.log('mqtt:Connected')
    client.publish(topic, JSON.stringify(data), { qos: 0, retain: true }, (error) => {
      if (error) {
        console.error('mqtt发布失败:', error)
      } else {
        console.log(`mqtt:Published to ${topic}`)
      }
    })
  })

  client.on('error', (error) => {
    console.error('mqtt连接失败:', error)
  })

  setTimeout(() => {
    client.end()
  }, 2000)

  await new Promise((resolve, reject) => {
    setTimeout(() => resolve("done!"), 2000)
  });
}

// 脚本主执行入口
(async () => {
  console.log('====================================');
  console.log('======= 网上国网-HA适配版 =======');
  console.log('====================================');
  // 检查账号密码
  if (!USERNAME || !PASSWORD)
    return sendMsg(
      SCRIPTNAME,
      '请先配置网上国网账号密码!',
      '检查环境变量/BoxJs配置',
      { 'open-url': 'http://boxjs.com/#/sub/add/https%3A%2F%2Fraw.bgithub.xyz%2FYuheng0101%2FX%2Fmain%2FTasks%2Fboxjs.json' }
    );
  // 核心流程：加重试+空值校验
  await retryRequest(getKeyCode);
  if (!(Global.bizrt?.token && Global.bizrt?.userInfo)) await retryRequest(doLogin);
  await retryRequest(getAuthcode);
  await retryRequest(getAccessToken);
  await retryRequest(getBindInfo);
  // 检查绑定户号
  if (!Global.bindInfo?.powerUserList || Global.bindInfo.powerUserList.length === 0)
    return sendMsg(SCRIPTNAME, '未绑定任何电表户号', '请在网上国网APP绑定户号后重试');
  // 遍历所有绑定户号
  for (let e = 0; e < Global.bindInfo.powerUserList.length; e++) {
    await retryRequest(() => getElcFee(e));
    await retryRequest(() => getDayElecQuantity(e));
    await retryRequest(() => getMonthElecQuantity(e));
    const o = Global.bindInfo.powerUserList[e],
      { dataInfo: r } = Global.monthElecQuantity,
      { sevenEleList: s, totalPq: n } = Global.dayElecQuantity,
      t = Number(Global.eleBill?.historyOwe || '0') > 0 || Number(Global.eleBill?.sumMoney || '0') < 0;
    let c = Math.abs(Global.eleBill?.sumMoney || '0');
    c = t ? `-${c}` : c;
    let a = '';
    Global.eleBill.totalPq && (a += `本期电量: ${Global.eleBill.totalPq}度`),
    Global.eleBill.sumMoney && (a += `  账户余额: ${c}元`),
    (a += `\n截至日期: ${Global.eleBill.date}`),
    r && r.totalEleNum && r.totalEleCost && (a += `\n年度用电: ${r.totalEleNum}度  累计花费: ${r.totalEleCost}元`),
    isTrue(SHOW_RECENT) || (Global.eleBill.dayNum ? (a += `\n预计可用: ${Global.eleBill.dayNum}天`) : Global.eleBill.prepayBal && (a += `\n预存电费: ${Global.eleBill.prepayBal}元`)),
    o.consNo_dst && (a += `\n户号信息: ${o.consNo_dst}${o.consName_dst ? `|${o.consName_dst}` : ''}`),
    o.orgName && (a += `\n供电单位: ${o.orgName}`),
    o.elecAddr_dst && (a += `\n用电地址: ${o.elecAddr_dst}`),
    n && (a += `\n五日用电: ${n}度`),
    isTrue(SHOW_RECENT) && s.forEach((e, o) => { Number(e.dayElePq) && (a += `\n${e.day}用电: ${e.dayElePq}度⚡`); }),
    // 发送MQTT
    await sendMsg(SCRIPTNAME, Global.eleBill, s, Global.monthElecQuantity);
  }
  console.log('====================================');
  console.log('========= 数据采集完成 =========');
  console.log('====================================');
})()
  .catch(e => {
    /无效|失效|过期|重新获取|请求异常|RK001/.test(e) && (store.clear('95598_bizrt'), console.log('✅ 清理缓存数据成功')),
    log.error(`执行失败: ${e}`);
    sendMsg(SCRIPTNAME, '脚本执行失败', `原因：${e}\n已自动清理缓存，可重试`);
  })
  .finally(done);
