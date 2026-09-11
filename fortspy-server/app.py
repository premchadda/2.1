"""FortSpy Flask bridge for the Trstprep Node backend.

The PyPI `fortspy` package is a library/CLI with no HTTP server, while
`apps/backend/src/services/fortspyService.js` expects these endpoints:

    GET  /api/health
    POST /api/keygen
    POST /api/encrypt      (multipart `file`, optional `key` hex form field)
    POST /api/decrypt      ({ id, key })
    GET  /api/info/<id>
    GET  /api/stream/<id>?key=<hex>   (MJPEG, proxied by Node to the canvas player)

Run:
    uv run --with fortspy --with flask --with opencv-python fortspy-server/app.py
    # or inside the repo venv: .venv\\Scripts\\python.exe fortspy-server/app.py

Env:
    PORT (default 5002), FORTSPY_STORE (default ./fortspy-server/store)
"""

import base64
import json
import os
import tempfile
import uuid
from pathlib import Path

import cv2
from flask import Flask, Response, jsonify, request
from fortspy import FortSpyDecryptor, FortSpyEncryptor, KeyManager
from werkzeug.utils import secure_filename

app = Flask(__name__)

STORE_DIR = Path(os.environ.get("FORTSPY_STORE", Path(__file__).parent / "store"))
STORE_DIR.mkdir(parents=True, exist_ok=True)
REGISTRY_PATH = STORE_DIR / "registry.json"


def _load_registry():
    if REGISTRY_PATH.exists():
        try:
            return json.loads(REGISTRY_PATH.read_text())
        except (OSError, ValueError):
            return {}
    return {}


def _save_registry(registry):
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2))


def _key_from_hex(hex_key):
    try:
        key = bytes.fromhex(hex_key)
    except (ValueError, TypeError):
        return None
    if len(key) not in (16, 24, 32):
        return None
    return key


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "fortspy-bridge"})


@app.post("/api/keygen")
def keygen():
    key_size = int(request.json.get("key_size", 256)) if request.is_json else 256
    key = KeyManager(key_size).generate_key()
    return jsonify(
        {"key": key.hex(), "algorithm": "aes-256-ctr", "key_size": key_size}
    )


@app.post("/api/encrypt")
def encrypt():
    if "file" not in request.files:
        return jsonify({"message": "No video file provided"}), 400
    upload = request.files["file"]
    filename = secure_filename(upload.filename or "upload.mp4")

    hex_key = request.form.get("key") or (request.json or {}).get("key")
    if hex_key:
        key = _key_from_hex(hex_key)
        if key is None:
            return jsonify({"message": "Invalid key (need 16/24/32 bytes as hex)"}), 400
        generated = False
    else:
        key = KeyManager(256).generate_key()
        generated = True

    video_id = uuid.uuid4().hex[:16]
    tmp_in = STORE_DIR / f"upload_{video_id}_{filename}"
    out_path = STORE_DIR / f"{video_id}.fortspy"
    upload.save(tmp_in)
    try:
        encryptor = FortSpyEncryptor(key=key, mode="CTR", key_size=len(key) * 8)
        metadata = encryptor.encrypt_video(str(tmp_in), str(out_path))
    finally:
        tmp_in.unlink(missing_ok=True)

    registry = _load_registry()
    registry[video_id] = {
        "filename": filename,
        "path": str(out_path),
        "metadata": metadata,
    }
    _save_registry(registry)

    payload = {"id": video_id, "videoId": video_id, **metadata}
    if generated:
        payload["key"] = key.hex()
    return jsonify(payload)


@app.post("/api/decrypt")
def decrypt():
    data = request.json or {}
    video_id, hex_key = data.get("id"), data.get("key")
    entry = _load_registry().get(video_id or "")
    key = _key_from_hex(hex_key or "")
    if entry is None:
        return jsonify({"message": "Unknown video id"}), 404
    if key is None:
        return jsonify({"message": "Invalid key"}), 400
    decryptor = FortSpyDecryptor(key=key, use_gpu=False)
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        decryptor.decrypt_to_video(entry["path"], tmp_path)
        raw = Path(tmp_path).read_bytes()
    finally:
        Path(tmp_path).unlink(missing_ok=True)
    return jsonify({"data": base64.b64encode(raw).decode("ascii")})


@app.get("/api/info/<video_id>")
def info(video_id):
    entry = _load_registry().get(video_id)
    if entry is None:
        return jsonify({"message": "Unknown video id"}), 404
    return jsonify({"id": video_id, **entry["metadata"]})


@app.get("/api/stream/<video_id>")
def stream(video_id):
    entry = _load_registry().get(video_id)
    hex_key = request.args.get("key", "")
    key = _key_from_hex(hex_key)
    if entry is None:
        return jsonify({"message": "Unknown video id"}), 404
    if key is None:
        return jsonify({"message": "Invalid key"}), 400

    def frames():
        decryptor = FortSpyDecryptor(key=key, use_gpu=False)
        for frame, _idx in decryptor.decrypt_video_stream(entry["path"]):
            ok, buf = cv2.imencode(".jpg", frame)
            if not ok:
                continue
            jpg = buf.tobytes()
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
            )

    return Response(
        frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5002"))
    app.run(host="127.0.0.1", port=port)
