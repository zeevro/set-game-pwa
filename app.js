window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
});

Array.prototype.random = function() {
  return this[Math.floor(Math.random() * this.length)];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function* zip(...arrs) {
  for (let i = 0;; i++) {
    let z = arrs.map(arr => arr[i]);
    if (z.some(x => x === undefined)) break;
    yield z;
  }
}

const SET_SIZE = 3;
const DECK_SIZE = SET_SIZE ** 4;
const TABLE_SIZE = SET_SIZE * 4;

const deckProgress = document.querySelector('#deckProgress');
const deckProgressLabel = document.querySelector('#deckProgressLabel');
const newGameBtn = document.querySelector('#newGameBtn');
const container = document.querySelector('.container');
const gameBoard = document.querySelector('.game-board');

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

function initModals() {
  document.querySelectorAll('.modal .close').forEach(elem => {
    elem.addEventListener('click', e => {
      e.target.closest('.modal').classList.remove('active');
    })
  });

  document.querySelectorAll('.modal').forEach(elem => {
    elem.addEventListener('click', e => {
      if (e.target == elem) elem.classList.remove('active');
    });
  });

  document.querySelector('#settingsBtn').addEventListener('click', () => {
    document.querySelector('#settingsModal').classList.add('active');
  });
}

function toast(text, ttl=3000) {
  if (this.alive === undefined) this.alive = [];
  let idx = this.alive.indexOf(false);
  if (idx == -1) {
    idx = this.alive.push(true) - 1;
  } else {
    this.alive[idx] = true;
  }
  let elem = document.createElement('div');
  elem.classList.add('toast');
  // elem.dataset.position = idx;
  elem.style.bottom = `calc(50px +  ${idx} * (30px + 1em))`;
  elem.innerHTML = text;
  document.body.appendChild(elem);
  setTimeout(() => {
    elem.classList.add('dead');
    setTimeout(() => {
      document.body.removeChild(elem);
      this.alive[idx] = false;
      while (this.alive.length && !this.alive.at(-1)) {
        this.alive.pop();
      }
    }, 400);
  }, ttl);
}

class Card {
  constructor (number, fill, color, shape) {
    this.number = number;
    this.fill = fill;
    this.color = color;
    this.shape = shape;
  }

  static fromString(str) {
    let card = new Card(
      parseInt(str.substr(0, 1)),
      { s: 'solid', p: 'striped', b: 'blank' }[str.substr(1, 1)],
      { r: 'red', p: 'purple', g: 'green' }[str.substr(2, 1)],
      { d: 'diamond', s: 'squiggle', o: 'oval' }[str.substr(3, 1)],
    );
    if (Object.values(card).includes(undefined)) throw `Invalid card string! ${str}`;
    return card;
  }

  toString() {
    return this.number.toString() + { solid: 's', striped: 'p', blank: 'b' }[this.fill] + this.color.substr(0, 1) + this.shape.substr(0, 1);
  }

  toByte() {
    return (
      (this.number - 1) << 6 |
      { solid: 0, striped: 1, blank: 2 }[this.fill] << 4 |
      { red: 0, purple: 1, green: 2 }[this.color] << 2 |
      { diamond: 0, squiggle: 1, oval: 2 }[this.shape]
    );
  }

  static fromByte(byte) {
    let card = new Card(
      (byte >> 6 & 3) + 1,
      ['solid', 'striped', 'blank'][byte >> 4 & 3],
      ['red', 'purple', 'green'][byte >> 2 & 3],
      ['diamond', 'squiggle', 'oval'][byte & 3],
    );
    if (Object.values(card).includes(undefined)) throw `Invalid card byte! ${byte}`;
    return card;
  }

  toHtml(oldCard) {
    const paths = {
      diamond: "M25 0 L50 50 L25 100 L0 50 Z",
      squiggle: "M38.4,63.4c0,16.1,11,19.9,10.6,28.3c-0.5,9.2-21.1,12.2-33.4,3.8s-15.8-21.2-9.3-38c3.7-7.5,4.9-14,4.8-20 c0-16.1-11-19.9-10.6-28.3C1,0.1,21.6-3,33.9,5.5s15.8,21.2,9.3,38C40.4,50.6,38.5,57.4,38.4,63.4z",
      oval: "M25,99.5C14.2,99.5,5.5,90.8,5.5,80V20C5.5,9.2,14.2,0.5,25,0.5S44.5,9.2,44.5,20v60 C44.5,90.8,35.8,99.5,25,99.5z",
    }
    let fillStr = () => {
      switch (this.fill) {
        case 'blank': return 'none';
        case 'striped': return `url(#striped-${this.color})`;
        case 'solid': return `var(--${this.color})`;
      }
    }
    let svg = `<svg viewbox="-6 -6 62 112"><path d="${paths[this.shape]}" fill="${fillStr()}" /></svg>`;

    return `<div class="card ${this.color}${oldCard !== undefined ? ' new' : ''}" data-card-value="${this.toByte()}">
      <div class="card-content">
        ${svg.repeat(this.number)}
      </div>
    </div>`;
  }

  equals(other) {
    return (
      this.number == other.number &&
      this.fill == other.fill &&
      this.color == other.color &&
      this.shape == other.shape
    )
  }
}

class CardArray extends Array {
  static randomDeck() {
    let deck = new this();
    for (let number of [1, 2, 3]) {
      for (let fill of ['solid', 'striped', 'blank']) {
        for (let color of ['red', 'purple', 'green']) {
          for (let shape of ['diamond', 'squiggle', 'oval']) {
            let card = new Card(number, fill, color, shape);
            deck.splice(Math.floor(Math.random() * (deck.length + 1)), 0, card);
          }
        }
      }
    }
    return deck;
  }

  static fromNodeList(nodes) {
    return this.from(nodes).map(elem => Card.fromByte(elem.dataset.cardValue))
  }

  combinations(size) {
    if (size <= 0 || size > this.length) {
      return new this.constructor();
    }

    if (size == 1) {
      return this.map(n => this.constructor.of(n));
    }

    return this.slice(0, this.length - size + 1).flatMap((n, i) => this.slice(i + 1).combinations(size - 1).map(rest => this.constructor.of(n).concat(rest)));
  }

  allSets() {
    return this.combinations(SET_SIZE).filter(arr => arr.isSet());
  }

  containsSet() {
    return this.allSets().length > 0;
  }

  isSet() {
    return Object.keys(this[0]).every(param => [1, this.length].includes(new Set(this.map(card => card[param])).size));
  }

  indexOf(card) {
    for (let i = 0; i < this.length; i++) {
      if (this[i].equals(card)) {
        return i;
      }
    }
    return -1;
  }

  includes(card) {
    return this.indexOf(card) != -1
  }

  toString() {
    return this.map(card => card.toString()).join(' ');
  }

  pluck(...cards) {
    return Array.from(cards.map(card => this.indexOf(card)));
  }

  without(...indices) {
    return this.filter((card, idx) => !indices.includes(idx));
  }
}

class Game {
  constructor () {
    this.deck = null;
    this.table = new CardArray();
    this.sets = [];
    this.oldCards = {};
  }

  loadState(str) {
    let state = str.split('_').map(part => new CardArray(...atob(part)).map(c => Card.fromByte(c.charCodeAt(0))));
    if (state.length != 2) {
      throw 'Invalid state code';
    }
    if (state.some(cards => cards.length % SET_SIZE != 0)) {
      throw 'Invalid card count';
    }
    [this.deck, this.table] = state;
  }

  dumpState() {
    return [this.deck, this.table].map(cards => btoa(String.fromCharCode(...cards.map(card => card.toByte())))).join('_');
  }

  initGameState() {
    if (location.hash && location.hash.substr(1) != localStorage.state) {
      try {
        this.loadState(location.hash.substr(1));
        return;
      } catch (err) {
        console.log(err);
        toast('Invalid state code');
      }
    }

    if (localStorage.state !== undefined) {
      try {
        this.loadState(localStorage.state);
        return;
      } catch (err) {
        console.log(err);
      }
    }

    this.deck = CardArray.randomDeck();
  }

  getCardElement(card) {
    return document.querySelector(`.card[data-card-value="${card.toByte()}"]`);
  }

  deal() {
    this.sets = this.table.allSets();
    while (this.deck.length && (this.table.length < TABLE_SIZE || !this.sets.length)) {
      this.table.push(...this.deck.splice(-SET_SIZE));
      this.sets = this.table.allSets();
    }
    this.renderTable();
  }

  takeSet(cards) {
    let indices = this.table.pluck(...cards);
    this.sets = this.table.without(...indices).allSets();
    if (this.deck.length && (this.table.length <= TABLE_SIZE || !this.sets.length)) {
      this.oldCards = Object.fromEntries(zip(indices, cards));
      indices.forEach(idx => this.table.splice(idx, 1, this.deck.pop()));
    } else {
      this.table = this.table.without(...indices);
    }
    this.deal();
  }

  clickHandler(e) {
    e.target.closest('.card').classList.toggle('selected');
    let selected = document.querySelectorAll('.game-board .card.selected');
    if (selected.length < SET_SIZE) return;
    let cards = CardArray.fromNodeList(selected);
    selected.forEach(elem => elem.classList.remove('selected'));
    if (cards.isSet()) {
      this.takeSet(cards);
    } else {
      container.classList.add('bad-set');
      setTimeout(() => container.classList.remove('bad-set'), 800);
    }
  }

  renderTable() {
    let state = this.dumpState();
    localStorage.state = state;
    history.replaceState(null, null, '#' + state);

    deckProgress.value = DECK_SIZE - this.deck.length;
    deckProgressLabel.innerHTML = `Cards in deck: ${this.deck.length}`;

    newGameBtn.classList.toggle('hidden', this.sets.length);

    gameBoard.innerHTML = this.table.map((card, idx) => card.toHtml(this.oldCards[idx])).join('');
    this.oldCards = {};

    this.table.forEach(card => { delete card.new; });
    document.querySelectorAll('.game-board .card').forEach(elem => {
      elem.addEventListener('click', e => this.clickHandler(e));
      elem.addEventListener('touchstart', e => {
        e.preventDefault();
        this.clickHandler(e);
      });
    });
  }

  startGame() {
    this.initGameState();
    this.deal();
  }

  newGame() {
    this.deck = CardArray.randomDeck();
    this.table = new CardArray();
    this.deal();
  }

  hint() {
    if (!this.sets.length) return;
    let hinted = CardArray.fromNodeList(document.querySelectorAll('.game-board .card.hinted'));
    if (hinted.length >= SET_SIZE) return;
    let availableSets = this.sets.filter(set => hinted.every(card => set.includes(card)));
    let hintedSet = availableSets.random();
    let cardToHint = hintedSet.filter(card => !hinted.includes(card)).random();
    this.getCardElement(cardToHint).classList.add('hinted');
  }

  validateState(oldDeck, oldTable, takenSet) {
    let errors = []
    if (this.deck.length % SET_SIZE != 0) errors.push(`Bad deck length: ${this.deck.length}`);
    if (this.table.length % SET_SIZE != 0) errors.push(`Bad table length: ${this.table.length}`);
    if (this.deck.length && this.table.length < TABLE_SIZE) errors.push(`Table too small: ${this.table.length}`);
    if (this.deck.length && !this.sets) errors.push('No sets on table');
    if (oldTable.length <= this.table.length) {
      oldTable.pluck(...takenSet).forEach(idx => {
        if (!this.getCardElement(this.table[idx]).classList.contains('new')) errors.push(`Card was not marked new: ${idx}`);
      });
    }
    return errors;
  }

  step() {
    if (!this.sets.length) return;
    let oldDeck = this.deck.slice();
    let oldTable = this.table.slice();
    let takenSet = this.sets.random()
    this.takeSet(takenSet);
    let errors = this.validateState(oldDeck, oldTable, takenSet);
    errors.forEach(err => console.error(err));
  }

  async playTillEnd(moveDelay=50) {
    while (this.sets.length) {
      this.step();
      await sleep(moveDelay);
    }
  }

  async playForever(moveDelay=50) {
    let stop = false;
    this.stop = () => { stop = true; };
    while (!stop) {
      await this.playTillEnd(moveDelay);
      this.newGame();
    }
  }
}

removeLegacy();
initWakeLock();
initModals();

let game = new Game();
game.startGame();

window.addEventListener('hashchange', e => {
  console.log(e);
  game.startGame();
});

newGameBtn.addEventListener('click', () => {
  game.newGame();
});