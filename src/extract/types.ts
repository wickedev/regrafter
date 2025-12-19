/**
 * Extract Feature Type Definitions
 *
 * Task 1.2: 핵심 데이터 모델 타입 정의
 * Defines all core data models for the extract feature
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';
import type { Code } from '../types/public.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Options
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract 함수 옵션
 */
export interface ExtractOptions {
  /** 추출할 컴포넌트 이름 (미제공 시 자동 생성) */
  componentName?: string;

  /** 대상 파일 경로 (미제공 시 같은 파일 내 추출) */
  targetFile?: string;

  /** TypeScript 타입 생성 활성화 (기본: true) */
  generateTypes?: boolean;

  /** 주석 보존 여부 (기본: true) */
  preserveComments?: boolean;

  /** 코드 포맷팅 옵션 */
  formatting?: FormattingOptions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Range Selector
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 범위 선택자 (여러 노드 선택)
 */
export interface RangeSelector {
  /** 파일 경로 */
  file: string;

  /** 시작 위치 */
  start: {
    line: number;
    column: number;
  };

  /** 종료 위치 */
  end: {
    line: number;
    column: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Result
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract 결과
 */
export interface ExtractResult {
  /** 변환된 파일들 */
  codes: Code[];

  /** 생성된 컴포넌트 정보 */
  component: ComponentInfo;

  /** 추출 통계 */
  stats: ExtractStats;
}

/**
 * Extract 분석 결과 (변환 없이 분석만 수행)
 *
 * Task 21.3: analyzeExtract() 함수 테스트
 */
export interface ExtractAnalysis {
  /** 선택된 JSX 노드 수 */
  selectedNodesCount: number;

  /** 식별된 의존성 정보 */
  dependencies: {
    /** 변수 의존성 목록 */
    variables: string[];

    /** 함수 의존성 목록 */
    functions: string[];

    /** 상태 의존성 목록 */
    states: Array<{ stateName: string; setterName: string }>;

    /** Hook 의존성 목록 */
    hooks: string[];

    /** Import 의존성 목록 */
    imports: Array<{ name: string; source: string }>;
  };

  /** Props 타입 정보 */
  propTypes: Array<{
    name: string;
    type: string;
    optional: boolean;
  }>;

  /** 생성될 컴포넌트 이름 */
  componentName: string;

  /** 대상 파일 경로 */
  targetFile: string;

  /** 같은 파일 내 추출 여부 */
  isSameFile: boolean;
}

/**
 * 생성된 컴포넌트 정보
 */
export interface ComponentInfo {
  /** 컴포넌트 이름 */
  name: string;

  /** 컴포넌트가 위치한 파일 */
  file: string;

  /** Props 인터페이스 이름 */
  propsInterface?: string;

  /** Props 목록 */
  props: PropInfo[];
}

/**
 * Prop 정보
 */
export interface PropInfo {
  /** Prop 이름 */
  name: string;

  /** Prop 타입 */
  type: string;

  /** 선택적 여부 */
  optional: boolean;
}

/**
 * Extract 통계
 */
export interface ExtractStats {
  /** 추출된 JSX 노드 수 */
  nodesExtracted: number;

  /** 식별된 의존성 수 */
  dependenciesFound: number;

  /** 생성된 Props 수 */
  propsGenerated: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Plan
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract 계획
 */
export interface ExtractPlan {
  /** 선택된 JSX 노드들 */
  selectedNodes: NodePath[];

  /** 소스 파일 */
  sourceFile: string;

  /** 대상 파일 */
  targetFile: string;

  /** 생성할 컴포넌트 이름 */
  componentName: string;

  /** Props 인터페이스 이름 */
  propsInterfaceName: string;

  /** 의존성 정보 */
  dependencies: ExtractDependencies;

  /** Props 타입 정보 */
  propTypes: PropType[];

  /** 이동할 Hook 선언들 */
  hooksToMove: HookDeclaration[];

  /** 같은 파일 내 추출 여부 */
  isSameFile: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Dependencies
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract 의존성 정보
 */
export interface ExtractDependencies {
  /** Props로 전달할 변수 */
  variables: VariableDependency[];

  /** Props로 전달할 함수 */
  functions: FunctionDependency[];

  /** Props로 전달할 상태 */
  states: StateDependency[];

  /** 새 컴포넌트로 이동할 Hook */
  hooks: HookDependency[];

  /** 필요한 Import */
  imports: ImportDependency[];
}

/**
 * 변수 의존성
 */
export interface VariableDependency {
  /** 변수 이름 */
  name: string;

  /** 변수 타입 (TypeScript) */
  type?: t.TSType;

  /** 변수 선언 노드 */
  declaration: NodePath;
}

/**
 * 함수 의존성
 */
export interface FunctionDependency {
  /** 함수 이름 */
  name: string;

  /** 함수 타입 (TypeScript) */
  type?: t.TSType;

  /** 함수 선언 노드 */
  declaration: NodePath;
}

/**
 * 상태 의존성
 */
export interface StateDependency {
  /** 상태 변수 이름 */
  stateName: string;

  /** Setter 함수 이름 */
  setterName: string;

  /** 상태 타입 (TypeScript) */
  type?: t.TSType;

  /** useState 호출 노드 */
  declaration: NodePath;
}

/**
 * Hook 의존성
 */
export interface HookDependency {
  /** Hook 이름 */
  name: string;

  /** Hook 호출 노드 */
  callNode: NodePath;

  /** 외부 의존성 목록 */
  externalDeps: string[];
}

/**
 * Import 의존성
 */
export interface ImportDependency {
  /** Import 이름 */
  name: string;

  /** Import 소스 경로 */
  source: string;

  /** Default import 여부 */
  isDefault: boolean;
}

/**
 * Prop 타입 정보
 */
export interface PropType {
  /** Prop 이름 */
  name: string;

  /** TypeScript 타입 AST */
  typeAnnotation: t.TSType;

  /** 선택적 여부 */
  optional: boolean;
}

/**
 * Hook 선언 정보
 */
export interface HookDeclaration {
  /** Hook 이름 */
  hookName: string;

  /** Hook 호출 표현식 */
  callExpression: t.CallExpression;

  /** 변수 선언자 (const [x, setX] = ...) */
  declarator?: t.VariableDeclarator;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Formatting Options
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 포맷팅 옵션
 */
export interface FormattingOptions {
  /** 들여쓰기 크기 */
  indentSize?: number;

  /** Tab 사용 여부 */
  useTabs?: boolean;

  /** 따옴표 스타일 */
  quotes?: 'single' | 'double';

  /** 세미콜론 사용 여부 */
  semi?: boolean;
}
