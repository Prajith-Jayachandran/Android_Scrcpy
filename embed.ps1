param(
    [string]$childHwndStr,
    [string]$parentHwndStr,
    [int]$x,
    [int]$y,
    [int]$w,
    [int]$h
)

$signature = @"
using System;
using System.Runtime.InteropServices;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@

try {
    Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue
} catch {}

# Convert handle strings to IntPtr (handles both 32-bit and 64-bit)
$childHwnd = [IntPtr][Convert]::ToInt64($childHwndStr, 10)
$parentHwnd = [IntPtr][Convert]::ToInt64($parentHwndStr, 10)

# GWL_STYLE = -16
# WS_CAPTION = 0x00C00000
# WS_THICKFRAME = 0x00040000
# WS_CHILD = 0x40000000
$style = [Win32]::GetWindowLong($childHwnd, -16)
$style = $style -band -not 0x00C00000 -band -not 0x00040000
$style = $style -bor 0x40000000

[Win32]::SetWindowLong($childHwnd, -16, $style)
[Win32]::SetParent($childHwnd, $parentHwnd)

# Move window and repaint
[Win32]::MoveWindow($childHwnd, $x, $y, $w, $h, $true)

# SWP_NOZORDER = 0x0004, SWP_SHOWWINDOW = 0x0040, SWP_FRAMECHANGED = 0x0020
[Win32]::SetWindowPos($childHwnd, [IntPtr]::Zero, $x, $y, $w, $h, 0x0004 -bor 0x0040 -bor 0x0020)

Write-Host "Success"
