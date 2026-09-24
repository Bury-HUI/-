# -*- coding: utf-8 -*-
"""从桌面《余额.xlsx》导出 data.json 并推送到 GitHub（更新 Pages）。全程无窗口。"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PARENT = ROOT.parent
sys.path.insert(0, str(PARENT))
import server  # noqa: E402

REMOTE = "https://github.com/Bury-HUI/-.git"
NO_WINDOW = 0x08000000  # CREATE_NO_WINDOW


def _run(cmd, **kw):
    return subprocess.run(
        cmd,
        cwd=str(ROOT),
        creationflags=NO_WINDOW if sys.platform == "win32" else 0,
        **kw,
    )


def export():
    d = server.load_payload()
    out = {
        "headers": d["headers"],
        "account_keys": d["account_keys"],
        "rows": d["rows"],
        "summary": d["summary"],
    }
    (ROOT / "data.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("data.json", out["summary"]["latest_date"], out["summary"]["total"])


def push():
    _run(["git", "add", "data.json"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    _run(
        [
            "git", "-c", "user.name=zhangjiahui",
            "-c", "user.email=zhangjiahui@users.noreply.github.com",
            "commit", "-m", "update balance data",
        ],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    _run(["git", "remote", "remove", "origin"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    _run(["git", "remote", "add", "origin", REMOTE], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    r = _run(["git", "push", "origin", "main"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("push", "ok" if r.returncode == 0 else "fail")


if __name__ == "__main__":
    export()
    if "--no-push" not in sys.argv:
        push()
