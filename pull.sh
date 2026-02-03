#!/bin/bash
cd "$(dirname "$0")" || exit 1
git fetch origin
git reset --hard origin/main
