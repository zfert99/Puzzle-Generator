/**
 * Tests for the /api/generate route handler.
 * 
 * We test the POST function directly by constructing mock NextRequest objects
 * and asserting on the returned NextResponse. This allows us to test the entire
 * pipeline (validation, puzzle generation, PDF rendering) without needing a
 * running server environment.
 */
import { POST } from '@/app/api/generate/route';
import { NextRequest } from 'next/server';

/**
 * Helper to construct a mock NextRequest containing a JSON payload.
 * Simulates a standard POST request from the frontend PuzzleForm component.
 */
function buildRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Helper to construct a completely empty NextRequest.
 * Used exclusively for testing edge cases where the network request fails to send a body.
 */
function buildEmptyRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/generate', {
    method: 'POST',
  });
}

// ─── Happy Paths ──────────────────────────────────────────────────────────────
// Tests that verify the API behaves correctly when given valid inputs.

describe('Happy Paths', () => {

  test('The Mixed Book: 1 easy, 2 medium, 1 hard, 1 expert returns 200', async () => {
    // This is the ultimate integration test. It requests one of every difficulty,
    // which tests the full logic of both the quota digger and the exhaustive expert digger.
    const res = await POST(buildRequest({ easy: 1, medium: 2, hard: 1, expert: 1 }));
    expect(res.status).toBe(200);
  }, 60_000); // Generous timeout because expert puzzle generation + PDF rendering takes time

  test('The Extreme Challenge: 1 extreme puzzle returns 200', async () => {
    // Tests the full extreme pipeline: W-Wing/ALS/AIC solver strategies,
    // the extreme digger with retry logic, and PDF rendering.
    const res = await POST(buildRequest({ extreme: 1 }));
    expect(res.status).toBe(200);
  }, 120_000); // Extreme puzzles may retry multiple grids — generous timeout

  test('The Minimum Book: 1 easy puzzle returns 200', async () => {
    const res = await POST(buildRequest({ easy: 1 }));
    expect(res.status).toBe(200);
  }, 30_000);

  test('Content-Type header is application/pdf', async () => {
    // Ensures the browser knows how to handle the returned binary blob
    const res = await POST(buildRequest({ easy: 1 }));
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  }, 30_000);

  test('Content-Disposition header triggers a file download', async () => {
    // Ensures the browser prompts the user to download the file instead of opening it inline
    const res = await POST(buildRequest({ easy: 1 }));
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="Sudoku_Puzzles.pdf"');
  }, 30_000);

  test('Response body starts with a valid PDF header (%PDF)', async () => {
    // The ultimate sanity check. If the binary blob doesn't start with %PDF, it's corrupt.
    const res = await POST(buildRequest({ easy: 1 }));
    const buffer = Buffer.from(await res.arrayBuffer());
    
    // Every valid PDF document must start with the magic bytes "%PDF"
    const header = buffer.subarray(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  }, 30_000);
});

// ─── Sad Paths ────────────────────────────────────────────────────────────────
// Tests that verify the API safely rejects bad data and handles malicious inputs.

describe('Sad Paths', () => {

  test('The "Zero" Request: all zeros returns 400', async () => {
    const res = await POST(buildRequest({ easy: 0, medium: 0, hard: 0, expert: 0 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('Empty object body (no fields) returns 400', async () => {
    // An empty JSON object {} evaluates to all zeros because of our default destructuring
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  test('The Overload: requesting more than 50 total puzzles returns 400', async () => {
    // This tests our DDoS protection / server load protection limit
    const res = await POST(buildRequest({ easy: 20, medium: 20, hard: 20 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/maximum|limit|too many/i);
  });

  test('Bad Data Types: non-numeric values are rejected', async () => {
    const res = await POST(buildRequest({ easy: 'apple', medium: 'banana', hard: 'cherry', expert: 'date' }));
    expect(res.status).toBe(400);
  });

  test('Negative Numbers: negative counts are rejected', async () => {
    // We shouldn't allow generating -5 puzzles
    const res = await POST(buildRequest({ easy: -5, medium: 0, hard: 0, expert: 0 }));
    expect(res.status).toBe(400);
  });

  test('Missing body entirely returns an error (not a crash)', async () => {
    const res = await POST(buildEmptyRequest());
    // Should return a 400 (Bad Request) or 500 (Internal Server Error)
    // Most importantly, the route must handle it gracefully and NOT crash the Node.js process
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
