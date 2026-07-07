from __future__ import annotations

from fastapi import Body, FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.core.errors import PROBLEM_JSON, register_error_handlers


def _client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/boom")
    def boom():
        raise HTTPException(status_code=402, detail="Monthly quota exhausted.")

    @app.get("/secure")
    def secure():
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    @app.post("/echo")
    def echo(n: int = Body(..., embed=True)):
        return {"ok": n}

    @app.get("/crash")
    def crash():
        raise RuntimeError("kaboom")

    return TestClient(app, raise_server_exceptions=False)


def test_http_exception_is_problem_json():
    r = _client().get("/boom")
    assert r.status_code == 402
    assert r.headers["content-type"].startswith(PROBLEM_JSON)
    b = r.json()
    assert b["status"] == 402
    assert b["title"] == "Payment Required"
    assert b["detail"] == "Monthly quota exhausted."
    assert b["type"].endswith("/quota-exceeded")
    assert b["instance"] == "/boom"


def test_401_preserves_www_authenticate_header():
    r = _client().get("/secure")
    assert r.status_code == 401
    assert r.headers.get("www-authenticate") == "Bearer"
    assert r.json()["detail"] == "Could not validate credentials"  # client parser still works


def test_validation_error_carries_field_errors():
    r = _client().post("/echo", json={"n": "not-an-int"})
    assert r.status_code == 422
    b = r.json()
    assert b["type"].endswith("/validation-error")
    assert any(e["field"] == "n" for e in b["errors"])


def test_unhandled_exception_becomes_500_problem():
    r = _client().get("/crash")
    assert r.status_code == 500
    b = r.json()
    assert b["status"] == 500 and b["title"] == "Internal Server Error"
