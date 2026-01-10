// ============================================
// TYPE DEFINITIONS
// ============================================

type Tool = "pen" | "rect" | "circle" | "arrow" | "text" | "eraser";
type AnnotationType = "pin" | "area" | "arrow" | "highlight";

interface Point {
  x: number;
  y: number;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DrawAction {
  imageData: ImageData;
  annotations: Annotation[];
}

interface Annotation {
  id: string;
  type: AnnotationType;
  number: number;
  position: Point;
  bounds: BoundingBox;
  points?: Point[];
  startPoint?: Point;
  endPoint?: Point;
  feedback: string;
  createdAt: number;
}

interface Page {
  id: string;
  name: string;
  imageData: ImageData | null;
  undoStack: DrawAction[];
  redoStack: DrawAction[];
  backgroundImage: HTMLImageElement | null;
  annotations: Annotation[];
  createdAt: number;
}

interface PageSubmitData {
  id: string;
  name: string;
  image: string;
  width: number;
  height: number;
  annotations: Array<{
    id: string;
    type: string;
    number: number;
    bounds: BoundingBox;
    feedback: string;
  }>;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// ANNOTATION RENDERER
// ============================================

class AnnotationRenderer {
  private ctx: CanvasRenderingContext2D;
  private readonly COLORS = {
    default: "#FF6B35",
    selected: "#00D4FF",
    hover: "#FFD700",
  };
  private readonly PIN_RADIUS = 14;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  renderAll(annotations: Annotation[], selectedId: string | null): void {
    this.clear();
    // Render unselected first, then selected on top
    for (const ann of annotations) {
      if (ann.id !== selectedId) {
        this.render(ann, false);
      }
    }
    if (selectedId) {
      const selected = annotations.find((a) => a.id === selectedId);
      if (selected) this.render(selected, true);
    }
  }

  render(ann: Annotation, isSelected: boolean): void {
    const color = isSelected ? this.COLORS.selected : this.COLORS.default;

    switch (ann.type) {
      case "pin":
        this.renderPin(ann, color, isSelected);
        break;
      case "area":
        this.renderArea(ann, color, isSelected);
        break;
      case "arrow":
        this.renderArrow(ann, color, isSelected);
        break;
      case "highlight":
        this.renderHighlight(ann, color);
        break;
    }
  }

  private renderPin(ann: Annotation, color: string, isSelected: boolean): void {
    const { position, number } = ann;

    // Selection glow
    if (isSelected) {
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 15;
    }

    // Pin circle
    this.ctx.beginPath();
    this.ctx.arc(position.x, position.y, this.PIN_RADIUS, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = "#FFFFFF";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Number
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.font = "bold 12px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(String(number), position.x, position.y);
  }

  private renderArea(
    ann: Annotation,
    color: string,
    isSelected: boolean,
  ): void {
    const { bounds, number } = ann;

    // Dashed rectangle
    this.ctx.setLineDash([6, 4]);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    this.ctx.setLineDash([]);

    // Semi-transparent fill
    this.ctx.fillStyle = color + "20";
    this.ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // Number badge
    this.renderBadge(bounds.x + 12, bounds.y + 12, number, color);

    // Selection handles
    if (isSelected) {
      this.renderHandles(bounds);
    }
  }

  private renderArrow(
    ann: Annotation,
    color: string,
    isSelected: boolean,
  ): void {
    if (!ann.startPoint || !ann.endPoint) return;

    const { startPoint, endPoint, number } = ann;

    if (isSelected) {
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 8;
    }

    // Arrow line
    this.ctx.beginPath();
    this.ctx.moveTo(startPoint.x, startPoint.y);
    this.ctx.lineTo(endPoint.x, endPoint.y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(
      endPoint.y - startPoint.y,
      endPoint.x - startPoint.x,
    );
    const headLength = 15;
    this.ctx.beginPath();
    this.ctx.moveTo(endPoint.x, endPoint.y);
    this.ctx.lineTo(
      endPoint.x - headLength * Math.cos(angle - Math.PI / 6),
      endPoint.y - headLength * Math.sin(angle - Math.PI / 6),
    );
    this.ctx.lineTo(
      endPoint.x - headLength * Math.cos(angle + Math.PI / 6),
      endPoint.y - headLength * Math.sin(angle + Math.PI / 6),
    );
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();

    this.ctx.shadowBlur = 0;

    // Number badge at midpoint
    const midX = (startPoint.x + endPoint.x) / 2;
    const midY = (startPoint.y + endPoint.y) / 2;
    this.renderBadge(midX, midY - 15, number, color);
  }

  private renderHighlight(ann: Annotation, color: string): void {
    if (!ann.points || ann.points.length < 2) return;

    const { points, number } = ann;

    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.strokeStyle = color + "80";
    this.ctx.lineWidth = 20;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.stroke();

    // Number badge
    this.renderBadge(points[0].x, points[0].y - 20, number, color);
  }

  private renderBadge(
    x: number,
    y: number,
    number: number,
    color: string,
  ): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, 10, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = "#FFFFFF";
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.font = "bold 10px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(String(number), x, y);
  }

  private renderHandles(bounds: BoundingBox): void {
    const size = 6;
    const handles = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x, y: bounds.y + bounds.height },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ];

    for (const h of handles) {
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.fillRect(h.x - size / 2, h.y - size / 2, size, size);
      this.ctx.strokeStyle = this.COLORS.selected;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(h.x - size / 2, h.y - size / 2, size, size);
    }
  }
}

// ============================================
// HIT TESTER
// ============================================

class HitTester {
  private readonly PIN_RADIUS = 18;
  private readonly LINE_TOLERANCE = 10;

