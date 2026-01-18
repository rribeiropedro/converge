#!/bin/bash

# ============================================
# face-api.js Model Download Script
# ============================================
# Run this from your project root:
#   chmod +x download-face-models.sh
#   ./download-face-models.sh
# ============================================

set -e  # Exit on error

# Configuration
MODELS_DIR="backend/face-api-models"
BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "============================================"
echo "  face-api.js Model Downloader"
echo "============================================"
echo ""

# Create models directory
echo -e "${YELLOW}Creating directory: ${MODELS_DIR}${NC}"
mkdir -p "$MODELS_DIR"

# Function to download a file
download_file() {
    local filename=$1
    echo -n "  Downloading $filename... "
    if curl -sf -o "$MODELS_DIR/$filename" "$BASE_URL/$filename"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo "FAILED"
        exit 1
    fi
}

# SSD MobileNet v1 (Face Detection - recommended)
echo ""
echo -e "${YELLOW}[1/3] Face Detection Model (SSD MobileNet)${NC}"
download_file "ssd_mobilenetv1_model-shard1"
download_file "ssd_mobilenetv1_model-shard2"
download_file "ssd_mobilenetv1_model-weights_manifest.json"

# Face Landmark 68 (Facial landmarks)
echo ""
echo -e "${YELLOW}[2/3] Face Landmark Model${NC}"
download_file "face_landmark_68_model-shard1"
download_file "face_landmark_68_model-weights_manifest.json"

# Face Recognition (Generates embeddings)
echo ""
echo -e "${YELLOW}[3/3] Face Recognition Model (Embeddings)${NC}"
download_file "face_recognition_model-shard1"
download_file "face_recognition_model-shard2"
download_file "face_recognition_model-weights_manifest.json"

# Optional: Tiny Face Detector (faster, less accurate)
echo ""
echo -e "${YELLOW}[Bonus] Tiny Face Detector (optional, faster)${NC}"
download_file "tiny_face_detector_model-shard1"
download_file "tiny_face_detector_model-weights_manifest.json"

# Summary
echo ""
echo "============================================"
echo -e "${GREEN}✓ All models downloaded successfully!${NC}"
echo "============================================"
echo ""
echo "Models saved to: $MODELS_DIR/"
echo ""
ls -lh "$MODELS_DIR/"
echo ""
echo "Total size:"
du -sh "$MODELS_DIR/"
echo ""