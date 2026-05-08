"""
Entry point for the PyInstaller .exe build.
Starts the FastAPI server and opens the browser automatically.
"""
import sys
import os
import time
import threading
import webbrowser

import uvicorn

PORT = 8000
URL  = f"http://localhost:{PORT}"


def _open_browser():
    """Wait for the server to be ready, then open the default browser."""
    for _ in range(30):          # try for up to 15 seconds
        time.sleep(0.5)
        try:
            import urllib.request
            urllib.request.urlopen(f"{URL}/api/stops", timeout=1)
            break
        except Exception:
            continue
    webbrowser.open(URL)


def _seed_data():
    """
    On first run copy the bundled starter data (routes, stops, hubs) into the
    writable data folder that lives next to the exe.  Skip if already present.
    """
    if not getattr(sys, "frozen", False):
        return

    exe_dir  = os.path.dirname(sys.executable)
    data_dir = os.path.join(exe_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    # _MEIPASS is the temp folder where PyInstaller unpacks bundled files
    seed_dir = os.path.join(sys._MEIPASS, "data_seed")
    if not os.path.isdir(seed_dir):
        return

    for fname in os.listdir(seed_dir):
        dest = os.path.join(data_dir, fname)
        if not os.path.exists(dest):
            import shutil
            shutil.copy2(os.path.join(seed_dir, fname), dest)


if __name__ == "__main__":
    _seed_data()

    print("=" * 48)
    print("  SunTran Transit Analysis Tool")
    print(f"  Starting server at {URL}")
    print("  Close this window to stop the app.")
    print("=" * 48)

    threading.Thread(target=_open_browser, daemon=True).start()

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=PORT,
        log_level="warning",
    )