  test(point: Point, annotations: Annotation[]): Annotation | null {
    // Test in reverse (newest on top)
    for (let i = annotations.length - 1; i >= 0; i--) {
      if (this.isHit(point, annotations[i])) {
        return annotations[i];
      }
    }
    return null;
  }

  private isHit(point: Point, ann: Annotation): boolean {
    // Quick bounds check
    if (!this.inBounds(point, ann.bounds)) return false;

    switch (ann.type) {
      case "pin":
        return this.distanceTo(point, ann.position) <= this.PIN_RADIUS;
      case "area":
        return true; // Already passed bounds
      case "arrow":
        if (!ann.startPoint || !ann.endPoint) return false;
        return this.onLine(point, ann.startPoint, ann.endPoint);
      case "highlight":
        if (!ann.points || ann.points.length < 2) return false;
        return this.onPath(point, ann.points);
      default:
        return false;
    }
  }

  private inBounds(point: Point, bounds: BoundingBox): boolean {
    return (
      point.x >= bounds.x - 5 &&
      point.x <= bounds.x + bounds.width + 5 &&
      point.y >= bounds.y - 5 &&
      point.y <= bounds.y + bounds.height + 5
    );
  }

  private distanceTo(a: Point, b: Point): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private onLine(point: Point, start: Point, end: Point): boolean {
    const dist = this.pointToLineDistance(point, start, end);
    return dist <= this.LINE_TOLERANCE;
  }

  private onPath(point: Point, points: Point[]): boolean {
    for (let i = 0; i < points.length - 1; i++) {
      if (this.pointToLineDistance(point, points[i], points[i + 1]) <= 15) {
        return true;
      }
    }
    return false;
  }

  private pointToLineDistance(p: Point, a: Point, b: Point): number {
    const A = p.x - a.x;
    const B = p.y - a.y;
    const C = b.x - a.x;
    const D = b.y - a.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;

    let xx: number, yy: number;
    if (param < 0) {
      xx = a.x;
      yy = a.y;
    } else if (param > 1) {
      xx = b.x;
      yy = b.y;
    } else {
      xx = a.x + param * C;
      yy = a.y + param * D;
    }

    return Math.sqrt((p.x - xx) ** 2 + (p.y - yy) ** 2);
  }
}

// ============================================
// MAIN CANVAS CLASS
// ============================================

class ShowMeCanvas {
  // Canvases
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private annotationCanvas: HTMLCanvasElement;
  private annotationRenderer: AnnotationRenderer;
  private hitTester: HitTester;

  // Drawing state
  private currentTool: Tool = "pen";
  private isDrawing = false;
  private startPoint: Point = { x: 0, y: 0 };
  private lastPoint: Point = { x: 0, y: 0 };
  private color = "#000000";
  private brushSize = 3;

  // Annotation state
  private annotationMode = false;
  private currentAnnotationType: AnnotationType = "pin";
  private selectedAnnotationId: string | null = null;
  private isCreatingAnnotation = false;
  private highlightPoints: Point[] = [];
  private nextAnnotationNumber = 1;

  // Page state
  private pages: Page[] = [];
  private currentPageIndex = 0;

  // Text modal
  private textPoint: Point = { x: 0, y: 0 };

  // Resize debounce
  private resizeTimeout: number | null = null;

  // Zoom and pan state
  private scale = 1.0;
  private minScale = 0.25;
  private maxScale = 4.0;
  private scaleStep = 0.1;
  private panOffset: Point = { x: 0, y: 0 };
  private isPanning = false;
  private lastPanPoint: Point = { x: 0, y: 0 };
  private spaceHeld = false;
  private canvasWrapper: HTMLElement | null = null;

  constructor() {
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.annotationCanvas = document.getElementById(
      "annotation-canvas",
    ) as HTMLCanvasElement;
    this.annotationRenderer = new AnnotationRenderer(this.annotationCanvas);
    this.hitTester = new HitTester();
    this.canvasWrapper = document.querySelector(".canvas-wrapper");

    this.initCanvas();
    this.bindEvents();
    this.createInitialPage();
    this.renderPageSidebar();
    this.renderFeedbackSidebar();
  }

