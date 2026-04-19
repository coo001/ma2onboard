import json
import os
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path
from urllib.request import urlopen

import uvicorn


def is_frozen() -> bool:
    return getattr(sys, "frozen", False)


def runtime_root() -> Path:
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def bundled_root() -> Path:
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS")).resolve()
    return Path(__file__).resolve().parent


PROJECT_ROOT = runtime_root()
BUNDLED_ROOT = bundled_root()
CONFIG_PATH = PROJECT_ROOT / "launcher_config.json"
BACKEND_DIR = BUNDLED_ROOT / "backend"
FRONTEND_DIST = BUNDLED_ROOT / "frontend" / "dist" / "index.html"


def load_config():
    default = {
        "grandma2_path": "",
        "grandma2_args": [],
        "app_host": "127.0.0.1",
        "app_port": 8000,
        "auto_open_browser": True,
        "startup_wait_seconds": 2.5,
    }

    if not CONFIG_PATH.exists():
        return default

    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return default

    default.update(data)
    return default


def find_grandma2_executable(configured_path: str) -> Path | None:
    candidates = []

    if configured_path:
        candidates.append(Path(configured_path))

    env_path = os.getenv("GRANDMA2_EXE", "").strip()
    if env_path:
        candidates.append(Path(env_path))

    candidates.extend(
        [
            Path(r"C:\Program Files\MA Lighting Technologies\grandma\grandMA2 onPC 3.9.60.91\gma2onpc.exe"),
            Path(r"C:\Program Files\MA Lighting Technologies\grandma\grandMA2 onPC 3.9.52.2\gma2onpc.exe"),
            Path(r"C:\Program Files\MA Lighting Technologies\grandma\grandMA2 onPC 3.9.0.0\gma2onpc.exe"),
            Path(r"C:\Program Files (x86)\MA Lighting Technologies\grandma\grandMA2 onPC 3.9.60.91\gma2onpc.exe"),
        ]
    )

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None


def is_port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(timeout)
        return sock.connect_ex((host, port)) == 0


def wait_for_http(url: str, timeout_seconds: float = 20.0) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=1.5) as response:
                if 200 <= response.status < 500:
                    return True
        except Exception:
            time.sleep(0.4)
    return False


def ensure_runtime_ready():
    if not FRONTEND_DIST.exists():
        raise RuntimeError("frontend/dist not found in runtime bundle.")


def start_grandma2(exe_path: Path | None, extra_args: list[str], wait_seconds: float):
    if is_port_open("127.0.0.1", 30000):
        return None  # already running

    if exe_path is None:
        raise RuntimeError(
            "grandMA2 onPC executable was not found. "
            "Set grandma2_path in launcher_config.json if it is installed in a custom folder."
        )

    process = subprocess.Popen(
        [str(exe_path), *extra_args],
        cwd=str(exe_path.parent),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )
    time.sleep(wait_seconds)
    return process


def start_backend_in_thread(host: str, port: int) -> threading.Thread:
    if str(BUNDLED_ROOT) not in sys.path:
        sys.path.insert(0, str(BUNDLED_ROOT))

    from backend.main import app

    config = uvicorn.Config(
        app=app,
        host=host,
        port=port,
        reload=False,
        log_level="warning",
        log_config=None,
        access_log=False,
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    return thread


def main():
    config = load_config()
    host = config["app_host"]
    port = int(config["app_port"])
    app_url = f"http://{host}:{port}"

    ensure_runtime_ready()

    grandma2_exe = find_grandma2_executable(config.get("grandma2_path", ""))
    start_grandma2(
        grandma2_exe,
        config.get("grandma2_args", []),
        float(config.get("startup_wait_seconds", 2.5)),
    )

    start_backend_in_thread(host, port)

    if not wait_for_http(f"{app_url}/api/health"):
        raise RuntimeError("Local web server did not start correctly.")

    if config.get("auto_open_browser", True):
        webbrowser.open(app_url)

    while True:
        time.sleep(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        import ctypes

        ctypes.windll.user32.MessageBoxW(0, str(exc), "grandMA2 Onboarding Launcher", 0x10)
        sys.exit(1)
