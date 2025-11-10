export enum TreeNodeType {
  maxNode = 'maxNode',
  minNode = 'minNode',
  randNode = 'randNode',
  leafNode = 'leafNode'
}

export function oppositeNodeType(t: TreeNodeType): TreeNodeType {
  if (t === TreeNodeType.maxNode) return TreeNodeType.minNode;
  if (t === TreeNodeType.minNode) return TreeNodeType.maxNode;
  return t;
}

export type NodeId = number;

export interface TreeEdge {
  source: TreeNode;
  target: TreeNode;
  pruned: boolean;
  entered?: boolean;
  __pruned?: boolean;
}

export interface TreeNode {
  id: NodeId;
  nodeType: TreeNodeType;
  parentNode?: TreeNode;
  edgeToParent?: TreeEdge;
  depth: number;
  childNum: number;
  children: Array<TreeNode | undefined>;
  value: number | null;
  alpha?: number | null;
  beta?: number | null;
  entered?: boolean;
  pruned?: boolean;
  __value?: number;
  __alpha?: number;
  __beta?: number;
  __pruned?: boolean;
  x?: number;
  y?: number;
}

export interface Tree {
  rootNode: TreeNode | null;
  treeType: TreeNodeType;
  depth: number;
  branchingFactor: number;
  mutable: boolean;
}

export interface Action<T extends object, K extends keyof T = any> {
  object: T | undefined | null;
  key: K;
  oldVal: any;
  newVal: any;
  apply(): void;
  reverse(): void;
}

export interface ActionListQueue {
  inAction: boolean;
  lastAction: number;
  actionListQueue: Array<Array<Action<any>>>;
  length: number;
  pushActionList(list: Array<Action<any>>): boolean;
  extendActionList(lists: Array<Array<Action<any>>>): boolean;
  stepForward(): boolean;
  stepBackward(): boolean;
  goToEnd(): void;
  goToBeginning(): void;
}


