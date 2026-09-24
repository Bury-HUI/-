# -*- coding: utf-8 -*-
"""监视桌面《余额.xlsx》，变更后自动导出 data.json 并 push。"""
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
XLSX = Path.home() / "Desktop" / "余额.xlsx"
PY = sys.executable

def once():
    subprocess.run([PY, str(ROOT / "sync_push.py")], cwd=str(ROOT))

def main():
    last = 0
    if XLSX.exists():
        last = XLSX.stat().st_mtime
    print("监视中", XLSX)
    while True:
        time.sleep(3)
        if not XLSX.exists():
            continue
        m = XLSX.stat().st_mtime
        if m != last:
            last = m
            print("检测到表格更新…")
            time.sleep(1)
            try:
                once()
            except Exception as e:
                print("同步失败", e)

if __name__ == "__main__":
    main()
