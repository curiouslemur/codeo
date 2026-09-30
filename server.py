#!/usr/bin/env python3
"""Static file server for the Codeo app, plus one extra endpoint:

    POST /api/apply-code

used by the "Apply this code with AI" right-click action. It sends the
current transcript's text plus a code's name/definition to the Claude API
and asks for verbatim quotes that fit the code. The API key stays on the
server side — the browser never sees it.

Setup:
    export ANTHROPIC_API_KEY=sk-ant-...
    python3 server.py [port]      (defaults to 8000)
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ANTHROPIC_MODEL = "claude-sonnet-5"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

PROMPT_TEMPLATE = """You are helping a qualitative researcher apply a code to an interview transcript.

CODE NAME: {name}
CODE DEFINITION: {definition}

Read the full transcript below. Identify every passage that clearly exemplifies this code. For each one, copy the EXACT verbatim text of the passage from the transcript, character for character, including punctuation and capitalization exactly as it appears — it will be located automatically by exact text search, so paraphrasing or summarizing will cause it to be discarded. Prefer shorter, precise quotes over long rambling ones. Only include passages that are a genuinely clear fit; skip weak or borderline matches. If nothing in the transcript fits, return an empty array.

If two or more sentences are adjacent (directly next to each other, with nothing unrelated in between) and all fit the same code, merge them into a single continuous quote rather than returning each sentence as its own separate quote. Only keep sentences separate when they are not adjacent in the transcript, or when something in between them does not fit the code.

Respond with ONLY a JSON array of strings and nothing else — no markdown code fences, no explanation. Example response:
["exact quote one", "exact quote two"]

TRANSCRIPT:
{transcript}
"""


def extract_json_array(text):
    text = text.strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("Could not find a JSON array in the model's response")


def call_claude(code_name, code_definition, transcript_text):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY environment variable is not set on the server. "
            "Set it and restart: ANTHROPIC_API_KEY=sk-... python3 server.py"
        )

    prompt = PROMPT_TEMPLATE.format(
        name=code_name, definition=code_definition or "(no definition provided)", transcript=transcript_text
    )
    payload = json.dumps(
        {
            "model": ANTHROPIC_MODEL,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=payload,
        method="POST",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Claude API error ({e.code}): {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Could not reach the Claude API: {e.reason}") from e

    text_parts = [block.get("text", "") for block in body.get("content", []) if block.get("type") == "text"]
    raw_text = "".join(text_parts)
    quotes = extract_json_array(raw_text)
    if not isinstance(quotes, list):
        raise ValueError("Model response was not a JSON array")
    return [str(q) for q in quotes]


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/apply-code":
            self.send_error(404, "Not found")
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
            transcript_text = payload["transcriptText"]
            code_name = payload["codeName"]
            code_definition = payload.get("codeDefinition", "")

            quotes = call_claude(code_name, code_definition, transcript_text)
            self._send_json(200, {"ok": True, "quotes": quotes})
        except Exception as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})

    def _send_json(self, status, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(ROOT)
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Warning: ANTHROPIC_API_KEY is not set — 'Apply this code with AI' will not work until it is.")
    print(f"Serving {ROOT} at http://localhost:{port} (Ctrl+C to stop)")
    ThreadingHTTPServer(("", port), Handler).serve_forever()
