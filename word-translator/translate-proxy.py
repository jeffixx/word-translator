import http.server
import urllib.request
import json
import os
import mimetypes

PORT = int(os.environ.get("PORT", 8080))
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")

# 前端文件所在目录（与 translate-proxy.py 同级）
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)))

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # API 代理路由
        if self.path.startswith('/freedict/'):
            word = self.path[len('/freedict/'):]
            url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + urllib.request.quote(word)
            self._proxy(url)
        elif self.path.startswith('/mymemory/'):
            word = self.path[len('/mymemory/'):]
            url = 'https://api.mymemory.translated.net/get?q=' + urllib.request.quote(word) + '&langpair=en|zh-CN'
            self._proxy(url)
        else:
            # 静态文件服务
            self._serve_static()

    def do_POST(self):
        if self.path == '/llm':
            self._handle_llm()
        else:
            self.send_error(404)

    def _serve_static(self):
        """提供前端静态文件"""
        path = self.path.split('?')[0]  # 去掉查询参数
        if path == '/':
            path = '/index.html'

        file_path = os.path.normpath(os.path.join(WEB_DIR, path.lstrip('/')))

        # 安全检查：防止目录遍历
        if not file_path.startswith(WEB_DIR):
            self.send_error(403)
            return

        if os.path.isfile(file_path):
            # 获取文件类型
            content_type, _ = mimetypes.guess_type(file_path)
            if content_type is None:
                content_type = 'application/octet-stream'

            with open(file_path, 'rb') as f:
                content = f.read()

            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(content))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_error(404)

    def _handle_llm(self):
        """DeepSeek AI 翻译代理"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, 'Empty body')
                return

            body = self.rfile.read(content_length)
            request_data = json.loads(body.decode('utf-8'))

            if not DEEPSEEK_API_KEY:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'DEEPSEEK_API_KEY not configured'}).encode())
                return

            req = urllib.request.Request(
                'https://api.deepseek.com/chat/completions',
                data=json.dumps(request_data).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
                }
            )

            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _proxy(self, url):
        """通用 API 代理"""
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(str(e).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', PORT), ProxyHandler)
    print('翻译代理已启动: http://127.0.0.1:' + str(PORT))
    print('  /freedict/<word>  - Free Dictionary API')
    print('  /mymemory/<word>  - MyMemory翻译API')
    print('  /llm              - DeepSeek AI翻译')
    print('  /                 - 前端页面')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
