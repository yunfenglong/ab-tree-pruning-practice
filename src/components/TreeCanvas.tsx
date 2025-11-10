import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Tree, TreeEdge, TreeNode, TreeNodeType } from '../lib/types';

type Dims = { width: number; height: number; navbarHeight: number };

export interface TreeCanvasProps {
  tree: Tree;
  useAb: boolean;
  dims: Dims;
  onEdgeToggle?: (edge: TreeEdge) => void;
  onNodeInputChange?: (node: TreeNode, value: string) => void;
}

type LayoutMetrics = {
  marginX: number;
  marginTop: number;
  nodeSide: number;
  triHeight: number;
  triCenterFromBase: number;
};

function toInfinityStr(n: number | null | undefined): string {
  if (n == null) return '';
  if (n === Infinity) return '∞';
  if (n === -Infinity) return '-∞';
  return String(n);
}

function layoutTree(
  tree: Tree,
  width: number,
  height: number,
  m: LayoutMetrics
): { nodes: TreeNode[]; edges: TreeEdge[]; yOffset: number } {
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  if (!tree.rootNode) return { nodes, edges, yOffset: 0 };
  const bFac = tree.branchingFactor;
  const maxDepth = tree.depth;
  const yOffset = (height - (m.marginX + m.marginTop)) / Math.max(1, (maxDepth - 1));

  const assign = (node: TreeNode | undefined, xMin: number, xMax: number) => {
    if (!node) return;
    const range = xMax - xMin;
    const newOffset = range / bFac;
    const yPos = m.marginTop + yOffset * (node.depth - 1);
    const xPos = xMin + range / 2;
    node.x = xPos;
    node.y = yPos;
    nodes.push(node);
    if (node.edgeToParent) edges.push(node.edgeToParent);
    for (let k = 0; k < bFac; k++) {
      assign(node.children[k], xMin + newOffset * k, xMin + newOffset * (k + 1));
    }
  };
  assign(tree.rootNode, m.marginX, width - m.marginX);
  return { nodes, edges, yOffset };
}

