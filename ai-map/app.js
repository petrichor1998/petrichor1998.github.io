import { RELATION_TYPES, validateContent, checkpointIndex, visibleTopicIds, visibleConnections, lessonDiscoveries, topicIdFromHash, computeLayout } from './model.js';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const state = { content: null, published: 0, checkpoint: 0, selected: null, view: 'map', visibleOverride: null, replay: null, newIds: new Set(), transform: null, width: 0 };
let graph;
let announceTimer;
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svgEl = (tag, attrs = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== null) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};
function announce(message) {
  clearTimeout(announceTimer);
  $('announcements').textContent = '';
  announceTimer = setTimeout(() => { $('announcements').textContent = message; }, 40);
}
const visible = () => state.visibleOverride ?? visibleTopicIds(state.content, state.checkpoint);
const topicById = id => state.content.topics.find(topic => topic.id === id);
const laneById = id => state.content.lanes.find(lane => lane.id === id);
const sourceById = id => state.content.sources.find(source => source.id === id);
const yearText = milestone => milestone.yearEnd ? `${milestone.year}–${milestone.yearEnd}` : String(milestone.year);

function citationLinks(refs) {
  const span = el('span');
  for (const [index, id] of refs.entries()) {
    const source = sourceById(id);
    span.append(document.createTextNode(index ? ' · ' : ' '));
    const link = el('a', 'citation-inline', `${source.authors.split(',')[0]} (${source.year}) ↗`);
    link.href = source.url;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.title = source.title;
    span.append(link);
  }
  return span;
}

function detailSection(title, text) {
  const section = el('section', 'detail-section');
  section.append(el('h3', '', title), el('p', '', text));
  return section;
}

function renderDetail() {
  const container = $('detail-content');
  container.replaceChildren();
  const topic = topicById(state.selected);
  $('copy-link').hidden = !topic;
  if (!topic || !visible().has(topic.id)) {
    const box = el('div', 'empty-notes');
    const title = el('h2', 'detail-title', 'A discovery awaits.'); title.id = 'detail-title';
    box.append(title, el('p', '', 'Select a revealed topic to meet its contributors, explore its central idea, and follow its connections.'));
    container.append(box); return;
  }
  const lane = laneById(topic.lane);
  $('detail-panel').style.setProperty('--selected-color', lane.color);
  container.append(el('p', 'detail-kicker', `${lane.label} / ${topic.kind === 'context' ? 'Historical context' : 'Course topic'}`));
  const heading = el('h2', 'detail-title', topic.title); heading.id = 'detail-title'; heading.tabIndex = -1;
  container.append(heading, el('p', 'detail-tagline', topic.tagline));
  const badge = el('div', 'date-badge');
  badge.append(el('strong', '', topic.dateLabel), el('span', '', topic.dateKind));
  container.append(badge, detailSection('The problem', topic.problem), detailSection('The central idea', topic.idea));
  const example = el('section', 'detail-section example');
  example.append(el('h3', '', topic.example.label), el('pre', '', topic.example.code), el('p', '', topic.example.explanation));
  container.append(example, detailSection('Why it matters', topic.significance));
  const people = el('section', 'detail-section'); people.append(el('h3', '', 'People behind the idea'));
  const names = el('ul', 'contributors');
  for (const person of topic.contributors) {
    const item = el('li'); item.append(el('strong', '', person.name), el('span', '', person.role), citationLinks(person.sources)); names.append(item);
  }
  people.append(names); container.append(people);
  const history = detailSection('A date with a story', topic.history);
  const milestones = el('ol', 'milestone-list');
  for (const milestone of topic.milestones) {
    const item = el('li'); const description = el('p', '', milestone.description);
    description.append(citationLinks(milestone.sources));
    item.append(el('strong', '', `${yearText(milestone)} · ${milestone.label}`), description); milestones.append(item);
  }
  history.append(milestones); container.append(history);

  const connections = el('section', 'detail-section'); connections.append(el('h3', '', 'Follow a connection'));
  const edges = visibleConnections(state.content, visible()).filter(edge => edge.from === topic.id || edge.to === topic.id);
  if (!edges.length) connections.append(el('p', 'no-connections', 'More connections will appear as the class reveals related topics.'));
  for (const edge of edges) {
    const other = topicById(edge.from === topic.id ? edge.to : edge.from);
    const card = el('div', 'connection-card');
    const kind = el('div', 'connection-kind'); const line = el('i', `legend-line ${edge.type}`); line.setAttribute('aria-hidden', 'true');
    kind.append(line, document.createTextNode(RELATION_TYPES[edge.type].label));
    const link = el('button', 'connection-topic', `${other.title} ${edge.type === 'comparison' ? '↔' : edge.from === topic.id ? '→' : '←'}`);
    link.type = 'button'; link.addEventListener('click', () => selectTopic(other.id, true));
    card.append(kind, link, el('p', 'connection-label', edge.label), el('p', '', edge.explanation));
    if (edge.sourceNote) card.append(el('p', 'source-note', edge.sourceNote));
    card.append(citationLinks(edge.sources)); connections.append(card);
  }
  container.append(connections);
  const sourceSection = el('section', 'detail-section'); sourceSection.append(el('h3', '', 'Read the sources'));
  const sources = el('ol', 'source-list');
  for (const id of topic.sources) {
    const source = sourceById(id); const item = el('li'); const link = el('a', '', `${source.title} ↗`);
    link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    item.append(link, el('span', '', `${source.authors} · ${source.year}`), el('span', '', source.note)); sources.append(item);
  }
  sourceSection.append(sources); container.append(sourceSection);
}

