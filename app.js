window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
});

const SET_SIZE = 3;
const DECK_SIZE = SET_SIZE ** 4;
const TABLE_SIZE = SET_SIZE * 4;

const deckProgress = document.querySelector('#deckProgress');
const deckProgressLabel = document.querySelector('#deckProgressLabel');
const newGameBtn = document.querySelector('#newGameBtn');
const container = document.querySelector('.container');
const gameBoard = document.querySelector('.game-board');

const allCssRules = Object.fromEntries(Array.from(document.styleSheets).flatMap(ss => Array.from(ss.cssRules)).map(r => [r.selectorText, r.style]));
const colors = Object.fromEntries(['red', 'green', 'purple'].map(color => [color, allCssRules[`.${color} path`].stroke]));

function removeLegacy() {
  ['deck', 'table'].forEach(k => localStorage.removeItem(k));
}

function initWakeLock() {
  if ('wakeLock' in navigator) {
    let wakeLock = null;
    const requestWakeLock = async () => {
      wakeLock = await navigator.wakeLock.request('screen');
    };

    const handleVisibilityChange = () => {
      if (wakeLock !== null && wakeLock.released && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleVisibilityChange);

    requestWakeLock();
  }
}

function range(a, b) {
  if (b === undefined) {
    return Array.from(new Array(a).keys());
  }
  return Array.from(new Array(b).keys()).splice(a);
}

function buildDeck() {
  let deck = [];
  for (let number of [1, 2, 3]) {
    for (let fill of ['solid', 'striped', 'blank']) {
      for (let color of ['red', 'purple', 'green']) {
        for (let shape of ['diamond', 'squiggle', 'oval']) {
          let card = {
            number: number,
            fill: fill,
            color: color,
            shape: shape,
          }
          deck.splice(Math.floor(Math.random() * (deck.length + 1)), 0, card);
        }
      }
    }
  }
  return deck;
}

function validateSet(cards) {
  return Object.keys(cards[0]).every(k => [1, cards.length].includes(new Set(cards.map(c => c[k])).size));
}

function combinations(arr, size) {
  if (size <= 0 || size > arr.length) {
    return [];
  }

  if (size == 1) {
    return arr.map(n => [n]);
  }

  return arr.slice(0, arr.length - size + 1).flatMap((n, i) => combinations(arr.slice(i + 1), size - 1).map(rest => [n].concat(rest)));
}

function findSets(cards) {
  return combinations(cards, SET_SIZE).filter(validateSet);
}

function cardFromString(str) {
  let card = {
    number: parseInt(str.substr(0, 1)),
    fill: { s: 'solid', p: 'striped', b: 'blank' }[str.substr(1, 1)],
    color: { r: 'red', p: 'purple', g: 'green' }[str.substr(2, 1)],
    shape: { d: 'diamond', s: 'squiggle', o: 'oval' }[str.substr(3, 1)],
  };
  if (Object.values(card).includes(undefined)) throw `Invalid card string! ${byte}`;
  return card;
}

function cardToString(card) {
  return card.number.toString() + { solid: 's', striped: 'p', blank: 'b' }[card.fill] + card.color.substr(0, 1) + card.shape.substr(0, 1);
}

function cardFromByte(byte) {
  let card = {
    number: (byte >> 6 & 3) + 1,
    fill: ['solid', 'striped', 'blank'][byte >> 4 & 3],
    color: ['red', 'purple', 'green'][byte >> 2 & 3],
    shape: ['diamond', 'squiggle', 'oval'][byte & 3],
  };
  if (Object.values(card).includes(undefined)) throw `Invalid card byte! ${byte}`;
  return card;
}

function cardToByte(card) {
  return (
    (card.number - 1) << 6 |
    { solid: 0, striped: 1, blank: 2 }[card.fill] << 4 |
    { red: 0, purple: 1, green: 2 }[card.color] << 2 |
    { diamond: 0, squiggle: 1, oval: 2 }[card.shape]
  );
}

function dumpState(deck, table) {
  return [deck, table].map(cards => btoa(String.fromCharCode(...cards.map(cardToByte)))).join('_');
}

function loadState(str) {
  return str.split('_').map(part => [...atob(part)].map(c => cardFromByte(c.charCodeAt(0))));
}

function cardToHtml(card, idx) {
  const paths = {
    diamond: "M25 0 L50 50 L25 100 L0 50 Z",
    squiggle: "M38.4,63.4c0,16.1,11,19.9,10.6,28.3c-0.5,9.2-21.1,12.2-33.4,3.8s-15.8-21.2-9.3-38c3.7-7.5,4.9-14,4.8-20 c0-16.1-11-19.9-10.6-28.3C1,0.1,21.6-3,33.9,5.5s15.8,21.2,9.3,38C40.4,50.6,38.5,57.4,38.4,63.4z",
    oval: "M25,99.5C14.2,99.5,5.5,90.8,5.5,80V20C5.5,9.2,14.2,0.5,25,0.5S44.5,9.2,44.5,20v60 C44.5,90.8,35.8,99.5,25,99.5z",
  }
  fill = card => {
    switch (card.fill) {
      case 'blank': return 'none';
      case 'striped': return `url(#striped-${card.color})`;
      case 'solid': return colors[card.color];
    }
  }
  svg = card => `<svg viewbox="-6 -6 62 112"><path d="${paths[card.shape]}" fill="${fill(card)}" /></svg>`;

  return `<div class="card ${card.color}${card.new ? ' new' : ''}"${idx !== undefined ? (' data-idx="' + idx + '" ') : ''}">
    <div class="card-content">
      ${range(card.number).map(() => svg(card)).join('')}
    </div>
  </div>`;
}

let deck = null;
let table = [];
let sets = [];
let saveState = true;

function play() {
  function initGameState() {
    if (location.hash && location.hash.substr(1) != localStorage.state) {
      try {
        [deck, table] = loadState(location.hash.substr(1));
        saveState = (localStorage.state !== undefined) && confirm('Would you like to replace your old game?');
        return;
      } catch (err) {
        console.log(err);
        alert('Invalid state code');
      }
    }

    if (localStorage.state !== undefined) {
      try {
        [deck, table] = loadState(localStorage.state);
        return;
      } catch (err) {
        console.log(err);
      }
    }

    deck = buildDeck();
  }

  function deal() {
    sets = findSets(table);
    while (deck.length && (table.length < TABLE_SIZE || !sets.length)) {
      table.push(...deck.splice(-SET_SIZE));
      sets = findSets(table);
    }
    // console.log('sets', sets.map(set => set.map(cardToString).sort().join(',')));
    renderTable();
  }

  function takeSet(set) {
    sets = findSets(table.filter(card => !set.includes(card)));
    if (deck.length && (table.length <= TABLE_SIZE || !sets.length)) {
      set.forEach(card => table.splice(table.indexOf(card), 1, { new: true, ...deck.pop() }));
    } else {
      set.forEach(card => table.splice(table.indexOf(card), 1));
    }
    deal();
  }

  function clickHandler(e) {
    e.target.closest('.card').classList.toggle('selected');
    let selected = document.querySelectorAll('.game-board .card.selected');
    if (selected.length < SET_SIZE) return;
    selected.forEach(elem => elem.classList.remove('selected'));
    let set = Array.from(selected).map(elem => table[elem.dataset.idx]);
    if (validateSet(set)) {
      takeSet(set);
      // selected.forEach(elem => gameBoard.children[elem.dataset.idx].classList.add('new'));
    } else {
      container.classList.add('bad-set');
      setTimeout(() => container.classList.remove('bad-set'), 800);
    }
  }

  function renderTable() {
    localStorage.state = location.hash = dumpState(deck, table);

    deckProgress.value = DECK_SIZE - deck.length;
    deckProgressLabel.innerHTML = `Cards in deck: ${deck.length}`;

    newGameBtn.classList.toggle('hidden', sets.length);

    gameBoard.innerHTML = table.map(cardToHtml).join('');

    table.forEach(card => { delete card.new; });
    document.querySelectorAll('.game-board .card').forEach(elem => {
      elem.addEventListener('click', clickHandler);
      elem.addEventListener('touchstart', e => {
        e.preventDefault();
        clickHandler(e);
      });
    });
  }

  newGameBtn.addEventListener('click', () => {
    deck = buildDeck();
    table = [];
    deal();
  });

  initGameState();
  deal();
}

// document.querySelector('.progress-container').addEventListener('click', () => {
//   alert('click');
// });

removeLegacy();
initWakeLock();
play();