  private initCanvas(): void {
    const container = document.querySelector(".canvas-wrapper") as HTMLElement;
    const maxWidth = Math.min(1200, window.innerWidth - 420);
    const maxHeight = Math.min(800, window.innerHeight - 200);

    this.canvas.width = maxWidth;
    this.canvas.height = maxHeight;
    this.annotationCanvas.width = maxWidth;
    this.annotationCanvas.height = maxHeight;

    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  private createInitialPage(): void {
    const page = this.createPage("Page 1");
    this.pages.push(page);
    this.saveState();
  }

  private createPage(name: string): Page {
    return {
      id: generateId(),
      name,
      imageData: null,
      undoStack: [],
      redoStack: [],
      backgroundImage: null,
      annotations: [],
      createdAt: Date.now(),
    };
  }

  private get currentPage(): Page {
    return this.pages[this.currentPageIndex];
  }

  // ============================================
  // EVENT BINDING
  // ============================================

  private bindEvents(): void {
    // Main canvas events
    this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.onMouseUp.bind(this));

    // Touch support
    this.canvas.addEventListener("touchstart", this.onTouchStart.bind(this));
    this.canvas.addEventListener("touchmove", this.onTouchMove.bind(this));
    this.canvas.addEventListener("touchend", this.onMouseUp.bind(this));

    // Annotation canvas events
    this.annotationCanvas.addEventListener(
      "mousedown",
      this.onAnnotationMouseDown.bind(this),
    );
    this.annotationCanvas.addEventListener(
      "mousemove",
      this.onAnnotationMouseMove.bind(this),
    );
    this.annotationCanvas.addEventListener(
      "mouseup",
      this.onAnnotationMouseUp.bind(this),
    );

    // Drawing tool buttons
    document
      .getElementById("tool-pen")!
      .addEventListener("click", () => this.setTool("pen"));
    document
      .getElementById("tool-rect")!
      .addEventListener("click", () => this.setTool("rect"));
    document
      .getElementById("tool-circle")!
      .addEventListener("click", () => this.setTool("circle"));
    document
      .getElementById("tool-arrow")!
      .addEventListener("click", () => this.setTool("arrow"));
    document
      .getElementById("tool-text")!
      .addEventListener("click", () => this.setTool("text"));
    document
      .getElementById("tool-eraser")!
      .addEventListener("click", () => this.setTool("eraser"));

    // Annotation tool buttons
    document
      .getElementById("tool-pin")!
      .addEventListener("click", () => this.setAnnotationTool("pin"));
    document
      .getElementById("tool-area")!
      .addEventListener("click", () => this.setAnnotationTool("area"));
    document
      .getElementById("tool-ann-arrow")!
      .addEventListener("click", () => this.setAnnotationTool("arrow"));
    document
      .getElementById("tool-highlight")!
      .addEventListener("click", () => this.setAnnotationTool("highlight"));
    document
      .getElementById("toggle-annotation-mode")!
      .addEventListener("click", () => this.toggleAnnotationMode());

    // Color and size
    const colorPicker = document.getElementById(
      "color-picker",
    ) as HTMLInputElement;
    colorPicker.addEventListener("input", (e) => {
      this.color = (e.target as HTMLInputElement).value;
    });

    const brushSizeInput = document.getElementById(
      "brush-size",
    ) as HTMLInputElement;
    const brushSizeLabel = document.getElementById("brush-size-label")!;
    brushSizeInput.addEventListener("input", (e) => {
      this.brushSize = parseInt((e.target as HTMLInputElement).value);
      brushSizeLabel.textContent = `${this.brushSize}px`;
    });

    // Actions
    document
      .getElementById("btn-undo")!
      .addEventListener("click", () => this.undo());
    document
      .getElementById("btn-redo")!
      .addEventListener("click", () => this.redo());
    document
      .getElementById("btn-clear")!
      .addEventListener("click", () => this.clear());
    document.getElementById("btn-import")!.addEventListener("click", () => {
      document.getElementById("file-input")!.click();
    });
    document
      .getElementById("file-input")!
      .addEventListener("change", this.onFileImport.bind(this));

    // Page management
    document
      .getElementById("btn-add-page")!
      .addEventListener("click", () => this.showAddPageMenu());
    document
      .getElementById("add-blank-page")!
      .addEventListener("click", () => this.addBlankPage());
    document.getElementById("add-image-page")!.addEventListener("click", () => {
      document.getElementById("page-file-input")!.click();
    });
    document
      .getElementById("page-file-input")!
      .addEventListener("change", this.onPageImageImport.bind(this));

    // Send/Cancel
    document
      .getElementById("btn-send")!
      .addEventListener("click", () => this.sendToServer());
    document
      .getElementById("btn-cancel")!
      .addEventListener("click", () => this.cancel());

    // Text modal
    document
      .getElementById("text-submit")!
      .addEventListener("click", () => this.submitText());
    document.getElementById("text-input")!.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submitText();
      if (e.key === "Escape") this.hideTextModal();
    });

    // Popover
    document
      .getElementById("popover-close")!
      .addEventListener("click", () => this.hidePopover());
    document
      .getElementById("popover-save")!
      .addEventListener("click", () => this.savePopoverFeedback());

    // Sidebar toggle
    document.getElementById("sidebar-toggle")!.addEventListener("click", () => {
      document
        .getElementById("feedback-sidebar")!
        .classList.toggle("collapsed");
    });

    // Zoom controls
    document
      .getElementById("zoom-in")!
      .addEventListener("click", () => this.zoomIn());
    document
      .getElementById("zoom-out")!
      .addEventListener("click", () => this.zoomOut());
    document
      .getElementById("zoom-fit")!
      .addEventListener("click", () => this.zoomFit());
    document
      .getElementById("zoom-reset")!
      .addEventListener("click", () => this.zoomReset());