function renderList() {
  const list = $('topic-list'); list.replaceChildren();
  const current = visible();
  for (const topic of [...state.content.topics].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))) {
    const row = el('div', 'list-row'); row.dataset.topicId = topic.id;
    row.style.setProperty('--node-color', laneById(topic.lane).color);
    row.setAttribute('aria-current', String(state.selected === topic.id));
    if (current.has(topic.id)) {
      row.append(el('span', 'list-year', topic.dateLabel));
      const body = el('div'); const button = el('button', '', topic.title); button.type = 'button';
      button.addEventListener('click', () => selectTopic(topic.id, true));
      body.append(button, el('p', '', topic.tagline)); row.append(body, el('span', 'list-kind', topic.kind === 'context' ? '◇ Context' : 'Course topic'));
    } else {
      row.append(el('span', 'list-year', '···'), el('span', 'locked-list', 'Undiscovered topic'), el('span', 'list-kind', laneById(topic.lane).label));
    }
    list.append(row);
  }
}

function chooseDefault() {
  const current = visible();
  const latest = state.content.topics.filter(topic => topic.kind === 'course' && current.has(topic.id)).sort((a, b) => checkpointIndex(state.content, b.unlockAt) - checkpointIndex(state.content, a.unlockAt));
  state.selected = latest[0]?.id ?? null;
}

function selectTopic(id, moveFocus = false, updateHash = true) {
  if (!visible().has(id)) return;
  state.selected = id;
  if (updateHash) history.replaceState(null, '', `#topic=${encodeURIComponent(id)}`);
  renderMapState(); renderDetail(); renderList();
  $('detail-panel').scrollTop = 0;
  if (moveFocus) {
    $('detail-title').focus({ preventScroll: true });
    if (matchMedia('(max-width: 900px)').matches) $('detail-panel').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    else if (graph) panToSelected();
  }
  announce(`${topicById(id).title}. Field notes updated.`);
}

function renderControls() {
  const topics = state.content.topics.filter(topic => topic.kind === 'course');
  const count = topics.filter(topic => visible().has(topic.id)).length;
  $('discovered-count').textContent = count;
  $('total-count').textContent = topics.length;
  $('progress-fill').style.width = `${count / topics.length * 100}%`;
  const checkpoint = state.content.checkpoints[state.checkpoint];
  $('current-caption').textContent = state.replay ? 'Replaying this lesson’s discoveries…' : `Viewing: ${checkpoint?.label ?? 'Before the first lesson'}`;
  $('checkpoint').value = String(state.checkpoint);
  $('checkpoint').disabled = Boolean(state.replay);
  $('previous').disabled = state.checkpoint <= 0 || Boolean(state.replay);
  $('next').disabled = state.checkpoint >= state.published || Boolean(state.replay);
  $('replay-label').textContent = state.replay ? 'Skip replay' : 'Replay this lesson’s discoveries';
  $('lesson-story').textContent = checkpoint?.story ?? 'Every expedition begins with a first discovery.';
  $('lesson-position').textContent = `Lesson ${state.checkpoint + 1} of ${state.published + 1}`;
}

