"""Static server with JavaScript module MIME types on Windows Python."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript",
                      ".mjs": "text/javascript", ".css": "text/css"}


ThreadingHTTPServer(("127.0.0.1", 8123), Handler).serve_forever()
