import { DatingSimulation } from './simulation.js';

const setupPanel = document.getElementById('setup-panel');
const simPanel = document.getElementById('sim-panel');
const setupForm = document.getElementById('setup-form');
const toggleRunBtn = document.getElementById('toggle-run');
const stepOnceBtn = document.getElementById('step-once');
const resetBtn = document.getElementById('reset');
const speedRange = document.getElementById('speedRange');
const speedLabel = document.getElementById('speedLabel');
const stats = document.getElementById('stats');
const svg = d3.select('#graph');

let simulation;
let timer;
let running = false;
let renderSim;

setupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(setupForm);

  simulation = new DatingSimulation({
    maleCount: Number(form.get('maleCount') || document.getElementById('maleCount').value),
    femaleCount: Number(form.get('femaleCount') || document.getElementById('femaleCount').value),
    casualPct: Number(form.get('casualPct') || document.getElementById('casualPct').value),
    seriousPct: Number(form.get('seriousPct') || document.getElementById('seriousPct').value),
    joinChance: Number(form.get('joinChance') || document.getElementById('joinChance').value),
    connectChance: Number(form.get('connectChance') || document.getElementById('connectChance').value),
  });

  setupPanel.classList.add('hidden');
  simPanel.classList.remove('hidden');

  renderGraph();
  startLoop();
});

toggleRunBtn.addEventListener('click', () => {
  if (!simulation) return;
  if (running) {
    stopLoop();
  } else {
    startLoop();
  }
});

stepOnceBtn.addEventListener('click', () => {
  if (!simulation) return;
  simulation.step();
  renderGraph();
});

resetBtn.addEventListener('click', () => {
  stopLoop();
  simulation = null;
  setupPanel.classList.remove('hidden');
  simPanel.classList.add('hidden');
  svg.selectAll('*').remove();
  stats.innerHTML = '';
});

speedRange.addEventListener('input', () => {
  speedLabel.textContent = `${speedMs()} ms/step`;
  if (running) {
    stopLoop();
    startLoop();
  }
});

function speedMs() {
  return 1050 - Number(speedRange.value) * 10;
}

function startLoop() {
  if (!simulation) return;
  running = true;
  toggleRunBtn.textContent = 'Pause';
  timer = setInterval(() => {
    simulation.step();
    renderGraph();
  }, speedMs());
}

function stopLoop() {
  running = false;
  toggleRunBtn.textContent = 'Run';
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function renderGraph() {
  const snapshot = simulation.getSnapshot();

  if (renderSim) renderSim.stop();
  const width = Number(svg.attr('width'));
  const height = Number(svg.attr('height'));

  stats.innerHTML = `
    <div class="stat-pill">Step: ${snapshot.metrics.steps}</div>
    <div class="stat-pill">Active: ${snapshot.metrics.active}</div>
    <div class="stat-pill">Male: ${snapshot.metrics.male}</div>
    <div class="stat-pill">Female: ${snapshot.metrics.female}</div>
    <div class="stat-pill">Joined: ${snapshot.metrics.joined}</div>
    <div class="stat-pill">Serious matched out: ${snapshot.metrics.seriousMatches}</div>
    <div class="stat-pill">Friend-match violations: ${snapshot.metrics.friendMatchViolations}</div>
  `;

  svg.selectAll('*').remove();

  const gEdges = svg.append('g');
  const gNodes = svg.append('g');

  renderSim = d3.forceSimulation(snapshot.nodes)
    .force('link', d3.forceLink(snapshot.edges).id((d) => d.id).distance(78).strength(0.42))
    .force('charge', d3.forceManyBody().strength(-185))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(16))
    .force(
      'x',
      d3.forceX((d) => (d.gender === 'female' ? width * 0.28 : width * 0.72)).strength(0.18),
    )
    .force('y', d3.forceY(height / 2).strength(0.04));

  const links = gEdges
    .selectAll('line')
    .data(snapshot.edges)
    .enter()
    .append('line')
    .attr('class', (d) => `edge-${d.type}`)
    .attr('stroke-width', 2)
    .attr('opacity', 0.85);

  gNodes
    .selectAll('circle')
    .data(snapshot.nodes)
    .enter()
    .append('circle')
    .attr('r', 7)
    .attr('class', (d) => `node-${d.gender}`)
    .append('title')
    .text((d) => `ID: ${d.id} | ${d.gender} | ${d.intent}`);

  renderSim.on('tick', () => {
    links
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    gNodes
      .selectAll('circle')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y);
  });

  if (renderSim.alpha() < 0.2) renderSim.alpha(0.8).restart();
}

speedLabel.textContent = `${speedMs()} ms/step`;
