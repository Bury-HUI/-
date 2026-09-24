# -*- coding: utf-8 -*-
"""监视桌面《余额.xlsx》，变更后自动导出并 push。全程无窗口。"""
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
XLSX = Path.home() / "Desktop" / "余额.xlsx"
NO_WINDOW = 0x08000000  # CREATE_NO_WINDOW


def once():
    subprocess.run(
        [sys.executable, str(ROOT / "sync_push.py")],
        cwd=str(ROOT),
        creationflags=NO_WINDOW if sys.platform == "win32" else 0,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main():
    last = 0.0
    if XLSX.exists():
        last = XLSX.stat().st_mtime
    while True:
        time.sleep(3)
        if not XLSX.exists():
            continue
        m = XLSX.stat().st_mtime
        if m != last:
            last = m
            time.sleep(1)
            try:
                once()
            except Exception:
                pass


if __name__ == "__main__":
    main()
