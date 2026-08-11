/**
 * 트랙 간 유일한 인터페이스 계약.
 *
 * A 가 소유하며, B 는 이 타입으로 mock 을 만들고 C 는 실제 응답을 맞춘다.
 * 여기가 바뀌면 반드시 팀에 공유한다.
 *
 * 원칙: 모든 엔드포인트의 행위자는 서버 세션에서 도출한다.
 * 요청 타입에 userId 를 두지 않는 이유가 이것이다 (16장 원칙 1).
 */

import type {
  Combo,
  EggType,
  ResourceType,
  Stage,
  Trait,
} from '@/lib/game/types';

// ---------------------------------------------------------------- 공통

export interface ApiError {
  error: string;
}

// ---------------------------------------------------------------- 세션 · 현황

export interface MeResponse {
  nickname: string;
  /** 알 인벤토리 (종류별 개수) */
  eggs: Record<EggType, number>;
  /** 자원 인벤토리 */
  resources: Record<ResourceType, number>;
  /** 육성 중인 개체. stage < 3 인 개체는 최대 1마리 */
  activePet: PetView | null;
  /** 도감 완성도 */
  dexCompleted: number;
  dexTotal: number;
  /**
   * 아직 수령하지 않은 보상 알 개수. 성체 완성 시 늘어난다.
   * 0 보다 크면 "보상 알 받기" 진입점을 노출한다.
   */
  unclaimedRewards: number;
  /**
   * 이미 판정을 굴려둔 건이 있는가. 선택만 남은 상태다.
   * 판정 결과(금색 여부)는 절대 포함하지 않는다 (6장).
   */
  hasPendingReward: boolean;
}

// ---------------------------------------------------------------- 개체

export interface PetView {
  id: string;
  eggType: EggType;
  stage: Stage;
  isAlbino: boolean;
  /** 현재 단계의 성향 카운터 */
  traits: Record<Trait, number>;
  /** 현재 단계에서 먹인 횟수 */
  feedCount: number;
  /** 이번 단계를 마치는 데 필요한 횟수. 알·성체면 null */
  feedRequired: number | null;
  stage2Trait: Trait | null;
  /** 성체일 때만 존재 */
  combo: Combo | null;
  speciesName: string | null;
  isTraded: boolean;
}

/** 보유한 알 중 하나를 부화시킨다. 알비노 판정이 여기서 일어난다 */
export interface HatchRequest {
  eggType: EggType;
}
export interface HatchResponse {
  pet: PetView;
}

/** 자원 1개를 소모해 1회 먹인다 */
export interface FeedRequest {
  petId: string;
  resourceType: ResourceType;
}
export interface FeedResponse {
  pet: PetView;
  resources: Record<ResourceType, number>;
  /** 이번 급여로 진화 조건을 채웠는가 */
  canEvolve: boolean;
}

/**
 * 보유한 성체 목록.
 *
 * `/api/me` 의 activePet 은 육성 중인 개체(stage < 3)만 담으므로,
 * 교환 화면이 고를 대상은 여기서 받아야 한다.
 */
export interface AdultPetsResponse {
  pets: TradePetView[];
  /** 아직 교환하지 않은 개체 수. 교환 탭 노출 판단용 */
  tradableCount: number;
}

export interface EvolveRequest {
  petId: string;
}
export interface EvolveResponse {
  pet: PetView;
  /** 3차 진화로 도감이 갱신되었는가 */
  dexUpdated: boolean;
  /** 성체 완성으로 보상 알을 받을 수 있게 되었는가 */
  rewardAvailable: boolean;
}

// ---------------------------------------------------------------- 알

/** 계정 생성 직후 1회. 이미 지급했으면 기존 결과를 그대로 돌려준다 */
export interface StarterEggsResponse {
  eggs: EggType[];
}

/**
 * 보상 알 열기 — 1단계.
 * 응답에 판정 결과를 절대 싣지 않는다. 실으면 개발자 도구로 선택 전에 확인 가능하다 (6장).
 */
export interface RewardOpenResponse {
  choices: EggType[]; // 항상 ['air', 'land', 'sea']
}

/** 보상 알 확정 — 2단계. 여기서 처음 결과가 공개된다 */
export interface RewardClaimRequest {
  chosen: EggType;
}
export interface RewardClaimResponse {
  /** 최종 지급된 알. 금색 판정이었다면 선택과 무관하게 'gold' */
  granted: EggType;
  /** 선택한 알이 금색으로 변하는 연출을 재생할지 */
  transformed: boolean;
  eggs: Record<EggType, number>;
}

