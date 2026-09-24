# -*- coding: utf-8 -*-
"""从桌面《余额.xlsx》导出 data.json 并推送到 GitHub（更新 Pages）。"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PARENT = ROOT.parent  # xlsx/
sys.path.insert(0, str(PARENT))
import server  # noqa: E402

REMOTE = "https://github.com/Bury-HUI/-.git"

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
    print("data.json 已导出", out["summary"]["latest_date"], out["summary"]["total"])

def push():
    subprocess.run(["git", "add", "data.json"], cwd=ROOT, check=False)
    subprocess.run(
        ["git", "-c", "user.name=zhangjiahui", "-c", "user.email=zhangjiahui@users.noreply.github.com",
         "commit", "-m", "update balance data"],
        cwd=ROOT, check=False,
    )
    subprocess.run(["git", "remote", "remove", "origin"], cwd=ROOT, check=False)
    subprocess.run(["git", "remote", "add", "origin", REMOTE], cwd=ROOT, check=False)
    r = subprocess.run(["git", "push", "origin", "main"], cwd=ROOT)
    if r.returncode == 0:
        print("已推送 GitHub，Pages 约 1 分钟内更新")
    else:
        print("push 失败，请检查网络/登录")

if __name__ == "__main__":
    export()
    if "--no-push" not in sys.argv:
        push()
