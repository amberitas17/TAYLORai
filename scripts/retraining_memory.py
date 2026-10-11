"""Shared low-memory controls for retraining and ONNX evaluation jobs."""

from __future__ import annotations

import gc
import os
import time
from pathlib import Path

try:
    import psutil
except ImportError:  # pragma: no cover - the workflow reports unavailable telemetry
    psutil = None


def memory_limit_mb(default: int = 4096) -> int:
    return max(256, int(os.environ.get("TAYLOR_MEMORY_LIMIT_MB", default)))


def rss_mb() -> float | None:
    if psutil is None:
        return None
    return psutil.Process().memory_info().rss / (1024 * 1024)


def memory_snapshot(label: str, log_path: Path | None = None) -> dict:
    snapshot = {"label": label, "rss_mb": rss_mb(), "timestamp": time.time(), "pid": os.getpid()}
    line = str(snapshot)
    if log_path:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    print(f"[memory] {line}", flush=True)
    return snapshot


def collect():
    gc.collect()
    return rss_mb()


def configure_cpu_threads():
    threads = max(1, int(os.environ.get("TAYLOR_CPU_THREADS", "2")))
    os.environ.setdefault("OMP_NUM_THREADS", str(threads))
    os.environ.setdefault("MKL_NUM_THREADS", str(threads))
    os.environ.setdefault("OPENBLAS_NUM_THREADS", str(threads))
    try:
        import torch
        torch.set_num_threads(threads)
        torch.set_num_interop_threads(1)
    except (ImportError, RuntimeError):
        pass
    return threads