    // Zoom with mouse wheel (Ctrl + scroll)
    this.canvas.addEventListener("wheel", this.onWheel.bind(this), {
      passive: false,
    });
    this.annotationCanvas.addEventListener("wheel", this.onWheel.bind(this), {
      passive: false,
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", this.onKeyDown.bind(this));
    document.addEventListener("keyup", this.onKeyUp.bind(this));
    document.addEventListener("paste", this.onPaste.bind(this));

    // Click outside to close menus
    document.addEventListener("click", (e) => {
      const addMenu = document.getElementById("add-page-menu")!;
      const addBtn = document.getElementById("btn-add-page")!;
      if (
        !addMenu.contains(e.target as Node) &&
        !addBtn.contains(e.target as Node)
      ) {
        addMenu.classList.add("hidden");
      }
    });

    // Window resize with debouncing
    window.addEventListener("resize", () => {
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = window.setTimeout(() => {
        this.handleResize();
        this.resizeTimeout = null;
      }, 150);
    });
  }

  // ============================================
  // TOOL MANAGEMENT
  // ============================================

  private setTool(tool: Tool): void {
    this.currentTool = tool;
    this.annotationMode = false;
    this.updateToolUI();
    document
      .querySelector(".canvas-wrapper")!
      .classList.remove("annotation-mode");
    this.canvas.style.cursor = tool === "text" ? "text" : "crosshair";
  }

  private setAnnotationTool(type: AnnotationType): void {
    this.currentAnnotationType = type;
    this.annotationMode = true;
    this.updateToolUI();
    document.querySelector(".canvas-wrapper")!.classList.add("annotation-mode");
    this.annotationCanvas.style.cursor = "crosshair";
  }

  private toggleAnnotationMode(): void {
    this.annotationMode = !this.annotationMode;
    this.updateToolUI();
    document
      .querySelector(".canvas-wrapper")!
      .classList.toggle("annotation-mode", this.annotationMode);
  }

  private updateToolUI(): void {
    document
      .querySelectorAll(".tool-btn, .ann-tool-btn")
      .forEach((btn) => btn.classList.remove("active"));

    if (this.annotationMode) {
      document
        .getElementById("toggle-annotation-mode")!
        .classList.add("active");
      document
        .getElementById(
          `tool-${this.currentAnnotationType === "arrow" ? "ann-arrow" : this.currentAnnotationType}`,
        )
        ?.classList.add("active");
    } else {
      document
        .getElementById(`tool-${this.currentTool}`)
        ?.classList.add("active");
    }
  }

  // ============================================
  // ZOOM AND PAN
  // ============================================

  private setZoom(newScale: number): void {
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    this.applyTransform();
    this.updateZoomDisplay();
  }

  private zoomIn(): void {
    this.setZoom(this.scale + this.scaleStep);
  }

  private zoomOut(): void {
    this.setZoom(this.scale - this.scaleStep);
  }

  private zoomReset(): void {
    this.scale = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.applyTransform();
    this.updateZoomDisplay();
  }

  private zoomFit(): void {
    const container = document.querySelector(
      ".canvas-container",
    ) as HTMLElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const padding = 40;
    const availableWidth = containerRect.width - padding * 2;
    const availableHeight = containerRect.height - padding * 2;

    const scaleX = availableWidth / this.canvas.width;
    const scaleY = availableHeight / this.canvas.height;
    const fitScale = Math.min(scaleX, scaleY, 1);

    this.scale = fitScale;
    this.panOffset = { x: 0, y: 0 };
    this.applyTransform();
    this.updateZoomDisplay();
  }

  private applyTransform(): void {
    if (!this.canvasWrapper) return;
    this.canvasWrapper.style.transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.scale})`;
    this.canvasWrapper.style.transformOrigin = "center center";
  }

  private updateZoomDisplay(): void {
    const zoomLevel = document.getElementById("zoom-level");
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  private startPan(e: MouseEvent): void {
    if (e.button === 1 || this.spaceHeld) {
      this.isPanning = true;
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      if (this.canvasWrapper) {
        this.canvasWrapper.style.cursor = "grabbing";
      }
      e.preventDefault();
    }
  }

  private doPan(e: MouseEvent): void {
    if (!this.isPanning) return;
    const dx = e.clientX - this.lastPanPoint.x;
    const dy = e.clientY - this.lastPanPoint.y;
    this.panOffset.x += dx;
    this.panOffset.y += dy;
    this.lastPanPoint = { x: e.clientX, y: e.clientY };
    this.applyTransform();
  }

  private endPan(): void {
    this.isPanning = false;
    if (this.canvasWrapper) {
      this.canvasWrapper.style.cursor = this.spaceHeld ? "grab" : "";
    }
  }

  // ============================================
  // DRAWING EVENTS
  // ============================================

  private getPoint(e: MouseEvent | Touch): Point {
    const rect = this.canvas.getBoundingClientRect();
    // Account for zoom scale when calculating canvas coordinates
    return {
      x: (e.clientX - rect.left) / this.scale,
      y: (e.clientY - rect.top) / this.scale,
    };
  }

  private onMouseDown(e: MouseEvent): void {
    // Pan with middle mouse button or space key
    if (e.button === 1 || this.spaceHeld) {
      e.preventDefault();
      this.startPan(e);
      return;
    }
    if (this.annotationMode) return;
    const point = this.getPoint(e);
    this.startDrawing(point);
  }

  private onTouchStart(e: TouchEvent): void {
    if (this.annotationMode) return;
    e.preventDefault();
    const point = this.getPoint(e.touches[0]);
    this.startDrawing(point);
  }

  private startDrawing(point: Point): void {
    if (this.currentTool === "text") {
      this.showTextModal(point);
      return;
    }

    this.isDrawing = true;
    this.startPoint = point;
    this.lastPoint = point;

    if (this.currentTool === "pen" || this.currentTool === "eraser") {
      this.ctx.beginPath();
      this.ctx.moveTo(point.x, point.y);
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      this.doPan(e);
      return;
    }
    if (!this.isDrawing || this.annotationMode) return;
    const point = this.getPoint(e);
    this.draw(point);
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.isDrawing || this.annotationMode) return;
    e.preventDefault();
    const point = this.getPoint(e.touches[0]);
    this.draw(point);
  }

  private draw(point: Point): void {
    if (this.currentTool === "pen" || this.currentTool === "eraser") {
      this.ctx.strokeStyle =
        this.currentTool === "eraser" ? "#ffffff" : this.color;
      this.ctx.lineWidth =
        this.currentTool === "eraser" ? this.brushSize * 3 : this.brushSize;
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(point.x, point.y);
    } else {
      this.restoreLastState();
      this.drawShape(this.startPoint, point, true);
    }
    this.lastPoint = point;
  }

  private onMouseUp(): void {
    if (this.isPanning) {
      this.endPan();
      return;
    }
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (
      this.currentTool !== "pen" &&
      this.currentTool !== "eraser" &&
      this.currentTool !== "text"
    ) {
      this.restoreLastState();
      this.drawShape(this.startPoint, this.lastPoint, false);
    }

    this.saveState();
  }

  private drawShape(start: Point, end: Point, isPreview: boolean): void {
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.brushSize;

    if (isPreview) {
      this.ctx.setLineDash([5, 5]);
    } else {
      this.ctx.setLineDash([]);
    }

    switch (this.currentTool) {
      case "rect":
        this.ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        break;
      case "circle":
        const radiusX = Math.abs(end.x - start.x) / 2;
        const radiusY = Math.abs(end.y - start.y) / 2;
        const centerX = start.x + (end.x - start.x) / 2;
        const centerY = start.y + (end.y - start.y) / 2;
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        this.ctx.stroke();
        break;
      case "arrow":
        this.drawArrow(start, end);
        break;
    }

    this.ctx.setLineDash([]);
  }

  private drawArrow(start: Point, end: Point): void {
    const headLength = 15;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6),
    );
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6),
    );
    this.ctx.stroke();
  }

  // ============================================
  // ANNOTATION EVENTS
  // ============================================

  private onAnnotationMouseDown(e: MouseEvent): void {
    if (!this.annotationMode) return;

    const point = this.getPoint(e);
    const hit = this.hitTester.test(point, this.currentPage.annotations);

    if (hit) {
      this.selectAnnotation(hit.id);
      this.showPopover(hit, e.clientX, e.clientY);
    } else {
      this.isCreatingAnnotation = true;
      this.startPoint = point;
      this.highlightPoints = [point];
      this.selectedAnnotationId = null;
      this.hidePopover();
    }

    this.renderAnnotations();
  }

  private onAnnotationMouseMove(e: MouseEvent): void {
    if (!this.isCreatingAnnotation) return;

    const point = this.getPoint(e);

    if (this.currentAnnotationType === "highlight") {
      this.highlightPoints.push(point);
    }

    this.lastPoint = point;
  }

  private onAnnotationMouseUp(e: MouseEvent): void {
    if (!this.isCreatingAnnotation) return;

    const point = this.getPoint(e);
    this.createAnnotation(point);
    this.isCreatingAnnotation = false;
    this.highlightPoints = [];
  }

  private createAnnotation(endPoint: Point): void {
    const ann: Annotation = {
      id: generateId(),
      type: this.currentAnnotationType,
      number: this.nextAnnotationNumber++,
      position: { ...this.startPoint },
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      feedback: "",
      createdAt: Date.now(),
    };

    switch (this.currentAnnotationType) {
      case "pin":
        ann.position = endPoint;
        ann.bounds = {
          x: endPoint.x - 14,
          y: endPoint.y - 14,
          width: 28,
          height: 28,
        };
        break;

      case "area":
        const minX = Math.min(this.startPoint.x, endPoint.x);
        const minY = Math.min(this.startPoint.y, endPoint.y);
        const w = Math.abs(endPoint.x - this.startPoint.x);
        const h = Math.abs(endPoint.y - this.startPoint.y);
        if (w < 10 || h < 10) return; // Too small
        ann.position = { x: minX, y: minY };
        ann.bounds = { x: minX, y: minY, width: w, height: h };
        ann.startPoint = { ...this.startPoint };
        ann.endPoint = { ...endPoint };
        break;

      case "arrow":
        if (this.distanceBetween(this.startPoint, endPoint) < 20) return; // Too short
        ann.startPoint = { ...this.startPoint };
        ann.endPoint = { ...endPoint };
        ann.position = {
          x: (this.startPoint.x + endPoint.x) / 2,
          y: (this.startPoint.y + endPoint.y) / 2,
        };
        const arrowMinX = Math.min(this.startPoint.x, endPoint.x) - 10;
        const arrowMinY = Math.min(this.startPoint.y, endPoint.y) - 10;
        const arrowMaxX = Math.max(this.startPoint.x, endPoint.x) + 10;
        const arrowMaxY = Math.max(this.startPoint.y, endPoint.y) + 10;
        ann.bounds = {
          x: arrowMinX,
          y: arrowMinY,
          width: arrowMaxX - arrowMinX,
          height: arrowMaxY - arrowMinY,
        };
        break;

      case "highlight":
        if (this.highlightPoints.length < 3) return; // Too short
        ann.points = [...this.highlightPoints];
        ann.position = { ...this.highlightPoints[0] };
        ann.bounds = this.calculatePathBounds(this.highlightPoints);
        break;
    }

    this.currentPage.annotations.push(ann);
    this.selectAnnotation(ann.id);
    this.renderAnnotations();
    this.renderFeedbackSidebar();
    this.saveState();
  }

  private distanceBetween(a: Point, b: Point): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private calculatePathBounds(points: Point[]): BoundingBox {
    let minX = points[0].x,
      maxX = points[0].x;
    let minY = points[0].y,
      maxY = points[0].y;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    return {
      x: minX - 15,
      y: minY - 15,
      width: maxX - minX + 30,
      height: maxY - minY + 30,
    };
  }

  private selectAnnotation(id: string): void {
    this.selectedAnnotationId = id;
    this.renderAnnotations();
    this.renderFeedbackSidebar();
  }

  private renderAnnotations(): void {
    this.annotationRenderer.renderAll(
      this.currentPage.annotations,
      this.selectedAnnotationId,
    );
  }

  // ============================================
  // POPOVER
  // ============================================

  private showPopover(ann: Annotation, clientX: number, clientY: number): void {
    const popover = document.getElementById("feedback-popover")!;
    const textarea = document.getElementById(
      "popover-feedback",
    ) as HTMLTextAreaElement;

    textarea.value = ann.feedback;
    popover.dataset.annotationId = ann.id;

    // Position popover
    const rect = document
      .querySelector(".canvas-container")!
      .getBoundingClientRect();
    let left = clientX + 15;
    let top = clientY - 80;

    if (left + 300 > rect.right) {
      left = clientX - 315;
    }
    if (top < rect.top) top = rect.top + 10;
    if (top + 160 > rect.bottom) top = rect.bottom - 170;

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.classList.remove("hidden");
    textarea.focus();
  }

  private hidePopover(): void {
    this.savePopoverFeedback();
    document.getElementById("feedback-popover")!.classList.add("hidden");
  }

  private savePopoverFeedback(): void {
    const popover = document.getElementById("feedback-popover")!;
    const textarea = document.getElementById(
      "popover-feedback",
    ) as HTMLTextAreaElement;
    const annId = popover.dataset.annotationId;

    if (annId) {
      const ann = this.currentPage.annotations.find((a) => a.id === annId);
      if (ann && ann.feedback !== textarea.value) {
        ann.feedback = textarea.value;
        this.renderFeedbackSidebar();
      }
    }
  }

  // ============================================
  // TEXT MODAL
  // ============================================

  private showTextModal(point: Point): void {
    this.textPoint = point;
    const modal = document.getElementById("text-input-modal")!;
    const input = document.getElementById("text-input") as HTMLInputElement;
    modal.classList.remove("hidden");
    input.value = "";
    input.focus();
  }

  private hideTextModal(): void {
    document.getElementById("text-input-modal")!.classList.add("hidden");
  }

  private submitText(): void {
    const input = document.getElementById("text-input") as HTMLInputElement;
    const text = input.value.trim();
    if (text) {
      this.ctx.font = `${this.brushSize * 5}px sans-serif`;
      this.ctx.fillStyle = this.color;
      this.ctx.fillText(text, this.textPoint.x, this.textPoint.y);
      this.saveState();
    }
    this.hideTextModal();
  }

  // ============================================
  // UNDO/REDO STATE
  // ============================================

  private saveState(): void {
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    const annotations = JSON.parse(
      JSON.stringify(this.currentPage.annotations),
    );

    this.currentPage.undoStack.push({ imageData, annotations });
    this.currentPage.redoStack = [];

    if (this.currentPage.undoStack.length > 50) {
      this.currentPage.undoStack.shift();
    }

    this.updatePageThumbnail(this.currentPageIndex);
  }

  private restoreLastState(): void {
    if (this.currentPage.undoStack.length > 0) {
      const state =
        this.currentPage.undoStack[this.currentPage.undoStack.length - 1];
      this.ctx.putImageData(state.imageData, 0, 0);
    }
  }

  private undo(): void {
    if (this.currentPage.undoStack.length > 1) {
      const current = this.currentPage.undoStack.pop()!;
      this.currentPage.redoStack.push(current);
      const previous =
        this.currentPage.undoStack[this.currentPage.undoStack.length - 1];
      this.ctx.putImageData(previous.imageData, 0, 0);
      this.currentPage.annotations = JSON.parse(
        JSON.stringify(previous.annotations),
      );
      this.renderAnnotations();
      this.renderFeedbackSidebar();
      this.updatePageThumbnail(this.currentPageIndex);
    }
  }

  private redo(): void {
    if (this.currentPage.redoStack.length > 0) {
      const state = this.currentPage.redoStack.pop()!;
      this.currentPage.undoStack.push(state);
      this.ctx.putImageData(state.imageData, 0, 0);
      this.currentPage.annotations = JSON.parse(
        JSON.stringify(state.annotations),
      );
      this.renderAnnotations();
      this.renderFeedbackSidebar();
      this.updatePageThumbnail(this.currentPageIndex);
    }
  }

  private clear(): void {
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.currentPage.backgroundImage) {
      this.drawBackgroundImage();
    }
    this.saveState();
  }

  // ============================================
  // PAGE MANAGEMENT
  // ============================================

  private showAddPageMenu(): void {
    const menu = document.getElementById("add-page-menu")!;
    menu.classList.toggle("hidden");
  }

  private addBlankPage(): void {
    document.getElementById("add-page-menu")!.classList.add("hidden");
    this.saveCurrentPageState();

    const page = this.createPage(`Page ${this.pages.length + 1}`);
    this.pages.push(page);
    this.switchToPage(this.pages.length - 1);
  }

  private onPageImageImport(e: Event): void {
    document.getElementById("add-page-menu")!.classList.add("hidden");
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      this.createPageFromImage(file);
    }
    (e.target as HTMLInputElement).value = "";
  }

  private createPageFromImage(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.saveCurrentPageState();

        const page = this.createPage(`Page ${this.pages.length + 1}`);
        page.backgroundImage = img;
        this.pages.push(page);
        this.switchToPage(this.pages.length - 1);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  private saveCurrentPageState(): void {
    if (this.currentPage.undoStack.length > 0) {
      const state =
        this.currentPage.undoStack[this.currentPage.undoStack.length - 1];
      this.currentPage.imageData = state.imageData;
    }
  }

  private switchToPage(index: number): void {
    if (index < 0 || index >= this.pages.length) return;

    this.saveCurrentPageState();
    this.currentPageIndex = index;
    this.selectedAnnotationId = null;
    this.hidePopover();

    // Restore page state
    const page = this.currentPage;
    if (page.undoStack.length > 0) {
      const state = page.undoStack[page.undoStack.length - 1];
      this.ctx.putImageData(state.imageData, 0, 0);
    } else {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      if (page.backgroundImage) {
        this.drawBackgroundImage();
      }
      this.saveState();
    }

    // Restore annotation numbers - handle empty array case
    if (page.annotations.length === 0) {
      this.nextAnnotationNumber = 1;
    } else {
      this.nextAnnotationNumber =
        Math.max(...page.annotations.map((a) => a.number)) + 1;
    }

    this.renderAnnotations();
    this.renderPageSidebar();
    this.renderFeedbackSidebar();
  }

  private deletePage(index: number): void {
    if (this.pages.length <= 1) return; // Can't delete last page

    this.pages.splice(index, 1);
    if (this.currentPageIndex >= this.pages.length) {
      this.currentPageIndex = this.pages.length - 1;
    }
    this.switchToPage(this.currentPageIndex);
  }

  private renamePage(index: number): void {
    const page = this.pages[index];
    const newName = prompt("Enter page name:", page.name);
    if (newName && newName.trim()) {
      page.name = newName.trim();
      this.renderPageSidebar();
    }
  }

  // ============================================
  // SIDEBAR RENDERING
  // ============================================

  private renderPageSidebar(): void {
    const list = document.getElementById("page-list")!;
    list.innerHTML = "";

    this.pages.forEach((page, index) => {
      const item = document.createElement("div");
      item.className = `page-item ${index === this.currentPageIndex ? "active" : ""}`;
      item.dataset.pageIndex = String(index);

      item.innerHTML = `
        <div class="page-thumbnail">
          <canvas class="thumbnail-canvas" width="120" height="80"></canvas>
        </div>
        <div class="page-info">
          <span class="page-name">${escapeHtml(page.name)}</span>
          <div class="page-actions">
            <button class="page-action-btn rename-btn" title="Rename">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            ${
              this.pages.length > 1
                ? `
            <button class="page-action-btn delete-btn" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
            `
                : ""
            }
          </div>
        </div>
      `;

      // Click to select page
      item.addEventListener("click", (e) => {
        if (!(e.target as HTMLElement).closest(".page-action-btn")) {
          this.switchToPage(index);
        }
      });

      // Rename button
      item.querySelector(".rename-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.renamePage(index);
      });

      // Delete button
      item.querySelector(".delete-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${page.name}"?`)) {
          this.deletePage(index);
        }
      });

      list.appendChild(item);
      this.updatePageThumbnail(index);
    });
  }

  private updatePageThumbnail(index: number): void {
    const item = document.querySelector(`[data-page-index="${index}"]`);
    if (!item) return;

    const thumbnailCanvas = item.querySelector(
      ".thumbnail-canvas",
    ) as HTMLCanvasElement;
    const tctx = thumbnailCanvas.getContext("2d")!;

    // Draw scaled version of page
    const page = this.pages[index];
    if (page.undoStack.length > 0) {
      const state = page.undoStack[page.undoStack.length - 1];
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = this.canvas.width;
      tempCanvas.height = this.canvas.height;
      tempCanvas.getContext("2d")!.putImageData(state.imageData, 0, 0);

      tctx.fillStyle = "#fff";
      tctx.fillRect(0, 0, 120, 80);
      tctx.drawImage(tempCanvas, 0, 0, 120, 80);
    } else {
      tctx.fillStyle = "#fff";
      tctx.fillRect(0, 0, 120, 80);
    }
  }

  private renderFeedbackSidebar(): void {
    const list = document.getElementById("annotations-list")!;
    const empty = document.getElementById("empty-annotations");
    const annotations = this.currentPage.annotations;

    // Remove existing annotation items (but preserve empty state element)
    list.querySelectorAll(".annotation-item").forEach((el) => el.remove());

    if (annotations.length === 0) {
      if (empty) empty.style.display = "flex";
      return;
    }

    if (empty) empty.style.display = "none";

    annotations.forEach((ann) => {
      const item = document.createElement("div");
      item.className = `annotation-item ${ann.id === this.selectedAnnotationId ? "selected" : ""}`;
      item.dataset.annotationId = ann.id;

      const typeLabel = {
        pin: "Pin",
        area: "Area",
        arrow: "Arrow",
        highlight: "Highlight",
      }[ann.type];

      item.innerHTML = `
        <div class="annotation-header">
          <span class="annotation-number" title="Click to highlight on canvas">#${ann.number}</span>
          <span class="annotation-type">${typeLabel}</span>
          <button class="annotation-delete-btn" title="Delete annotation" aria-label="Delete annotation">×</button>
        </div>
        <textarea class="feedback-input" placeholder="Click to add feedback for Claude..." aria-label="Feedback for annotation ${ann.number}">${escapeHtml(ann.feedback)}</textarea>
      `;

      // Click to select
      item.addEventListener("click", () => {
        this.selectAnnotation(ann.id);
      });

      // Focus on canvas
      item
        .querySelector(".annotation-number")
        ?.addEventListener("click", (e) => {
          e.stopPropagation();
          this.focusOnAnnotation(ann);
        });

      // Delete
      item
        .querySelector(".annotation-delete-btn")
        ?.addEventListener("click", (e) => {
          e.stopPropagation();
          this.deleteAnnotation(ann.id);
        });

      // Feedback input
      const textarea = item.querySelector(
        ".feedback-input",
      ) as HTMLTextAreaElement;
      textarea.addEventListener("input", () => {
        ann.feedback = textarea.value;
      });
      textarea.addEventListener("focus", () => {
        this.selectAnnotation(ann.id);
      });

      list.appendChild(item);
    });
  }

  private focusOnAnnotation(ann: Annotation): void {
    // Visual flash on canvas
    const ctx = this.annotationCanvas.getContext("2d")!;
    const originalAlpha = ctx.globalAlpha;

    let flashes = 0;
    const flash = () => {
      ctx.globalAlpha = flashes % 2 === 0 ? 0.5 : 1;
      this.renderAnnotations();
      flashes++;
      if (flashes < 4) {
        setTimeout(flash, 150);
      } else {
        ctx.globalAlpha = originalAlpha;
        this.renderAnnotations();
      }
    };
    flash();
  }

  private deleteAnnotation(id: string): void {
    const index = this.currentPage.annotations.findIndex((a) => a.id === id);
    if (index !== -1) {
      this.currentPage.annotations.splice(index, 1);
      if (this.selectedAnnotationId === id) {
        this.selectedAnnotationId = null;
      }
      this.renderAnnotations();
      this.renderFeedbackSidebar();
      this.saveState();
    }
  }

  // ============================================
  // FILE HANDLING
  // ============================================

  private onFileImport(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      this.loadImage(file);
    }
  }

  private onPaste(e: ClipboardEvent): void {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          this.loadImage(file);
        }
        break;
      }
    }
  }

  private loadImage(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.currentPage.backgroundImage = img;
        this.clear();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  private drawBackgroundImage(): void {
    const img = this.currentPage.backgroundImage;
    if (!img) return;

    const scale = Math.min(
      this.canvas.width / img.width,
      this.canvas.height / img.height,
      1,
    );
    const width = img.width * scale;
    const height = img.height * scale;
    const x = (this.canvas.width - width) / 2;
    const y = (this.canvas.height - height) / 2;

    this.ctx.drawImage(img, x, y, width, height);
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  private onKeyDown(e: KeyboardEvent): void {
    const isTyping =
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement;

    // Always allow Escape to close modals
    if (e.key === "Escape") {
      this.hideTextModal();
      this.hidePopover();
      this.selectedAnnotationId = null;
      this.renderAnnotations();
      return;
    }

    // Block all other shortcuts when typing in text fields
    if (isTyping) {
      return;
    }

    // Ctrl/Cmd shortcuts (undo, redo, zoom)
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      } else if (e.key === "y") {
        e.preventDefault();
        this.redo();
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        this.zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        this.zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        this.zoomReset();
      }
      return;
    }

    // Space for panning (only when not typing)
    if (e.key === " " && !this.spaceHeld) {
      e.preventDefault();
      this.spaceHeld = true;
      if (this.canvasWrapper) {
        this.canvasWrapper.style.cursor = "grab";
      }
      return;
    }

    // Delete selected annotation
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selectedAnnotationId) {
        this.deleteAnnotation(this.selectedAnnotationId);
      }
      return;
    }

    // Note: Tool shortcuts (P, R, C, A, T, E, M, 1-4) removed
    // to prevent interference when typing. Use toolbar buttons instead.
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.key === " ") {
      this.spaceHeld = false;
      if (this.canvasWrapper && !this.isPanning) {
        this.canvasWrapper.style.cursor = "";
      }
    }
  }

  private onWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -this.scaleStep : this.scaleStep;
      this.setZoom(this.scale + delta);
    }
  }

  private handleResize(): void {
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    this.initCanvas();
    this.ctx.putImageData(imageData, 0, 0);
    this.renderAnnotations();
  }

  // ============================================
  // SERVER COMMUNICATION
  // ============================================

  private showError(message: string): void {
    const existing = document.getElementById("error-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "error-toast";
    toast.className = "error-toast";
    toast.setAttribute("role", "alert");
    toast.innerHTML = `
      <span class="error-message">${escapeHtml(message)}</span>
      <button class="error-dismiss">&times;</button>
    `;

    toast.querySelector(".error-dismiss")!.addEventListener("click", () => {
      toast.remove();
    });

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  private async sendToServer(): Promise<void> {
    const sendBtn = document.getElementById("btn-send") as HTMLButtonElement;
    const originalText = sendBtn.textContent;

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    const globalNotes = (
      document.getElementById("notes") as HTMLTextAreaElement
    ).value;

    // Collect all pages
    const pages: PageSubmitData[] = this.pages.map((page, index) => {
      // Get the image for this page
      let imageData: string;
      if (index === this.currentPageIndex) {
        imageData = this.canvas.toDataURL("image/png");
      } else if (page.undoStack.length > 0) {
        const state = page.undoStack[page.undoStack.length - 1];
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        tempCanvas.getContext("2d")!.putImageData(state.imageData, 0, 0);
        imageData = tempCanvas.toDataURL("image/png");
      } else {
        imageData = "";
      }

      return {
        id: page.id,
        name: page.name,
        image: imageData,
        width: this.canvas.width,
        height: this.canvas.height,
        annotations: page.annotations.map((ann) => ({
          id: ann.id,
          type: ann.type,
          number: ann.number,
          bounds: ann.bounds,
          feedback: ann.feedback,
        })),
      };
    });

    const payload = {
      action: "submit",
      pages,
      globalNotes,
    };

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        window.close();
      } else {
        this.showError("Failed to send. Please try again.");
      }
    } catch (err) {
      console.error("Failed to send:", err);
      this.showError("Network error. Please check your connection.");
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = originalText || "Send to Claude";
    }
  }

  private async cancel(): Promise<void> {
    try {
      await fetch("/api/cancel", { method: "POST" });
      window.close();
    } catch (err) {
      console.error("Failed to cancel:", err);
    }
  }
}

// Initialize
new ShowMeCanvas();
