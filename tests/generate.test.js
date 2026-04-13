/**
 * Offline validation tests for generate.cjs
 *
 * 28 test cases covering argument parsing, validation, and error handling.
 * Uses only Node.js built-ins — no external test frameworks.
 */

import { spawnSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '../.claude/skills/imagegen/generate.cjs');

// Create a minimal 1x1 PNG for tests that need a real image file.
// PNG spec: signature + IHDR + IDAT + IEND (67 bytes).
const TEMP_DIR = mkdtempSync(path.join(tmpdir(), 'imagegen-test-'));
const TEMP_PNG = path.join(TEMP_DIR, 'test.png');
const TEMP_JPG = path.join(TEMP_DIR, 'test.jpg');
const TEMP_TXT = path.join(TEMP_DIR, 'test.txt');
const MINI_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
writeFileSync(TEMP_PNG, MINI_PNG);
writeFileSync(TEMP_JPG, MINI_PNG); // content doesn't matter, just needs to exist
writeFileSync(TEMP_TXT, 'not an image');

// Cleanup on exit
process.on('exit', () => { try { rmSync(TEMP_DIR, { recursive: true }); } catch {} });

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name}\n    ${err.message}`);
  }
}

function run(args, opts = {}) {
  const result = spawnSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: opts.env || process.env,
    timeout: 10000,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

console.log('\ngenerate.cjs — offline validation tests\n');

// 1. Help flag
test('--help prints usage and exits 0', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}`);
  assert.ok(r.stdout.includes('Usage:'), 'stdout should contain "Usage:"');
});

