export type ProvenanceStatus = "marker_present" | "not_detected" | "not_applicable";

export type LocalForensics = {
  version: "verity-edge-v1";
  sha256: string;
  perceptualHash: string;
  provenance: {
    status: ProvenanceStatus;
    detail: string;
  };
  frequency: {
    highFrequencyEnergy: number;
    blockBoundaryRatio: number;
    detail: string;
  };
  temporal: {
    frameVariation: number | null;
    detail: string;
  };
  route: "standard" | "enhanced";
  routeReasons: string[];
  processedLocally: true;
};

type FrameMetrics = {
  hash: string;
  highFrequencyEnergy: number;
  blockBoundaryRatio: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex(new Uint8Array(digest));
}

function containsC2paMarker(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("latin1");
  const windowSize = 4 * 1024 * 1024;
  const head = decoder.decode(bytes.subarray(0, Math.min(bytes.length, windowSize))).toLowerCase();
  if (head.includes("c2pa") || head.includes("content credentials")) return true;
  if (bytes.length <= windowSize) return false;
  const tail = decoder.decode(bytes.subarray(Math.max(0, bytes.length - windowSize))).toLowerCase();
  return tail.includes("c2pa") || tail.includes("content credentials");
}

function hammingDistance(left: string, right: string) {
  const length = Math.min(left.length, right.length);
  let distance = Math.abs(left.length - right.length);
  for (let index = 0; index < length; index += 1) {
    const xor = Number.parseInt(left[index], 16) ^ Number.parseInt(right[index], 16);
    distance += xor.toString(2).split("1").length - 1;
  }
  return distance;
}

async function readFrame(dataUrl: string): Promise<FrameMetrics> {
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("A prepared frame could not be inspected locally."));
  });

  const width = 64;
  const height = 64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot run the local forensic checks.");
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);

  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    gray[index] = pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114;
  }

  let highFrequency = 0;
  let horizontalEnergy = 0;
  let verticalEnergy = 0;
  let horizontalSamples = 0;
  let verticalSamples = 0;
  let blockEnergy = 0;
  let blockSamples = 0;
  let innerEnergy = 0;
  let innerSamples = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = gray[y * width + x];
      const laplacian = Math.abs(4 * center - gray[y * width + x - 1] - gray[y * width + x + 1] - gray[(y - 1) * width + x] - gray[(y + 1) * width + x]);
      highFrequency += laplacian;

      const horizontal = Math.abs(center - gray[y * width + x - 1]);
      const vertical = Math.abs(center - gray[(y - 1) * width + x]);
      horizontalEnergy += horizontal;
      verticalEnergy += vertical;
      horizontalSamples += 1;
      verticalSamples += 1;

      const isBlockBoundary = x % 8 === 0 || y % 8 === 0;
      if (isBlockBoundary) {
        blockEnergy += horizontal + vertical;
        blockSamples += 2;
      } else {
        innerEnergy += horizontal + vertical;
        innerSamples += 2;
      }
    }
  }

  const hashBits: number[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = gray[Math.floor((y + 0.5) * 8) * width + Math.floor((x + 0.35) * 8)];
      const right = gray[Math.floor((y + 0.5) * 8) * width + Math.min(width - 1, Math.floor((x + 0.65) * 8))];
      hashBits.push(left > right ? 1 : 0);
    }
  }

  let hash = "";
  for (let index = 0; index < hashBits.length; index += 4) {
    hash += Number.parseInt(hashBits.slice(index, index + 4).join(""), 2).toString(16);
  }

  const meanEdge = (horizontalEnergy / Math.max(1, horizontalSamples) + verticalEnergy / Math.max(1, verticalSamples)) / 2;
  const frequencyScore = clamp((highFrequency / Math.max(1, (width - 2) * (height - 2))) / 2.4);
  const boundary = blockEnergy / Math.max(1, blockSamples);
  const interior = innerEnergy / Math.max(1, innerSamples);
  const blockRatio = clamp(((boundary / Math.max(1, interior)) - 0.8) * 55 + meanEdge * 0.12);

  return {
    hash,
    highFrequencyEnergy: Math.round(frequencyScore),
    blockBoundaryRatio: Math.round(blockRatio),
  };
}

export async function runLocalForensics(file: File, preparedFrames: string[]): Promise<LocalForensics> {
  const fileBuffer = await file.arrayBuffer();
  const [digest, ...frames] = await Promise.all([
    sha256(fileBuffer),
    ...preparedFrames.map((frame) => readFrame(frame)),
  ]);

  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
  const frequency = average(frames.map((frame) => frame.highFrequencyEnergy));
  const blockiness = average(frames.map((frame) => frame.blockBoundaryRatio));

  let frameVariation: number | null = null;
  if (frames.length > 1) {
    const distances: number[] = [];
    for (let index = 1; index < frames.length; index += 1) {
      distances.push(hammingDistance(frames[index - 1].hash, frames[index].hash));
    }
    frameVariation = Math.round((average(distances) / 64) * 100);
  }

  const canCarryC2pa = /image\/(jpeg|png|webp)|video\/(mp4|quicktime)/.test(file.type);
  const markerPresent = canCarryC2pa && containsC2paMarker(fileBuffer);
  const provenance: LocalForensics["provenance"] = !canCarryC2pa
    ? { status: "not_applicable", detail: "This file type was not checked for an embedded C2PA marker." }
    : markerPresent
      ? { status: "marker_present", detail: "A C2PA-related marker was found. Its signature is not cryptographically validated in this MVP." }
      : { status: "not_detected", detail: "No C2PA marker was found. Absence does not mean the media is synthetic." };

  const routeReasons: string[] = [];
  if (preparedFrames.length > 1) routeReasons.push("multiple video frames require cross-frame review");
  if (frequency >= 42) routeReasons.push("elevated high-frequency energy needs visual context");
  if (blockiness >= 45) routeReasons.push("compression-boundary behavior may obscure evidence");
  if (provenance.status !== "marker_present") routeReasons.push("no validated provenance baseline is available");
  const route = routeReasons.length >= 2 ? "enhanced" : "standard";

  return {
    version: "verity-edge-v1",
    sha256: digest,
    perceptualHash: frames[0]?.hash ?? "unavailable",
    provenance,
    frequency: {
      highFrequencyEnergy: frequency,
      blockBoundaryRatio: blockiness,
      detail: "Local signal-quality heuristics only. These values are not deepfake probabilities.",
    },
    temporal: {
      frameVariation,
      detail: frameVariation === null
        ? "Temporal analysis requires video frames."
        : "Frame variation helps route the review but cannot establish manipulation by itself.",
    },
    route,
    routeReasons: routeReasons.slice(0, 3),
    processedLocally: true,
  };
}