// ---------------------------------------------------------------- 채집

export interface FarmStateResponse {
  /** null 이면 비어 있는 밭 */
  plantedAt: string | null;
  /** 수확까지 남은 초. 심지 않았으면 null */
  remainingSeconds: number | null;
  ready: boolean;
}

export interface HarvestResponse {
  gained: number;
  resources: Record<ResourceType, number>;
}

/** 광산 시작 — 서버가 세션을 연다 */
export interface MineStartResponse {
  sessionId: string;
  clickTarget: number;
}

/** 광산 완료 — 서버가 최소 소요 시간 하한을 검증한다 */
export interface MineFinishRequest {
  sessionId: string;
  clicks: number;
}
export interface MineFinishResponse {
  success: boolean;
  gained: number;
  resources: Record<ResourceType, number>;
}

/** 어업 캐스팅 — bite_delay 만 내려준다. 성공 여부는 여기서 정해지지 않는다 */
export interface FishCastResponse {
  sessionId: string;
  biteDelayMs: number;
}

/**
 * 어업 판정.
 *
 * 반응시간은 **클라이언트가 로컬에서 잰다**. 서버가 요청 도착 시각으로 재면
 * 왕복 지연이 반응시간에 그대로 더해져, 화면상 제때 눌러도 실패한다.
 * 서버는 이 값이 물리적으로 가능한 시각에 도착했는지만 검증한다.
 */
export interface FishStrikeRequest {
  sessionId: string;
  /** 입질 표시부터 입력까지 걸린 시간(ms). 클라이언트 측정값 */
  reactionMs: number;
}
export interface FishStrikeResponse {
  success: boolean;
  /** 실패 사유. too_early = 봇 의심, too_late = 윈도우 초과 */
  reason?: 'too_early' | 'too_late';
  gained: number;
  resources: Record<ResourceType, number>;
}

// ---------------------------------------------------------------- 도감

export interface DexCell {
  eggType: EggType;
  combo: Combo;
  name: string;
  hasNormal: boolean;
  hasAlbino: boolean;
}

export interface DexResponse {
  /** 도감 순서대로 24칸. 알 종류별 6칸씩 4묶음 */
  cells: DexCell[];
  /** hasNormal OR hasAlbino 인 칸 수 */
  completed: number;
  total: number;
}

// ---------------------------------------------------------------- 교환

export interface TradePetView {
  id: string;
  speciesName: string;
  eggType: EggType;
  combo: Combo;
  isAlbino: boolean;
  /** 이미 교환한 개체인가. 개체당 1회 한정이므로 다시 걸 수 없다 (9장) */
  isTraded: boolean;
}

/** 내 성체를 걸고 코드를 발급한다 */
export interface TradeCreateRequest {
  petId: string;
}
export interface TradeCreateResponse {
  code: string;
  expiresAt: string;
  myPet: TradePetView;
}

/** 코드를 입력하고 내 성체를 지정한다 */
export interface TradeJoinRequest {
  code: string;
  petId: string;
}
export interface TradeJoinResponse {
  tradeId: string;
  theirPet: TradePetView;
  myPet: TradePetView;
}

/** 제안자가 교환을 취소한다. 잠긴 개체가 함께 풀린다 */
export interface TradeCancelRequest {
  tradeId: string;
}
export interface TradeCancelResponse {
  status: 'cancelled';
}

/** 제안자가 최종 수락 / 거절한다 */
export interface TradeResolveRequest {
  tradeId: string;
  accept: boolean;
}
export interface TradeResolveResponse {
  status: 'accepted' | 'rejected';
  /** 수락 시 내가 받은 개체 */
  received: TradePetView | null;
}

// ---------------------------------------------------------------- 방명록

export interface GuestbookEntryView {
  id: string;
  authorNickname: string;
  message: string;
  createdAt: string;
  /** 세션 사용자가 작성한 글인가 — 삭제 버튼 노출 판단용 */
  mine: boolean;
}

export interface GuestbookListResponse {
  entries: GuestbookEntryView[];
  hasMore: boolean;
}

export interface GuestbookCreateRequest {
  message: string;
}
