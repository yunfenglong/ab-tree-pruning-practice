# Alpha-Beta Pruning Practice (React + TypeScript)

A modern React + TypeScript rewrite of the original AngularJS + D3 alpha-beta pruning practice tool.

## Features

- React 18 (Fiber) with `createRoot` and StrictMode
- Strong TypeScript types for tree, nodes, edges, actions
- SVG-based renderer (no D3 dependency) with pure React components
- Interactive:
  - Toggle αβ vs. Cutoff display
  - Start/stop animation and step/play through the evaluation
  - Adjustable animation speed
  - Edit node values inline (press Enter to commit, Esc to cancel)
  - Toggle pruning on edges
- Generate trees with configurable depth and branching factor
- Swap Min/Max for the root
- Check Answer, Reset, and Show Solution
- Plain, minimal UI

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
npm run preview
```