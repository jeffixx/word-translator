import http.server
import urllib.request
import json
import sys
import os

PORT = int(os.environ.get("PORT", 8080))
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self._serve_static('index.html', 'text/html; charset=utf-8')
        elif self.path.startswith('/css/'):
            self._serve_static(self.path[1:], 'text/css; charset=utf-8')
        elif self.path.startswith('/js/'):
            self._serve_static(self.path[1:], 'application/javascript; charset=utf-8')
        elif self.path.startswith('/freedict/'):
            word = self.path[len('/freedict/'):]
            url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + urllib.request.quote(word)
            self._proxy(url)
        elif self.path.startswith('/mymemory/'):
            word = self.path[len('/mymemory/'):]
            url = 'https://api.mymemory.translated.net/get?q=' + urllib.request.quote(word) + '&langpair=en|zh-CN'
            self._proxy(url)
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/llm':
            self._handle_llm()
        else:
            self.send_error(404)

    def _serve_static(self, filename, content_type):
        try:
            with open(filename, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self.send_error(404)

    def _proxy(self, url):
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

    def _handle_llm(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        try:
            request_data = json.loads(body)
        except json.JSONDecodeError:
            self._send_json_error(400, 'Invalid JSON')
            return

        if not DEEPSEEK_API_KEY:
            self._send_json_error(500, 'DeepSeek API Key not configured')
            return

        messages = request_data.get('messages', [])
        if not messages:
            self._send_json_error(400, 'Missing messages')
            return

        deepseek_url = 'https://api.deepseek.com/chat/completions'
        payload = json.dumps({
            'model': 'deepseek-chat',
            'messages': messages,
            'temperature': 0.7,
            'max_tokens': 500
        }).encode('utf-8')

        try:
            req = urllib.request.Request(
                deepseek_url,
                data=payload,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
                    'User-Agent': 'Mozilla/5.0'
                }
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            error_body = e.read() if e.fp else b''
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(error_body)
        except Exception as e:
            self._send_json_error(500, str(e))

    def _send_json_error(self, code, message):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({'error': message}).encode('utf-8'))

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
    print('翻译代理已启动: http://0.0.0.0:' + str(PORT))
    print('  /freedict/<word>  - Free Dictionary API')
    print('  /mymemory/<word>  - MyMemory翻译API')
    print('  /llm              - DeepSeek LLM API')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