export default function TreeCanvas(props: TreeCanvasProps) {
  const { tree, useAb, dims, onEdgeToggle, onNodeInputChange } = props;
  const viewportWidth = dims.width;
  const viewportHeight = dims.height - dims.navbarHeight;
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [valStr, setValStr] = useState<string>('');
  const [charIndex, setCharIndex] = useState<number>(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute responsive metrics to reduce overlap as branching/depth increases
  const metrics: LayoutMetrics = useMemo(() => {
    // Fixed node size; scrolling will handle overflow
    const nodeSide = 80;
    const marginTop = 100;
    const marginX = 120;
    const triHeight = Math.sqrt(Math.pow(nodeSide, 2) - Math.pow(nodeSide / 2, 2));
    const triCenterFromBase = Math.sqrt(Math.pow(nodeSide / Math.sqrt(3), 2) - Math.pow(nodeSide / 2, 2));
    return { marginX, marginTop, nodeSide, triHeight, triCenterFromBase };
  }, []);

  // Compute canvas size to enable scrolling
  const canvasSize = useMemo(() => {
    const b = Math.max(2, tree.branchingFactor || 2);
    const d = Math.max(1, tree.depth || 1);
    const leafCount = Math.pow(b, Math.max(0, d - 1));
    const xCell = metrics.nodeSide * 1.6;
    const yBand = metrics.nodeSide * 2.0;
    const widthNeeded = metrics.marginX * 2 + leafCount * xCell;
    const heightNeeded = metrics.marginTop + (d - 1) * yBand + metrics.marginX;
    return {
      width: Math.max(viewportWidth, Math.ceil(widthNeeded)),
      height: Math.max(viewportHeight, Math.ceil(heightNeeded)),
      yBand
    };
  }, [tree.branchingFactor, tree.depth, metrics, viewportWidth, viewportHeight]);

  const { nodes, edges } = useMemo(
    () => {
      const res = layoutTree(tree, canvasSize.width, canvasSize.height, metrics);
      return { nodes: res.nodes, edges: res.edges };
    },
    [tree.rootNode, tree.branchingFactor, tree.depth, canvasSize.width, canvasSize.height, metrics]
  );

  const getNodeById = useCallback((id: number | null): TreeNode | undefined => {
    if (id == null) return undefined;
    return nodes.find(n => n.id === id);
  }, [nodes]);

  const startEditing = useCallback((node: TreeNode) => {
    setSelectedNodeId((prev) => {
      if (prev !== null && prev !== node.id) {
        // committing previous selection when switching
        const prevNode = getNodeById(prev);
        if (prevNode) {
          // commit current text into previous node
          const num = parseFloat(valStr);
          (prevNode as any).value = Number.isNaN(num) ? null : num;
        }
      }
      return node.id;
    });
    const nextStr = node.value == null ? '' : String(node.value);
    setValStr(nextStr);
    setCharIndex(nextStr.length);
  }, [getNodeById, valStr]);

  const commitEditing = useCallback(() => {
    if (selectedNodeId == null) return;
    const node = getNodeById(selectedNodeId);
    if (node) {
      const num = parseFloat(valStr);
      (node as any).value = Number.isNaN(num) ? null : num;
    }
    setSelectedNodeId(null);
    setValStr('');
    setCharIndex(0);
  }, [getNodeById, selectedNodeId, valStr]);

  const cancelEditing = useCallback(() => {
    setSelectedNodeId(null);
    setValStr('');
    setCharIndex(0);
  }, []);

  const ensureCanvas = () => {
    if (!measureCanvasRef.current) {
      measureCanvasRef.current = document.createElement('canvas');
    }
    return measureCanvasRef.current;
  };
  const measureTextWidth = useCallback((text: string, px: number) => {
    const canvas = ensureCanvas();
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    ctx.font = `${px}px Helvetica Neue, Arial, sans-serif`;
    const metrics = ctx.measureText(text);
    return metrics.width;
  }, []);

  const onSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Clicking on background should commit and clear selection
    if (e.target === e.currentTarget && selectedNodeId != null) {
      commitEditing();
    }
  }, [commitEditing, selectedNodeId]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<SVGSVGElement>) => {
    if (selectedNodeId == null) return;
    let handled = false;
    if (e.key.length === 1) {
      // Accept digits, minus, decimal point
      if (/[0-9\.\-]/.test(e.key)) {
        const left = valStr.slice(0, charIndex);
        const right = valStr.slice(charIndex);
        const newStr = left + e.key + right;
        setValStr(newStr);
        setCharIndex(charIndex + 1);
        handled = true;
      }
    } else if (e.key === 'Backspace') {
      const left = valStr.slice(0, Math.max(0, charIndex - 1));
      const right = valStr.slice(charIndex);
      setValStr(left + right);
      setCharIndex(Math.max(0, charIndex - 1));
      handled = true;
    } else if (e.key === 'ArrowLeft') {
      setCharIndex(Math.max(0, charIndex - 1));
      handled = true;
    } else if (e.key === 'ArrowRight') {
      setCharIndex(Math.min(valStr.length, charIndex + 1));
      handled = true;
    } else if (e.key === 'Enter') {
      commitEditing();
      handled = true;
    } else if (e.key === 'Escape') {
      cancelEditing();
      handled = true;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [selectedNodeId, valStr, charIndex, commitEditing, cancelEditing]);

  return (
    <svg
      ref={svgRef}
      className="tree-canvas"
      width={canvasSize.width}
      height={canvasSize.height}
      onMouseDown={onSvgMouseDown}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <g className="links">
        {edges.map((e, idx) => {
          const d = `M${e.source.x},${e.source.y}L${e.target.x},${e.target.y}`;
          const cls = ['link'];
          if (e.pruned) cls.push('pruned');
          if (e.entered) cls.push('entered');
          return (
            <g key={idx}>
              <path className={cls.join(' ')} d={d} />
              <path
                className="mouselink"
                d={d}
                onMouseDown={(ev) => {
                  ev.stopPropagation();
                  if (!tree.mutable) return;
                  onEdgeToggle?.(e);
                }}
              />
            </g>
          );
        })}
      </g>
      <g className="nodes">
        {nodes.map((n) => {
          const isLeaf = n.nodeType === TreeNodeType.leafNode;
          const classes = ['node'];
          if (isLeaf) classes.push('leaf');
          if (n.entered) classes.push('entered');
          if ((n as any).pruned) classes.push('pruned');

          const fontBase = 18;
          const fontSmall = 14;
          const valueYOffset = 6;
          const labelXOffset = 45;
          const alphaYOffset = -4;
          const betaYOffset = 16;

          const transform = (() => {
            const halfSide = metrics.nodeSide / 2;
            if (isLeaf) {
              return `translate(${(n.x ?? 0) - halfSide},${(n.y ?? 0) + halfSide})`;
            }
            if (n.nodeType === TreeNodeType.maxNode) {
              return `translate(${(n.x ?? 0) - halfSide},${(n.y ?? 0) + metrics.triCenterFromBase})`;
            }
            // min node rotated 180
            return `translate(${(n.x ?? 0) + halfSide},${(n.y ?? 0) - metrics.triCenterFromBase}) rotate(180)`;
          })();

          const pathD = (() => {
            const s = metrics.nodeSide;
            if (isLeaf) {
              const ns = s / 2.1;
              const a = (s - ns) / 2;
              return `M${a},${-a}L${ns + a},${-a}L${ns + a},${-ns - a}L${a},${-ns - a}L${a},${-a}`;
            }
            const h = metrics.triHeight;
            return `M0,0L${s},0L${s / 2},${-h}L0,0`;
          })();

          const alphaText = (() => {
            const a = n.alpha ?? (n as any).__alpha ?? null;
            const b = n.beta ?? (n as any).__beta ?? null;
            if (a == null || b == null) return '';
            if (!useAb) {
              if (n.nodeType === TreeNodeType.maxNode) {
                return `c ≥ ${toInfinityStr(b)}`;
              } else if (n.nodeType === TreeNodeType.minNode) {
                return `c ≤ ${toInfinityStr(a)}`;
              }
              return '';
            }
            return `α: ${toInfinityStr(a)}`;
          })();
          const betaText = (() => {
            if (!useAb) return '';
            const b = n.beta ?? (n as any).__beta ?? null;
            if (b == null) return '';
            return `β: ${toInfinityStr(b)}`;
          })();

          return (
            <g
              key={n.id}
              className={classes.join(' ')}
              onMouseDown={(ev) => {
                ev.stopPropagation();
                if (!tree.mutable) return;
                if (selectedNodeId !== n.id) {
                  startEditing(n);
                }
              }}
            >
              <path
                className="nodepath"
                d={pathD}
                transform={transform}
              />
              <text className="value" x={n.x} y={(n.y ?? 0) + valueYOffset} style={{ fontSize: fontBase }}>
                {selectedNodeId === n.id ? valStr : (n.value != null ? String(n.value) : '')}
              </text>
              {selectedNodeId === n.id && (
                <rect
                  className="cursor"
                  x={(n.x ?? 0)
                    + (measureTextWidth((selectedNodeId === n.id ? valStr : (n.value != null ? String(n.value) : '')), fontBase) / -2)
                    + measureTextWidth((valStr.substring(0, charIndex)), fontBase)}
                  y={(n.y ?? 0) - (fontBase * 0.7)}
                  width={1.5}
                  height={fontBase * 0.95}
                  style={{ animation: 'blink 1.2s steps(1, end) infinite' }}
                />
              )}
              <text className="alpha" x={(n.x ?? 0) + labelXOffset} y={(n.y ?? 0) + alphaYOffset} style={{ fontSize: fontSmall }}>
                {alphaText}
              </text>
              <text className="beta" x={(n.x ?? 0) + labelXOffset} y={(n.y ?? 0) + betaYOffset} style={{ fontSize: fontSmall }}>
                {betaText}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}


