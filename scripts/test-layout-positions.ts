import { buildRouteGraph } from '../src/lib/graph/graph-builder';

const sampleRoutes = [
  {
    id: 'r1',
    httpMethod: 'GET' as const,
    routePath: '/api/v1/users',
    handlerName: 'listUsers',
    location: { filePath: 'routes/users.ts', startLine: 10, endLine: 20 },
    codeSnippet: '...',
    calledFunctions: ['findUsers', 'c.JSON'],
  },
  {
    id: 'r2',
    httpMethod: 'POST' as const,
    routePath: '/api/v1/users',
    handlerName: 'createUser',
    location: { filePath: 'routes/users.ts', startLine: 22, endLine: 35 },
    codeSnippet: '...',
    calledFunctions: ['validateUser', 'saveUser', 'c.JSON'],
  },
  {
    id: 'r3',
    httpMethod: 'POST' as const,
    routePath: '/auth/login',
    handlerName: 'login',
    location: { filePath: 'routes/auth.ts', startLine: 5, endLine: 18 },
    codeSnippet: '...',
    calledFunctions: ['verifyPass', 'generateJwt'],
  },
];

const graph = buildRouteGraph(sampleRoutes as any, 'Express');
console.log('Total nodes:', graph.nodes.length);
console.log('Total edges:', graph.edges.length);
const types = Array.from(new Set(graph.nodes.map((n) => n.type)));
console.log('Node types in graph:', types);

console.log('\n--- Node Placements ---');
for (const n of graph.nodes) {
  console.log(`[${n.type}] id=${n.id} pos=(${n.position.x}, ${n.position.y})`);
}

console.log('\n--- Edges ---');
for (const e of graph.edges) {
  console.log(`Edge: ${e.source} -> ${e.target}`);
}
