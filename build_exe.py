"""
Build script — creates a standalone SunTran executable.

Usage:
    python build_exe.py

Requirements (install once):
    pip install pyinstaller
    npm must be available in PATH (Node.js installed)

Output:
    dist/SunTran/          — folder containing the exe + all dependencies
    dist/SunTran/SunTran   — the executable (SunTran.exe on Windows)
    dist/SunTran/data/     — created on first run with starter data
    dist/SunTran/static/   — bundled React app
"""

import os
import sys
import shutil
import subprocess

ROOT    = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
FRONTEND = os.path.join(ROOT, "frontend")
STATIC_DEST = os.path.join(BACKEND, "static")
DIST    = os.path.join(ROOT, "dist", "SunTran")


def run(cmd, cwd=None):
    print(f"\n>>> {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd)
    if result.returncode != 0:
        print(f"\nERROR: command failed with exit code {result.returncode}")
        sys.exit(1)


def main():
    print("=" * 52)
    print("  SunTran Executable Builder")
    print("=" * 52)

    # ── 1. Build the React frontend ──────────────────────
    print("\n[1/3] Building React frontend...")
    run(["npm", "install"], cwd=FRONTEND)
    run(["npm", "run", "build"], cwd=FRONTEND)

    # Copy the Vite build output into backend/static so PyInstaller can find it
    vite_dist = os.path.join(FRONTEND, "dist")
    if not os.path.isdir(vite_dist):
        print("ERROR: frontend/dist not found after build.")
        sys.exit(1)

    if os.path.exists(STATIC_DEST):
        shutil.rmtree(STATIC_DEST)
    shutil.copytree(vite_dist, STATIC_DEST)
    print(f"  Copied build to {STATIC_DEST}")

    # ── 2. Run PyInstaller ───────────────────────────────
    print("\n[2/3] Packaging with PyInstaller...")
    spec = os.path.join(BACKEND, "suntran.spec")
    run([sys.executable, "-m", "PyInstaller", spec, "--clean", "--noconfirm"],
        cwd=ROOT)

    # ── 3. Clean up temp files ───────────────────────────
    print("\n[3/3] Cleaning up...")
    build_dir = os.path.join(ROOT, "build")
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
    if os.path.exists(STATIC_DEST):
        shutil.rmtree(STATIC_DEST)

    # ── Done ─────────────────────────────────────────────
    exe_name = "SunTran.exe" if sys.platform == "win32" else "SunTran"
    exe_path = os.path.join(DIST, exe_name)

    print("\n" + "=" * 52)
    print("  BUILD COMPLETE")
    print(f"  Executable: {exe_path}")
    print()
    print("  To distribute: zip the entire dist/SunTran/ folder")
    print("  and send it. The recipient just runs SunTran.exe")
    print("  (Windows) or ./SunTran (Mac) — no install needed.")
    print("=" * 52)


if __name__ == "__main__":
    main()
