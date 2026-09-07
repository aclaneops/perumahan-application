#!/bin/bash

# Vercel environments to add to
ENVS="production preview development"

while IFS='=' read -r key val || [ -n "$key" ]; do
  # Skip comments and empty lines
  if [[ -z "$key" ]] || [[ "$key" == \#* ]]; then
    continue
  fi
  
  # Remove leading/trailing quotes from value
  val="${val%\"}"
  val="${val#\"}"
  
  if [ -n "$val" ]; then
    echo "Adding $key..."
    for env in $ENVS; do
      echo -n "$val" | npx vercel env add "$key" "$env" || true
    done
  fi
done < <(grep -v '^#' .env.local | grep -v '^$')
