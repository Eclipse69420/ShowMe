# ShowMe - Visual Mockup & Annotation Tool for Claude Code

ShowMe lets you create visual mockups with coordinate-tracked annotations. Draw on multiple pages, add pins/areas/arrows/highlights, and provide component-specific feedback.

## Instructions for Claude

When the user invokes `/showme`, execute this command and wait for the result:

```bash
bun run /mnt/c/Users/dell/Documents/Projects/ShowMe/server/index.ts
```

The command will:

1. Open a browser with a multi-page drawing canvas
2. Let the user create pages (blank or from images), draw, and add annotations
3. Output JSON with structured page and annotation data

### Processing the Output

The output JSON has this structure:

```json
{
  "hookSpecificOutput": {
    "decision": { "behavior": "allow" },
    "showme": {
      "pages": [
        {
          "id": "page-uuid",
          "name": "Page 1",
          "image": "data:image/png;base64,...",
          "width": 800,
          "height": 600,
          "annotations": [
            {
              "id": "ann-uuid",
              "type": "pin|area|arrow|highlight",
              "number": 1,
              "bounds": { "x": 100, "y": 150, "width": 50, "height": 50 },
              "feedback": "User's feedback for this specific component"
            }
          ]
        }
      ],
      "globalNotes": "Overall notes/context from the user"
    }
  }
}
```

**To process the result:**

```bash
# Extract the first page image
python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
pages = data.get('hookSpecificOutput', {}).get('showme', {}).get('pages', [])
if pages:
    img_data = pages[0]['image'].split(',')[1]
    sys.stdout.buffer.write(base64.b64decode(img_data))
" < <output_file> > /tmp/showme-page-1.png
```

Then:

1. **Read each page image** to view the visual mockup
2. **Review annotations** - each has coordinates (`bounds`) and `feedback` text
3. **Read globalNotes** for overall context or questions

### Understanding Annotations

Annotations are coordinate-tracked markers on the canvas:

| Type        | Description                | Key Fields                            |
| ----------- | -------------------------- | ------------------------------------- |
| `pin`       | Numbered marker at a point | `bounds.x`, `bounds.y` (center point) |
| `area`      | Rectangle selection        | `bounds` (x, y, width, height)        |
| `arrow`     | Directional arrow          | `bounds` covers start-to-end region   |
| `highlight` | Freehand highlight stroke  | `bounds` covers the stroke area       |

Each annotation has:

- `number` - Display order (1, 2, 3...)
- `bounds` - Location/size on the canvas
- `feedback` - User's text feedback for that specific component

**IMPORTANT:** The `feedback` field on each annotation contains component-specific feedback. The user marked that exact location to give targeted feedback about that UI element.

## User Instructions

### Drawing Tools

- **P** - Pen (free draw)
- **R** - Rectangle
- **C** - Circle
- **A** - Arrow
- **T** - Text labels
- **E** - Eraser

### Annotation Tools

- **M** - Toggle annotation mode
- **1** - Pin (numbered markers)
- **2** - Area (selection rectangles)
- **3** - Arrow (directional pointers)
- **4** - Highlight (freehand highlighting)

### Page Management

- Click **+** to add blank page or import image
- Click page thumbnail to switch pages
- Each page has its own annotations and undo history

### Actions

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
