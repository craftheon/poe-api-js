import { PoeApi } from '../src';

async function main() {
  const client = new PoeApi({
    tokens: {
      'p-b': 'SbwemCp8_T49a-6AWvzCKw%3D%3D',
      'p-lat': 'mTcEIMVCez9xB%2FiSSDFiVssfJG0RGis1vJ5FKAY3Tg%3D%3D'
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
