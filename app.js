window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
});

function randInt(suprimum) {
  return Math.floor(Math.random() * suprimum);
}

Array.prototype.random = function() {
  return this[randInt(this.length)];
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

function colorValue(str){
  var ctx = document.createElement("canvas").getContext("2d");
  ctx.fillStyle = str;
  return ctx.fillStyle;
}

const SET_SIZE = 3;
const DECK_SIZE = SET_SIZE ** 4;
const TABLE_SIZE = SET_SIZE * 4;

const deckProgress = document.querySelector('#deckProgress');
const deckProgressLabel = document.querySelector('#deckProgressLabel');
const container = document.querySelector('.container');
const gameBoard = document.querySelector('.game-board');
const endGameScreen = document.querySelector('.end-game-screen');
const newGameBtn = document.querySelector('#newGameBtn');
const gameButtonsContainer = document.querySelector('.game-buttons-container');
const hintBtn = document.querySelector('#hintBtn');
const add3Btn = document.querySelector('#add3Btn');
const qrCodeContainer = document.querySelector('#qrcode');
const shareStateCheckbox = document.querySelector('input[name="shareState"]');
const installBtn = document.querySelector('#installBtn');
const settingsBtn = document.querySelector('#settingsBtn');
const fullscreenBtn = document.querySelector('#fullscreenBtn');

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

function initPwaFeatures() {
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone || document.referrer.includes('android-app://')) return;
  // if (!(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))) return;

  const fullscreenBtnVisibility = () => {
    const containerBoundingRect = container.getBoundingClientRect();
    fullscreenBtn.classList.toggle('hidden', (
      containerBoundingRect.top >= 0 &&
      containerBoundingRect.bottom <= window.innerHeight + 1.5
    ));
  }

  fullscreenBtn.addEventListener('click', () => { document.body.requestFullscreen(); });
  window.addEventListener('resize', fullscreenBtnVisibility);
  fullscreenBtnVisibility();

  window.addEventListener('beforeinstallprompt', deferedInstallEvent => {
    installBtn.addEventListener('click', async () => {
      if (deferedInstallEvent == null) return;
      deferedInstallEvent.prompt();
      let { outcome } = await deferedInstallEvent.userChoice;
      if (outcome == 'accepted') {
        installBtn.classList.add('hidden');
        window.removeEventListener('resize', fullscreenBtnVisibility);
      }
    });

    settingsBtn.addEventListener('click', () => { settingsBtn.classList.remove('glowing'); });

    installBtn.classList.remove('hidden');
    settingsBtn.classList.add('glowing');
  });
}

function getShareUrl() {
  let url = location.href.split('#')[0];
  if (shareStateCheckbox.checked) {
    url += '#' + game.dumpState();
  }
  return url;
}

