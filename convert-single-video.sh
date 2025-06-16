#!/bin/bash

# Convert a single video with custom speed
# Usage: ./convert-single-video.sh <video-name> <speed-multiplier>
# Example: ./convert-single-video.sh deploy 2.0

if [ $# -lt 2 ]; then
    echo "Usage: $0 <video-name> <speed-multiplier>"
    echo "Example: $0 deploy 2.0"
    echo ""
    echo "Available videos: deploy, package_view, duplicate, tests, changelog, scan"
    echo "Speed multipliers:"
    echo "  - 1.0 = normal speed"
    echo "  - 2.0 = 2x faster" 
    echo "  - 3.0 = 3x faster"
    echo "  - 4.0 = 4x faster"
    exit 1
fi

VIDEO_NAME=$1
SPEED_MULTIPLIER=$2
SPEED_FILTER=$(echo "scale=2; 1.0 / $SPEED_MULTIPLIER" | bc)

if [ ! -f "public/${VIDEO_NAME}.mov" ]; then
    echo "Error: public/${VIDEO_NAME}.mov not found!"
    exit 1
fi

echo "Converting ${VIDEO_NAME}.mov at ${SPEED_MULTIPLIER}x speed..."

ffmpeg -i "public/${VIDEO_NAME}.mov" \
    -vf "setpts=${SPEED_FILTER}*PTS,fps=15,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
    -y "public/${VIDEO_NAME}.gif"

echo "Done! File size:"
ls -lh "public/${VIDEO_NAME}.gif"