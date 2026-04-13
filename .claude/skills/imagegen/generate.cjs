#!/usr/bin/env node

// generate.cjs — Thin OpenAI gpt-image-1 API wrapper for Claude Code skill.
// Zero external dependencies. Requires Node.js 20+ for built-in fetch().
//
// NOTE: gpt-image-1 always returns b64_json. Do NOT send `response_format`
// (that parameter is only for dall-e-2/dall-e-3 and causes errors with
// gpt-image-1). Use `output_format` for the image encoding (png/jpeg/webp).
//
// Usage:
//   node generate.cjs --prompt "..." --output "./path/to/image.png" [options]

"use strict";

const fs = require("fs");
const path = require("path");

// Load .env file if present (Node 20.12+ built-in, no dependencies).
// Search cwd first, then walk up from the script's own directory so the
// skill works regardless of where it's invoked from (worktrees, subdirs).
(function loadEnv() {
  const tried = new Set();
  const candidates = [process.cwd()];
  let dir = __dirname;
  while (dir && dir !== path.dirname(dir)) {
    candidates.push(dir);
    dir = path.dirname(dir);
  }
  for (const d of candidates) {
    const p = path.join(d, ".env");
    if (tried.has(p)) continue;
    tried.add(p);
    try {
      if (fs.existsSync(p)) {
        process.loadEnvFile(p);
        return;
      }
    } catch {}
  }
})();

// ---------------------------------------------------------------------------
// Early --help check (before argument parsing, so it works with any flags)
// ---------------------------------------------------------------------------

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
generate.cjs — OpenAI gpt-image-1 API wrapper

Usage:
  node generate.cjs --prompt "..." --output "./path/to/image.png" [options]

Required:
  --prompt <string>       Image generation prompt
  --output <path>         Output file path (.png, .jpg, .jpeg, or .webp)

Options:
  --size <size>           1024x1024 | 1024x1536 | 1536x1024 | auto
                          (default: 1024x1024)
  --quality <quality>     low | medium | high | auto (default: medium)
  --background <bg>       transparent | opaque | auto (default: auto)
  --model <model>         Model name (default: gpt-image-1)
  --help, -h              Show this help message

Reference images (triggers /v1/images/edits endpoint):
  --image <path>          Input image file (repeatable, max 16). PNG/JPG/WEBP, <50 MB.
  --mask <path>           PNG mask with alpha channel for inpainting (<4 MB).
  --input-fidelity <val>  high | low (default: low). "high" preserves first
                          image's features more closely at higher token cost.

History (automatic by default):
  --history-id <string>   Override auto-derived ID (default: from output path)
  --history-parent <str>  Parent generation ID (for iterations)
  --no-history            Disable history logging for this generation

Environment:
  OPENAI_API_KEY          Required. Your OpenAI API key.

Examples:
  node generate.cjs --prompt "A pixel art sword" --output "./sword.png"
  node generate.cjs --prompt "Forest scene" --output "./bg.png" --size 1536x1024 --quality high
  node generate.cjs --prompt "Game icon" --output "./icon.png" --background transparent
  node generate.cjs --prompt "Make it blue" --output "./edit.png" --image "./orig.png"
  node generate.cjs --prompt "Match this style" --output "./new.png" --image "./ref1.png" --image "./ref2.png"
