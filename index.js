const express = require('express');
const { WebSocket } = require('ws');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('✅ Grok → Retell Bridge is running successfully!');
});

const server = app.listen(PORT, () => {
  console.log(`Bridge running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server, path: '/llm-websocket' });

wss.on('connection', (client) => {
  console.log('🔗 Retell AI connected to Grok bridge');

  client.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'conversation.initiation') {
        client.send(JSON.stringify({ type: 'conversation.initiation' }));
        return;
      }

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
            stream: true,
          }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.replace('data: ', '').trim();
              if (jsonStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices[0]?.delta?.content || '';
                if (content) {
                  client.send(JSON.stringify({
                    type: 'llm.response',
                    content: content
                  }));
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  });

  client.on('close', () => console.log('Retell disconnected'));
});

console.log('Grok-Retell Bridge initialized');
