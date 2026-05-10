"""
Entry point for the PyInstaller .exe build.
Starts the FastAPI server and opens the browser automatically.
"""
import sys
import os
import time
import threading
import webbrowser
import mimetypes

import uvicorn

PORT = 8000
URL  = f"http://localhost:{PORT}"


def _open_browser():
    for _ in range(30):
        time.sleep(0.5)
        try:
            import urllib.request
            urllib.request.urlopen(f"{URL}/health", timeout=1)
            break
        except Exception:
            continue
    webbrowser.open(URL)


def _seed_data():
    if not getattr(sys, "frozen", False):
        return
    exe_dir  = os.path.dirname(sys.executable)
    data_dir = os.path.join(exe_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    seed_dir = os.path.join(sys._MEIPASS, "data_seed")
    if not os.path.isdir(seed_dir):
        return
    import shutil
    for entry in os.listdir(seed_dir):
        src  = os.path.join(seed_dir, entry)
        dest = os.path.join(data_dir, entry)
        if os.path.isdir(src):
            # Recursively seed subdirectories (e.g. otp_archive/),
            # only filling in files that don't already exist.
            for root, _dirs, files in os.walk(src):
                rel  = os.path.relpath(root, src)
                ddir = os.path.join(dest, rel) if rel != "." else dest
                os.makedirs(ddir, exist_ok=True)
                for f in files:
                    dfp = os.path.join(ddir, f)
                    if not os.path.exists(dfp):
                        shutil.copy2(os.path.join(root, f), dfp)
        else:
            if not os.path.exists(dest):
                shutil.copy2(src, dest)


if __name__ == "__main__":
    _seed_data()

    print("=" * 48, flush=True)
    print("  SunTran Transit Analysis Tool", flush=True)
    print(f"  Opening at {URL}", flush=True)
    print("  Close this window to stop.", flush=True)
    print("=" * 48, flush=True)

    threading.Thread(target=_open_browser, daemon=True).start()

    from main import app

    # When frozen, add middleware to FastAPI's own stack so it
    # intercepts requests before they hit the router.
    if getattr(sys, "frozen", False):
        static_dir = os.path.join(sys._MEIPASS, "static")
        print(f"  static_dir={static_dir}  exists={os.path.isdir(static_dir)}", flush=True)

        if os.path.isdir(static_dir):
            from starlette.middleware.base import BaseHTTPMiddleware
            from starlette.requests import Request
            from starlette.responses import FileResponse, Response

            _static_dir = static_dir  # capture in closure

            class SPAMiddleware(BaseHTTPMiddleware):
                async def dispatch(self, request: Request, call_next):
                    path = request.url.path

                    # API routes — pass straight through
                    if path.startswith("/api/") or path in ("/health", "/docs", "/openapi.json"):
                        return await call_next(request)

                    # Try real static file
                    rel = path.lstrip("/")
                    if rel:
                        fp = os.path.join(_static_dir, rel)
                        if os.path.isfile(fp):
                            return FileResponse(fp)

                    # SPA fallback
                    idx = os.path.join(_static_dir, "index.html")
                    if os.path.isfile(idx):
                        return FileResponse(idx)

                    return await call_next(request)

            app.add_middleware(SPAMiddleware)
            print("  SPAMiddleware added to FastAPI stack", flush=True)

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=PORT,
        log_level="warning",
    )
