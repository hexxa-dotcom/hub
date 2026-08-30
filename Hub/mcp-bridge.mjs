#!/usr/bin/env node
import readline from 'node:readline';

const token = process.env.HEXX_API_TOKEN || process.argv[2];
const url = process.env.HEXX_MCP_URL || 'http://localhost:3001/api/mcp';

if (!token) {
  process.stderr.write('Erro: Token HEXX_API_TOKEN ausente. Passe via env HEXX_API_TOKEN ou como primeiro argumento.\n');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const parsed = JSON.parse(trimmed);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${token}`,
      },
      body: trimmed,
    });

    const text = await res.text();
    // Extrai linhas de dados do formato SSE (data: {...}) ou JSON direto
    for (const raw of text.split('\n')) {
      const lineStr = raw.trim();
      if (lineStr.startsWith('data: ')) {
        const payload = lineStr.slice(6).trim();
        if (payload) {
          process.stdout.write(payload + '\n');
        }
      } else if (lineStr.startsWith('{') && lineStr.endsWith('}')) {
        process.stdout.write(lineStr + '\n');
      }
    }
  } catch (err) {
    process.stderr.write(`Bridge error: ${err.message}\n`);
  }
});
