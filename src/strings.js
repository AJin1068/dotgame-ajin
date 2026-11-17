// UI 문구 단일 장소 (GAME_DESIGN.md 7장). 다른 src 파일에는 UI 문구를 직접 적지 않는다.
export const levelLabel = (n, total) => `레벨 ${n}/${total}`;
export const stormLabel = (sec) => `소나기 ${sec}초`;
export const levelClear = (n) => `레벨 ${n} 클리어! 곧 다음 레벨`;
export const allClear = "모든 레벨 클리어! 다시 하려면 F5";
export const failWasp = "말벌에 닿았어요. 다시 하려면 F5";
export const failStorm = "소나기가 왔어요. 다시 하려면 F5";
