import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "avatar-live"


@pytest.fixture(scope="session")
def server_mod():
    sys.path.insert(0, str(APP))
    spec = importlib.util.spec_from_file_location("avatar_server", APP / "server.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture()
def memory_db(server_mod, tmp_path, monkeypatch):
    db = tmp_path / "memory.db"
    monkeypatch.setattr(server_mod, "DB_PATH", str(db))
    server_mod.init_memory()
    return str(db)


@pytest.fixture()
def http_server(server_mod, memory_db, monkeypatch):
    import http.server
    import threading

    monkeypatch.chdir(APP)

    class QuietHandler(server_mod.Handler):
        def log_message(self, *args):
            pass

    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()
    thread.join(timeout=2)