function renderAll() {
  if (!visible().has(state.selected)) chooseDefault();
  renderControls(); renderMapState(); renderList(); renderDetail();
}

function setCheckpoint(index) {
  if (index < 0 || index > state.published || state.replay) return;
  state.checkpoint = index; state.newIds = new Set(); chooseDefault();
  if (state.selected) history.replaceState(null, '', `#topic=${encodeURIComponent(state.selected)}`);
  renderAll(); $('detail-panel').scrollTop = 0;
  announce(`Viewing lesson ${index + 1}: ${state.content.checkpoints[index].label}.`);
}

function finishReplay() {
  const replay = state.replay; if (!replay) return;
  for (const timer of replay.timers) clearTimeout(timer);
  state.checkpoint = replay.target; state.visibleOverride = null;
  state.newIds = new Set(replay.discoveries.map(topic => topic.id)); state.replay = null;
  chooseDefault(); renderAll();
  if (state.selected) history.replaceState(null, '', `#topic=${encodeURIComponent(state.selected)}`);
  announce(`Lesson revealed: ${state.content.checkpoints[state.checkpoint].label}. ${replay.discoveries.length} discoveries added.`);
}

function replayLesson() {
  if (state.replay) { finishReplay(); return; }
  const target = state.checkpoint;
  const discoveries = lessonDiscoveries(state.content, target).sort((a, b) => (a.kind === 'context' ? 0 : 1) - (b.kind === 'context' ? 0 : 1));
  state.replay = { target, discoveries, timers: [] };
  state.newIds = new Set();
  if (reducedMotion.matches) { finishReplay(); return; }
  state.visibleOverride = visibleTopicIds(state.content, target - 1);
  renderAll();
  for (const [index, topic] of discoveries.entries()) {
    state.replay.timers.push(setTimeout(() => {
      state.visibleOverride.add(topic.id); state.newIds.add(topic.id); state.selected = topic.id;
      renderAll(); announce(`Discovered ${topic.title}.`);
    }, 500 + index * 950));
  }
  state.replay.timers.push(setTimeout(finishReplay, 1000 + discoveries.length * 950));
}

