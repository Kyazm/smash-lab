#!/usr/bin/env python3
"""labels-g*.json（ゲーム別ラベル断片）を labels.json に結合し、フレーム実在を検証する。

使い方: python3 scripts/merge-labels.py <video_id>
  <repo>/.context/player-study/<video_id>/labels-g*.json を game_index 順に結合し、
  同ディレクトリに labels.json を書く。frame パスが実在しない場合はエラー終了（labels.json は書かない）。
"""
import glob
import json
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
WORK_ROOT = os.path.join(REPO_ROOT, ".context", "player-study")


def main() -> int:
    if len(sys.argv) != 2:
        print("使い方: merge-labels.py <video_id>", file=sys.stderr)
        return 2
    video_id = sys.argv[1]
    workdir = os.path.join(WORK_ROOT, video_id)
    fragments = sorted(
        glob.glob(os.path.join(workdir, "labels-g*.json")),
        key=lambda p: int(re.search(r"labels-g(\d+)\.json$", p).group(1)),
    )
    if not fragments:
        print(f"labels-g*.json が見つかりません: {workdir}", file=sys.stderr)
        return 1

    games, interactions = [], []
    for path in fragments:
        with open(path) as f:
            d = json.load(f)
        games.append(d["game"])
        # ラベラーが interaction 側の game_index を省略した場合は game オブジェクトから補完
        for it in d["interactions"]:
            it.setdefault("game_index", d["game"]["game_index"])
        interactions.extend(d["interactions"])
    interactions.sort(key=lambda x: x["t_sec"])

    missing = [
        it["frame"]
        for it in interactions
        if not os.path.exists(os.path.join(workdir, it["frame"]))
    ]
    if missing:
        print("フレーム欠落（labels.json は書きません）:", file=sys.stderr)
        for m in missing:
            print(f"  {m}", file=sys.stderr)
        return 1

    labels = {"video_id": video_id, "games": games, "interactions": interactions}
    out = os.path.join(workdir, "labels.json")
    with open(out, "w") as f:
        json.dump(labels, f, ensure_ascii=False, indent=2)
    print(f"labels.json OK: games={len(games)} interactions={len(interactions)} 全フレーム実在 → {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
