#!/usr/bin/env python3
"""Serve Planner locally so you can install it on your iPhone."""

import http.server
import socket
import socketserver
import os
import sys

PORT = 8080
DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()

if __name__ == "__main__":
    os.chdir(DIR)
    ip = get_local_ip()
    print()
    print("  Planner is running!")
    print(f"  On your iPhone (same Wi-Fi), open Safari and go to:")
    print(f"  http://{ip}:{PORT}")
    print()
    print("  Then tap Share → Add to Home Screen")
    print("  Allow notifications when prompted.")
    print()
    print("  Press Ctrl+C to stop.")
    print()

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
            sys.exit(0)
