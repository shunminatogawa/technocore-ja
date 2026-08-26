#!/bin/bash
# ダブルクリックすると、ブラウザで technocore が読めます。
cd "$(dirname "$0")"
clear
echo "╭──────────────────────────────────────────╮"
echo "│  technocore ビューア                     │"
echo "╰──────────────────────────────────────────╯"
echo
echo "  ブラウザを開きます。"
echo "  終わるときは、このウィンドウで Ctrl+C を押すか"
echo "  ウィンドウを閉じてください。"
echo
node src/cli.js view
