/**
 * Factory Functions for Internal Data Structures
 *
 * This module provides factory functions for creating internal data structures
 * with proper initialization and default values.
 */

import type { NodePath, Binding } from '@babel/traverse';
import type * as t from '@babel/types';

import {
  ScopeType,
  AtomicUnitType,
} from './internal.js';
import type {
  ASTEntry,
  ASTStore,
  AtomicUnit,
  ComponentScope,
  ConsumerInfo,
  DependencyAnalysis,
  DependencyGraph,
  DependencyNode,
  DependencyOrigin,
  ExportDeclaration,
  HoistOperation,
  HoistStrategy,
  ImportOperation,
  ImportSpecifier,
  InternalDependency,
  Modification,
  MoveOperation,
  NodeMetadata,
  OptimizeResult,
  ParseError,
  ParseResult,
  PropRemoval,
  PropThreadOperation,
  ResolveResult,
  ScopeInfo,
  SelectorError,
  SharedModuleOperation,
  SinkCandidate,
  SourceLocation,
  TransformPlan,
  TransformResult,
  TransformStats,
  ValidationResult,
} from './internal.js';
import type {
  AnalysisStats,
  Code,
  Dependency,
  DependencyType,
  Move,
  MoveAnalysis,
  SuggestedFix,
} from './public.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ID Generation
// ═══════════════════════════════════════════════════════════════════════════════

let idCounter = 0;

/**
 * Generates a unique ID for internal structures.
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

/**
 * Resets the ID counter (useful for testing).
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hash Generation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a simple hash for content comparison.
 * Uses FNV-1a algorithm for fast hashing.
 */
