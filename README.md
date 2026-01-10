# ShowMe

## Claude Code Is Blind. And It's Costing You Hours.

Here's the thing nobody talks about:

**Claude Code is arguably the most powerful AI coding assistant on the planet.** It can refactor entire codebases. Write complex features from scratch. Debug problems that would take you hours to figure out.

But it has one fatal flaw.

**It can't see your screen.**

Think about that for a second. You're staring at a button that's 3 pixels off. A form that looks janky. A layout that's completely wrong. And you're sitting there trying to _describe_ it in words.

"The button should be more to the left."

"The spacing looks weird."

"It's not quite right... can you try again?"

Sound familiar?

---

## The Feedback Loop From Hell

You know what happens next. Claude makes a change. You refresh. It's still wrong. You try to explain again. Claude tries again. Still wrong.

**This is the feedback loop from hell.**

And yes, there are workarounds:

- **Chrome extensions** that capture screenshots - but Claude can't interact with them contextually
- **Playwright/browser automation** - powerful, but now you're debugging your debugging tool
- **Taking screenshots manually** - works, but good luck pointing to exactly what's wrong

None of these solve the real problem: **giving Claude precise, component-level feedback with exact coordinates.**

---

## Enter ShowMe

ShowMe is a visual mockup and annotation tool built specifically for Claude Code.

Type `/showme` and a canvas opens. Now you can:

1. **Paste your screenshot** or draw from scratch
2. **Drop numbered pins** exactly where the problem is
3. **Draw boxes around components** that need work
4. **Add arrows** showing where things should move
5. **Write feedback for each annotation** - Claude sees exactly what you mean

When you click "Send to Claude," it doesn't just get an image. It gets **structured data with exact pixel coordinates** for every annotation you made.

No more "move it to the left." Now it's: _"Annotation #3 at coordinates (452, 128) - this button needs 16px more margin-right."_

**Claude finally sees what you see.**

---

## Why This Is Better

| Approach          | Can Claude See? | Precise Coordinates? | Component-Level Feedback? |
| ----------------- | --------------- | -------------------- | ------------------------- |
| Text descriptions | No              | No                   | No                        |
| Screenshot paste  | Yes             | No                   | No                        |
| Chrome extension  | Yes             | No                   | No                        |
| Playwright        | Yes             | Requires code        | Requires code             |
| **ShowMe**        | **Yes**         | **Yes**              | **Yes**                   |

ShowMe is the only tool that gives Claude:

- The visual context it needs
- Exact coordinates for every piece of feedback
- Multi-page support for complex flows
- Structured data it can actually act on

---

## See It In Action

```
You: /showme

[Canvas opens - you paste a screenshot of your app]
[You click to drop Pin #1 on a misaligned button]
[You draw Area #2 around the navigation]
[You add Arrow #3 pointing where the logo should move]

[For each annotation, you type specific feedback]

[Click "Send to Claude"]

Claude: I can see the issues clearly:
- Pin #1 (452, 128): The submit button - I'll add margin-right: 16px
- Area #2 (0, 0, 1200, 64): The navigation - I'll fix the flexbox alignment
- Arrow #3: Moving the logo 24px left as indicated

Let me make these changes...
```

**That's the feedback loop you deserve.**

---

## Features

### Multi-Page Support

- Create multiple pages to organize your mockups
- Import images/screenshots as page references
- Add blank pages for freehand drawing
- Per-page state management with independent undo/redo

### Drawing Tools

- **Pen** (P) - Freehand drawing
- **Rectangle** (R) - Draw rectangles
- **Circle** (C) - Draw circles/ellipses
- **Arrow** (A) - Draw arrows with arrowheads
- **Text** (T) - Add text labels
- **Eraser** (E) - Erase areas

### Annotation System

Track component-specific feedback with coordinate-aware annotations:

- **Pin** (1) - Click to place numbered markers
- **Area** (2) - Draw selection rectangles to highlight regions
- **Arrow** (3) - Draw directional arrows for flow/connections
- **Highlight** (4) - Freehand highlighting

Each annotation:

- Has a unique number for easy reference
- Stores exact coordinates and bounds
- Supports individual feedback/comments
- Appears in the feedback sidebar

### Feedback UI

- **Sidebar** - View all annotations with inline feedback editing
- **Popover** - Click any annotation on canvas for quick feedback entry
- **Sync** - Changes sync between sidebar and popover in real-time

---

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime

### Setup

```bash
# Clone the repository
git clone https://github.com/yaronbeen/ShowMe.git
cd ShowMe

# Install dependencies
bun install

# Run the development server
bun run dev
```

---

## Usage

### As a Claude Code Plugin

ShowMe integrates with Claude Code as a hook/skill. When invoked via `/showme`:

1. A browser window opens with the drawing canvas
2. Draw your mockup or import an image
3. Add annotations to mark specific areas
4. Add feedback for each annotation
5. Click "Send to Claude" to submit

### Keyboard Shortcuts

**Zoom & Pan:**

- `Ctrl + +` - Zoom in
- `Ctrl + -` - Zoom out
- `Ctrl + 0` - Reset zoom and pan
- `Ctrl + Wheel` - Zoom with mouse scroll
- `Space + Drag` - Pan canvas
- `Middle Mouse + Drag` - Pan canvas

**Actions:**

- `Ctrl+Z` - Undo
- `Ctrl+Y` / `Ctrl+Shift+Z` - Redo
- `Ctrl+V` - Paste screenshot from clipboard
- `Delete` / `Backspace` - Delete selected annotation
- `Escape` - Deselect / close popover

_Note: Tool selection shortcuts removed to prevent conflicts when typing feedback. Use the toolbar buttons instead._

### Workflow

1. **Create Pages** - Use the "+" button in the left sidebar to add blank pages or import images
2. **Draw** - Use drawing tools to create your mockup
3. **Annotate** - Switch to annotation mode and mark specific components
4. **Add Feedback** - Click annotations or use the sidebar to add detailed feedback
5. **Submit** - Send all pages with annotations to Claude

---

## Data Structure

When submitted, ShowMe sends structured data including:

```typescript
{
  pages: [
    {
      id: string,
      name: string,
      image: string,  // Base64 PNG
      width: number,
      height: number,
      annotations: [
        {
          id: string,
          type: "pin" | "area" | "arrow" | "highlight",
          number: number,
          bounds: { x, y, width, height },
          feedback: string
        }
      ]
    }
  ],
  globalNotes: string
}
```

---

## Development

### Project Structure

```
showme/
├── server/
│   └── index.ts        # Bun server with API endpoints
├── ui/
│   ├── index.html      # Main UI layout
│   ├── main.ts         # Canvas application logic
│   └── styles.css      # Styling
├── skills/
│   └── showme.md       # Claude Code skill definition
├── hooks/
│   └── hooks.json      # Hook configuration
└── package.json
```

### Building

```bash
# Build for production
bun run build

# Start production server
bun start
```

### Scripts

- `bun run dev` - Start development server with hot reload
- `bun run build` - Build for production
- `bun start` - Run the ShowMe server

---

## Configuration

The hook is configured in `hooks/hooks.json`:

```json
{
  "hooks": [
    {
      "matcher": { "type": "Skill", "skill_name": "showme" },
      "hooks": [
        {
          "type": "command",
          "command": "bun run server/index.ts",
          "timeout": 300
        }
      ]
    }
  ]
}
```

---

## License

MIT

---

**Stop describing. Start showing.**

`/showme`

---

Built with ❤️ by **Yaron - No Fluff**

[YouTube](https://www.youtube.com/channel/UCuCwMz8aMJBFfhDnYicfdjg/)
