/**
 * Tests for the /api/generate route handler.
 * 
 * We test the POST function directly by constructing mock NextRequest objects
 * and asserting on the returned NextResponse.
 */
import { POST } from '@/app/api/generate/route';
import { NextRequest } from 'next/server';

// Helper to build a mock NextRequest with a JSON body
function buildRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Helper to build a NextRequest with no body at all
function buildEmptyRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/generate', {
    method: 'POST',
  });
}

// ─── Happy Paths ──────────────────────────────────────────────────────────────

describe('Happy Paths', () => {

  test('The Mixed Book: 1 easy, 2 medium, 1 hard returns 200', async () => {
    const res = await POST(buildRequest({ easy: 1, medium: 2, hard: 1 }));
    expect(res.status).toBe(200);
  }, 60_000); // Generous timeout because puzzle generation + PDF rendering can be slow

  test('The Minimum Book: 1 easy puzzle returns 200', async () => {
    const res = await POST(buildRequest({ easy: 1 }));
    expect(res.status).toBe(200);
  }, 30_000);

  test('Content-Type header is application/pdf', async () => {
    const res = await POST(buildRequest({ easy: 1 }));
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  }, 30_000);

  test('Content-Disposition header triggers a file download', async () => {
    const res = await POST(buildRequest({ easy: 1 }));
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="Sudoku_Puzzles.pdf"');
  }, 30_000);

  test('Response body starts with a valid PDF header (%PDF)', async () => {
    const res = await POST(buildRequest({ easy: 1 }));
    const buffer = Buffer.from(await res.arrayBuffer());
    // Every valid PDF starts with the magic bytes "%PDF"
    const header = buffer.subarray(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  }, 30_000);
});

// ─── Sad Paths ────────────────────────────────────────────────────────────────

describe('Sad Paths', () => {

  test('The "Zero" Request: all zeros returns 400', async () => {
    const res = await POST(buildRequest({ easy: 0, medium: 0, hard: 0 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('Empty object body (no fields) returns 400', async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  test('The Overload: requesting more than 50 total puzzles returns 400', async () => {
    const res = await POST(buildRequest({ easy: 20, medium: 20, hard: 20 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/maximum|limit|too many/i);
  });

  test('Bad Data Types: non-numeric values are rejected', async () => {
    const res = await POST(buildRequest({ easy: 'apple', medium: 'banana', hard: 'cherry' }));
    expect(res.status).toBe(400);
  });

  test('Negative Numbers: negative counts are rejected', async () => {
    const res = await POST(buildRequest({ easy: -5, medium: 0, hard: 0 }));
    expect(res.status).toBe(400);
  });

  test('Missing body entirely returns an error (not a crash)', async () => {
    const res = await POST(buildEmptyRequest());
    // Should return a 400 or 500, but NOT crash the process
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
