export const ROUND_TIME = 115;
export const WIN_REWARD = 250;
export const TIME_BONUS = 0;

const START_MONEY = 800;
const MAX_MONEY = 16000;
const KILL_REWARD = 100;
const LOSS_REWARD = 400;
const LOSS_STREAK_BONUS = 100;
const MATCH_WIN_TARGET = 8;

function clampMoney(value) {
  return Math.max(0, Math.min(MAX_MONEY, value));
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

export function createRounds() {
  const state = {
    round: 1,
    money: START_MONEY,
    kills: 0,
    wins: 0,
    losses: 0,
    lossStreak: 0,
    lastReward: 0,
    lastOutcome: null,
    matchOver: false,
    phase: 'buy',
    timer: ROUND_TIME,
  };

  function award(amount) {
    state.money = clampMoney(state.money + amount);
    state.lastReward = amount;
  }

  function isMatchOver() {
    return state.wins >= MATCH_WIN_TARGET;
  }

  function finishRound(result) {
    if (state.phase !== 'live') return;

    state.phase = 'complete';
    state.timer = Math.max(0, state.timer);

    if (result === 'win') {
      state.wins += 1;
      state.lossStreak = 0;
      state.lastOutcome = 'win';
      award(WIN_REWARD + Math.round(TIME_BONUS * (state.timer / ROUND_TIME)));
      state.matchOver = isMatchOver();
      return;
    }

    state.losses += 1;
    state.lossStreak += 1;
    state.lastOutcome = 'loss';
    award(LOSS_REWARD + (state.lossStreak - 1) * LOSS_STREAK_BONUS);
  }

  return {
    state,

    canBuy() {
      return state.phase === 'buy' && !state.matchOver;
    },

    startRound() {
      if (state.phase === 'buy' && !state.matchOver) {
        state.phase = 'live';
        state.timer = ROUND_TIME;
      }
    },

    awardKill() {
      if (state.phase !== 'live') return;
      state.kills += 1;
      state.money = clampMoney(state.money + KILL_REWARD);
    },

    completeRound(result) {
      finishRound(result === 'win' ? 'win' : 'loss');
    },

    nextRound() {
      if (state.phase !== 'complete' || state.matchOver) return;
      state.round += 1;
      state.phase = 'buy';
    },

    restartCampaign() {
      state.round = 1;
      state.money = START_MONEY;
      state.kills = 0;
      state.wins = 0;
      state.losses = 0;
      state.lossStreak = 0;
      state.lastReward = 0;
      state.lastOutcome = null;
      state.matchOver = false;
      state.phase = 'buy';
      state.timer = ROUND_TIME;
    },

    spend(amount) {
      if (!isPositiveNumber(amount) || state.money < amount) return false;
      state.money = clampMoney(state.money - amount);
      return true;
    },

    addKillMoney() {
      if (state.phase !== 'live') return;
      state.money = clampMoney(state.money + KILL_REWARD);
    },

    step(dt) {
      if (state.phase !== 'live') return;
      state.timer = Math.max(0, state.timer - dt);
      if (state.timer === 0) finishRound('win');
    },
  };
}
