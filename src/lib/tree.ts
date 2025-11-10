import { Action as IAction, ActionListQueue as IActionListQueue, Tree, TreeEdge, TreeNode, TreeNodeType, oppositeNodeType } from './types';

class Action<T extends object, K extends keyof T = any> implements IAction<T, K> {
  object: T | undefined | null;
  key: K;
  oldVal: any;
  newVal: any;
  constructor(object: T | undefined | null, key: K, oldVal: any, newVal: any) {
    this.object = object;
    this.key = key;
    this.oldVal = oldVal;
    this.newVal = newVal;
  }
  apply(): void {
    if (!this.object) return;
    (this.object as any)[this.key] = this.newVal;
  }
  reverse(): void {
    if (!this.object) return;
    (this.object as any)[this.key] = this.oldVal;
  }
}

export class ActionListQueue implements IActionListQueue {
  inAction = false;
  lastAction = -1;
  actionListQueue: Array<Array<Action<any>>> = [];
  length = 0;

  pushActionList(actionList: Array<Action<any>>): boolean {
    if (this.inAction) return false;
    this.actionListQueue.push(actionList);
    this.length += 1;
    return true;
  }
  extendActionList(actionLists: Array<Array<Action<any>>>): boolean {
    if (this.inAction) return false;
    this.actionListQueue.push(...actionLists);
    this.length += actionLists.length;
    return true;
  }
  stepForward(): boolean {
    if (!this.inAction || this.lastAction === (this.actionListQueue.length - 1)) {
      return false;
    }
    this.lastAction += 1;
    const actionList = this.actionListQueue[this.lastAction]!;
    for (const action of actionList) {
      action.apply();
    }
    return true;
  }
  stepBackward(): boolean {
    if (!this.inAction || this.lastAction === -1) {
      return false;
    }
    const actionList = this.actionListQueue[this.lastAction]!;
    for (const action of actionList) {
      action.reverse();
    }
    this.lastAction -= 1;
    return true;
  }
  goToEnd(): void {
    if (!this.inAction) return;
    while (this.stepForward()) {}
  }
  goToBeginning(): void {
    if (!this.inAction) return;
    while (this.stepBackward()) {}
  }
}

let globalNodeId = 0;

export function createTree(treeType: TreeNodeType, depth: number, branchingFactor: number): Tree {
  return {
    rootNode: null,
    treeType,
    depth,
    branchingFactor,
    mutable: true
  };
}

export function generateABTreeRootNode(
  treeType: TreeNodeType,
  maxDepth: number,
  branchingFactor: number,
  minVal: number,
  maxVal: number
): TreeNode {
  function generateSubTree(parentNode: TreeNode | undefined, nodeType: TreeNodeType, depth: number, bFac: number): TreeNode {
    const curNode: TreeNode = {
      id: ++globalNodeId,
      nodeType,
      parentNode,
      depth,
      childNum: bFac,
      children: new Array(bFac),
      value: null
    };
    if (parentNode) {
      const edge: TreeEdge = { source: parentNode, target: curNode, pruned: false };
      curNode.edgeToParent = edge;
    }
    if (depth === maxDepth) {
      curNode.nodeType = TreeNodeType.leafNode;
      curNode.value = Math.round(Math.random() * (maxVal - minVal)) - maxVal;
    } else {
      for (let k = 0; k < bFac; k++) {
        curNode.children[k] = generateSubTree(
          curNode,
          oppositeNodeType(nodeType),
          depth + 1,
          bFac
        );
      }
    }
    return curNode;
  }
  return generateSubTree(undefined, treeType, 1, branchingFactor);
}

function generatePruneActionList(node: TreeNode | undefined, bFac: number): Array<Action<any>> {
  const actions: Array<Action<any>> = [];
  function pruneInner(n: TreeNode | undefined) {
    if (!n) return;
    if (n.edgeToParent) {
      actions.push(new Action(n.edgeToParent, 'pruned', false, true));
      (n.edgeToParent as any).__pruned = true;
    }
    for (let k = 0; k < bFac; k++) {
      pruneInner(n.children[k]);
    }
  }
  pruneInner(node);
  return actions;
}

