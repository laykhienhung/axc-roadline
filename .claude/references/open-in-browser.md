# Open a file in the browser (shared)

Write the file, then launch the user's default browser on it. Print the path too, as a headless/no-GUI fallback.

```sh
f="<path-to-file>"
case "$(uname -s)" in
  Darwin)          open "$f" ;;
  Linux)           xdg-open "$f" ;;            # WSL: if this errors, explorer.exe "$f"
  MINGW*|MSYS*|CYGWIN*) start "" "$f" ;;       # Git Bash on Windows
  *)               echo "open manually: $f" ;;
esac
```

(WSL has `uname` = Linux but no `xdg-open` → if it fails, `explorer.exe "$f"`.)