`.trim());
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(message) {
  process.stdout.write(JSON.stringify({ success: false, error: message }) + "\n");
  process.exit(1);
}

function requireArgValue(flag, argv, index) {
  if (index >= argv.length || argv[index] === undefined) {
    fail(`${flag} requires a value.`);
  }
  return argv[index];
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    prompt: null,
    output: null,
    size: "1024x1024",
    quality: "medium",
    background: "auto",
    model: "gpt-image-1",
    images: [],           // Reference images for edits endpoint
    mask: null,           // PNG mask for inpainting
    inputFidelity: null,  // "high" or "low" (edits only)
    historyId: null,      // null = auto-derive from output filename
    historyParent: null,
    noHistory: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--help":
      case "-h":
        break; // Already handled above
      case "--prompt":
        args.prompt = requireArgValue(flag, argv, ++i);
        break;
      case "--output":
        args.output = requireArgValue(flag, argv, ++i);
        break;
      case "--size":
        args.size = requireArgValue(flag, argv, ++i);
        break;
      case "--quality":
        args.quality = requireArgValue(flag, argv, ++i);
        break;
      case "--background":
        args.background = requireArgValue(flag, argv, ++i);
        break;
      case "--model":
        args.model = requireArgValue(flag, argv, ++i);
        break;
      case "--image":
        args.images.push(requireArgValue(flag, argv, ++i));
        break;
      case "--mask":
        args.mask = requireArgValue(flag, argv, ++i);
        break;
      case "--input-fidelity":
        args.inputFidelity = requireArgValue(flag, argv, ++i);
        break;
      case "--history-id":
        args.historyId = requireArgValue(flag, argv, ++i);
        break;
      case "--history-parent":
        args.historyParent = requireArgValue(flag, argv, ++i);
        break;
      case "--no-history":
        args.noHistory = true;
        break;
      default:
        fail(`Unknown argument: ${flag}. Use --help for usage information.`);
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
const VALID_QUALITIES = new Set(["low", "medium", "high", "auto"]);
const VALID_BACKGROUNDS = new Set(["transparent", "opaque", "auto"]);
const VALID_EXTENSIONS = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp" };
const VALID_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const VALID_FIDELITIES = new Set(["high", "low"]);
const MAX_IMAGES = 16;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;  // 50 MB
const MAX_MASK_BYTES = 4 * 1024 * 1024;    // 4 MB

const MIME_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

const VALID_MASK_EXTENSIONS = new Set([".png"]);

function validateImageFile(filePath, label, { maxBytes, allowedExtensions } = {}) {
  const exts = allowedExtensions || VALID_IMAGE_EXTENSIONS;
  const limit = maxBytes || MAX_IMAGE_BYTES;
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    fail(`${label} file not found: "${filePath}"`);
  }
  const ext = path.extname(resolved).toLowerCase();
  if (!exts.has(ext)) {
    const names = [...exts].join(", ");
    fail(`${label} has unsupported extension "${ext}". Must be: ${names}`);
  }
  const stat = fs.statSync(resolved);
  if (stat.size > limit) {
    fail(`${label} is ${(stat.size / 1024 / 1024).toFixed(1)} MB, exceeds ${limit / 1024 / 1024} MB limit.`);
  }
  return { resolved, ext, mime: MIME_TYPES[ext] };
}

function validate(args) {
  if (!args.prompt) fail("--prompt is required.");
  if (!args.output) fail("--output is required.");
  if (!VALID_SIZES.has(args.size))
    fail(`Invalid --size "${args.size}". Must be one of: ${[...VALID_SIZES].join(", ")}`);
  if (!VALID_QUALITIES.has(args.quality))
    fail(`Invalid --quality "${args.quality}". Must be one of: ${[...VALID_QUALITIES].join(", ")}`);
  if (!VALID_BACKGROUNDS.has(args.background))
    fail(`Invalid --background "${args.background}". Must be one of: ${[...VALID_BACKGROUNDS].join(", ")}`);

  const ext = path.extname(args.output).toLowerCase();
  if (!VALID_EXTENSIONS[ext]) {
    fail(`Unsupported file extension "${ext}". Use .png, .jpg, .jpeg, or .webp.`);
  }

  // JPEG does not support transparency
  if (args.background === "transparent" && (ext === ".jpg" || ext === ".jpeg")) {
    fail("JPEG does not support transparency. Use .png or .webp with --background transparent.");
  }

  // --- Reference image validation ---

  if (args.images.length > MAX_IMAGES) {
    fail(`Too many --image flags (${args.images.length}). Maximum is ${MAX_IMAGES}.`);
  }

  // Resolve image paths in place
  for (let i = 0; i < args.images.length; i++) {
    const info = validateImageFile(args.images[i], `--image "${args.images[i]}"`, MAX_IMAGE_BYTES);
    args.images[i] = info.resolved;
  }

  // Mask requires --image
  if (args.mask && args.images.length === 0) {
    fail("--mask requires at least one --image.");
  }

  if (args.mask) {
    const info = validateImageFile(args.mask, "--mask", {
      maxBytes: MAX_MASK_BYTES,
      allowedExtensions: VALID_MASK_EXTENSIONS,
    });
    args.mask = info.resolved;
  }

  // input-fidelity requires --image
  if (args.inputFidelity && args.images.length === 0) {
    fail("--input-fidelity requires at least one --image.");
  }

  if (args.inputFidelity && !VALID_FIDELITIES.has(args.inputFidelity)) {
    fail(`Invalid --input-fidelity "${args.inputFidelity}". Must be "high" or "low".`);
  }
}

// ---------------------------------------------------------------------------
// Retry logic with exponential backoff
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 120_000; // 2 minutes

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      const jitter = Math.random() * delay * 0.5;
      await sleep(delay + jitter);
    }

    let response;
    try {
      response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (err.name === "TimeoutError") {
        lastError = `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`;
      } else {
        lastError = `Network error: ${err.message}`;
      }
      if (attempt < MAX_RETRIES) continue;
      fail(lastError);
    }

    if (response.ok) return response;

    let body;
    try {
      body = await response.json();
    } catch {
      body = { error: { message: `HTTP ${response.status} ${response.statusText}` } };
    }

    const errorMessage = body?.error?.message || `HTTP ${response.status}`;

    // Content policy — do NOT retry
    if (response.status === 400 && errorMessage.toLowerCase().includes("content policy")) {
      fail(`Content policy violation: ${errorMessage}`);
    }

    // Auth errors — do NOT retry
    if (response.status === 401) {
      fail(`Authentication failed: ${errorMessage}. Check your OPENAI_API_KEY.`);
    }

    // Billing/quota/verification — do NOT retry
    if (response.status === 402 || response.status === 403) {
      fail(`Access denied (HTTP ${response.status}): ${errorMessage}`);
    }

    // Retryable errors
    if (RETRYABLE_STATUS_CODES.has(response.status)) {
      lastError = `HTTP ${response.status}: ${errorMessage}`;
      if (attempt < MAX_RETRIES) continue;
      fail(`Failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError}`);
    }

    // Any other error
    fail(`API error (HTTP ${response.status}): ${errorMessage}`);
  }

  fail(`Failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError}`);
}

// ---------------------------------------------------------------------------
// Edit-mode FormData builder
// ---------------------------------------------------------------------------

// Build a multipart/form-data body for the /v1/images/edits endpoint.
// Uses Node's built-in FormData + Blob (no external deps).
// NOTE: Buffer-backed Blobs are replayable, so retries in fetchWithRetry
// work correctly. Do not switch to streams without revisiting retry safety.
function buildEditForm(args, outputFormat) {
  const form = new FormData();
  form.append("model", args.model);
  form.append("prompt", args.prompt);
  form.append("size", args.size);
  form.append("quality", args.quality);
  form.append("output_format", outputFormat);

  if (args.background !== "auto") {
    form.append("background", args.background);
  }
  if (args.inputFidelity) {
    form.append("input_fidelity", args.inputFidelity);
  }

  // Single image: field name "image". Multiple: "image[]".
  const fieldName = args.images.length === 1 ? "image" : "image[]";
  for (const imgPath of args.images) {
    const ext = path.extname(imgPath).toLowerCase();
    const mime = MIME_TYPES[ext];
    const buf = fs.readFileSync(imgPath);
    const blob = new Blob([buf], { type: mime });
    form.append(fieldName, blob, path.basename(imgPath));
  }

  if (args.mask) {
    const maskBuf = fs.readFileSync(args.mask);
    const maskBlob = new Blob([maskBuf], { type: "image/png" });
    form.append("mask", maskBlob, path.basename(args.mask));
  }

  return form;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  validate(args);

  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    fail(
      "OPENAI_API_KEY environment variable is not set. " +
      "See https://platform.openai.com/api-keys to create one."
    );
  }

  // Ensure output directory exists
  const outputDir = path.dirname(path.resolve(args.output));
  fs.mkdirSync(outputDir, { recursive: true });

  // Determine output format from file extension
  const ext = path.extname(args.output).toLowerCase();
  const outputFormat = VALID_EXTENSIONS[ext]; // Already validated

  const isEdit = args.images.length > 0;
  let url, fetchOptions;

  if (isEdit) {
    // --- Edits endpoint (multipart/form-data) ---
    url = "https://api.openai.com/v1/images/edits";
    const form = buildEditForm(args, outputFormat);
    fetchOptions = {
      method: "POST",
      headers: {
        // Do NOT set Content-Type — fetch auto-sets the multipart boundary.
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    };
  } else {
    // --- Generations endpoint (JSON) ---
    url = "https://api.openai.com/v1/images/generations";
    // NOTE: Do NOT include `response_format` — it is not valid for gpt-image-1
    // and will cause errors. gpt-image-1 always returns b64_json.
    const requestBody = {
      model: args.model,
      prompt: args.prompt,
      size: args.size,
      quality: args.quality,
      output_format: outputFormat,
    };
    if (args.background !== "auto") {
      requestBody.background = args.background;
    }
    fetchOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    };
  }

  // Call the API
  const response = await fetchWithRetry(url, fetchOptions);

  // Parse response
  let data;
  try {
    data = await response.json();
  } catch (err) {
    fail(`Failed to parse API response as JSON: ${err.message}`);
  }

  // Extract the base64 image data
  // gpt-image-1 always returns b64_json (no URL option)
  const imageData = data?.data?.[0];
  if (!imageData || !imageData.b64_json) {
    fail("Unexpected API response: no image data (b64_json) returned.");
  }

  const imageBuffer = Buffer.from(imageData.b64_json, "base64");

  // Write to file
  const outputPath = path.resolve(args.output);
  try {
    fs.writeFileSync(outputPath, imageBuffer);
  } catch (err) {
    fail(`Failed to write image to "${outputPath}": ${err.message}`);
  }

  // Auto-derive history ID from output path if not provided
  // Uses relative path minus extension to avoid collisions (e.g.,
  // "assets/sprites/snake-idle" instead of just "snake-idle")
  const historyId = args.historyId ||
    args.output.replace(/\.[^.]+$/, "").replace(/^\.\//, "");

  // Build result
  const result = {
    success: true,
    output: outputPath,
    historyId: historyId,
    size: args.size,
    quality: args.quality,
    background: args.background,
    model: args.model,
    bytes: imageBuffer.length,
  };

  if (isEdit) {
    result.inputImages = args.images;
    if (args.mask) result.mask = args.mask;
    if (args.inputFidelity) result.inputFidelity = args.inputFidelity;
  }

  // Append to history file (best-effort — never fail the generation over this)
  if (!args.noHistory) {
    const historyEntry = {
      id: historyId,
      timestamp: new Date().toISOString(),
      prompt: args.prompt,
      output: args.output, // Keep as provided (relative path)
      params: {
        size: args.size,
        quality: args.quality,
        background: args.background,
        model: args.model,
      },
      parentId: args.historyParent || null,
      bytes: imageBuffer.length,
      outputFormat: outputFormat,
    };

    if (args.images.length > 0) {
      historyEntry.inputImages = args.images;
    }
    if (args.mask) {
      historyEntry.mask = args.mask;
    }
    if (args.inputFidelity) {
      historyEntry.inputFidelity = args.inputFidelity;
    }

    try {
      fs.appendFileSync(
        path.resolve(".imagegen-history.jsonl"),
        JSON.stringify(historyEntry) + "\n"
      );
    } catch (err) {
      result.historyWarning = `Failed to write history: ${err.message}`;
    }
  }

  process.stdout.write(JSON.stringify(result) + "\n");
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
});
