import http.server
import urllib.request
import json
import sys
import os

PORT = int(os.environ.get("PORT", 8080))

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

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', PORT), ProxyHandler)
    print('翻译代理已启动: http://0.0.0.0:' + str(PORT))
    print('  /freedict/<word>  - Free Dictionary API')
    print('  /mymemory/<word>  - MyMemory翻译API')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
