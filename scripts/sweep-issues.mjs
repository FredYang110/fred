import { readFile, writeFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const octoWebhookURL = process.env.OCTO_WEBHOOK_URL;
const statePath = "state/sweep-state.json";

if (!token || !repository) {
  throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
}

const apiRoot = `https://api.github.com/repos/${repository}`;
const trackedPrefixes = ["type:", "priority:", "status:", "resolution:"];

async function github(path) {
  const response = await fetch(`${apiRoot}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub Issue scan failed (${response.status}).`);
  }
  return response.json();
}

async function getAllIssues() {
  const issues = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/issues?state=all&sort=updated&direction=asc&per_page=100&page=${page}`);
    issues.push(...batch);
    if (batch.length < 100) return issues.filter((issue) => !issue.pull_request);
  }
}

function labelFamilies(labels) {
  const values = {};
  for (const prefix of trackedPrefixes) {
    values[prefix] = labels.find((label) => label.startsWith(prefix)) ?? null;
  }
  return values;
}

function snapshot(issue) {
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    updatedAt: issue.updated_at,
    labels: labelFamilies(issue.labels.map((label) => label.name)),
  };
}

function changedFamilies(before, after) {
  const changes = [];
  if (before.state !== after.state) changes.push(`状态 ${before.state} → ${after.state}`);
  for (const prefix of trackedPrefixes) {
    if (before.labels[prefix] !== after.labels[prefix]) {
      changes.push(`${prefix.slice(0, -1)} ${before.labels[prefix] ?? "无"} → ${after.labels[prefix] ?? "无"}`);
    }
  }
  return changes;
}

function safeText(value, limit = 160) {
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\`*_\[\]<>]/g, "\\$&")
    .trim()
    .slice(0, limit);
}

function renderEvent(event) {
  const heading = `Issue #${event.after.number}: ${safeText(event.after.title)}`;
  if (event.kind === "new") {
    const labels = Object.values(event.after.labels).filter(Boolean).join(" / ");
    return `${heading}\n新建并归档为 ${labels || "未分类"}。\n${event.after.url}`;
  }
  return `${heading}\n${event.changes.join("；")}。\n${event.after.url}`;
}

async function notifyOcto(events) {
  if (!octoWebhookURL) {
    throw new Error("OCTO_WEBHOOK_URL is required after the initial scan baseline is established.");
  }
  const content = [
    "需求池检测到需要处理的变更：",
    ...events.slice(0, 8).map(renderEvent),
    events.length > 8 ? `另有 ${events.length - 8} 项变更，请查看需求池。` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch(octoWebhookURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw new Error(`Octo notification failed (${response.status}); scan state was not persisted.`);
  }
}

const state = JSON.parse(await readFile(statePath, "utf8"));
const issues = await getAllIssues();
const nextIssues = {};
const events = [];

for (const issue of issues) {
  const after = snapshot(issue);
  const before = state.issues[String(issue.number)];
  if (state.initializedAt && !before) {
    events.push({ kind: "new", after });
  } else if (before) {
    const changes = changedFamilies(before, after);
    if (changes.length > 0) events.push({ kind: "changed", before, after, changes });
  }
  nextIssues[String(issue.number)] = after;
}

if (!state.initializedAt) {
  await writeFile(
    statePath,
    `${JSON.stringify({ schemaVersion: 1, initializedAt: new Date().toISOString(), issues: nextIssues }, null, 2)}\n`,
  );
} else if (events.length > 0) {
  await notifyOcto(events);
  await writeFile(
    statePath,
    `${JSON.stringify({ schemaVersion: 1, initializedAt: state.initializedAt, issues: nextIssues }, null, 2)}\n`,
  );
}