function setupGraph() {
  if (!window.d3) {
    $('map-view').disabled = true; $('map-help').textContent = 'The timeline library could not load. All revealed topics are available in the list.';
    setView('list'); return;
  }
  const width = Math.max(760, $('map-container').clientWidth);
  if (graph && state.width === width) return;
  const oldTransform = state.transform;
  state.width = width;
  const layout = computeLayout(state.content, width - 340);
  const svg = $('timeline'); svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${width} ${layout.height}`);
  svg.style.minWidth = `${width}px`; svg.style.height = `${layout.height}px`;
  const defs = svgEl('defs');
  for (const [id, color] of [['default', '#9ca99c'], ...state.content.lanes.map(lane => [lane.id, lane.color])]) {
    const marker = svgEl('marker', { id: `arrow-${id}`, viewBox: '0 -4 8 8', refX: 7, refY: 0, markerWidth: 6, markerHeight: 6, orient: 'auto' });
    marker.append(svgEl('path', { d: 'M0,-3L7,0L0,3', fill: 'none', stroke: color, 'stroke-width': 1.2 })); defs.append(marker);
  }
  const clip = svgEl('clipPath', { id: 'plot-clip' }); clip.append(svgEl('rect', { x: 154, y: 20, width: width - 154, height: layout.height - 30 })); defs.append(clip); svg.append(defs);
  for (const lane of layout.lanes) {
    svg.append(svgEl('rect', { class: 'lane-bg', x: 0, y: lane.top, width, height: lane.height }), svgEl('line', { class: 'lane-rule', x1: 0, x2: width, y1: lane.top, y2: lane.top }));
  }
  const plot = svgEl('g', { 'clip-path': 'url(#plot-clip)' });
  const grid = svgEl('g'); const edgeLayer = svgEl('g'); const nodeLayer = svgEl('g'); const axis = svgEl('g', { class: 'axis', transform: 'translate(0,48)' });
  plot.append(grid, axis, edgeLayer, nodeLayer); svg.append(plot);
  svg.append(svgEl('rect', { class: 'lane-gutter', x: 0, y: 0, width: 152, height: layout.height }));
  svg.append(svgEl('text', { x: 22, y: 48, class: 'lane-index' }, 'HISTORICAL TIME →'));
  for (const [index, lane] of layout.lanes.entries()) {
    const label = svgEl('g', { transform: `translate(22,${lane.top + 30})` });
    label.append(svgEl('text', { class: 'lane-index', y: 0 }, `0${index + 1}`), svgEl('text', { class: 'lane-label', y: 25, fill: lane.color }, lane.label));
    const words = lane.question.split(' '); let line = ''; let row = 0;
    for (const word of words) {
      if ((line + word).length > 21) { label.append(svgEl('text', { class: 'lane-question', y: 47 + row++ * 14 }, line.trim())); line = ''; }
      line += `${word} `;
    }
    label.append(svgEl('text', { class: 'lane-question', y: 47 + row * 14 }, line.trim())); svg.append(label);
  }
  const baseScale = d3.scaleLinear().domain([layout.firstYear, layout.lastYear]).range([240, width - 100]);
  const nodes = new Map();
  for (const topic of state.content.topics) {
    const node = svgEl('g', { class: 'node', 'data-topic-id': topic.id, role: 'button' });
    const color = laneById(topic.lane).color;
    node.style.setProperty('--node-color', color); node.style.setProperty('--node-wash', `${color}13`);
    node.append(svgEl('title'));
    if (topic.yearEnd) node.append(svgEl('line', { class: 'range-mark', y1: -44, y2: -44 }));
    node.append(svgEl('rect', { class: 'focus-ring', x: -79, y: -34, width: 158, height: 69, rx: 9 }));
    node.append(svgEl('rect', { class: 'node-card', x: -73, y: -28, width: 146, height: 57, rx: 6 }));
    node.append(svgEl(topic.kind === 'context' ? 'path' : 'circle', topic.kind === 'context' ? { class: 'node-mark', d: 'M-57,-5 L-52,0 L-57,5 L-62,0 Z' } : { class: 'node-mark', cx: -57, cy: 0, r: 4 }));
    node.append(svgEl('text', { class: 'node-date', x: -72, y: -37 }));
    node.append(svgEl('text', { class: 'node-title', x: -44, y: 4 }));
    node.addEventListener('click', () => selectTopic(topic.id, true));
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectTopic(topic.id, true); }
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const ordered = [...state.content.topics].filter(item => visible().has(item.id)).sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
        const index = ordered.findIndex(item => item.id === topic.id);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? ordered.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + ordered.length) % ordered.length;
        const target = ordered[next]; selectTopic(target.id); panToSelected(); nodes.get(target.id).focus();
      }
    });
    nodes.set(topic.id, node); nodeLayer.append(node);
  }
  const zoom = d3.zoom().scaleExtent([1, 8]).extent([[154, 0], [width, layout.height]]).translateExtent([[154, 0], [width, layout.height]])
    .filter(event => (!event.button && event.type !== 'wheel') || (event.type === 'wheel' && (event.ctrlKey || event.metaKey)))
    .on('start', () => svg.classList.add('is-dragging'))
    .on('end', () => svg.classList.remove('is-dragging'))
    .on('zoom', event => { state.transform = event.transform; positionGraph(); });
  graph = { svg, layout, nodes, grid, edgeLayer, axis, baseScale, zoom, width };
  d3.select(svg).call(zoom).on('dblclick.zoom', null);
  d3.select(svg).call(zoom.transform, oldTransform ?? d3.zoomIdentity);
  renderMapState();
}

function positionGraph() {
  if (!graph) return;
  const transform = state.transform ?? d3.zoomIdentity;
  const scale = transform.rescaleX(graph.baseScale); graph.scale = scale;
  const ticks = scale.ticks(Math.max(4, Math.floor((graph.width - 154) / 92))).filter(Number.isInteger);
  d3.select(graph.axis).call(d3.axisTop(scale).tickValues(ticks).tickFormat(d3.format('d')).tickSize(5));
  graph.grid.replaceChildren();
  for (const year of ticks) graph.grid.append(svgEl('line', { class: 'grid-line', x1: scale(year), x2: scale(year), y1: 65, y2: graph.layout.height - 15 }));
  for (const topic of state.content.topics) {
    const node = graph.nodes.get(topic.id); const position = graph.layout.nodes.get(topic.id);
    node.setAttribute('transform', `translate(${scale(topic.year)},${position.y})`);
    if (topic.yearEnd) {
      const line = node.querySelector('.range-mark'); line.setAttribute('x1', 0); line.setAttribute('x2', scale(topic.yearEnd) - scale(topic.year));
    }
  }
  renderEdges();
}

function renderEdges() {
  if (!graph || !graph.scale) return;
  graph.edgeLayer.replaceChildren();
  const selectedLane = topicById(state.selected)?.lane;
  graph.svg.style.setProperty('--selected-color', laneById(selectedLane)?.color ?? '#28634b');
  for (const edge of visibleConnections(state.content, visible())) {
    const start = graph.layout.nodes.get(edge.from), end = graph.layout.nodes.get(edge.to);
    const x1 = graph.scale(start.year), x2 = graph.scale(end.year);
    const selected = edge.from === state.selected || edge.to === state.selected;
    const sameRow = start.y === end.y;
    const direction = x2 >= x1 ? 1 : -1;
    let path;
    if (sameRow) path = `M${x1 + direction * 74},${start.y} C${x1 + direction * 95},${start.y - 32} ${x2 - direction * 95},${end.y - 32} ${x2 - direction * 77},${end.y}`;
    else {
      const down = end.y > start.y ? 1 : -1;
      const y1 = start.y + down * 29, y2 = end.y - down * 33, mid = (y1 + y2) / 2;
      path = `M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`;
    }
    graph.edgeLayer.append(svgEl('path', { d: path, class: `edge${state.selected ? selected ? ' is-connected' : ' is-muted' : ''}`, 'data-connection-id': edge.id, 'stroke-dasharray': RELATION_TYPES[edge.type].dash, 'marker-end': RELATION_TYPES[edge.type].directed ? `url(#arrow-${selected && selectedLane ? selectedLane : 'default'})` : null }));
  }
}

