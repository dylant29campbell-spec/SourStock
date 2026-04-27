const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('✅ Grok → Retell Bridge is running successfully!');
});

const wss = new WebSocketServer({ 
  port: PORT,
  path: '/llm-websocket'
});

wss.on('connection', (ws) => {
  console.log('✅ Retell connected to Grok bridge');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'llm.request') {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'grok-4',
            messages: data.messages,
            temperature: 0.7,
            max_tokens: 800,
            stream: false
          })
        });

        const result = await response.json();
        const content = result.choices[0]?.message?.content || "Sorry, I didn't understand that.";

        ws.send(JSON.stringify({
          type: 'llm.response',
          content: content
        }));
      }
    } catch (err) {
      console.error(err);
    }
  });

  ws.on('close', () => console.log('Retell disconnected'));
});

console.log(`Bridge running on port ${PORT}`);
