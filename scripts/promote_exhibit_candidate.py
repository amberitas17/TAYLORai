"""Promote an evaluated exhibit candidate with an on-disk rollback point.

This command is intentionally separate from training. It refuses candidates
that do not carry a passed quality gate and atomically preserves the current
production asset before replacing it.
"""

from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--production", type=Path, required=True)
    parser.add_argument("--evaluation", type=Path, required=True)
    parser.add_argument("--versions-dir", type=Path, required=True)
    args = parser.parse_args()
    evaluation = json.loads(args.evaluation.read_text(encoding="utf-8"))
    if evaluation.get("quality_gate", {}).get("passed") is not True:
        raise SystemExit("Candidate rejected: quality gates did not pass.")
    if not args.candidate.is_file():
        raise SystemExit(f"Candidate does not exist: {args.candidate}")
    args.production.parent.mkdir(parents=True, exist_ok=True)
    args.versions_dir.mkdir(parents=True, exist_ok=True)
    version = time.strftime("%Y%m%d-%H%M%S")
    rollback = args.versions_dir / f"{args.production.name}.{version}"
    if args.production.exists():
        shutil.copy2(args.production, rollback)
    temporary = args.production.with_suffix(args.production.suffix + ".candidate")
    shutil.copy2(args.candidate, temporary)
    temporary.replace(args.production)
    registry = args.versions_dir / "registry.json"
    history = json.loads(registry.read_text(encoding="utf-8")) if registry.exists() else {"active": None, "versions": []}
    history["versions"].append({"version": version, "production": str(args.production), "rollback": str(rollback) if rollback.exists() else None, "evaluation": str(args.evaluation)})
    history["active"] = version
    registry.write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"promoted": True, "version": version, "rollback": str(rollback) if rollback.exists() else None}, indent=2))


if __name__ == "__main__":
    main()