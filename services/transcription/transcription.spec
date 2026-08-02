from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules, copy_metadata


datas = collect_data_files("whisperx")
datas += collect_data_files("pyannote.audio")
datas += copy_metadata("torchcodec")
binaries = []
hiddenimports = []

for package in ("av", "ctranslate2", "faster_whisper"):
    package_datas, package_binaries, package_hiddenimports = collect_all(package)
    datas += package_datas
    binaries += package_binaries
    hiddenimports += package_hiddenimports

for package in ("whisperx", "pyannote", "torchcodec"):
    hiddenimports += collect_submodules(package)

a = Analysis(
    ["src/main.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter"],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="meridian-transcription",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="meridian-transcription",
)
