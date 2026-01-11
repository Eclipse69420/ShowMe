# Changelog

All notable changes to ShowMe will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Direct clipboard paste support for images and text (Ctrl+V)

## [0.1.0] - 2026-01-10

Initial release of ShowMe - a visual communication tool for Claude Code.

### Added

- Canvas drawing with multiple tools (pen, shapes, text, eraser)
- Multi-page support with page sidebar
- Annotation system with 4 types: pin, area, arrow, highlight
- Annotation feedback modal for adding notes
- Zoom and pan functionality (Ctrl+scroll, space+drag)
- Image import via file picker or paste
- Undo/redo support (Ctrl+Z, Ctrl+Y)
- WSL environment support
- Claude Code skill integration (`/showme`)

### Fixed

- Browser opening in WSL environment
- Race condition in HTTP response handling
- Annotation sidebar display bugs
- Server process cleanup after sending results
