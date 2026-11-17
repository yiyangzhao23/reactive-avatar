#!/bin/zsh
set -e
BASE="$(cd "$(dirname "$0")/.." && pwd)"
GSV="${GSV_DIR:-$BASE/.gsv/GPT-SoVITS}"
PYENV="${GSV_PYENV:-$BASE/.gsv/env}"
CONDA="${CONDA_SH:-$BASE/.gsv/miniconda/etc/profile.d/conda.sh}"

if [ ! -f "$CONDA" ]; then
  echo "conda not found at $CONDA; set CONDA_SH or install GPT-SoVITS first" >&2
  exit 1
fi
if [ ! -d "$GSV" ]; then
  echo "GPT-SoVITS not found at $GSV; set GSV_DIR first" >&2
  exit 1
fi

source "$CONDA"
conda activate "$PYENV"
export PATH="$PYENV/bin:$PATH"
export TERM=xterm
cd "$GSV"
exec python -u api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer_cpu.yaml
