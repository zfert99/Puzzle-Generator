/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ easy: 1, medium: 1, hard: 1 })
    });
    
    if (!res.ok) {
      console.error('API failed with status:', res.status);
      const text = await res.text();
      console.error(text);
      process.exit(1);
    }
    
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync('../output/test_output.pdf', buffer);
    console.log('Successfully generated test_output.pdf! Size:', buffer.length, 'bytes');
    process.exit(0);
  } catch (err) {
    console.error('Fetch error:', err);
    process.exit(1);
  }
}

run();
