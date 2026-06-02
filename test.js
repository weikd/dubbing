import WebSocket from 'isomorphic-ws';
import { generateSecMSGecParam } from 'edge-tts-node/dist/SecMSGec.js';

const token = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const param = generateSecMSGecParam(token);

const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${token}${param}`;
console.log('Connecting with correct headers to:', url);

const ws = new WebSocket(url, {
  headers: {
    "Pragma": "no-cache",
    "Cache-Control": "no-cache",
    "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68"
  }
});

ws.on('open', () => {
  console.log('Successfully connected to MS websocket!');
  ws.close();
});

ws.on('error', (err) => {
  console.error('Websocket error message:', err.message);
});
