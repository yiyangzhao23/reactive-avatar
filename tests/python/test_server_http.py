import httpx


def test_static_index_served(http_server):
    res = httpx.get(f"{http_server}/", timeout=10)
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "Reactive Avatar" in res.text


def test_main_script_served(http_server):
    res = httpx.get(f"{http_server}/src/main.js", timeout=10)
    assert res.status_code == 200
    assert "javascript" in res.headers["content-type"]


def test_tts_requires_text(http_server):
    res = httpx.get(f"{http_server}/tts?lang=zh", timeout=10)
    assert res.status_code == 400


def test_memory_http_roundtrip(http_server):
    created = httpx.post(f"{http_server}/memory", json={"text": "接口层的记忆", "source": "test"}, timeout=10)
    assert created.status_code == 200

    listed = httpx.get(f"{http_server}/memory?limit=5", timeout=10)
    assert listed.status_code == 200
    assert any("接口层的记忆" in row["text"] for row in listed.json()["memories"])

    searched = httpx.post(f"{http_server}/memory/search", json={"query": "接口层", "limit": 5}, timeout=10)
    assert searched.status_code == 200
    assert searched.json()["memories"]

    cleared = httpx.post(f"{http_server}/memory/clear", json={}, timeout=10)
    assert cleared.status_code == 200
    assert httpx.get(f"{http_server}/memory?limit=5", timeout=10).json()["memories"] == []
