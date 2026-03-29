const INTENT_SERIOUS = 'serious';
const INTENT_CASUAL = 'casual';
const INTENT_BOTH = 'both';

export class DatingSimulation {
  constructor(config = {}) {
    this.config = {
      maleCount: config.maleCount ?? 30,
      femaleCount: config.femaleCount ?? 30,
      casualPct: config.casualPct ?? 40,
      seriousPct: config.seriousPct ?? 40,
      joinChance: config.joinChance ?? 0.12,
      connectChance: config.connectChance ?? 0.28,
    };

    this.graph = new jsnx.Graph();
    this.people = new Map();
    this.nextId = 1;
    this.stepCount = 0;
    this.stats = {
      joined: 0,
      seriousMatches: 0,
      friendMatchViolations: 0,
    };

    this._buildInitialPopulation();
    this._seedFriendships();
  }

  _buildInitialPopulation() {
    for (let i = 0; i < this.config.maleCount; i += 1) {
      this._addPerson('male');
    }
    for (let i = 0; i < this.config.femaleCount; i += 1) {
      this._addPerson('female');
    }
  }

  _pickIntent() {
    const casual = Math.max(0, Number(this.config.casualPct));
    const serious = Math.max(0, Number(this.config.seriousPct));
    const total = casual + serious;

    if (total >= 100) {
      const roll = Math.random() * total;
      return roll < casual ? INTENT_CASUAL : INTENT_SERIOUS;
    }

    const both = 100 - total;
    const roll = Math.random() * 100;
    if (roll < casual) return INTENT_CASUAL;
    if (roll < casual + serious) return INTENT_SERIOUS;
    if (roll < casual + serious + both) return INTENT_BOTH;
    return INTENT_BOTH;
  }

  _addPerson(gender) {
    const id = this.nextId;
    this.nextId += 1;

    const person = {
      id,
      gender,
      intent: this._pickIntent(),
      active: true,
    };

    this.people.set(id, person);
    this.graph.addNode(id, person);
    return id;
  }

  _activeIdsByGender(gender) {
    const out = [];
    this.people.forEach((person, id) => {
      if (person.active && person.gender === gender) out.push(id);
    });
    return out;
  }

  _seedFriendships() {
    ['male', 'female'].forEach((gender) => {
      const ids = this._activeIdsByGender(gender);
      ids.forEach((id) => {
        const candidates = ids.filter((otherId) => otherId !== id);
        const picks = pickRandom(candidates, 3);
        picks.forEach((friendId) => this._link(id, friendId, 'friend'));
      });
    });
  }

  _link(a, b, type) {
    if (a === b) return;
    if (this.graph.hasEdge(a, b)) {
      const edge = this.graph.getEdgeData(a, b);
      if (edge.type === 'friend') return;
      if (type === 'friend') {
        this.graph.addEdge(a, b, { type: 'friend' });
      } else if (type === 'dating' || edge.type === 'match') {
        this.graph.addEdge(a, b, { type });
      }
      return;
    }
    this.graph.addEdge(a, b, { type });
  }

  _isSeriousCompatible(intent) {
    return intent === INTENT_SERIOUS || intent === INTENT_BOTH;
  }

  _removePerson(id) {
    const person = this.people.get(id);
    if (!person || !person.active) return;
    person.active = false;
    this.graph.removeNode(id);
  }

  _removeAllConnections(id) {
    if (!this.graph.hasNode(id)) return;
    const neighbors = this.graph.neighbors(id);
    neighbors.forEach((nId) => {
      if (this.graph.hasEdge(id, nId)) this.graph.removeEdge(id, nId);
    });
  }

  _attemptConnection(fromId) {
    const from = this.people.get(fromId);
    if (!from || !from.active || !this.graph.hasNode(fromId)) return;

    if (Math.random() > this.config.connectChance) return;

    const oppositeGender = from.gender === 'male' ? 'female' : 'male';
    const candidates = this._activeIdsByGender(oppositeGender).filter((id) => id !== fromId);
    if (!candidates.length) return;

    const toId = candidates[Math.floor(Math.random() * candidates.length)];
    const to = this.people.get(toId);
    if (!to || !to.active) return;

    if (this.graph.hasEdge(fromId, toId)) {
      const existing = this.graph.getEdgeData(fromId, toId);
      if (existing.type === 'friend') {
        this._removeAllConnections(fromId);
        this._removeAllConnections(toId);
        this.stats.friendMatchViolations += 1;
      }
      return;
    }

    const fromSerious = this._isSeriousCompatible(from.intent);
    const toSerious = this._isSeriousCompatible(to.intent);

    if (fromSerious && toSerious) {
      this.stats.seriousMatches += 1;
      this._removePerson(fromId);
      this._removePerson(toId);
      return;
    }

    if (from.intent === INTENT_CASUAL && to.intent === INTENT_CASUAL) {
      this._link(fromId, toId, 'match');
    } else {
      this._link(fromId, toId, 'dating');
    }
  }

  _maybeJoin() {
    if (Math.random() > this.config.joinChance) return;
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const id = this._addPerson(gender);
    this.stats.joined += 1;

    const sameGender = this._activeIdsByGender(gender).filter((n) => n !== id);
    pickRandom(sameGender, 3).forEach((friendId) => this._link(id, friendId, 'friend'));
  }

  step() {
    this.stepCount += 1;
    this._maybeJoin();

    const activeIds = [];
    this.people.forEach((person, id) => {
      if (person.active && this.graph.hasNode(id)) activeIds.push(id);
    });

    shuffle(activeIds).forEach((id) => this._attemptConnection(id));
  }

  getSnapshot() {
    const nodes = [];
    this.graph.nodes(true).forEach(([id, attrs]) => {
      nodes.push({ id, ...attrs });
    });

    const edges = [];
    this.graph.edges(true).forEach(([source, target, attrs]) => {
      edges.push({ source, target, type: attrs.type });
    });

    const active = nodes.length;
    const male = nodes.filter((n) => n.gender === 'male').length;
    const female = active - male;

    return {
      nodes,
      edges,
      metrics: {
        steps: this.stepCount,
        active,
        male,
        female,
        joined: this.stats.joined,
        seriousMatches: this.stats.seriousMatches,
        friendMatchViolations: this.stats.friendMatchViolations,
      },
    };
  }
}

function pickRandom(list, count) {
  if (list.length <= count) return [...list];
  const copy = [...list];
  shuffle(copy);
  return copy.slice(0, count);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
