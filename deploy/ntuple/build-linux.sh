#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
case "$(uname -m)" in aarch64|x86_64) ;; *) echo 'Supported Linux architectures: aarch64 and x86_64' >&2; exit 1;; esac
command -v g++ >/dev/null
command -v python3 >/dev/null
python3 verify_source.py
# Same greedy selector and source as the verified bridge. No training or games.
g++ -std=c++20 -O3 -mtune=generic -pthread -Wall -o native/ntuple-bridge native/ntuple-bridge.cpp
g++ --version > compiler-version.txt
python3 model_setup.py
sha256sum native/ntuple-bridge > executable.sha256
printf 'Build complete. Start the HTTP service, then run smoke.py before enabling Vercel traffic.\n'
