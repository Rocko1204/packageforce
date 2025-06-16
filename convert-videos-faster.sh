#!/bin/bash

# Convert videos to GIF with faster playback
# Adjust the fps and speed settings as needed

echo "Converting videos to faster GIFs..."

# Create a backup of existing GIFs
mkdir -p public/backup
cp public/*.gif public/backup/ 2>/dev/null || true

# Convert each video with speed adjustment
# The setpts filter controls playback speed:
# - setpts=0.5*PTS = 2x faster
# - setpts=0.33*PTS = 3x faster
# - setpts=0.25*PTS = 4x faster

SPEED="0.5"  # 2x faster - adjust this value as needed
FPS="15"     # Frames per second
SCALE="800"  # Width in pixels

echo "Converting with ${SPEED} speed factor (smaller = faster)..."

# Package View
ffmpeg -i public/package_view.mov -vf "setpts=${SPEED}*PTS,fps=${FPS},scale=${SCALE}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -y public/package_view.gif

# Deploy
ffmpeg -i public/deploy.mov -vf "setpts=${SPEED}*PTS,fps=${FPS},scale=${SCALE}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -y public/deploy.gif

# Duplicate
ffmpeg -i public/duplicate.mov -vf "setpts=${SPEED}*PTS,fps=${FPS},scale=${SCALE}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -y public/duplicate.gif

# Tests
ffmpeg -i public/tests.mov -vf "setpts=${SPEED}*PTS,fps=${FPS},scale=${SCALE}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -y public/tests.gif

# Changelog
ffmpeg -i public/changelog.mov -vf "setpts=${SPEED}*PTS,fps=${FPS},scale=${SCALE}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -y public/changelog.gif

# Scan
ffmpeg -i public/scan.mov -vf "setpts=${SPEED}*PTS,fps=${FPS},scale=${SCALE}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -y public/scan.gif

echo "Conversion complete!"
echo ""
echo "File sizes:"
ls -lh public/*.gif

echo ""
echo "Tips:"
echo "- To make videos faster, decrease the SPEED value (e.g., 0.25 for 4x speed)"
echo "- To make videos slower, increase the SPEED value (e.g., 1.0 for normal speed)"
echo "- Adjust FPS for smoother playback (higher = smoother but larger file)"
echo "- Adjust SCALE for smaller file sizes (smaller width = smaller file)"