function renderMapState() {
  if (!graph) return;
  const current = visible(); const neighbors = new Set();
  for (const edge of visibleConnections(state.content, current)) {
    if (edge.from === state.selected) neighbors.add(edge.to);
    if (edge.to === state.selected) neighbors.add(edge.from);
  }
  for (const topic of state.content.topics) {
    const node = graph.nodes.get(topic.id); const open = current.has(topic.id); const selected = state.selected === topic.id;
    node.setAttribute('class', `node${!open ? ' is-locked' : selected ? ' is-selected' : neighbors.has(topic.id) ? ' is-connected' : state.selected ? ' is-muted' : ''}${state.newIds.has(topic.id) ? ' is-new' : ''}`);
    node.setAttribute('tabindex', open ? '0' : '-1');
    node.setAttribute('aria-disabled', String(!open)); node.setAttribute('aria-pressed', String(open && selected));
    node.setAttribute('aria-label', open ? `${topic.title}, ${topic.dateLabel}, ${topic.dateKind}, ${topic.kind === 'context' ? 'historical context' : 'course topic'}` : `Undiscovered topic in ${laneById(topic.lane).label}`);
    node.querySelector('title').textContent = open ? `${topic.title} · ${topic.dateLabel}\n${topic.tagline}` : 'A future lesson will reveal this topic.';
    node.querySelector('.node-date').textContent = open ? topic.dateLabel : '';
    const label = node.querySelector('.node-title'); label.replaceChildren();
    const lines = open ? topic.shortLabel.split('\n') : ['Undiscovered'];
    for (const [index, text] of lines.entries()) label.append(svgEl('tspan', { x: -44, y: lines.length === 1 ? 4 : -4 + index * 16 }, text));
    const range = node.querySelector('.range-mark'); if (range) range.style.display = open ? '' : 'none';
  }
  renderEdges();
}

function panToSelected() {
  if (!graph || !state.selected) return;
  const x = graph.scale(topicById(state.selected).year);
  if (x < 234 || x > graph.width - 85) {
    const center = (234 + graph.width - 85) / 2;
    d3.select(graph.svg).call(graph.zoom.translateBy, (center - x) / state.transform.k, 0);
  }
  // A small screen scrolls the full-size drawing rather than shrinking its text.
  const container = $('map-container');
  const selectedX = graph.scale(topicById(state.selected).year);
  if (container.clientWidth < graph.width && (selectedX < container.scrollLeft + 80 || selectedX > container.scrollLeft + container.clientWidth - 80)) container.scrollLeft = Math.max(0, selectedX - container.clientWidth / 2);
}

