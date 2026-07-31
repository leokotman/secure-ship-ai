import { defineConfig } from 'orval';

export default defineConfig({
  secureship: {
    input: {
      target: 'http://localhost:8000/openapi.json',
    },
    output: {
      mode: 'split',
      target: 'src/lib/generated/client.ts',
      schemas: 'src/lib/generated/schemas',
      client: 'react-query',
      prettier: true,
    },
  },
});
