import { PoeApi } from '../src';

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
