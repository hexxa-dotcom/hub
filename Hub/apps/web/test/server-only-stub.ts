// Stub pra rodar módulos com `import 'server-only'` sob vitest (Node puro) —
// esse pacote lança erro deliberadamente quando importado fora do bundler
// do Next. Aliado em vitest.config.ts só pro ambiente de teste.
export {};
