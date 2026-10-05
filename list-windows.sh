#!/bin/bash
osascript -e 'tell application "System Events" to get name of every window of every application process' \
  | tr ',' '\n' \
  | sed 's/^ *//' \
  | grep -v '^missing value$' \
  | grep -v '^$' \
  | sort -u
