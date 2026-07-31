import { defineConfig } from 'orval';

const openApiTarget = process.env.ORVAL_OPENAPI_TARGET || 'http://localhost:8000/openapi.json';

export default defineConfig({
  secureship: {
    input: {
      target: openApiTarget,
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