// 2. Help with extra flags
test('--help --foo also exits 0 (early exit)', () => {
  const r = run(['--help', '--foo']);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}`);
  assert.ok(r.stdout.includes('Usage:'), 'stdout should contain "Usage:"');
});

// 3. No arguments
test('no arguments exits non-zero with "--prompt is required."', () => {
  const r = run([]);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('--prompt is required.'), `stdout: ${r.stdout}`);
});

// 4. Missing output
test('--prompt only exits non-zero with "--output is required."', () => {
  const r = run(['--prompt', 'test']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('--output is required.'), `stdout: ${r.stdout}`);
});

// 5. Missing arg value
test('--prompt as last flag exits non-zero with "--prompt requires a value."', () => {
  const r = run(['--prompt']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('--prompt requires a value.'), `stdout: ${r.stdout}`);
});

// 6. Invalid size
test('--size 999x999 exits non-zero with invalid size error', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--size', '999x999']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('Invalid --size'), `stdout: ${r.stdout}`);
});

// 7. Invalid quality
test('--quality ultra exits non-zero with invalid quality error', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--quality', 'ultra']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('Invalid --quality'), `stdout: ${r.stdout}`);
});

// 8. Invalid background
test('--background fuzzy exits non-zero with invalid background error', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--background', 'fuzzy']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('Invalid --background'), `stdout: ${r.stdout}`);
});

// 9. Unsupported extension
test('--output "t.bmp" exits non-zero with unsupported extension error', () => {
  const r = run(['--prompt', 'test', '--output', 't.bmp']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('Unsupported file extension'), `stdout: ${r.stdout}`);
});

// 10. JPEG + transparent
test('--output "t.jpg" --background transparent exits non-zero', () => {
  const r = run(['--prompt', 'test', '--output', 't.jpg', '--background', 'transparent']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('JPEG does not support transparency'), `stdout: ${r.stdout}`);
});

// 11. Missing API key
test('valid args with OPENAI_API_KEY="" exits non-zero with missing key error', () => {
  const r = run(['--prompt', 'test', '--output', 't.png'], {
    env: { ...process.env, OPENAI_API_KEY: '' },
  });
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('OPENAI_API_KEY'), `stdout: ${r.stdout}`);
});

// 12. Unknown argument
test('--foo exits non-zero with unknown argument error', () => {
  const r = run(['--foo']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('Unknown argument'), `stdout: ${r.stdout}`);
});

// -------------------------------------------------------------------------
// Reference image tests (--image, --mask, --input-fidelity)
// -------------------------------------------------------------------------

console.log('\n  --- reference image tests ---\n');

// 13. --image without value
test('--image as last flag exits non-zero with "--image requires a value."', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('--image requires a value.'), `stdout: ${r.stdout}`);
});

// 14. --image with nonexistent file
test('--image /nonexistent/file.png exits non-zero with file not found', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image', '/nonexistent/file.png']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('file not found'), `stdout: ${r.stdout}`);
});

// 15. --image with non-image extension
test('--image with .txt extension exits non-zero with unsupported extension', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image', TEMP_TXT]);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('unsupported extension'), `stdout: ${r.stdout}`);
});

// 16. --image with valid file passes validation (fails later at API key check)
test('--image with valid PNG passes validation, fails at API key check', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image', TEMP_PNG], {
    env: { ...process.env, OPENAI_API_KEY: '' },
  });
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('OPENAI_API_KEY'), `should reach API key check, stdout: ${r.stdout}`);
});

// 17. --mask without --image
test('--mask without --image exits non-zero', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--mask', TEMP_PNG]);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('--mask requires at least one --image'), `stdout: ${r.stdout}`);
});

// 18. --mask without value
test('--mask as last flag exits non-zero with "--mask requires a value."', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image', TEMP_PNG, '--mask']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('--mask requires a value.'), `stdout: ${r.stdout}`);
});

// 19. --mask with non-PNG extension
test('--mask with .jpg extension exits non-zero (must be PNG)', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image', TEMP_PNG, '--mask', TEMP_JPG]);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('unsupported extension'), `stdout: ${r.stdout}`);
});

// 20. --input-fidelity without --image
test('--input-fidelity without --image exits non-zero', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--input-fidelity', 'high']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('--input-fidelity requires at least one --image'), `stdout: ${r.stdout}`);
});

// 21. --input-fidelity with invalid value
test('--input-fidelity banana exits non-zero', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image', TEMP_PNG, '--input-fidelity', 'banana']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('Invalid --input-fidelity'), `stdout: ${r.stdout}`);
});

// 22. --input-fidelity without value
test('--input-fidelity as last flag exits non-zero', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image', TEMP_PNG, '--input-fidelity']);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('--input-fidelity requires a value.'), `stdout: ${r.stdout}`);
});

// 23. More than 16 --image flags
test('17 --image flags exits non-zero with too many images error', () => {
  const imageArgs = [];
  for (let i = 0; i < 17; i++) imageArgs.push('--image', TEMP_PNG);
  const r = run(['--prompt', 'test', '--output', 't.png', ...imageArgs]);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('Too many --image'), `stdout: ${r.stdout}`);
});

// 24. --help output includes new flags
test('--help mentions --image, --mask, and --input-fidelity', () => {
  const r = run(['--help']);
  assert.ok(r.stdout.includes('--image'), 'help should mention --image');
  assert.ok(r.stdout.includes('--mask'), 'help should mention --mask');
  assert.ok(r.stdout.includes('--input-fidelity'), 'help should mention --input-fidelity');
});

// 25. --image with valid file + --background transparent + JPEG output still errors
test('--image + --background transparent + .jpg output exits non-zero', () => {
  const r = run(['--prompt', 'test', '--output', 't.jpg', '--background', 'transparent', '--image', TEMP_PNG]);
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('JPEG does not support transparency'), `stdout: ${r.stdout}`);
});

// 26. Multiple --image flags with valid files pass validation
test('multiple --image flags with valid files pass validation', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image', TEMP_PNG, '--image', TEMP_JPG], {
    env: { ...process.env, OPENAI_API_KEY: '' },
  });
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('OPENAI_API_KEY'), `should reach API key check, stdout: ${r.stdout}`);
});

// 27. --mask with valid PNG + --image passes validation
test('--mask with valid PNG passes validation', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image', TEMP_PNG, '--mask', TEMP_PNG], {
    env: { ...process.env, OPENAI_API_KEY: '' },
  });
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('OPENAI_API_KEY'), `should reach API key check, stdout: ${r.stdout}`);
});

// 28. --input-fidelity high with --image passes validation
test('--input-fidelity high with --image passes validation', () => {
  const r = run(['--prompt', 'test', '--output', 't.png', '--image', TEMP_PNG, '--input-fidelity', 'high'], {
    env: { ...process.env, OPENAI_API_KEY: '' },
  });
  assert.notEqual(r.status, 0, 'expected non-zero exit');
  assert.ok(r.stdout.includes('OPENAI_API_KEY'), `should reach API key check, stdout: ${r.stdout}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
