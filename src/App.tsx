import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TreeCanvas from './components/TreeCanvas';
import { ActionListQueue, alphaBeta, checkAnswer, createTree, generateABTreeRootNode, resetTree, setSolution } from './lib/tree';
import { Tree, TreeEdge, TreeNode, TreeNodeType, oppositeNodeType } from './lib/types';

type Dims = { width: number; height: number; navbarHeight: number };

export default function App() {
  const [useAb, setUseAb] = useState(true);
  const [timeStep, setTimeStep] = useState(850);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [dims, setDims] = useState<Dims>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    navbarHeight: 48
  }));

  const treeRef = useRef<Tree>(createTree(TreeNodeType.maxNode, 3, 2));
  const actionRef = useRef<ActionListQueue | null>(null);
  const playingRef = useRef<number | null>(null);

  const [, forceTick] = useState(0);
  const forceRender = () => forceTick((x) => x + 1);

  // initialize
  useEffect(() => {
    regenerateTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => {
      setDims({
        width: window.innerWidth,
        height: window.innerHeight,
        navbarHeight: 48
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const regenerateTree = useCallback(() => {
    const t = treeRef.current;
    t.rootNode = generateABTreeRootNode(
      t.treeType,
      t.depth,
      t.branchingFactor,
      -20,
      20
    );
    actionRef.current = null;
    forceRender();
  }, []);

  const incrBranchingFactor = useCallback((incr: number) => {
    const t = treeRef.current;
    t.branchingFactor = Math.max(2, t.branchingFactor + incr);
    regenerateTree();
  }, [regenerateTree]);

  const incrDepth = useCallback((incr: number) => {
    const t = treeRef.current;
    t.depth = Math.max(3, t.depth + incr);
    regenerateTree();
  }, [regenerateTree]);

  const flipMax = useCallback(() => {
    const t = treeRef.current;
    t.treeType = oppositeNodeType(t.treeType);
    regenerateTree();
  }, [regenerateTree]);

  const ensureAction = () => {
    if (!actionRef.current) {
      actionRef.current = alphaBeta(treeRef.current);
    }
    return actionRef.current;
  };

  const toggleABVisual = useCallback(() => {
    const t = treeRef.current;
    const aq = ensureAction();
    resetTree(t.rootNode);
    if (aq.inAction) {
      aq.goToBeginning();
      t.mutable = true;
      aq.inAction = false;
      forceRender();
      return;
    }
    t.mutable = false;
    aq.inAction = true;
    setCorrect(null);
    forceRender();
  }, []);

  const stepBackward = useCallback(() => {
    const aq = actionRef.current;
    if (!aq) return false;
    const ret = aq.stepBackward();
    forceRender();
    return ret;
  }, []);

  const stepForward = useCallback(() => {
    const aq = actionRef.current;
    if (!aq) return false;
    const ret = aq.stepForward();
    forceRender();
    return ret;
  }, []);

  const goToBeginning = useCallback(() => {
    const aq = actionRef.current;
    if (!aq) return;
    aq.goToBeginning();
    forceRender();
  }, []);

  const goToEnd = useCallback(() => {
    const aq = actionRef.current;
    if (!aq) return;
    aq.goToEnd();
    forceRender();
  }, []);

  const play = useCallback(() => {
    const step = () => {
      const res = stepForward();
      if (res) {
        playingRef.current = window.setTimeout(step, timeStep);
      } else {
        playingRef.current = null;
      }
    };
    step();
  }, [stepForward, timeStep]);

  const pause = useCallback(() => {
    if (playingRef.current != null) {
      window.clearTimeout(playingRef.current);
      playingRef.current = null;
    }
  }, []);

  const onEdgeToggle = useCallback((edge: TreeEdge) => {
    edge.pruned = !edge.pruned;
    forceRender();
  }, []);

  const onNodeInputChange = useCallback((node: TreeNode, value: string) => {
    if (value === '' || value === '-' || value === '.' || value === '-.') {
      node.value = null;
    } else {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        node.value = num;
      }
    }
    forceRender();
  }, []);

  const onCheckAnswer = useCallback(() => {
    ensureAction();
    const res = checkAnswer(treeRef.current.rootNode);
    setCorrect(res);
  }, []);

  const onResetTree = useCallback(() => {
    resetTree(treeRef.current.rootNode);
    forceRender();
  }, []);

  const onShowSolution = useCallback(() => {
    ensureAction();
    setSolution(treeRef.current.rootNode);
    forceRender();
  }, []);

  const aq = actionRef.current;
  const progressPct = useMemo(() => {
    if (!aq || !aq.length) return 0;
    return ((aq.lastAction + 1) / aq.length) * 100;
  }, [aq, forceRender]); // forceRender included to re-evaluate

  const t = treeRef.current;

  return (
    <>
      <div className="navbar">
        <div className="brand">Alpha-Beta Pruning Practice</div>
        <div className="mode-toggle">
          <button onClick={() => setUseAb(true)} className={useAb ? 'active' : ''}>αβ</button>
          <button onClick={() => setUseAb(false)} className={!useAb ? 'active' : ''}>Cutoff</button>
        </div>
      </div>
      <div className="layout">
        <div className="tree-scroll">
          <TreeCanvas
            tree={t}
            useAb={useAb}
            dims={dims}
            onEdgeToggle={onEdgeToggle}
            onNodeInputChange={onNodeInputChange}
          />
        </div>
        <div className="ctrl-panel">
          <div className="row">
            <button onClick={toggleABVisual} className="btn">
              {aq?.inAction ? 'Stop' : 'Start'} Animation
            </button>
          </div>
          <div className="row" style={{ display: aq?.inAction ? 'flex' : 'none' }}>
            <div className="row" style={{ gap: 6 }}>
              <button onClick={play} disabled={!aq?.inAction}>⏵</button>
              <button onClick={pause} disabled={!aq?.inAction}>⏸</button>
              <button onClick={stepBackward} disabled={!aq?.inAction}>⏪</button>
              <button onClick={stepForward} disabled={!aq?.inAction}>⏩</button>
              <button onClick={goToBeginning} disabled={!aq?.inAction}>⏮</button>
              <button onClick={goToEnd} disabled={!aq?.inAction}>⏭</button>
            </div>
          </div>
          <div className="row" style={{ display: aq?.inAction ? 'flex' : 'none' }}>
            <div className="progress" style={{ width: '100%' }}>
              <div className="bar" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="row slider-row" style={{ display: aq?.inAction ? 'grid' : 'none' }}>
            <label>Slow</label>
            <input
              type="range"
              min={25}
              max={1675}
              step={25}
              value={timeStep}
              onChange={(e) => setTimeStep(Number(e.target.value))}
            />
            <label>Fast</label>
          </div>

          <div style={{ display: aq?.inAction ? 'none' : 'block' }}>
            <hr />
            <div className="row split">
              <div style={{ textAlign: 'right' }}>
                <label>Depth</label>
              </div>
              <div>
                <button onClick={() => incrDepth(-1)}>-</button>
                <button onClick={() => incrDepth(1)} style={{ marginLeft: 6 }}>+</button>
              </div>
            </div>
            <div className="row split">
              <div style={{ textAlign: 'right' }}>
                <label>Branching Factor</label>
              </div>
              <div>
                <button onClick={() => incrBranchingFactor(-1)}>-</button>
                <button onClick={() => incrBranchingFactor(1)} style={{ marginLeft: 6 }}>+</button>
              </div>
            </div>
            <hr />
            <div className="row split">
              <div style={{ textAlign: 'right' }}>
                <button onClick={flipMax}>Swap Min/Max</button>
              </div>
              <div style={{ textAlign: 'left' }}>
                <button onClick={regenerateTree}>Regenerate Tree</button>
              </div>
            </div>
            <div className="row split">
              <div style={{ textAlign: 'right' }}>
                <button onClick={onResetTree} disabled={aq?.inAction}>Reset Tree</button>
              </div>
              <div style={{ textAlign: 'left' }}>
                <button onClick={onShowSolution} disabled={aq?.inAction}>Show Solution</button>
              </div>
            </div>
            <div className="row split">
              <div style={{ textAlign: 'right' }}>
                <button onClick={onCheckAnswer} disabled={aq?.inAction}>Check Answer</button>
              </div>
              <div className="answer">
                {correct === null ? '--' : (correct ? <span className="correct">Correct!</span> : <span className="incorrect">Incorrect</span>)}
              </div>
            </div>
          </div>
        </div>

        <div className="info">
          <span>
            React + TypeScript rewrite. Original by Aleks Kamko (CS61B).
          </span>
        </div>
        <div className="prune-info">
          <span>Nodes are pruned when {useAb ? 'β ≤ α' : 'value is in cutoff range'}.</span>
        </div>
      </div>
    </>
  );
}


