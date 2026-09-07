import { readFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;

if (!token || !repository) {
  throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
}

const apiRoot = `https://api.github.com/repos/${repository}`;

async function request(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub label request failed (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

const labels = JSON.parse(await readFile("config/labels.json", "utf8"));
const existing = await request("/labels?per_page=100");
const existingNames = new Set(existing.map((label) => label.name));

for (const label of labels) {
  if (existingNames.has(label.name)) {
    await request(`/labels/${encodeURIComponent(label.name)}`, {
      method: "PATCH",
      body: JSON.stringify(label),
    });
  } else {
    await request("/labels", { method: "POST", body: JSON.stringify(label) });
  }
}

console.log(`Ensured ${labels.length} labels.`);

