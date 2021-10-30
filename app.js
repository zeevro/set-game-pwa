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
  const paths = {
    diamond: "M25 0 L50 50 L25 100 L0 50 Z",
    squiggle: "M38.4,63.4c0,16.1,11,19.9,10.6,28.3c-0.5,9.2-21.1,12.2-33.4,3.8s-15.8-21.2-9.3-38c3.7-7.5,4.9-14,4.8-20 c0-16.1-11-19.9-10.6-28.3C1,0.1,21.6-3,33.9,5.5s15.8,21.2,9.3,38C40.4,50.6,38.5,57.4,38.4,63.4z",
    oval: "M25,99.5C14.2,99.5,5.5,90.8,5.5,80V20C5.5,9.2,14.2,0.5,25,0.5S44.5,9.2,44.5,20v60 C44.5,90.8,35.8,99.5,25,99.5z",
  }
  const colors = {
    red: 'red',
    green: 'green',
    purple: 'darkorchid',
  }
  fill = card => {
    switch (card.fill) {
      case 'blank': return 'none';
      case 'striped': return `url(#striped-${card.color})`;
      case 'solid': return colors[card.color];
    }
  }
  svg = card => `<svg viewbox="-2 -2 54 104"><path d="${paths[card.shape]}" fill="${fill(card)}" /></svg>`;

  return `<div class="card ${card.color}${card.new ? ' new' : ''}"${idx !== undefined ? (' data-idx="' + idx + '" ') : ''}">
    <div class="card-content">
      ${range(card.number).map(() => svg(card)).join('')}
    </div>
  </div>`;
}

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
      set.forEach(card => table.splice(table.indexOf(card), 1, {new: true, ...popRandom(deck)}));
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
      renderTable();
    } else {
      gameBoard.classList.add('bad-set');
      setTimeout(() => gameBoard.classList.remove('bad-set'), 800);
    }
  }

  function renderTable() {
    window.localStorage.deck = deck.map(cardToString).join(',');
    window.localStorage.table = table.map(cardToString).join(',');
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