function populateShareModal() {
  let qr = new QRious({
    element: qrCodeContainer,
    value: getShareUrl(),
    size: qrCodeContainer.width,
  });
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
    document.querySelectorAll('#settingsModal input[type="checkbox"]').forEach(elem => {
      elem.checked = game.settings[elem.name] ^ parseInt(elem.dataset.invert);
    });
    document.querySelectorAll('#settingsModal input[type="color"]').forEach(elem => {
      elem.value = colorValue(getComputedStyle(document.documentElement).getPropertyValue(`--${elem.name}`));
    });
    document.querySelector('#settingsModal').classList.add('active');
  });

  document.querySelector('#defaultColorsBtn').addEventListener('click', () => {
    document.querySelectorAll('#settingsModal input[type="color"]').forEach(elem => {
      let propertyName = `--${elem.name}`;
      document.documentElement.style.removeProperty(propertyName);
      elem.value = colorValue(getComputedStyle(document.documentElement).getPropertyValue(propertyName));
    });
    localStorage.removeItem('colors');
  });

  document.querySelectorAll('.defaultColorBtn').forEach(elem => elem.addEventListener('click', e => {
    let colorName = e.target.dataset.color;
    let propertyName = `--${colorName}`;
    document.documentElement.style.removeProperty(propertyName);
    document.querySelector(`#settingsModal input[type="color"][name="${colorName}"]`).value = colorValue(getComputedStyle(document.documentElement).getPropertyValue(propertyName));
    if (localStorage.colors !== undefined) {
      localStorage.colors = JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(localStorage.colors)).filter(([color, value]) => color != colorName)));
    }
  }));

  document.querySelectorAll('#settingsModal input[type="checkbox"]').forEach(elem => elem.addEventListener('input', e => {
    game.settings[e.target.name] = (e.target.checked ^ parseInt(e.target.dataset.invert)) ? true : false;
    localStorage.settings = JSON.stringify(game.settings);
    game.renderTable();
  }));

  document.querySelectorAll('#settingsModal input[type="color"]').forEach(elem => elem.addEventListener('input', e => {
    document.documentElement.style.setProperty(`--${e.target.name}`, e.target.value);
    let colorSettings = localStorage.colors !== undefined ? JSON.parse(localStorage.colors) : {};
    colorSettings[e.target.name] = e.target.value;
    localStorage.colors = JSON.stringify(colorSettings);
    game.renderTable();
  }));

  document.querySelector('#settingsNewGameBtn').addEventListener('click', () => {
    game.newGame();
  });

  document.querySelector('#shareBtn').addEventListener('click', () => {
    shareStateCheckbox.checked = true;
    populateShareModal();
    document.querySelector('#shareModal').classList.add('active');
  });

  shareStateCheckbox.addEventListener('input', () => {
    populateShareModal();
  });

  document.querySelector('#copyUrlBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(getShareUrl());
    toast('URL copied');
  });

  if ('share' in navigator) {
    const doShare = async (withImage = false) => {
      let shareData = {
        title: 'Set Game',
        url: getShareUrl(),
      };

      if (shareStateCheckbox.checked && withImage) {
        let canvas = await html2canvas(document.querySelector('.game-board'), { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--board-color') })
        let blob = await new Promise(resolve => canvas.toBlob(resolve));
        shareData.files = [
          new File(
            [blob],
            'set-board.png',
            {
              type: blob.type,
              lastModified: new Date().getTime(),
            }
          )
        ];
      }

      if (navigator.canShare(shareData)) {
        navigator.share(shareData);
      } else {
        toast('Problem with sharing');
      }
    };

    shareStateCheckbox.addEventListener('input', e => { document.querySelector('#shareGameWithScreenshotBtn').classList.toggle('hidden', !e.target.checked); });

    document.querySelector('#shareGameBtn').addEventListener('click', async () => doShare());
    document.querySelector('#shareGameWithScreenshotBtn').addEventListener('click', async () => doShare(true));
  } else {
    document.querySelector('#shareGameBtn').classList.add('hidden');
    document.querySelector('#shareGameWithScreenshotBtn').classList.add('hidden');
  }
}

function initGameButtons() {
  hintBtn.addEventListener('click', () => {
    game.hint();
  });

  add3Btn.addEventListener('click', () => {
    game.add3();
  });

  newGameBtn.addEventListener('click', () => {
    game.newGame();
  });
}

function initTimeCounting() {
  const handler = () => {
    if (!game.gameFinished) {
      if (document.visibilityState === 'visible') {
        // console.log('resume counting');
        game.timeCountStart = new Date();
      } else if (game.timeCountStart !== null) {
        // console.log('pause counting');
        game.statistics.timeTaken += new Date() - game.timeCountStart;
        game.timeCountStart = null;
        localStorage.statistics = game.statistics;
      }
    }
  }
  document.addEventListener('visibilitychange', handler);
  return handler;
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

class Statistics {
  constructor() {
    this.timeTaken = 0;
    this.setsTaken = 0;
    this.mistakes = 0;
    this.hints = 0;
    this.mostCards = 0;
    this.mostSets = 0;
  }

  static fromJSON(json) {
    let ret = new Statistics();
    Object.entries(JSON.parse(json)).filter(([k, v]) => ret.hasOwnProperty(k)).forEach(([k, v]) => ret[k] = v);
    return ret;
  }

  toString() {
    return JSON.stringify(this);
  }

  get timeTakenStr() {
    let time = this.timeTaken;

    let ret = `${(time / 1000 % 60).toFixed(2)}s`;

    if (time = Math.floor(time / 60000)) {
      ret = `${time % 60}m ${ret}`;

      if (time = Math.floor(time / 60)) {
        ret = `${time % 60}h ${ret}`;
      }
    }
    return ret;
  }
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
  static fromNodeList(nodes) {
    return this.from(nodes).map(elem => Card.fromByte(elem.dataset.cardValue))
  }

  combinations(size) {
    if (size <= 0 || size > this.length) {
      return new CardArray();
    }

    if (size == 1) {
      return this.map(n => CardArray.of(n));
    }

    return this.slice(0, this.length - size + 1).flatMap((n, i) => this.slice(i + 1).combinations(size - 1).map(rest => CardArray.of(n).concat(rest)));
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

  indicesOf(cards) {
    return Array.from(cards.map(card => this.indexOf(card)));
  }

  without(cardsOrIndices) {
    if (!(cardsOrIndices instanceof Array)) cardsOrIndices = [cardsOrIndices];
    if (!cardsOrIndices.length) return this;
    if (cardsOrIndices[0] instanceof Card) return this.filter(card => !cardsOrIndices.includes(card));
    return this.filter((card, idx) => !cardsOrIndices.includes(idx));
  }

  with(cards) {
    if (cards instanceof Array) return this.concat(...cards);
    return this.concat(cards);
  }
}

class Decks {
  static * #allCards() {
    for (let number of [1, 2, 3]) {
      for (let fill of ['solid', 'striped', 'blank']) {
        for (let color of ['red', 'purple', 'green']) {
          for (let shape of ['diamond', 'squiggle', 'oval']) {
            yield new Card(number, fill, color, shape);
          }
        }
      }
    }
  }

  static randomDeck() {
    let deck = new CardArray();
    for (let card of this.#allCards()) {
      deck.splice(randInt(deck.length + 1), 0, card);
    }
    return deck;
  }
}

class Game {
  constructor () {
    this.deck = null;
    this.table = new CardArray();
    this.sets = [];
    this.oldCards = {};

    this.timeCountStart = null;
    this.countingTime = false;

    try {
      this.settings = JSON.parse(localStorage.settings);
    } catch {
      this.settings = {
        autoDeal: true,
        hints: false,
      };
    }

    try {
      this.statistics = Statistics.fromJSON(localStorage.statistics);
    } catch {
      this.statistics = new Statistics();
    }
  }

  get gameFinished() {
    return !this.deck.length && !this.sets.length;
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
    if (location.hash) {
      try {
        this.loadState(location.hash.substr(1));
        history.replaceState(null, null, location.href.split('#')[0]);
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

    this.deck = Decks.randomDeck();
  }

  getCardElement(card) {
    return document.querySelector(`.card[data-card-value="${card.toByte()}"]`);
  }

  mistakeFlash() {
    container.classList.add('mistake-flash');
    setTimeout(() => container.classList.remove('mistake-flash'), 800);
    this.statistics.mistakes += 1;
  }

  deal() {
    this.sets = this.table.allSets();
    if (!this.gameFinished) {
      while (this.deck.length && (this.table.length < TABLE_SIZE || (!this.sets.length && this.settings.autoDeal))) {
        this.table.push(...this.deck.splice(-SET_SIZE));
        this.sets = this.table.allSets();
      }
      this.statistics.mostCards = Math.max(this.statistics.mostCards, this.table.length);
      this.statistics.mostSets = Math.max(this.statistics.mostSets, this.sets.length);
    } else if (this.timeCountStart !== null) {
      this.statistics.timeTaken += new Date() - this.timeCountStart;
      this.timeCountStart = null;
    }
    this.renderTable();
  }

  takeSet(cards) {
    let indices = this.table.indicesOf(cards);
    this.sets = this.table.without(indices).allSets();
    if (this.deck.length && (this.table.length <= TABLE_SIZE || !this.sets.length)) {
      this.oldCards = Object.fromEntries(zip(indices, cards));
      indices.forEach(idx => this.table.splice(idx, 1, this.deck.pop()));
    } else {
      this.table = this.table.without(indices);
    }
    this.statistics.setsTaken += 1;
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
      this.mistakeFlash();
    }
  }

  renderTable() {
    gameBoard.classList.toggle('hidden', this.gameFinished);
    gameButtonsContainer.classList.toggle('hidden', this.gameFinished);
    endGameScreen.classList.toggle('hidden', !this.gameFinished);

    localStorage.state = this.dumpState();
    localStorage.statistics = this.statistics;

    deckProgress.value = DECK_SIZE - this.deck.length;
    deckProgressLabel.innerHTML = `Cards in deck: ${this.deck.length}`;

    hintBtn.classList.toggle('hidden', !this.settings.hints);
    add3Btn.classList.toggle('hidden', this.settings.autoDeal);

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

    if (this.gameFinished) {
      document.querySelector('#timeTaken').innerHTML = this.statistics.timeTakenStr;
      document.querySelector('#setsTaken').innerHTML = this.statistics.setsTaken;
      document.querySelector('#mistakes').innerHTML = this.statistics.mistakes;
      document.querySelector('#hints').innerHTML = this.statistics.hints;
      document.querySelector('#cardsLeft').innerHTML = this.table.length;
      document.querySelector('#mostCards').innerHTML = this.statistics.mostCards;
      document.querySelector('#mostSets').innerHTML = this.statistics.mostSets;
    } else {

      if (this.timeCountStart === null) {
        this.timeCountStart = new Date();
      }
    }
  }

  startGame() {
    this.initGameState();
    this.deal();
  }

  newGame() {
    this.deck = Decks.randomDeck();
    this.table = new CardArray();
    this.statistics = new Statistics();
    this.deal();
    timeCountingHandler();
  }

  hint() {
    if (!this.sets.length) {
      if (!this.settings.autoDeal) {
        this.add3();
        this.statistics.hints += 1;
        return;
      }
    }
    let hinted = CardArray.fromNodeList(document.querySelectorAll('.game-board .card.hinted'));
    if (hinted.length >= SET_SIZE) return;
    let availableSets = this.sets.filter(set => hinted.every(card => set.includes(card)));
    let hintedSet = availableSets.random();
    let cardToHint = hintedSet.filter(card => !hinted.includes(card)).random();
    this.getCardElement(cardToHint).classList.add('hinted');
    this.statistics.hints += 1;
  }

  add3() {
    if (!this.deck.length) return;
    if (this.table.length >= TABLE_SIZE && this.sets.length) {
      this.mistakeFlash();
      return;
    }
    this.table.push(...this.deck.splice(-SET_SIZE));
    this.sets = game.table.allSets();
    this.renderTable();
  }

  validateState(oldDeck, oldTable, takenSet) {
    let errors = []
    if (this.deck.length % SET_SIZE != 0) errors.push(`Bad deck length: ${this.deck.length}`);
    if (this.table.length % SET_SIZE != 0) errors.push(`Bad table length: ${this.table.length}`);
    if (this.deck.length && this.table.length < TABLE_SIZE) errors.push(`Table too small: ${this.table.length}`);
    if (this.deck.length && !this.sets) errors.push('No sets on table');
    if (oldTable.length <= this.table.length) {
      oldTable.indicesOf(takenSet).forEach(idx => {
        if (!this.getCardElement(this.table[idx]).classList.contains('new')) errors.push(`Card was not marked new: ${idx}`);
      });
      if (this.table.length > TABLE_SIZE && oldTable.without(takenSet).containsSet()) errors.push('Redundant cards on table');
    }
    return errors;
  }

  step() {
    if (!this.sets.length) {
      if (!this.settings.autoDeal) this.add3();
      return;
    }
    let oldDeck = this.deck.slice();
    let oldTable = this.table.slice();
    let takenSet = this.sets.random()
    this.takeSet(takenSet);
    let errors = this.validateState(oldDeck, oldTable, takenSet);
    errors.forEach(err => console.error(err));
    // if (this.table.length > TABLE_SIZE) console.log(`${this.table.length / SET_SIZE} rows on table`);
  }

  async playTillEnd(moveDelay=50) {
    while (!this.gameFinished) {
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
initPwaFeatures();
initModals();
initGameButtons();

let timeCountingHandler = initTimeCounting();

let game = new Game();

if (localStorage.colors !== undefined) {
  Object.entries(JSON.parse(localStorage.colors)).forEach(([color, value]) => document.documentElement.style.setProperty(`--${color}`, value));
}

window.addEventListener('hashchange', e => {
  game.startGame();
});

game.startGame();
