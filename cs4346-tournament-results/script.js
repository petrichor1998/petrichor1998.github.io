(function () {
  "use strict";

  // Add an optional publicName later if a team adopts a public, non-identifying name.
  const TEAM_CONFIG = Object.freeze(
    Array.from({ length: 11 }, (_, index) =>
      Object.freeze({
        id: `T${String(index + 1).padStart(2, "0")}`,
        publicName: "",
      }),
    ),
  );

  const TEAM_IDS = new Set(TEAM_CONFIG.map((team) => team.id));
  const RESULT_CODES = new Set(["A", "B", "D"]);

  function loadRawResults(url = "./results.txt") {
    return fetch(url, { cache: "no-store" }).then((response) => {
      if (!response.ok) {
        throw new Error(`Results request failed with status ${response.status}.`);
      }
      return response.text();
    });
  }

  function extractMatchLines(rawText) {
    return String(rawText)
      .split(/\r?\n/)
      .map((line, index) => ({ lineNumber: index + 1, text: line.trim() }))
      .filter((line) => line.text.startsWith("MATCH|"));
  }

  function isValidDate(dateText) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function validateAndNormalize(candidate) {
    const fields = candidate.text.split("|");
    if (fields.length !== 6) {
      return { error: "Expected exactly six pipe-separated fields." };
    }

    const [recordType, teamA, teamB, game1, game2, date] = fields;

    if (recordType !== "MATCH") {
      return { error: "The record type must be MATCH." };
    }
    if (!TEAM_IDS.has(teamA) || !TEAM_IDS.has(teamB)) {
      return { error: "Team IDs must be in the range T01 through T11." };
    }
    if (teamA === teamB) {
      return { error: "A team cannot play itself." };
    }
    if (!RESULT_CODES.has(game1) || !RESULT_CODES.has(game2)) {
      return { error: "Game result codes must be A, B, or D." };
    }
    if (!isValidDate(date)) {
      return { error: "The date must be a real calendar date in YYYY-MM-DD format." };
    }

    return {
      record: Object.freeze({
        teamA,
        teamB,
        game1,
        game2,
        date,
        lineNumber: candidate.lineNumber,
      }),
    };
  }

  function canonicalMatchupKey(teamA, teamB) {
    return [teamA, teamB].sort().join("|");
  }

  function parseResults(rawText) {
    const candidates = extractMatchLines(rawText);
    const records = [];
    const diagnostics = [];
    const seenExactLines = new Set();
    const seenMatchups = new Set();

    candidates.forEach((candidate) => {
      if (seenExactLines.has(candidate.text)) {
        diagnostics.push({
          line: candidate.lineNumber,
          type: "exact-duplicate",
          message: "Ignored an exact duplicate result line.",
        });
        return;
      }
      seenExactLines.add(candidate.text);

      const validation = validateAndNormalize(candidate);
      if (validation.error) {
        diagnostics.push({
          line: candidate.lineNumber,
          type: "invalid",
          message: validation.error,
        });
        return;
      }

      const matchupKey = canonicalMatchupKey(
        validation.record.teamA,
        validation.record.teamB,
      );
      if (seenMatchups.has(matchupKey)) {
        diagnostics.push({
          line: candidate.lineNumber,
          type: "duplicate-matchup",
          message: `Ignored a second result for official pairing ${matchupKey.replace("|", " vs ")}.`,
        });
        return;
      }

      seenMatchups.add(matchupKey);
      records.push(validation.record);
    });

    return { records, diagnostics, candidateCount: candidates.length };
  }

  function createGame(record, gameNumber, white, black, resultCode) {
    const winner = resultCode === "D" ? null : resultCode === "A" ? record.teamA : record.teamB;
    const loser = winner === null ? null : winner === white ? black : white;

    return Object.freeze({
      gameNumber,
      white,
      black,
      winner,
      loser,
      isDraw: resultCode === "D",
    });
  }

  function matchupToGames(record) {
    return [
      createGame(record, 1, record.teamA, record.teamB, record.game1),
      createGame(record, 2, record.teamB, record.teamA, record.game2),
    ];
  }

  function createTeamStats() {
    return new Map(
      TEAM_CONFIG.map((team) => [
        team.id,
        {
          id: team.id,
          matches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          points: 0,
          white: { wins: 0, losses: 0, draws: 0 },
          black: { wins: 0, losses: 0, draws: 0 },
        },
      ]),
    );
  }

  function recordGameForTeam(teamStats, game) {
    const color = teamStats.id === game.white ? "white" : "black";
    const colorStats = teamStats[color];

    if (game.isDraw) {
      teamStats.draws += 1;
      teamStats.points += 0.5;
      colorStats.draws += 1;
    } else if (game.winner === teamStats.id) {
      teamStats.wins += 1;
      teamStats.points += 1;
      colorStats.wins += 1;
    } else {
      teamStats.losses += 1;
      colorStats.losses += 1;
    }
  }

  function calculateStatistics(records) {
    const statistics = createTeamStats();

    records.forEach((record) => {
      statistics.get(record.teamA).matches += 1;
      statistics.get(record.teamB).matches += 1;

      matchupToGames(record).forEach((game) => {
        recordGameForTeam(statistics.get(game.white), game);
        recordGameForTeam(statistics.get(game.black), game);
      });
    });

    return statistics;
  }

  function sortStandings(statistics) {
    return Array.from(statistics.values()).sort(
      (left, right) =>
        right.points - left.points ||
        right.wins - left.wins ||
        left.id.localeCompare(right.id),
    );
  }

  function teamLabel(teamId) {
    const team = TEAM_CONFIG.find((entry) => entry.id === teamId);
    return team && team.publicName ? `${team.id} — ${team.publicName}` : teamId;
  }

  function formatPoints(points) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(points);
  }

  function formatDate(dateText) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${dateText}T00:00:00Z`));
  }

  function appendCell(row, value, options = {}) {
    const cell = document.createElement(options.header ? "th" : "td");
    if (options.header) cell.scope = "row";
    if (options.className) cell.className = options.className;
    cell.textContent = String(value);
    row.appendChild(cell);
  }

  function renderStandings(statistics) {
    const body = document.getElementById("standings-body");
    const fragment = document.createDocumentFragment();

    sortStandings(statistics).forEach((team, index) => {
      const row = document.createElement("tr");
      appendCell(row, index + 1, { className: "rank-cell" });
      appendCell(row, teamLabel(team.id), { header: true });
      appendCell(row, team.matches);
      appendCell(row, team.wins);
      appendCell(row, team.losses);
      appendCell(row, team.draws);
      appendCell(row, formatPoints(team.points), { className: "points-cell" });
      fragment.appendChild(row);
    });

    body.replaceChildren(fragment);
  }

  function renderColorStatistics(statistics) {
    const body = document.getElementById("color-body");
    const fragment = document.createDocumentFragment();

    Array.from(statistics.values())
      .sort((left, right) => left.id.localeCompare(right.id))
      .forEach((team) => {
        const row = document.createElement("tr");
        appendCell(row, teamLabel(team.id), { header: true });
        appendCell(row, team.white.wins);
        appendCell(row, team.white.losses);
        appendCell(row, team.white.draws);
        appendCell(row, team.black.wins);
        appendCell(row, team.black.losses);
        appendCell(row, team.black.draws);
        fragment.appendChild(row);
      });

    body.replaceChildren(fragment);
  }

  function describeGame(game) {
    if (game.isDraw) {
      return `${teamLabel(game.white)} (White) drew with ${teamLabel(game.black)} (Black)`;
    }

    const winnerColor = game.winner === game.white ? "White" : "Black";
    const loserColor = game.loser === game.white ? "White" : "Black";
    return `${teamLabel(game.winner)} (${winnerColor}) defeated ${teamLabel(game.loser)} (${loserColor})`;
  }

  function renderOfficialResults(records) {
    const body = document.getElementById("results-body");
    const wrapper = document.getElementById("results-table-wrapper");
    const emptyState = document.getElementById("results-empty");
    const fragment = document.createDocumentFragment();

    body.replaceChildren();

    if (records.length === 0) {
      wrapper.hidden = true;
      emptyState.textContent = "No official results have been reported yet.";
      emptyState.hidden = false;
      return;
    }

    records.forEach((record) => {
      const row = document.createElement("tr");
      const games = matchupToGames(record);
      appendCell(row, formatDate(record.date));
      appendCell(row, `${teamLabel(record.teamA)} vs ${teamLabel(record.teamB)}`);
      appendCell(row, describeGame(games[0]));
      appendCell(row, describeGame(games[1]));
      fragment.appendChild(row);
    });

    body.appendChild(fragment);
    emptyState.hidden = true;
    wrapper.hidden = false;
  }

  function reportDiagnostics(diagnostics) {
    if (diagnostics.length === 0) return;

    console.groupCollapsed(
      `[Morris Tournament] ${diagnostics.length} result ${diagnostics.length === 1 ? "entry was" : "entries were"} ignored.`,
    );
    diagnostics.forEach((diagnostic) => {
      console.warn(
        `Line ${diagnostic.line} (${diagnostic.type}): ${diagnostic.message}`,
      );
    });
    console.groupEnd();
  }

  function renderNotice(message) {
    const notice = document.getElementById("data-notice");
    notice.textContent = message || "";
    notice.hidden = !message;
  }

  function renderTournament(records) {
    const statistics = calculateStatistics(records);
    renderStandings(statistics);
    renderColorStatistics(statistics);
    renderOfficialResults(records);
  }

  async function initialize() {
    const main = document.getElementById("tournament-content");
    renderTournament([]);
    document.getElementById("results-empty").textContent = "Loading official results…";

    try {
      const rawText = await loadRawResults();
      const parsed = parseResults(rawText);
      renderTournament(parsed.records);
      reportDiagnostics(parsed.diagnostics);
      renderNotice(
        parsed.diagnostics.length > 0
          ? "Some result entries could not be processed."
          : "",
      );
    } catch (error) {
      console.error("[Morris Tournament] Unable to load results.txt.", error);
      renderTournament([]);
      renderNotice(
        "Official results could not be loaded. Standings currently show zero values.",
      );
    } finally {
      main.setAttribute("aria-busy", "false");
    }
  }

  const testApi = Object.freeze({
    TEAM_CONFIG,
    extractMatchLines,
    validateAndNormalize,
    parseResults,
    matchupToGames,
    calculateStatistics,
    sortStandings,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = testApi;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
      initialize();
    }
  }
})();
