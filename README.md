# Obsidian Link Checker

A browser prototype for inspecting Obsidian Markdown wikilinks before importing notes. Imported files are processed locally.

## Run

From this directory, run `python -m http.server 8000` and open http://localhost:8000 in a browser. Click **加载示例** to load the included Markdown files, or **选择笔记文件夹** to analyze a local folder.

## Example

The inbox contains a link to an old budget note title, including a heading and a display label. The replacement note declares the old title as an alias. Approve the suggested fix and download a revised copy of the inbox. The original file remains on disk.

## Prototype scope

The prototype supports ordinary note wikilinks, ATX headings, YAML block-list aliases, exact and alias-based repair suggestions, and per-note Markdown downloads. The graph shows up to 40 notes, while the linter scans the entire selected folder. Fuzzy ranking, block references, and ZIP export are future work.
