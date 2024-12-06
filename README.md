# poe-api-js
Typescript Api wrapper for Poe.com. With this, you will have free access to GPT-4, Claude, Llama, Gemini, Mistral and more! 🚀


## Install
```
$ npm install poe-api-js
```

## Usage
```
import { PoeApi } from 'poe-api-js';

async function main() {
  const client = new PoeApi({
    tokens: {
      'p-b': 'your-pb-token',
      'p-lat': 'your-plat-token'
    }
  });

  // Send a message and get streaming response
  const messageGenerator = await client.sendMessage('gpt3_5', 'Hello!');

  for await (const chunk of messageGenerator) {
    if (chunk.response) {
      process.stdout.write(chunk.response);
    }
  }
}

main().catch(console.error);

```