export function hashContent(content: string): string {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public Type Factories
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates a Dependency object.
 */
export function createDependency(
  params: Omit<Dependency, 'isTransitive'> & { isTransitive?: boolean }
): Dependency {
  return {
    symbol: params.symbol,
    type: params.type,
    origin: params.origin,
    scope: params.scope,
    isTransitive: params.isTransitive ?? false,
    resolution: params.resolution,
  };
}

/**
 * Creates a SuggestedFix object.
 */
export function createSuggestedFix(
  params: Omit<SuggestedFix, 'automatic'> & { automatic?: boolean }
): SuggestedFix {
  return {
    description: params.description,
    action: params.action,
    automatic: params.automatic ?? false,
  };
}

/**
 * Creates an AnalysisStats object.
 */
export function createAnalysisStats(
  params?: Partial<AnalysisStats>
): AnalysisStats {
  return {
    totalDependencies: params?.totalDependencies ?? 0,
    hookDependencies: params?.hookDependencies ?? 0,
    variableDependencies: params?.variableDependencies ?? 0,
    importDependencies: params?.importDependencies ?? 0,
    propDependencies: params?.propDependencies ?? 0,
    transitiveDependencies: params?.transitiveDependencies ?? 0,
  };
}

/**
 * Creates a MoveAnalysis object.
 */
export function createMoveAnalysis(
  params: Partial<MoveAnalysis> = {}
): MoveAnalysis {
  return {
    canMove: params.canMove ?? true,
    reason: params.reason,
    dependencies: params.dependencies ?? [],
    hoistedDeps: params.hoistedDeps ?? [],
    sunkDeps: params.sunkDeps,
    suggestedFixes: params.suggestedFixes,
    stats: params.stats,
  };
}

/**
 * Creates a Code object.
 */
export function createCode(
  params: Omit<Code, 'changed'> & { changed?: boolean }
): Code {
  return {
    file: params.file,
    content: params.content,
    changed: params.changed ?? false,
    isNew: params.isNew,
    original: params.original,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal Type Factories
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates a ScopeInfo object.
 */
export function createScopeInfo(params: {
  type: ScopeType;
  path: NodePath;
  parent: ScopeInfo | null;
  bindings?: Map<string, Binding>;
  depth?: number;
  id?: string;
}): ScopeInfo {
  return {
    id: params.id ?? generateId('scope'),
    type: params.type,
    path: params.path,
    parent: params.parent,
    bindings: params.bindings ?? new Map<string, Binding>(),
    depth: params.depth ?? (params.parent ? params.parent.depth + 1 : 0),
  };
}

/**
 * Creates a ComponentScope object.
 */
export function createComponentScope(params: {
  componentName: string;
  path: NodePath;
  parent: ScopeInfo | null;
  parentComponent: ComponentScope | null;
  bindings?: Map<string, Binding>;
  depth?: number;
  isConditionallyRendered?: boolean;
  isInsideLoop?: boolean;
  hooks?: HookUsage[];
  id?: string;
}): ComponentScope {
  return {
    id: params.id ?? generateId('component'),
    type: ScopeType.Component,
    path: params.path,
    parent: params.parent,
    bindings: params.bindings ?? new Map<string, Binding>(),
    depth: params.depth ?? (params.parent ? params.parent.depth + 1 : 0),
    componentName: params.componentName,
    isConditionallyRendered: params.isConditionallyRendered ?? false,
    isInsideLoop: params.isInsideLoop ?? false,
    parentComponent: params.parentComponent,
    hooks: params.hooks ?? [],
  };
}

// Local type definition for HookUsage to avoid circular import issues
interface HookUsage {
  name: string;
  path: NodePath;
  dependencies: string[];
}

/**
 * Creates a NodeMetadata object.
 */
export function createNodeMetadata(params?: Partial<NodeMetadata>): NodeMetadata {
  return {
    isHook: params?.isHook ?? false,
    isPure: params?.isPure ?? true,
    hasSideEffects: params?.hasSideEffects ?? false,
    isExported: params?.isExported ?? false,
  };
}

/**
 * Creates a DependencyNode object.
 */
export function createDependencyNode(params: {
  type: 'symbol' | 'element' | 'scope';
  name: string;
  path: NodePath;
  scope: ScopeInfo;
  metadata?: Partial<NodeMetadata>;
  id?: string;
}): DependencyNode {
  return {
    id: params.id ?? generateId('node'),
    type: params.type,
    name: params.name,
    path: params.path,
    scope: params.scope,
    metadata: createNodeMetadata(params.metadata),
  };
}

/**
 * Creates an empty DependencyGraph.
 */
export function createDependencyGraph(): DependencyGraph {
  return {
    nodes: new Map(),
    edges: new Map(),
    reverseEdges: new Map(),
  };
}

/**
 * Adds a node to a DependencyGraph.
 */
export function addNodeToDependencyGraph(
  graph: DependencyGraph,
  node: DependencyNode
): void {
  graph.nodes.set(node.id, node);
  if (!graph.edges.has(node.id)) {
    graph.edges.set(node.id, new Set());
  }
  if (!graph.reverseEdges.has(node.id)) {
    graph.reverseEdges.set(node.id, new Set());
  }
}

/**
 * Adds an edge to a DependencyGraph.
 */
export function addEdgeToDependencyGraph(
  graph: DependencyGraph,
  fromId: string,
  toId: string
): void {
  const fromEdges = graph.edges.get(fromId);
  if (fromEdges) {
    fromEdges.add(toId);
  }
  const toReverseEdges = graph.reverseEdges.get(toId);
  if (toReverseEdges) {
    toReverseEdges.add(fromId);
  }
}

/**
 * Creates an empty ASTStore.
 */
export function createASTStore(): ASTStore {
  return {
    files: new Map(),
    scopeMap: new WeakMap(),
    bindingCache: new WeakMap(),
    dependencyGraphCache: new WeakMap(),
  };
}

/**
 * Creates an ASTEntry.
 */
export function createASTEntry(params: {
  path: string;
  ast: t.File;
  content: string;
  dependencies?: Set<string>;
  dependents?: Set<string>;
}): ASTEntry {
  return {
    path: params.path,
    ast: params.ast,
    dirty: false,
    hash: hashContent(params.content),
    dependencies: params.dependencies ?? new Set(),
    dependents: params.dependents ?? new Set(),
  };
}

/**
 * Creates a DependencyOrigin object.
 */
export function createDependencyOrigin(params: {
  node: t.Node;
  file: string;
  location?: t.SourceLocation | null;
}): DependencyOrigin {
  return {
    node: params.node,
    file: params.file,
    location: params.location,
  };
}

/**
 * Creates an InternalDependency object.
 */
export function createInternalDependency(params: {
  symbol: string;
  type: DependencyType;
  origin: DependencyOrigin;
  scope: ScopeInfo;
  isTransitive?: boolean;
  consumers?: string[];
  id?: string;
}): InternalDependency {
  return {
    id: params.id ?? generateId('dep'),
    symbol: params.symbol,
    type: params.type,
    origin: params.origin,
    scope: params.scope,
    isTransitive: params.isTransitive ?? false,
    consumers: params.consumers ?? [],
  };
}

/**
 * Creates a ValidationResult object.
 */
export function createValidationResult(params?: {
  valid?: boolean;
  errors?: string[];
  warnings?: string[];
}): ValidationResult {
  return {
    valid: params?.valid ?? true,
    errors: params?.errors ?? [],
    warnings: params?.warnings ?? [],
  };
}

/**
 * Creates an empty TransformPlan.
 */
export function createTransformPlan(
  params?: Partial<TransformPlan>
): TransformPlan {
  return {
    id: params?.id ?? generateId('plan'),
    moves: params?.moves ?? [],
    hoists: params?.hoists ?? [],
    propThreads: params?.propThreads ?? [],
    imports: params?.imports ?? [],
    sharedModules: params?.sharedModules ?? [],
    validation: params?.validation ?? createValidationResult(),
  };
}

/**
 * Creates a MoveOperation object.
 */
export function createMoveOperation(params: {
  sourceFile: string;
  sourcePath: string;
  targetFile: string;
  targetPath: string;
  mode: Move;
  atomicUnit?: AtomicUnitType;
  id?: string;
}): MoveOperation {
  return {
    id: params.id ?? generateId('move'),
    sourceFile: params.sourceFile,
    sourcePath: params.sourcePath,
    targetFile: params.targetFile,
    targetPath: params.targetPath,
    mode: params.mode,
    atomicUnit: params.atomicUnit ?? AtomicUnitType.Element,
  };
}

/**
 * Creates a HoistOperation object.
 */
export function createHoistOperation(params: {
  dependencyId: string;
  symbol: string;
  fromFile: string;
  fromScope: string;
  toFile: string;
  toScope: string;
  strategy: HoistStrategy;
  id?: string;
}): HoistOperation {
  return {
    id: params.id ?? generateId('hoist'),
    dependencyId: params.dependencyId,
    symbol: params.symbol,
    fromFile: params.fromFile,
    fromScope: params.fromScope,
    toFile: params.toFile,
    toScope: params.toScope,
    strategy: params.strategy,
  };
}

/**
 * Creates a PropThreadOperation object.
 */
export function createPropThreadOperation(params: {
  propName: string;
  valueExpression: string;
  fromComponent: string;
  toComponent: string;
  path: string[];
  id?: string;
}): PropThreadOperation {
  return {
    id: params.id ?? generateId('thread'),
    propName: params.propName,
    valueExpression: params.valueExpression,
    fromComponent: params.fromComponent,
    toComponent: params.toComponent,
    path: params.path,
  };
}

/**
 * Creates an ImportSpecifier object.
 */
export function createImportSpecifier(params: {
  type: 'default' | 'named' | 'namespace';
  imported: string;
  local?: string;
}): ImportSpecifier {
  return {
    type: params.type,
    imported: params.imported,
    local: params.local ?? params.imported,
  };
}

/**
 * Creates an ImportOperation object.
 */
export function createImportOperation(params: {
  file: string;
  importSource: string;
  specifiers: ImportSpecifier[];
  position?: 'start' | 'end' | 'grouped';
  id?: string;
}): ImportOperation {
  return {
    id: params.id ?? generateId('import'),
    file: params.file,
    importSource: params.importSource,
    specifiers: params.specifiers,
    position: params.position ?? 'grouped',
  };
}

/**
 * Creates an ExportDeclaration object.
 */
export function createExportDeclaration(params: {
  name: string;
  type: 'named' | 'default';
  node: t.Node;
}): ExportDeclaration {
  return {
    name: params.name,
    type: params.type,
    node: params.node,
  };
}

/**
 * Creates a SharedModuleOperation object.
 */
export function createSharedModuleOperation(params: {
  newFilePath: string;
  exports: ExportDeclaration[];
  importers: string[];
  id?: string;
}): SharedModuleOperation {
  return {
    id: params.id ?? generateId('shared'),
    newFilePath: params.newFilePath,
    exports: params.exports,
    importers: params.importers,
  };
}

/**
 * Creates a TransformStats object.
 */
export function createTransformStats(
  params?: Partial<TransformStats>
): TransformStats {
  return {
    elementsMoved: params?.elementsMoved ?? 0,
    dependenciesHoisted: params?.dependenciesHoisted ?? 0,
    propsAdded: params?.propsAdded ?? 0,
    importsAdded: params?.importsAdded ?? 0,
    filesModified: params?.filesModified ?? 0,
    filesCreated: params?.filesCreated ?? 0,
  };
}

/**
 * Creates a TransformResult object.
 */
export function createTransformResult(
  params?: Partial<TransformResult>
): TransformResult {
  return {
    asts: params?.asts ?? new Map<string, t.File>(),
    newFiles: params?.newFiles ?? new Map<string, t.File>(),
    modifications: params?.modifications ?? [],
    stats: params?.stats ?? createTransformStats(),
  };
}

/**
 * Creates a ParseError object.
 */
export function createParseError(params: {
  message: string;
  location: SourceLocation;
  code: string;
}): ParseError {
  return {
    message: params.message,
    location: params.location,
    code: params.code,
  };
}

/**
 * Creates a ParseResult object.
 */
export function createParseResult(params: {
  ast: t.File;
  errors?: ParseError[];
  sourceMap?: unknown;
}): ParseResult {
  return {
    ast: params.ast,
    errors: params.errors ?? [],
    sourceMap: params.sourceMap,
  };
}

/**
 * Creates a SelectorError object.
 */
export function createSelectorError(params: {
  message: string;
  code: string;
  location?: SourceLocation;
}): SelectorError {
  return {
    message: params.message,
    code: params.code,
    location: params.location,
  };
}

/**
 * Creates an AtomicUnit object.
 */
export function createAtomicUnit(params: {
  type: AtomicUnitType;
  path: NodePath;
  nodes: t.Node[];
}): AtomicUnit {
  return {
    type: params.type,
    path: params.path,
    nodes: params.nodes,
  };
}

/**
 * Creates a ResolveResult object with lazy atomic unit evaluation.
 *
 * If computeAtomicUnit is provided, atomic unit will be computed lazily on first access.
 * Otherwise, the provided atomicUnit value is used directly (but still wrapped in a getter).
 */
export function createResolveResult(params: {
  node: t.Node | null;
  path: NodePath | null;
  atomicUnit?: AtomicUnit | null;
  error?: SelectorError;
  computeAtomicUnit?: () => AtomicUnit | null;
}): ResolveResult {
  let cachedAtomicUnit: AtomicUnit | null | undefined = undefined;
  const hasComputeFunction = params.computeAtomicUnit !== undefined;

  return {
    node: params.node,
    path: params.path,
    get atomicUnit(): AtomicUnit | null {
      // Lazy evaluation with memoization
      if (cachedAtomicUnit === undefined) {
        if (hasComputeFunction && params.computeAtomicUnit) {
          // Lazy: compute on first access
          cachedAtomicUnit = params.computeAtomicUnit();
        } else {
          // Eager: use provided value
          cachedAtomicUnit = params.atomicUnit ?? null;
        }
      }
      return cachedAtomicUnit;
    },
    error: params.error,
  };
}

/**
 * Creates a DependencyAnalysis object.
 */
export function createDependencyAnalysis(
  params?: Partial<DependencyAnalysis>
): DependencyAnalysis {
  return {
    dependencies: params?.dependencies ?? [],
    needsHoisting: params?.needsHoisting ?? [],
    needsImport: params?.needsImport ?? [],
    needsPropThreading: params?.needsPropThreading ?? [],
    canResolve: params?.canResolve ?? true,
    unresolvedReason: params?.unresolvedReason,
  };
}

/**
 * Creates a ConsumerInfo object.
 */
export function createConsumerInfo(params: {
  path: NodePath | null;
  scope: ScopeInfo;
  usageType: 'direct' | 'prop' | 'closure';
}): ConsumerInfo {
  return {
    path: params.path,
    scope: params.scope,
    usageType: params.usageType,
  };
}

/**
 * Creates a SinkCandidate object.
 */
export function createSinkCandidate(params: {
  dependency: InternalDependency;
  currentScope: ScopeInfo;
  optimalScope: ScopeInfo;
  consumers: ConsumerInfo[];
  sinkable: boolean;
  reason?: string;
}): SinkCandidate {
  return {
    dependency: params.dependency,
    currentScope: params.currentScope,
    optimalScope: params.optimalScope,
    consumers: params.consumers,
    sinkable: params.sinkable,
    reason: params.reason,
  };
}

/**
 * Creates a PropRemoval object.
 */
export function createPropRemoval(params: {
  component: string;
  propName: string;
}): PropRemoval {
  return {
    component: params.component,
    propName: params.propName,
  };
}

/**
 * Creates an OptimizeResult object.
 */
export function createOptimizeResult(
  params?: Partial<OptimizeResult>
): OptimizeResult {
  return {
    asts: params?.asts ?? new Map<string, t.File>(),
    sunkDependencies: params?.sunkDependencies ?? [],
    removedProps: params?.removedProps ?? [],
    deadCodeRemoved: params?.deadCodeRemoved ?? [],
  };
}

/**
 * Creates a Modification object.
 */
export function createModification(params: {
  type: 'move' | 'hoist' | 'prop' | 'import' | 'delete';
  file: string;
  description: string;
  location?: t.SourceLocation | null;
}): Modification {
  return {
    type: params.type,
    file: params.file,
    description: params.description,
    location: params.location,
  };
}
