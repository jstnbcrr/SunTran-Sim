# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for SunTran Transit Analysis Tool.
Run via:  python build_exe.py   (from the project root)
"""

import os

ROOT    = os.path.abspath(os.path.join(SPECPATH, ".."))
BACKEND = SPECPATH                        # .../backend/
STATIC  = os.path.join(BACKEND, "static") # built React files copied here by build_exe.py
DATA    = os.path.join(ROOT, "data")

a = Analysis(
    [os.path.join(BACKEND, "run.py")],
    pathex=[BACKEND],
    binaries=[],
    datas=(
        [
            # Bundled React build
            (STATIC, "static"),
        ]
        # Seed every flat file in /data (excluding the backups subfolder) plus
        # the otp_archive folder. Copied to a writable data/ dir on first run.
        + [
            (os.path.join(DATA, f), "data_seed")
            for f in os.listdir(DATA)
            if os.path.isfile(os.path.join(DATA, f))
        ]
        + (
            [(os.path.join(DATA, "otp_archive"), "data_seed/otp_archive")]
            if os.path.isdir(os.path.join(DATA, "otp_archive"))
            else []
        )
    ),
    hiddenimports=[
        # uvicorn internals
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        # data stack
        "pandas",
        "pandas._libs.tslibs.base",
        "numpy",
        "openpyxl",
        "openpyxl.styles.stylesheet",
        # auth
        "bcrypt",
        "jose",
        "jose.jwt",
        "passlib.handlers.bcrypt",
        # routing / graph
        "networkx",
        "networkx.algorithms",
        # fastapi
        "fastapi",
        "fastapi.staticfiles",
        "fastapi.responses",
        "starlette.routing",
        "starlette.staticfiles",
        "anyio",
        "anyio._backends._asyncio",
        "multipart",
        "python_multipart",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="SunTran",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,          # keep console so user can see "server started" messages
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="SunTran",
)
