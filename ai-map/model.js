/** Pure data and course-state functions, shared by the browser and Node checks. */
export const RELATION_TYPES = {
  historical: { label: 'Historical influence', dash: null, directed: true },
  technical: { label: 'Technical relationship', dash: '7 5', directed: true },
  comparison: { label: 'Teaching comparison', dash: '2 5', directed: false }
};

export function validateContent(content, progress) {
  const errors = [];
  if (!content || typeof content !== 'object') return ['Content must be an object.'];
  const groups = ['lanes', 'checkpoints', 'sources', 'topics', 'connections'];
  for (const name of groups) {
    if (!Array.isArray(content[name])) errors.push(`${name} must be an array.`);
  }
  if (errors.length) return errors;
  const ids = {};
  for (const name of groups) {
    ids[name] = new Set();
    for (const item of content[name]) {
      if (!item || typeof item.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.id)) {
        errors.push(`${name}: invalid ID.`);
        continue;
      }
      if (ids[name].has(item.id)) errors.push(`${name}: duplicate ID ${item.id}.`);
      ids[name].add(item.id);
    }
  }
  const requireText = (value, where) => {
    if (typeof value !== 'string' || !value.trim()) errors.push(`${where}: text is required.`);
  };
  const checkSources = (refs, where, required = true) => {
    if (!Array.isArray(refs) || (required && !refs.length)) {
      errors.push(`${where}: citations are required.`);
      return;
    }
    for (const ref of refs) if (!ids.sources.has(ref)) errors.push(`${where}: unknown source ${ref}.`);
  };
  const checkDates = (item, where) => {
    if (!Number.isInteger(item.year) || item.year < -10000 || item.year > 3000) errors.push(`${where}: invalid year.`);
    if (item.yearEnd !== undefined && (!Number.isInteger(item.yearEnd) || item.yearEnd < item.year || item.yearEnd > 3000)) errors.push(`${where}: invalid date range.`);
  };
  requireText(content.title, 'title');
  requireText(content.course, 'course');
  if (!content.lanes.length || !content.topics.length || !content.checkpoints.length) errors.push('Lanes, topics, and checkpoints cannot be empty.');
  for (const lane of content.lanes) {
    requireText(lane.label, `lane ${lane.id}`);
    if (!/^#[0-9a-f]{6}$/i.test(lane.color)) errors.push(`lane ${lane.id}: use a six-digit hex color.`);
  }
  for (const checkpoint of content.checkpoints) {
    requireText(checkpoint.label, `checkpoint ${checkpoint.id}`);
    requireText(checkpoint.story, `checkpoint ${checkpoint.id} story`);
  }
  for (const source of content.sources) {
    requireText(source.title, `source ${source.id} title`);
    requireText(source.authors, `source ${source.id} authors`);
    checkDates(source, `source ${source.id}`);
    try {
      if (new URL(source.url).protocol !== 'https:') throw new Error();
    } catch { errors.push(`source ${source.id}: a valid HTTPS URL is required.`); }
  }
  for (const topic of content.topics) {
    const where = `topic ${topic.id}`;
    for (const field of ['title', 'shortLabel', 'dateLabel', 'dateKind', 'tagline', 'problem', 'idea', 'significance', 'history']) requireText(topic[field], `${where} ${field}`);
    if (!ids.lanes.has(topic.lane)) errors.push(`${where}: unknown lane.`);
    if (!ids.checkpoints.has(topic.unlockAt)) errors.push(`${where}: unknown checkpoint.`);
    if (!['course', 'context'].includes(topic.kind)) errors.push(`${where}: invalid kind.`);
    checkDates(topic, where);
    checkSources(topic.sources, where);
    if (!topic.example) errors.push(`${where}: an example is required.`);
    else for (const field of ['label', 'code', 'explanation']) requireText(topic.example[field], `${where} example ${field}`);
    for (const group of ['contributors', 'milestones']) {
      if (!Array.isArray(topic[group]) || !topic[group].length) errors.push(`${where}: ${group} are required.`);
      else for (const item of topic[group]) {
        checkSources(item.sources, `${where} ${group}`);
        if (group === 'milestones') {
          checkDates(item, `${where} milestone`);
          requireText(item.label, `${where} milestone label`);
          requireText(item.description, `${where} milestone description`);
        } else {
          requireText(item.name, `${where} contributor name`);
          requireText(item.role, `${where} contributor role`);
        }
      }
    }
  }
  for (const edge of content.connections) {
    const where = `connection ${edge.id}`;
    if (!ids.topics.has(edge.from) || !ids.topics.has(edge.to)) errors.push(`${where}: missing endpoint.`);
    if (edge.from === edge.to) errors.push(`${where}: self-connections are not supported.`);
    if (!Object.hasOwn(RELATION_TYPES, edge.type)) errors.push(`${where}: unknown relationship type.`);
    requireText(edge.label, `${where} label`);
    requireText(edge.explanation, `${where} explanation`);
    checkSources(edge.sources, where, edge.type !== 'comparison');
    if (edge.type === 'historical') requireText(edge.sourceNote, `${where} source location`);
  }
  if (progress && !ids.checkpoints.has(progress.unlockedThrough)) errors.push('Published progress refers to an unknown checkpoint.');
  return errors;
}

export function checkpointIndex(content, id) {
  const index = content.checkpoints.findIndex(checkpoint => checkpoint.id === id);
  if (index < 0) throw new Error(`Unknown checkpoint: ${id}`);
  return index;
}

export function visibleTopicIds(content, index) {
  const unlocked = new Set(content.checkpoints.slice(0, Math.max(0, index + 1)).map(checkpoint => checkpoint.id));
  return new Set(content.topics.filter(topic => unlocked.has(topic.unlockAt)).map(topic => topic.id));
}

export function visibleConnections(content, visibleIds) {
  return content.connections.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to));
}

export function lessonDiscoveries(content, index) {
  const before = visibleTopicIds(content, index - 1);
  return content.topics.filter(topic => visibleTopicIds(content, index).has(topic.id) && !before.has(topic.id));
}

export function topicIdFromHash(hash) {
  return new URLSearchParams(hash.replace(/^#/, '')).get('topic');
}

/** All topics participate, including silhouettes. Course state cannot move a node. */
export function computeLayout(content, plotSpan = 850) {
  const years = content.topics.flatMap(topic => [topic.year, topic.yearEnd ?? topic.year]);
  const firstYear = Math.floor((Math.min(...years) - 7) / 10) * 10;
  const lastYear = Math.ceil((Math.max(...years) + 7) / 10) * 10;
  const referenceX = year => (year - firstYear) / (lastYear - firstYear) * plotSpan;
  const nodes = new Map();
  const lanes = [];
  let top = 76;
  for (const lane of content.lanes) {
    const rowEnds = [];
    const members = content.topics.filter(topic => topic.lane === lane.id).sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
    for (const topic of members) {
      const x = referenceX(topic.year);
      let row = rowEnds.findIndex(end => x - end >= 166);
      if (row < 0) row = rowEnds.length;
      rowEnds[row] = x;
      nodes.set(topic.id, { year: topic.year, y: top + 62 + row * 84, row });
    }
    const height = 58 + Math.max(1, rowEnds.length) * 84;
    lanes.push({ ...lane, top, height });
    top += height;
  }
  return { firstYear, lastYear, nodes, lanes, height: top + 28 };
}
