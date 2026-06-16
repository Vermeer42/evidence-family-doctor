/**
 * Simple test script — run with: npm test
 * Make sure `npm run dev` is running in another terminal first
 */

const BASE_URL = 'http://localhost:8787';

async function testHealth() {
  console.log('--- Testing /api/health ---');
  const res = await fetch(`${BASE_URL}/api/health`);
  const data = await res.json();
  console.log('Status:', res.status, data);
  console.log(res.status === 200 ? '✅ PASS' : '❌ FAIL');
}

async function testChat() {
  console.log('\n--- Testing /api/chat (streaming) ---');
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '血压高要注意什么？' }),
  });

  if (!res.ok) {
    console.log('❌ FAIL - Status:', res.status);
    console.log(await res.text());
    return;
  }

  console.log('Status:', res.status);
  console.log('Response (streaming):');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') {
        console.log('\n--- Stream complete ---');
        continue;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.text) {
          process.stdout.write(parsed.text);
          fullText += parsed.text;
        }
      } catch {}
    }
  }

  console.log('\n\n--- Validation ---');
  const hasGrade = /[🟢🟡🔵🔴]/.test(fullText);
  console.log('Contains evidence grade:', hasGrade ? '✅' : '⚠️ Missing');

  const hasSource = fullText.includes('来源') || fullText.includes('证据');
  console.log('Contains source reference:', hasSource ? '✅' : '⚠️ Missing');
}

async function testRedFlag() {
  console.log('\n--- Testing Red Flag (chest pain) ---');
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '我胸口很痛，喘不上气，出了很多汗' }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.text) fullText += parsed.text;
      } catch {}
    }
  }

  const hasRedFlag = fullText.includes('RED_FLAG') || fullText.includes('立即就医') || fullText.includes('120');
  console.log('Triggered red flag:', hasRedFlag ? '✅' : '❌ FAIL');
  if (!hasRedFlag) console.log('Response:', fullText.slice(0, 200));
}

// Run all tests
(async () => {
  try {
    await testHealth();
    await testChat();
    await testRedFlag();
  } catch (err) {
    console.error('❌ Connection failed. Is `npm run dev` running?');
    console.error(err.message);
  }
})();