export function alphaBeta(tree: Tree): ActionListQueue {
  if (!tree.rootNode) return new ActionListQueue();
  const bFac = tree.branchingFactor;

  function abActions(node: TreeNode, a: number, b: number, isMaxNode: boolean): {
    returnVal: number;
    enterActions: Array<Action<any>>;
    childActionsList: Array<Array<Action<any>>>;
    exitActions: Array<Action<any>>;
  } {
    const enterActions: Array<Action<any>> = [
      new Action(node.edgeToParent as any, 'entered' as any, false, true),
      new Action(node as any, 'entered' as any, false, true)
    ];
    const childActionsList: Array<Array<Action<any>>> = [];

    if (node.nodeType === TreeNodeType.leafNode) {
      return {
        returnVal: node.value as number,
        enterActions,
        childActionsList,
        exitActions: [new Action(node.edgeToParent as any, 'entered' as any, true, false)]
      };
    }

    enterActions.push(
      new Action(node as any, 'alpha' as any, node.alpha, a),
      new Action(node as any, 'beta' as any, node.beta, b)
    );
    (node as any).__alpha = a;
    (node as any).__beta = b;

    let k = 0;
    let pruneRest = false;
    let lastChildExitActions: Array<Action<any>> = [];
    let curVal = isMaxNode ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

    if (isMaxNode) {
      for (; k < bFac; k++) {
        const child = node.children[k]!;
        if (pruneRest) {
          lastChildExitActions.push(...generatePruneActionList(child, bFac));
          lastChildExitActions.push(new Action(node as any, 'pruned' as any, false, true));
          (node as any).__pruned = true;
        } else {
          const res = abActions(child, a, b, !isMaxNode);
          const setValActions: Array<Action<any>> = [];
          if (res.returnVal > curVal) {
            curVal = res.returnVal;
            setValActions.push(new Action(node as any, 'value' as any, (node as any).__value, curVal));
            (node as any).__value = curVal;
          }
          if (res.returnVal > a) {
            a = res.returnVal;
            setValActions.push(new Action(node as any, 'alpha' as any, (node as any).__alpha, a));
            (node as any).__alpha = a;
          }
          if (res.childActionsList.length) {
            res.exitActions.push(...setValActions);
          } else {
            res.enterActions.push(...setValActions);
          }
          res.enterActions.push(...lastChildExitActions);
          childActionsList.push(res.enterActions);
          childActionsList.push(...res.childActionsList);
          lastChildExitActions = res.exitActions;
          if (b <= a) {
            pruneRest = true;
          }
        }
      }
    } else {
      for (; k < bFac; k++) {
        const child = node.children[k]!;
        if (pruneRest) {
          lastChildExitActions.push(...generatePruneActionList(child, bFac));
          lastChildExitActions.push(new Action(node as any, 'pruned' as any, false, true));
          (node as any).__pruned = true;
        } else {
          const res = abActions(child, a, b, !isMaxNode);
          const setValActions: Array<Action<any>> = [];
          if (res.returnVal < curVal) {
            curVal = res.returnVal;
            setValActions.push(new Action(node as any, 'value' as any, (node as any).__value, curVal));
            (node as any).__value = curVal;
          }
          if (res.returnVal < b) {
            b = res.returnVal;
            setValActions.push(new Action(node as any, 'beta' as any, (node as any).__beta, b));
            (node as any).__beta = b;
          }
          if (res.childActionsList.length) {
            res.exitActions.push(...setValActions);
          } else {
            res.enterActions.push(...setValActions);
          }
          res.enterActions.push(...lastChildExitActions);
          childActionsList.push(res.enterActions);
          childActionsList.push(...res.childActionsList);
          lastChildExitActions = res.exitActions;
          if (b <= a) {
            pruneRest = true;
          }
        }
      }
    }
    childActionsList.push(lastChildExitActions);
    const exitActions: Array<Action<any>> = [
      new Action(node.edgeToParent as any, 'entered' as any, true, false),
      new Action(node as any, 'entered' as any, true, false)
    ];
    return {
      returnVal: curVal,
      enterActions,
      childActionsList,
      exitActions
    };
  }

  const actionLQ = new ActionListQueue();
  const res = abActions(
    tree.rootNode,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    (tree.treeType === TreeNodeType.maxNode)
  );
  actionLQ.pushActionList(res.enterActions);
  actionLQ.extendActionList(res.childActionsList);
  actionLQ.pushActionList(res.exitActions);
  return actionLQ;
}

export function resetTree(root: TreeNode | null | undefined): void {
  function resetSubTree(node: TreeNode | undefined) {
    if (!node) return;
    if (node.edgeToParent) {
      node.edgeToParent.entered = false;
      node.edgeToParent.pruned = false;
    }
    node.entered = false;
    if (node.nodeType === TreeNodeType.leafNode) return;
    node.value = null;
    node.alpha = null;
    node.beta = null;
    for (let k = 0; k < node.childNum; k++) {
      resetSubTree(node.children[k]);
    }
  }
  resetSubTree(root || undefined);
}

export function setSolution(root: TreeNode | null | undefined): void {
  function setSolutionForSubTree(node: TreeNode | undefined) {
    if (!node) return;
    if (node.edgeToParent) {
      node.edgeToParent.pruned = (node.edgeToParent as any).__pruned || false;
    }
    if (node.nodeType === TreeNodeType.leafNode) return;
    node.value = (node as any).__value ?? null;
    node.alpha = (node as any).__alpha ?? null;
    node.beta = (node as any).__beta ?? null;
    (node as any).pruned = (node as any).__pruned || false;
    for (let k = 0; k < node.childNum; k++) {
      setSolutionForSubTree(node.children[k]);
    }
  }
  setSolutionForSubTree(root || undefined);
}

export function checkAnswer(root: TreeNode | null | undefined): boolean {
  function checkSubTree(node: TreeNode | undefined): boolean {
    if (!node) return true;
    if (node.nodeType === TreeNodeType.leafNode) return true;
    if (node.value !== (node as any).__value) return false;
    if (node.edgeToParent &&
        (node.edgeToParent as any).__pruned &&
        (node.edgeToParent as any).__pruned !== node.edgeToParent.pruned) {
      return false;
    }
    let res = true;
    for (let k = 0; k < node.childNum; k++) {
      res = res && checkSubTree(node.children[k]);
    }
    return res;
  }
  return checkSubTree(root || undefined);
}


