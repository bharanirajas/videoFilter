import { Component, ElementRef, ViewChild } from '@angular/core';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';
import { FaceFilterServiceService } from './services/face-filter-service.service';
import { FaceMesh, Results as FaceMeshResults } from '@mediapipe/face_mesh';
import { Options } from 'ngx-qrcode-styling';
import { Camera } from '@mediapipe/camera_utils';
import * as drawingUtils from '@mediapipe/drawing_utils';
import { PoseLandmarker, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface Mask {
  id: string;
  label: string;
  img?: HTMLImageElement;
  anchor: 'eyes' | 'nose' | 'mouth' | 'chin' | 'forehead';
}
//
type BgMode = 'gradient' | 'image' | 'blur' | 'none';

export interface FaceFilter {
  id: string;
  name: string;
  parts: ArmorPart[];
}

export interface ArmorPart {
  id: string;
  imgUrl: string;
  anchor: 'forehead' | 'chin' | 'leftShoulder' | 'rightShoulder' | 'chest' | 'leftHand' | 'rightHand';
  scale: number;
  offsetX?: number;
  offsetY?: number;
  img?: HTMLImageElement;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  // masks: Mask[] = [];
  // FaceFilter: FaceFilter[] = [
  //   {
  //     id: 'hat',
  //     name: 'Cool Hat',
  //     parts: [
  //       { id: 'hat', imgUrl: 'assets/filters/hat/hat.png', anchor: 'forehead', scale: 2.0, offsetY: -50 }
  //     ]
  //   },
  //   {
  //     id: 'glasses',
  //     name: 'Sunglasses',
  //     parts: [
  //       { id: 'glass', imgUrl: 'assets/filters/glasses/glasses.png', anchor: 'rightEye', scale: 2.2, offsetY: -10 }
  //     ]
  //   },
  //   {
  //     id: 'armor',
  //     name: 'Armor Suit',
  //     parts: [
  //       { id: 'helmet', imgUrl: 'assets/filters/armor/helmet.png', anchor: 'forehead', scale: 2.2, offsetY: -50 },
  //       { id: 'chest', imgUrl: 'assets/filters/armor/chest.png', anchor: 'chin', scale: 3.0, offsetY: 150 },
  //       { id: 'shoulderL', imgUrl: 'assets/filters/armor/shoulderL.png', anchor: 'leftCheek', scale: 2.0, offsetX: -180, offsetY: 100 },
  //       { id: 'shoulderR', imgUrl: 'assets/filters/armor/shoulderR.png', anchor: 'rightCheek', scale: 2.0, offsetX: 180, offsetY: 100 }
  //     ]
  //   }
  // ];
  masks = [
    { id: 'glasses', label: 'Glasses', img: 'assets/mask/mask1.png', anchor: 'eyes' },
    { id: 'nose', label: 'Clown Nose', img: 'assets/mask/nose.png', anchor: 'nose' },
    { id: 'ears', label: 'Dog Ears', img: 'assets/mask/mask3.png', anchor: 'ears' },
    { id: 'hat', label: 'Hat', img: 'assets/mask/Helmet.png', anchor: 'forehead' },
    { id: 'beard', label: 'Beard', img: 'assets/mask/mask4.png', anchor: 'chin' },
    { id: 'fullface', label: 'Full Face', img: 'assets/mask/mask5.png', mode: 'fullface' },
    {
      id: 'armor',
      name: 'Armor Suit',
      parts: [
        { id: 'helmet', imgUrl: 'assets/filters/armor/helmet.png', anchor: 'forehead', scale: 2, offsetY: -10 },
        { id: 'chest', imgUrl: 'assets/filters/armor/chest.png', anchor: 'chest', scale: 1, offsetY: 220 },
        { id: 'shoulderL', imgUrl: 'assets/filters/armor/shoulderL.png', anchor: 'leftShoulder', scale: 0.5, offsetX: 0, offsetY: -60 },
        { id: 'shoulderR', imgUrl: 'assets/filters/armor/shoulderR.png', anchor: 'rightShoulder', scale: 0.5, offsetX: 0, offsetY: -60 },
        { id: 'hand', imgUrl: 'assets/filters/armor/hand.png', anchor: 'rightHand', scale: 2.4, offsetY: 0 }
      ]
    }
  ];
  activeMask: any;
  title = 'botolVideoFilter';
  @ViewChild('videoElement') video!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('bgImg') bgImg!: ElementRef<HTMLImageElement>;
  @ViewChild('bgVideo') bgVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('bgImg') bgImageRef?: ElementRef<HTMLImageElement>;

  private ctx!: CanvasRenderingContext2D;
  private faceMesh!: FaceMesh;
  private poseLandmarker!: PoseLandmarker;
  private handLandmarker!: HandLandmarker;
  private selfieSeg!: SelfieSegmentation;
  selectedFilter!: FaceFilter;
  private camera!: Camera;
  private maskImg = new Image();
  public config: Options = {
    width: 400,
    height: 400,
    template: 'facebooks',
    data: 'https://botolapp.s3.amazonaws.com/rvmfiles/faceFilter/filtered-capture.png',
    // image: "assets/images/logo-black.png",
    image: "https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg",

    margin: 0,
    dotsOptions: {
      color: "#1a77f3",
      type: "dots"
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    imageOptions: {
      crossOrigin: "anonymous",
      margin: 5
    },
    cornersDotOptions: {
      color: "#1a77f3",
      type: "dot"
    },
    cornersSquareOptions: {
      color: "#1a77f3",
      type: "extra-rounded"
    }
  };
  qrData = 'https://www.facebook.com/sharer/sharer.php?u=https://botolapp.s3.amazonaws.com/rvmfiles/faceFilter/filtered-capture.png&quote=GreetingsFromBotol';
  captureSec: boolean = false;
  qrCode: boolean = false;

  private lastVideoTime = -1;
  private runningMode: "VIDEO" | "IMAGE" = "VIDEO";
  private latestFaceLandmarks: any | null = null;
  private latestPoseLandmarks: any | null = null;
  private latestHandLandmarks: any | null = null;
  private latestSegMask: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null = null;
  // GMeet-style background settings
  backgroundMode: 'none' | 'blur' | 'image' | 'video' = 'video';
  blurStrength: number = 16;
  private bgImage: HTMLImageElement | null = null;
  // Dynamic scale baselines
  private baselineShoulderDist: number | null = null;
  private baselineInterocular: number | null = null;
  constructor(private faceFilter: FaceFilterServiceService) {
    // this.maskImg.src = 'assets/mask/mask1.png';
    // this.maskImg.src = this.masks[0].img;

    // this.masks.forEach((m: any) => {
    //   m.img = new Image();
    //   m.img.src = 'assets/mask/Helmet.png';
    // });
    // // only one mask at a time
    // // this.activeMask = this.masks[0];
    // this.activeMask = this.masks.find(f => f.id === 'glasses')!;
    // console.log(this.activeMask);
    // this.selectedFilter = this.FaceFilter.find(f => f.id === 'armor')!;

    this.masks.forEach((m: any) => {
      if (m.img) {
        const image = new Image();
        image.src = m.img;
        m.img = image;
      }

      if (m.parts) {
        m.parts.forEach((p: any) => {
          const image = new Image();
          image.src = p.imgUrl;
          p.img = image;
        });
      }
    });

    this.activeMask = this.masks.find(f => f.id === 'armor')!;
    console.log(this.activeMask);
  }

  ngAfterViewInit(): void {
    const canvasEl = this.canvas.nativeElement;

    this.ctx = canvasEl.getContext('2d')!;

    this.startWebcam().then(() => {
      this.initModels().then(() => {
        // FaceMesh already initialized in initModels
        this.startLoop();
      });
    });

    setTimeout(() => {
      this.captureSec = true;
    }, 3000);
  }

  async startWebcam() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    this.video.nativeElement.srcObject = stream;
    await this.video.nativeElement.play();
    // Match canvas to displayed size once
    const canvas = this.canvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
    }
  }

  async initModels() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");

    // Initialize PoseLandmarker
    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
        delegate: "GPU"
      },
      runningMode: this.runningMode,
      numPoses: 1
    });

    // Initialize HandLandmarker
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: 'GPU',
      },
      runningMode: this.runningMode,
      numHands: 1,
    });

    // Initialize FaceMesh
    this.faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    // Set up listeners to update latest landmarks (no draw here; we draw once per frame)
    this.faceMesh.onResults((results) => {
      this.latestFaceLandmarks = results.multiFaceLandmarks?.[0] || null;
    });

    // Initialize SelfieSegmentation for background replacement
    this.selfieSeg = new SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    this.selfieSeg.setOptions({ modelSelection: 1 });
    this.selfieSeg.onResults((results: any) => {
      this.latestSegMask = results.segmentationMask || null;
    });
  }

  initFaceMesh() {
    this.faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.faceMesh.onResults((results) => this.onResults(results));

  }

  async startLoop() {
    const render = async () => {
      const nowInMs = performance.now();
      if (this.video.nativeElement.readyState === 4 && nowInMs > this.lastVideoTime) {
        // Detect pose for the current video frame
        this.poseLandmarker.detectForVideo(this.video.nativeElement, nowInMs, (result) => {
          this.latestPoseLandmarks = result.landmarks?.[0] || null;
          this.draw();
        });

        // Detect hand landmarks
        const handResult = this.handLandmarker.detectForVideo(this.video.nativeElement, nowInMs);
        this.latestHandLandmarks = handResult.landmarks?.[0] || null;

        // Send frame to FaceMesh
        await this.faceMesh.send({ image: this.video.nativeElement });

        // Send frame to SelfieSegmentation
        await this.selfieSeg.send({ image: this.video.nativeElement });

        this.lastVideoTime = nowInMs;
      }
      requestAnimationFrame(render);
    };
    render();
  }

  private draw() {
    const canvas = this.canvas.nativeElement;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Compute cover-fit parameters once so we can map landmarks consistently
    const getCoverParams = (source: CanvasImageSource) => {
      const cw = canvas.width, ch = canvas.height;
      const sw = (source as HTMLVideoElement).videoWidth || (source as HTMLImageElement).naturalWidth || (source as HTMLCanvasElement).width || cw;
      const sh = (source as HTMLVideoElement).videoHeight || (source as HTMLImageElement).naturalHeight || (source as HTMLCanvasElement).height || ch;
      const scale = Math.max(cw / sw, ch / sh);
      const dw = sw * scale, dh = sh * scale;
      const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
      return { sw, sh, scale, dx, dy };
    };

    const drawCover = (targetCtx: CanvasRenderingContext2D, source: CanvasImageSource, params?: { dx: number; dy: number; scale: number; sw: number; sh: number }) => {
      const p = params || getCoverParams(source);
      const dw = p.sw * p.scale, dh = p.sh * p.scale;
      targetCtx.drawImage(source, p.dx, p.dy, dw, dh);
    };

    // Map a normalized landmark (relative to source) to canvas space using cover-fit params
    const mapPoint = (pt: { x: number; y: number }, params: { dx: number; dy: number; scale: number; sw: number; sh: number }) => {
      return {
        x: pt.x * params.sw * params.scale + params.dx,
        y: pt.y * params.sh * params.scale + params.dy,
      };
    };

    // 1) Background layer per mode
    if (this.backgroundMode === 'video') {
      if (this.bgVideoRef && this.bgVideoRef.nativeElement.readyState >= 2) {
        const bgParams = getCoverParams(this.bgVideoRef.nativeElement);
        drawCover(ctx, this.bgVideoRef.nativeElement, bgParams);
      }
    } else if (this.backgroundMode === 'image' && this.bgImage) {
      const imgParams = getCoverParams(this.bgImage);
      drawCover(ctx, this.bgImage, imgParams);
    }

    // 2) Person layer (segmented or fallback)
    const personCanvas = document.createElement('canvas');
    personCanvas.width = canvas.width; personCanvas.height = canvas.height;
    const pctx = personCanvas.getContext('2d')!;
    // For blur mode, blur the background webcam before masking out background
    const videoParams = getCoverParams(this.video.nativeElement);
    if (this.backgroundMode === 'blur') {
      pctx.filter = `blur(${this.blurStrength}px)`;
      drawCover(pctx, this.video.nativeElement, videoParams);
      pctx.filter = 'none';
      // Draw only background-blurred to main first
      ctx.drawImage(personCanvas, 0, 0);
      // Reset personCanvas to draw the sharp person on top
      pctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // Draw webcam as base for person
    drawCover(pctx, this.video.nativeElement, videoParams);
    if (this.latestSegMask) {
      pctx.globalCompositeOperation = 'destination-in';
      drawCover(pctx, this.latestSegMask as CanvasImageSource, videoParams);
      pctx.globalCompositeOperation = 'source-over';
    }
    // If mode is none, this draws just the webcam frame
    ctx.drawImage(personCanvas, 0, 0);

    if (!this.activeMask) {
      return;
    }

    const getAnchorPoints = (anchor: string) => {
      switch (anchor) {
        case 'forehead':
          // Use temples for width/angle; more stable for helmet
          return this.latestFaceLandmarks ? [this.latestFaceLandmarks[127], this.latestFaceLandmarks[356]] : null;
        case 'chest':
          return this.latestPoseLandmarks ? [this.latestPoseLandmarks[11], this.latestPoseLandmarks[12]] : null;
        case 'leftShoulder':
          return this.latestPoseLandmarks ? [this.latestPoseLandmarks[11], this.latestPoseLandmarks[13]] : null;
        case 'rightShoulder':
          return this.latestPoseLandmarks ? [this.latestPoseLandmarks[12], this.latestPoseLandmarks[14]] : null;
        case 'leftHand':
          return this.latestPoseLandmarks ? [this.latestPoseLandmarks[15], this.latestPoseLandmarks[17]] : null;
        case 'rightHand':
          return this.latestPoseLandmarks ? [this.latestPoseLandmarks[16], this.latestPoseLandmarks[18]] : null;
        case 'eyes':
          return this.latestFaceLandmarks ? [this.latestFaceLandmarks[33], this.latestFaceLandmarks[263]] : null;
        case 'nose':
          return this.latestFaceLandmarks ? [this.latestFaceLandmarks[1], this.latestFaceLandmarks[4]] : null;
        case 'chin':
          return this.latestFaceLandmarks ? [this.latestFaceLandmarks[152], this.latestFaceLandmarks[10]] : null;
        default:
          return null;
      }
    };

    const prevMap: Record<string, { cx: number; cy: number; angle: number; width: number; height: number }> = (this as any)._prevMap || ((this as any)._prevMap = {});
    const smooth = (key: string, next: { cx: number; cy: number; angle: number; width: number; height: number }) => {
      const prev = prevMap[key];
      // Lower alpha to reduce jitter; exponential smoothing
      const a = 0.18; // smoothing factor
      if (!prev) { prevMap[key] = next; return next; }
      const lerp = (p: number, n: number) => p + (n - p) * a;
      const wrappedAngle = (p: number, n: number) => {
        let d = n - p; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return p + d * a;
      };
      const smoothed = {
        cx: lerp(prev.cx, next.cx),
        cy: lerp(prev.cy, next.cy),
        angle: wrappedAngle(prev.angle, next.angle),
        width: lerp(prev.width, next.width),
        height: lerp(prev.height, next.height)
      };
      prevMap[key] = smoothed;
      return smoothed;
    };

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const getGlobalScale = (key: string) => {
      let s = 1;
      // pose-based scale from shoulders
      if (this.latestPoseLandmarks) {
        const sL = mapPoint(this.latestPoseLandmarks[11], videoParams);
        const sR = mapPoint(this.latestPoseLandmarks[12], videoParams);
        const d = Math.hypot(sR.x - sL.x, sR.y - sL.y);
        if (!this.baselineShoulderDist && d > 0) this.baselineShoulderDist = d;
        if (this.baselineShoulderDist) s = d / this.baselineShoulderDist;
      }
      // face-based refinement for face parts
      if (key === 'helmet' || key === 'single' || key === 'face') {
        if (this.latestFaceLandmarks) {
          const le = mapPoint(this.latestFaceLandmarks[33], videoParams);
          const re = mapPoint(this.latestFaceLandmarks[263], videoParams);
          const iod = Math.hypot(re.x - le.x, re.y - le.y);
          if (!this.baselineInterocular && iod > 0) this.baselineInterocular = iod;
          if (this.baselineInterocular) s = iod / this.baselineInterocular;
        }
      }
      return clamp(s, 0.8, 1.4);
    };

    const drawPart = (img: HTMLImageElement, points: any[], baseScale: number, offsetX = 0, offsetY = 0, key: string = 'part') => {
      if (!points || points.length < 2) return;

      const mp1 = mapPoint(points[0], videoParams);
      const mp2 = mapPoint(points[1], videoParams);
      const x1 = mp1.x;
      const y1 = mp1.y;
      const x2 = mp2.x;
      const y2 = mp2.y;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const angle = Math.atan2(dy, dx);
      const dist = Math.sqrt(dx * dx + dy * dy);

      const gScale = getGlobalScale(key);
      const effectiveScale = baseScale * gScale;
      const width = dist * effectiveScale;
      const height = width * (img.height / img.width);

      const cx = (x1 + x2) / 2 + offsetX * gScale;
      const cy = (y1 + y2) / 2 + offsetY * gScale;

      const t = smooth(key, { cx, cy, angle, width, height });

      ctx.save();
      ctx.translate(t.cx, t.cy);
      ctx.rotate(t.angle);
      ctx.drawImage(img, -t.width / 2, -t.height / 2, t.width, t.height);
      ctx.restore();
    };

    if (this.activeMask.parts && this.activeMask.parts.length) {
      this.activeMask.parts.forEach((p: any) => {
        if (!(p.img && p.img.complete)) return;
        const points = getAnchorPoints(p.anchor);
        if (!points) return;
        if (p.id === 'hand') {
          if (!this.latestHandLandmarks || this.isHandOpen(this.latestHandLandmarks)) {
            drawPart(p.img, points, p.scale, p.offsetX || 0, p.offsetY || 0, p.id);
          }
          return;
        }
        drawPart(p.img, points, p.scale, p.offsetX || 0, p.offsetY || 0, p.id);
      });
    } else if (this.activeMask.img && this.latestFaceLandmarks) {
      // Single-image mask
      const anchor = this.activeMask.anchor || 'eyes';
      const pts = getAnchorPoints(anchor);
      if (pts) {
        drawPart(this.activeMask.img, pts, 2.5, 0, 0, 'single');
      }
    }
  }


  onResults(results: any) {
    const canvas = this.canvas.nativeElement;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (!(results.multiFaceLandmarks?.length && this.activeMask)) return;

    const landmarks = results.multiFaceLandmarks[0];

    const getAnchorPoints = (anchor: string) => {
      switch (anchor) {
        case 'eyes':
          return [landmarks[33], landmarks[263]]; // left eye to right eye
        case 'nose':
          return [landmarks[1], landmarks[4]];   // nose tip to below nose
        case 'chin':
          return [landmarks[152], landmarks[10]]; // chin bottom to forehead top (vertical)
        case 'forehead':
          return [landmarks[10], landmarks[338]]; // forehead center to right forehead
        case 'leftCheek':
          return [landmarks[234], landmarks[93]]; // cheek width
        case 'rightCheek':
          return [landmarks[454], landmarks[323]];
        default:
          return [landmarks[1], landmarks[4]];
      }
    };

    const drawPart = (img: HTMLImageElement, anchor: string, scale = 2, offsetX = 0, offsetY = 0) => {
      const points = getAnchorPoints(anchor);
      const x1 = points[0].x * canvas.width;
      const y1 = points[0].y * canvas.height;
      const x2 = points[1].x * canvas.width;
      const y2 = points[1].y * canvas.height;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const angle = Math.atan2(dy, dx);
      const dist = Math.sqrt(dx * dx + dy * dy);

      const width = dist * scale;
      const height = width * (img.height / img.width);

      const cx = (x1 + x2) / 2 + offsetX;
      const cy = (y1 + y2) / 2 + offsetY;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      ctx.restore();
    };

    // 🔹 If armor (multi parts)
    if (this.activeMask.parts?.length) {
      this.activeMask.parts.forEach((p: any) => {
        if (p.img && p.img.complete) {
          drawPart(p.img, p.anchor, p.scale, p.offsetX || 0, p.offsetY || 0);
        }
      });
    }

    // 🔹 Else single mask
    else if (this.activeMask.img && this.activeMask.img.complete) {
      const [p1, p2] = getAnchorPoints(this.activeMask.anchor);
      const x1 = p1.x * canvas.width, y1 = p1.y * canvas.height;
      const x2 = p2.x * canvas.width, y2 = p2.y * canvas.height;

      const dx = x2 - x1, dy = y2 - y1;
      const angle = Math.atan2(dy, dx);
      const dist = Math.sqrt(dx * dx + dy * dy);

      const width = dist * 2.5;
      const height = width * (this.activeMask.img.height / this.activeMask.img.width);
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(this.activeMask.img, -width / 2, -height / 2, width, height);
      ctx.restore();
    }
  }

  private isHandOpen(lm: any[]): boolean {
    if (!lm) return false;
    const WRIST = 0, INDEX_MCP = 5, MIDDLE_MCP = 9, RING_MCP = 13, PINKY_MCP = 17;
    const INDEX_TIP = 8, MIDDLE_TIP = 12, RING_TIP = 16, PINKY_TIP = 20, THUMB_TIP = 4;
    const palmWidth = Math.hypot(lm[INDEX_MCP].x - lm[PINKY_MCP].x, lm[INDEX_MCP].y - lm[PINKY_MCP].y);
    const extended = (tip: number, mcp: number) => (lm[mcp].y - lm[tip].y) > 0.08; // tip higher than mcp
    const thumbOpen = Math.hypot(lm[THUMB_TIP].x - lm[INDEX_MCP].x, lm[THUMB_TIP].y - lm[INDEX_MCP].y) > 0.6 * palmWidth;
    const fingersOpen = [[INDEX_TIP, INDEX_MCP], [MIDDLE_TIP, MIDDLE_MCP], [RING_TIP, RING_MCP], [PINKY_TIP, PINKY_MCP]]
      .every(([tip, mcp]) => extended(tip, mcp));
    return fingersOpen && thumbOpen;
  }




  // onResults(results: any) {
  //   const canvas = this.canvas.nativeElement;
  //   const ctx = this.ctx;
  //   ctx.clearRect(0, 0, canvas.width, canvas.height);

  //   // Draw the video frame
  //   ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  //   if (results.multiFaceLandmarks?.length && this.activeMask) {
  //     const landmarks = results.multiFaceLandmarks[0];
  //     const mask = this.activeMask;

  //     let x1 = 0, y1 = 0, x2 = 0, y2 = 0, cx = 0, cy = 0;
  //     let maskWidth = 0, maskHeight = 0;

  //     switch (mask.anchor) {
  //       case 'eyes': {
  //         const leftEye = landmarks[33];
  //         const rightEye = landmarks[263];
  //         x1 = leftEye.x * canvas.width;
  //         y1 = leftEye.y * canvas.height;
  //         x2 = rightEye.x * canvas.width;
  //         y2 = rightEye.y * canvas.height;
  //         break;
  //       }

  //       case 'nose': {
  //         const nose = landmarks[1];
  //         x1 = nose.x * canvas.width;
  //         y1 = nose.y * canvas.height;
  //         x2 = x1 + 1;
  //         y2 = y1;
  //         break;
  //       }

  //       case 'chin': {
  //         const jawL = landmarks[234];
  //         const jawR = landmarks[454];
  //         const chin = landmarks[152];
  //         x1 = jawL.x * canvas.width;
  //         y1 = jawL.y * canvas.height;
  //         x2 = jawR.x * canvas.width;
  //         y2 = jawR.y * canvas.height;
  //         cy = chin.y * canvas.height;
  //         break;
  //       }

  //       case 'forehead': {
  //         const tL = landmarks[127];
  //         const tR = landmarks[356];
  //         x1 = tL.x * canvas.width;
  //         y1 = tL.y * canvas.height;
  //         x2 = tR.x * canvas.width;
  //         y2 = tR.y * canvas.height;
  //         cy = landmarks[10].y * canvas.height - 40; // slightly above eyes
  //         break;
  //       }

  //       case 'fullface': {
  //         const faceTop = landmarks[10];
  //         const faceBottom = landmarks[152];
  //         const faceLeft = landmarks[234];
  //         const faceRight = landmarks[454];
  //         x1 = faceLeft.x * canvas.width;
  //         y1 = faceTop.y * canvas.height;
  //         x2 = faceRight.x * canvas.width;
  //         y2 = faceBottom.y * canvas.height;

  //         maskWidth = (x2 - x1) * 1.2;
  //         maskHeight = (y2 - y1) * 1.2;
  //         cx = (x1 + x2) / 2;
  //         cy = (y1 + y2) / 2;
  //         break;
  //       }
  //     }

  //     // distance + angle (except fullface which already has width/height)
  //     const dx = x2 - x1;
  //     const dy = y2 - y1;
  //     const angle = Math.atan2(dy, dx);
  //     const dist = Math.sqrt(dx * dx + dy * dy);

  //     if (mask.anchor !== 'fullface') {
  //       maskWidth = dist * (mask.anchor === 'nose' ? 2 : 2.5);
  //       maskHeight = maskWidth * (mask.img.height / mask.img.width);
  //       cx = cx || (x1 + x2) / 2;
  //       cy = cy || (y1 + y2) / 2;
  //     }

  //     // draw with rotation
  //     if (mask.img.complete && mask.img.naturalWidth > 0) {
  //       ctx.save();
  //       ctx.translate(cx, cy);
  //       ctx.rotate(angle);
  //       ctx.drawImage(mask.img, -maskWidth / 2, -maskHeight / 2, maskWidth, maskHeight);
  //       ctx.restore();
  //     }
  //   }
  // }





  // onResults(results: any) {
  //   const canvas = this.canvas.nativeElement;
  //   const ctx = this.ctx;
  //   ctx.clearRect(0, 0, canvas.width, canvas.height);

  //   // Draw the video frame
  //   ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  //   if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
  //     const landmarks = results.multiFaceLandmarks[0];

  //     // ---- Example: draw glasses mask using eye landmarks ----
  //     const leftEye = landmarks[33];
  //     const rightEye = landmarks[263];

  //     const x1 = leftEye.x * canvas.width;
  //     const y1 = leftEye.y * canvas.height;
  //     const x2 = rightEye.x * canvas.width;
  //     const y2 = rightEye.y * canvas.height;

  //     // distance between eyes = scale
  //     const dx = x2 - x1;
  //     const dy = y2 - y1;
  //     const angle = Math.atan2(dy, dx);       // rotation in radians
  //     const dist = Math.sqrt(dx * dx + dy * dy);

  //     // set mask size relative to eye distance
  //     const maskWidth = dist * 2.5;   // scale factor
  //     const maskHeight = maskWidth * (this.maskImg.height / this.maskImg.width);

  //     // midpoint between eyes = center of mask
  //     const cx = (x1 + x2) / 2;
  //     const cy = (y1 + y2) / 2;

  //     // draw with rotation
  //     if (this.maskImg.complete && this.maskImg.naturalWidth > 0) {
  //       ctx.save();
  //       ctx.translate(cx, cy);
  //       ctx.rotate(angle);
  //       ctx.drawImage(this.maskImg, -maskWidth / 2, -maskHeight / 2, maskWidth, maskHeight);
  //       ctx.restore();
  //     }
  //   }
  // }



  // ngAfterViewInit(): void {
  //   const canvasEl = this.canvas.nativeElement;
  //   this.ctx = canvasEl.getContext('2d')!;
  //   // Offscreen canvas for background (same size as main canvas)
  //   this.bgCanvas = document.createElement('canvas');
  //   this.bgCanvas.width = canvasEl.width;
  //   this.bgCanvas.height = canvasEl.height;
  //   this.bgCtx = this.bgCanvas.getContext('2d')!;

  //   // Start webcam and auto-loop after metadata loads
  //   this.startWebcam();
  // }

  // startWebcam() {
  //   if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  //     navigator.mediaDevices.getUserMedia({ video: true })
  //       .then(stream => {
  //         // Set the video stream to the video element
  //         this.video.nativeElement.srcObject = stream;
  //         this.video.nativeElement.play();

  //         // Get the video track from the stream
  //         const videoTrack = stream.getVideoTracks()[0];

  //         // Print the name of the current camera
  //         navigator.mediaDevices.enumerateDevices().then(devices => {
  //           const videoInputDevices = devices.filter(device => device.kind === 'videoinput');
  //           const currentCamera = videoInputDevices.find(device => device.deviceId === videoTrack.getSettings().deviceId);
  //           if (currentCamera) {
  //             console.log("Using camera: ", currentCamera.label);
  //             // this.apiService.webcamName = currentCamera.label;
  //           }
  //         });
  //       })
  //       .catch(err => {
  //         console.error("Error accessing the webcam: ", err);
  //       });
  //   } else {
  //     console.warn("Webcam not supported by your browser.");
  //   }
  // }

  // capture() {
  //   const video = this.video?.nativeElement;
  //   const canvas = this.canvas?.nativeElement;

  //   if (!(canvas instanceof HTMLCanvasElement)) {
  //     console.error('canvas is not a HTMLCanvasElement');
  //     return;
  //   }
  //   const ctx = canvas.getContext('2d');
  //   if (!ctx) {
  //     console.error('Canvas context not available');
  //     return;
  //   }

  //   // Optional: sync canvas size with video
  //   if (video && video.videoWidth && video.videoHeight) {
  //     canvas.width = video.videoWidth;
  //     canvas.height = video.videoHeight;
  //   }

  //   if (video && video.readyState >= 2) { // HAVE_CURRENT_DATA
  //     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  //     const img = canvas.toDataURL('image/png');
  //     console.log('Captured image', img);
  //   } else {
  //     console.warn('Video data not ready');
  //   }
  // }

  capture() {
    const canvas = this.canvas.nativeElement;
    if (!(canvas instanceof HTMLCanvasElement)) {
      console.error('canvas is not a HTMLCanvasElement');
      return;
    }

    // No need to redraw video here — filters are already drawn
    const img = canvas.toDataURL('image/png');
    console.log('Captured with filter:', img);

    // optional: trigger download
    const link = document.createElement('a');
    link.href = img;
    link.download = 'filtered-capture.png';
    link.click();
    this.uploadToS3(img);
    this.qrCode = true;
  }

  async uploadToS3(base64Data: string) {
    // Remove "data:image/png;base64," prefix
    const base64 = base64Data.split(",")[1];
    const blob = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Use FormData for upload
    const formData = new FormData();
    formData.append("file", new Blob([blob], { type: "image/png" }), "filtered-capture.png");

    // Upload to your API or directly to a pre-signed S3 URL
    await fetch("https://botolapp.s3.amazonaws.com/rvmfiles/faceFilter/filtered-capture.png", {
      method: "PUT", // with pre-signed URL
      body: formData.get("file"),
      headers: {
        "Content-Type": "image/png",
      },
    });
  }

}
