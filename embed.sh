#!/bin/bash
CHILD_WID=$1
PARENT_WID=$2
X=$3
Y=$4
W=$5
H=$6

if [ -z "$CHILD_WID" ] || [ -z "$PARENT_WID" ]; then
    echo "Usage: embed.sh <child_wid> <parent_wid> <x> <y> <w> <h>"
    exit 1
fi

# 1. Strip window decoration/borders via MOTIF hints (X11)
xprop -id $CHILD_WID -f _MOTIF_WM_HINTS 32c -set _MOTIF_WM_HINTS "0x2, 0x0, 0x0, 0x0, 0x0" 2>/dev/null

# 2. Reparent window under Electron parent
xdotool windowreparent $CHILD_WID $PARENT_WID

# 3. Position and size window
xdotool windowmove $CHILD_WID $X $Y
xdotool windowsize $CHILD_WID $W $H

# 4. Enforce resizing update to trigger redraw
xdotool windowsize $CHILD_WID $((W+1)) $((H+1))
xdotool windowsize $CHILD_WID $W $H
