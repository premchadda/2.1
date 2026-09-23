#!/usr/bin/env python3
"""
Local Nimble HTTP Serving Bridge for Trstprep
Exposes a classifier.dev compatible endpoint powered by Bespoke-Nimble (bespokelabsai/nimble)
Allows local, rate-limit-free taxonomy classification.
"""

import sys
import json
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler

# Attempt to import NimbleModel if present
NIMBLE_LOADED = False
nimble_model = None

try:
    sys.path.insert(0, "nimble-model")
    from inference import NimbleModel
    nimble_model = NimbleModel("nimble-model")
    NIMBLE_LOADED = True
    print("[NimbleServer] Successfully loaded Bespoke-Nimble model weights.")
except Exception as e:
    print(f"[NimbleServer] Note: Local Bespoke-Nimble model weights not found ({e}).")
    print("[NimbleServer] Running in proxy/simulation mode. Download weights with:")
    print("  hf download bespokelabs/Bespoke-Nimble-9B --local-dir nimble-model")

class NimbleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        status = {
            "service": "Bespoke-Nimble-Bridge",
            "model": "Bespoke-Nimble-9B",
            "engine_loaded": NIMBLE_LOADED,
            "status": "ready"
        }
        self.wfile.write(json.dumps(status).encode('utf-8'))

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            payload = json.loads(body)
            labels = payload.get('labels', [])
            inputs = payload.get('inputs', [])
            instructions = payload.get('instructions', '')

            if not labels or not inputs:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Missing labels or inputs"}')
                return

            results = []

            if NIMBLE_LOADED and nimble_model is not None:
                # Run through Bespoke Nimble local scoring schema
                schema = {
                    "choice": {
                        "type": "string",
                        "enum": labels,
                        "description": instructions or "Select the best matching category."
                    }
                }
                for text in inputs:
                    scored = nimble_model.score(context=text, schema=schema)
                    best_label = scored.get("output", {}).get("choice")
                    scores = scored.get("fields", {}).get("choice", {}).get("probabilities", {})
                    confidence = scores.get(best_label, 0.95)
                    results.append({
                        "label": best_label,
                        "confidence": confidence,
                        "scores": scores,
                        "model": "Bespoke-Nimble-9B"
                    })
            else:
                # Stand-in scoring: keyword heuristic scoring for testing when weights aren't mounted
                for text in inputs:
                    text_lower = text.lower()
                    best_label = labels[0]
                    best_matches = 0
                    scores = {}
                    for l in labels:
                        words = [w.lower() for w in l.split() if len(w) > 3]
                        matches = sum(1 for w in words if w in text_lower)
                        if matches > best_matches:
                            best_matches = matches
                            best_label = l
                        scores[l] = 0.1 + (matches * 0.3)

                    total_score = sum(scores.values()) or 1.0
                    norm_scores = {k: round(v / total_score, 3) for k, v in scores.items()}
                    results.append({
                        "label": best_label,
                        "confidence": norm_scores.get(best_label, 0.8),
                        "scores": norm_scores,
                        "model": "Bespoke-Nimble-9B-Fallback"
                    })

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('RateLimit-Remaining', '999999')
            self.end_headers()

            resp = {
                "tier": "local",
                "model": "Bespoke-Nimble-9B",
                "results": results,
                "usage": {
                    "classifications": len(inputs),
                    "local": True
                }
            }
            self.wfile.write(json.dumps(resp).encode('utf-8'))

        except Exception as err:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(err)}).encode('utf-8'))

def run_server(port=8000):
    server = HTTPServer(('127.0.0.1', port), NimbleHandler)
    print(f"[NimbleServer] Listening on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Nimble server.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000, help='Port to bind to')
    args = parser.parse_args()
    run_server(args.port)
