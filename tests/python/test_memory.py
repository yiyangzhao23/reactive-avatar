def test_memory_roundtrip(server_mod, memory_db):
    saved = server_mod.memory_add("灯塔下的钥匙在抽屉里", source="test")
    assert saved["id"] > 0
    assert saved["text"].startswith("灯塔")

    rows = server_mod.memory_list(limit=10)
    assert any(row["id"] == saved["id"] for row in rows)

    found = server_mod.memory_search("钥匙", limit=5)
    assert any("钥匙" in row["text"] for row in found)

    other = server_mod.memory_add("另一条无关记忆", source="test", tags="misc")
    assert other["id"] != saved["id"]
    assert len(server_mod.memory_search("", limit=50)) >= 2

    server_mod.memory_clear()
    assert server_mod.memory_list(limit=10) == []


def test_memory_rejects_empty_text(server_mod, memory_db):
    import pytest

    with pytest.raises(ValueError):
        server_mod.memory_add("   ")
