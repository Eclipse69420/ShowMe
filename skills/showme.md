# ShowMe - Visual Mockup & Annotation Tool for Claude Code

ShowMe lets you create visual mockups with coordinate-tracked annotations across multiple pages. Draw, annotate, and provide component-specific feedback that Claude can see and act on.

## Instructions for Claude

When the user invokes `/showme`, execute this command and wait for the result:

```bash
bun run /mnt/c/Users/dell/Documents/Projects/ShowMe/server/index.ts
```

The command will:

1. Open a browser with a multi-page drawing canvas
2. Let the user create pages (blank or from images), draw, and add annotations
3. Output JSON with structured page and annotation data

---

## Processing the Output

**CRITICAL:**

- DO NOT try to read the raw output file directly - it contains base64 images and will exceed token limits
- ALWAYS use the extraction script below to process the output
- The script saves images to `/tmp/` and prints a text summary

**IMPORTANT:** The output may contain MULTIPLE pages. You MUST process ALL of them.

The output file path will be in the tool result. Pass it to this script:

```bash
python3 << 'EOF'
import sys, json, base64

# Read from file path (first argument) or use the standard Claude Code output location
output_file = sys.argv[1] if len(sys.argv) > 1 else None

if output_file:
    with open(output_file, 'r') as f:
        # Read only first line (JSON data, ignore any trailing content)
        data = json.loads(f.readline())
else:
    data = json.load(sys.stdin)

showme = data.get('hookSpecificOutput', {}).get('showme', {})
pages = showme.get('pages', [])
global_notes = showme.get('globalNotes', '')

print('=' * 60)
print(f'SHOWME OUTPUT: {len(pages)} page(s)')
print('=' * 60)

if global_notes:
    print(f'\nGLOBAL NOTES: {global_notes}\n')

for i, page in enumerate(pages):
    img_data = page.get('image', '')
    filename = f'/tmp/showme-page-{i+1}.png'

    if img_data and ',' in img_data:
        with open(filename, 'wb') as f:
            f.write(base64.b64decode(img_data.split(',')[1]))
        saved = f'saved to {filename}'
    else:
        saved = '(no image)'

    anns = page.get('annotations', [])
    w, h = page.get('width', 0), page.get('height', 0)

    print(f"\nPage {i+1}: \"{page.get('name', 'Untitled')}\" ({w}x{h})")
    print(f"  Image: {saved}")
    print(f"  Annotations: {len(anns)}")

    for ann in anns:
        b = ann.get('bounds', {})
        coord = f"({b.get('x', 0)}, {b.get('y', 0)})"
        if b.get('width') and b.get('height'):
            coord += f" {b.get('width')}x{b.get('height')}"

        feedback = ann.get('feedback', '')
        print(f"    #{ann.get('number', '?')} [{ann.get('type', '?')}] at {coord}")
        if feedback:
            print(f"       → \"{feedback}\"")

print('\n' + '=' * 60)
print('ACTION: Read each /tmp/showme-page-N.png to see the visuals')
print('=' * 60)
EOF
```

---

## After Running the Script

1. **Read the summary output** - Understand how many pages, what annotations exist
2. **Read EACH page image** - `/tmp/showme-page-1.png`, `/tmp/showme-page-2.png`, etc.
3. **Cross-reference annotations** - Each numbered marker has feedback text
4. **Address globalNotes** - This contains overall context or questions
5. **Acknowledge each annotation** - Let the user know you saw their specific feedback

---

## Understanding Annotations

Annotations are coordinate-tracked markers. Each has:

- `number` - Display order (1, 2, 3...) - unique across ALL pages
- `type` - The kind of marker (see below)
- `bounds` - Location on canvas: `{x, y, width, height}`
- `feedback` - User's specific feedback for that component

| Type        | What It Means                  | Bounds Usage                    |
| ----------- | ------------------------------ | ------------------------------- |
| `pin`       | Point marker (numbered circle) | x, y = center point             |
| `area`      | Rectangle selection            | x, y, width, height = full rect |
| `arrow`     | Directional pointer            | bounds covers start-to-end      |
| `highlight` | Freehand highlight stroke      | bounds covers the stroke area   |

**Coordinate System:** (0, 0) is top-left corner. X increases rightward, Y increases downward.

---

## Example Output

```
============================================================
SHOWME OUTPUT: 2 page(s)
============================================================

GLOBAL NOTES: Please review the login flow and fix alignment issues

Page 1: "Login Screen" (800x600)
  Image: saved to /tmp/showme-page-1.png
  Annotations: 2
    #1 [pin] at (452, 128)
       → "This button should be blue, not gray"
    #2 [area] at (0, 480) 800x120
       → "Footer needs more padding"

Page 2: "Dashboard" (800x600)
  Image: saved to /tmp/showme-page-2.png
  Annotations: 1
    #3 [arrow] at (200, 300) 150x50
       → "Move this chart to the left sidebar"

============================================================
ACTION: Read each /tmp/showme-page-N.png to see the visuals
============================================================
```

---

## User Instructions

### Tools (use toolbar buttons)

**Drawing:** Pen, Rectangle, Circle, Arrow, Text, Eraser

**Annotations:** Pin, Area, Arrow, Highlight

### Page Management

- Click **+** to add blank page or import image
- Click page thumbnail to switch pages
- Each page has its own annotations and undo history

### Zoom & Pan

- **Ctrl + Wheel** - Zoom with mouse wheel
- **Space + Drag** - Pan canvas
- Toolbar buttons: Zoom in, Zoom out, Fit, Reset

### Keyboard Shortcuts

- **Ctrl+V** - Paste screenshot
- **Ctrl+Z** - Undo
- **Ctrl+Y** - Redo
- **Delete** - Remove selected annotation
- **Escape** - Deselect / close popover

### Workflow

1. Create pages (blank or from imported images/screenshots)
2. Draw your mockup using drawing tools
3. Switch to annotation mode and add markers
4. Click annotations to add component-specific feedback
5. Add global notes at the bottom for overall context
6. Click "Send to Claude" when done

---

Built with ❤️ by **Yaron - No Fluff** | [YouTube](https://www.youtube.com/channel/UCuCwMz8aMJBFfhDnYicfdjg/)
