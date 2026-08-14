#!/usr/bin/env python3
"""Wrap a 48x48 PNG in a real ICO container (PNG-compressed entry, Vista+)."""
import struct
import sys

def build(png_path: str, ico_path: str) -> None:
    png = open(png_path, "rb").read()
    header = struct.pack("<HHH", 0, 1, 1)  # reserved, type=icon, 1 image
    # width, height (48<256 so raw byte), colors, reserved, planes, bitcount, size, offset
    entry = struct.pack("<BBBBHHII", 48, 48, 0, 0, 1, 32, len(png), 22)
    open(ico_path, "wb").write(header + entry + png)
    print(f"{ico_path} <- {png_path} ({len(png)}B payload)")

if __name__ == "__main__":
    pairs = [
        ("public/favicon-main-48.png", "public/favicon-main.ico"),
        ("public/favicon-main-48.png", "public/favicon.ico"),
        ("public/favicon-decon-48.png", "public/favicon-decon.ico"),
        ("public/favicon-ev-48.png", "public/favicon-ev.ico"),
    ]
    for png_path, ico_path in pairs:
        build(png_path, ico_path)
