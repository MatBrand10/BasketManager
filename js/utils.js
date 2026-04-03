// Shared utility helpers (loaded before app.js and audio.js).

window.AppUtils = (() => {
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const randomChoice = (arr) => arr[rand(0, arr.length - 1)];

  const createId = () => Math.random().toString(36).slice(2, 10);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = rand(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const weightedChoice = (items) => {
    const total = items.reduce((acc, item) => acc + item[1], 0);
    let roll = Math.random() * total;
    for (let i = 0; i < items.length; i += 1) {
      roll -= items[i][1];
      if (roll <= 0) return items[i][0];
    }
    return items[items.length - 1][0];
  };

  return {
    rand,
    randomChoice,
    createId,
    clamp,
    shuffle,
    weightedChoice
  };
})();
