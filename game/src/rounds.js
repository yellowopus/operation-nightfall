// Authoritative round and economy state. UI and gameplay systems read this module;
// only explicit round outcomes or purchases mutate it.
export const ROUND_TIME = 115;
const START_MONEY = 800;
const MAX_MONEY = 16000;
const KILL_REWARD = 300;
export const WIN_REWARD = 3250;
const LOSS_REWARD = 1900;
const LOSS_STREAK_BONUS = 500;
export const TIME_BONUS = 300;

export function createRounds() {
  const state = {
    round: 1,
    money: START_MONEY,
    kills: 0,
    wins: 0,
    losses: 0,
    lossStreak: 0,
    lastReward: 0,
    phase: 'buy',
    timer: ROUND_TIME,
  };

  function addMoney(amount) {
    state.money = Math.max(0, Math.min(MAX_MONEY, state.money + amount));
  }

  return {
    state,
    canBuy() { return state.phase === 'buy'; },
    startRound() {
      state.phase = 'live';
      state.timer = ROUND_TIME;
    },
    awardKill() {
      state.kills += 1;
      addMoney(KILL_REWARD);
    },
    completeRound(result) {
      if (state.phase !== 'live') return;
      state.phase = result;
      if (result === 'win') {
        state.wins += 1;
        state.lossStreak = 0;
        const timeBonus = Math.round(TIME_BONUS * (state.timer / ROUND_TIME));
        state.lastReward = WIN_REWARD + timeBonus;
        addMoney(state.lastReward);
      } else {
        state.losses += 1;
        state.lossStreak = Math.min(4, state.lossStreak + 1);
      state.lastReward = LOSS_REWARD + (state.lossStreak - 1) * LOSS_STREAK_BONUS;
      addMoney(state.lastReward);
      }
    },
    nextRound() {
      state.round += 1;
      state.phase = 'buy';
    },
    restartCampaign() {
      state.round = 1;
      state.kills = 0;
      state.wins = 0;
      state.losses = 0;
      state.lossStreak = 0;
      state.money = START_MONEY;
      state.phase = 'buy';
    },
    spend(amount) {
      if (!Number.isFinite(amount) || amount < 0 || state.money < amount) return false;
      addMoney(-amount);
      return true;
    },
    addKillMoney() { addMoney(KILL_REWARD); },
    step(dt) {
      if (state.phase !== 'live') return;
      state.timer = Math.max(0, state.timer - dt);
      if (state.timer === 0) completeRound('loss');
    },
  };
}
