const SET_SIZE = 3;
const DECK_SIZE = 3 ** 4;

const deckProgress = document.getElementById('deckProgress');
const deckProgressLabel = document.getElementById('deckProgressLabel');
const newGameBtn = document.getElementById('newGameBtn');
const gameBoard = document.querySelector('.game-board');

function range(a, b) {
  if (b === undefined) {
    return Array.from(new Array(a).keys());
  }
  return Array.from(new Array(b).keys()).splice(a);
}

function buildDeck() {
  let deck = [];
  for (number of [1, 2, 3]) {
    for (fill of ['solid', 'striped', 'blank']) {
      for (color of ['red', 'purple', 'green']) {
        for (shape of ['diamond', 'squiggle', 'oval']) {
          deck.push({
            number: number,
            fill: fill,
            color: color,
            shape: shape,
          });
        }
      }
    }
  }
  return deck;
}

function popRandom(arr) {
  return arr.splice(Math.floor(Math.random() * arr.length), 1)[0];
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

function cardFromString(s) {
  return {
    number: parseInt(s.substr(0, 1)),
    fill: { s: 'solid', p: 'striped', b: 'blank' }[s.substr(1, 1)],
    color: { r: 'red', p: 'purple', g: 'green' }[s.substr(2, 1)],
    shape: { d: 'diamond', s: 'squiggle', o: 'oval' }[s.substr(3, 1)],
  };
}

function cardToString(card) {
  return card.number.toString() + { solid: 's', striped: 'p', blank: 'b' }[card.fill] + card.color.substr(0, 1) + card.shape.substr(0, 1);
}

function cardToHtml(card, idx) {
  const characters = {
    diamond: {
      solid: '&#x25C6;',
      striped: '&#x25C8;',
      blank: '&#x25C7;',
    },
    squiggle: {
      solid: '&#x25A0;',
      striped: '&#x25A3;',
      blank: '&#x25A1;',
    },
    oval: {
      solid: '&#x25CF;',
      striped: '&#x25C9;',
      blank: '&#x25CB;',
    },
  }
  let text = range(card.number).map(() => characters[card.shape][card.fill]).join('');
  return `<div class="card ${card.color}" ${idx !== undefined ? ('data-idx="' + idx + '" ') : ''}data-params="${cardToString(card)}">${text}</div>`
}

async function playRandom() {
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const sleepTime = 1000;

  let deck = buildDeck();
  let table = range(12).map(() => popRandom(deck));
  let sets = [];
  while (deck.length || sets.length) {
    console.log('table', table.map(cardToString));
    gameBoard.innerHTML = table.map(cardToHtml).join('');

    await sleep(sleepTime);

    sets = findSets(table);
    if (!sets.length) {
      console.log('no sets found')
      if (deck.length) {
        table.push(...range(SET_SIZE).map(() => popRandom(deck)));
      }
      continue;
    }
    console.log('sets', sets.map(set => set.map(cardToString).join(',')));

    await sleep(sleepTime);

    let set = popRandom(sets);
    console.log('chosen set', table.map(cardToString));
    if (deck.length) {
      set.forEach(card => table.splice(table.indexOf(card), 1, popRandom(deck)));
    } else {
      set.forEach(card => table.splice(table.indexOf(card), 1));
    }

    await sleep(sleepTime);
  }
  console.log('final table', table.map(cardToString));
}

// playRandom();

function play() {
  let deck = buildDeck();
  let table = [];
  let sets = [];

  if (localStorage.deck !== undefined) {
    deck = localStorage.deck.length ? localStorage.deck.split(',').map(cardFromString) : [];
    table = localStorage.table.length ? localStorage.table.split(',').map(cardFromString) : [];
  }

  function draw3() {
    if (!deck.length) return [];
    return range(SET_SIZE).map(() => popRandom(deck));
  }

  function deal() {
    sets = findSets(table);
    while (deck.length && (table.length < 12 || !sets.length)) {
      table.push(...draw3());
      sets = findSets(table);
    }
    // console.log('sets', sets.map(set => set.map(cardToString).sort().join(',')));
  }

  function takeSet(set) {
    if (deck.length) {
      set.forEach(card => table.splice(table.indexOf(card), 1, popRandom(deck)));
    } else {
      set.forEach(card => table.splice(table.indexOf(card), 1));
    }
    deal();
  }

  function clickHandler(e) {
    e.target.classList.toggle('selected');
    let selected = document.querySelectorAll('.game-board .card.selected');
    if (selected.length < SET_SIZE) return;
    selected.forEach(elem => elem.classList.remove('selected'));
    let set = Array.from(selected).map(elem => table[elem.dataset.idx]);
    if (validateSet(set)) {
      takeSet(set);
      renderTable();
    }
  }

  function renderTable() {
    window.localStorage.deck = deck.map(cardToString).join(',');
    window.localStorage.table = table.map(cardToString).join(',');
    deckProgress.value = DECK_SIZE - deck.length;
    deckProgressLabel.innerHTML = `Cards in deck: ${deck.length}`;
    newGameBtn.classList.toggle('hidden', sets.length);
    gameBoard.innerHTML = table.map(cardToHtml).join('');
    document.querySelectorAll('.game-board .card').forEach(elem => {
      elem.addEventListener('click', clickHandler);
      elem.addEventListener('touchstart', e => {
        e.preventDefault();
        clickHandler(e);
      });
    });
  }

  function newGame() {
    deck = buildDeck();
    table = [];
    sets = [];
    deal();
    renderTable();
  }

  newGameBtn.addEventListener('click', newGame);

  deal();
  renderTable();
}

play();