function setView(view) {
  state.view = view;
  $('map-container').hidden = view !== 'map'; $('topic-list').hidden = view !== 'list';
  $('map-view').setAttribute('aria-pressed', String(view === 'map')); $('list-view').setAttribute('aria-pressed', String(view === 'list'));
  document.querySelector('.zoom-controls').hidden = view !== 'map';
  if (view === 'map') setupGraph();
}

function followHash() {
  const id = topicIdFromHash(location.hash);
  if (!id) return;
  const topic = topicById(id);
  if (!topic) { announce('That topic link was not found. Showing the current lesson.'); return; }
  if (!visibleTopicIds(state.content, state.published).has(id)) {
    announce('That topic has not been revealed by your instructor yet.'); return;
  }
  if (!visible().has(id)) { state.checkpoint = state.published; state.visibleOverride = null; renderControls(); }
  selectTopic(id, false, false); panToSelected();
}

async function init() {
  try {
    const [contentResponse, progressResponse] = await Promise.all([fetch('./content.json', { cache: 'no-cache' }), fetch('./progress.json', { cache: 'no-cache' })]);
    if (!contentResponse.ok || !progressResponse.ok) throw new Error('The course content could not be loaded.');
    const [content, progress] = await Promise.all([contentResponse.json(), progressResponse.json()]);
    const errors = validateContent(content, progress);
    if (errors.length) throw new Error(`The course data needs a correction: ${errors[0]}`);
    state.content = content; state.published = checkpointIndex(content, progress.unlockedThrough); state.checkpoint = state.published;
    $('course-label').textContent = content.course;
    for (const [index, checkpoint] of content.checkpoints.entries()) {
      if (index > state.published) break;
      const option = el('option', '', `${String(index + 1).padStart(2, '0')} · ${checkpoint.label}`); option.value = String(index); $('checkpoint').append(option);
    }
    chooseDefault(); $('atlas-controls').hidden = false;
    setupGraph(); renderAll(); followHash();
    $('checkpoint').addEventListener('change', event => setCheckpoint(Number(event.target.value)));
    $('previous').addEventListener('click', () => setCheckpoint(state.checkpoint - 1));
    $('next').addEventListener('click', () => setCheckpoint(state.checkpoint + 1));
    $('replay').addEventListener('click', replayLesson);
    $('map-view').addEventListener('click', () => setView('map'));
    $('list-view').addEventListener('click', () => setView('list'));
    $('zoom-in').addEventListener('click', () => { if (graph) d3.select(graph.svg).call(graph.zoom.scaleBy, 1.5); });
    $('zoom-out').addEventListener('click', () => { if (graph) d3.select(graph.svg).call(graph.zoom.scaleBy, 1 / 1.5); });
    $('zoom-fit').addEventListener('click', () => { if (graph) { d3.select(graph.svg).call(graph.zoom.transform, d3.zoomIdentity); $('map-container').scrollLeft = 0; } });
    $('copy-link').addEventListener('click', async () => {
      if (!state.selected) return;
      const url = new URL(location.href); url.hash = `topic=${encodeURIComponent(state.selected)}`;
      try {
        await navigator.clipboard.writeText(url.href);
        announce('Topic link copied.'); $('copy-link').textContent = 'Link copied ✓';
        setTimeout(() => { $('copy-link').textContent = 'Copy topic link ↗'; }, 1800);
      } catch {
        history.replaceState(null, '', url.hash); announce('The topic link is in your address bar. Copy it from there.');
      }
    });
    window.addEventListener('hashchange', () => { if (state.replay) finishReplay(); followHash(); });
    let resizeTimer;
    new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (state.view === 'map') setupGraph(); }, 100); }).observe($('map-container'));
    document.documentElement.dataset.atlasReady = 'true';
  } catch (error) {
    console.error(error);
    $('atlas-controls').hidden = true;
    const box = $('load-error'); box.hidden = false;
    box.append(el('strong', '', 'The atlas could not open.'), el('p', '', `${error.message} Try reloading. If this continues, please let your instructor know.`));
    const retry = el('button', '', 'Reload atlas'); retry.type = 'button'; retry.addEventListener('click', () => location.reload()); box.append(retry);
    $('current-caption').textContent = 'Waiting for course content.';
  }
}
init();
