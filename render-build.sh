#!/bin/bash
# Render build script for installing system dependencies

set -e  # Exit on error

echo "Installing system dependencies..."
apt-get update
apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    postgresql-client \
    libgl1 \
    libglib2.0-0

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Build complete!"
