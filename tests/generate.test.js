/**
 * Offline validation tests for generate.cjs
 *
 * 12 test cases covering argument parsing, validation, and error handling.
 * Uses only Node.js built-ins — no external test frameworks.
 */

import { spawnSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '../.claude/skills/imagegen/generate.cjs');

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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
