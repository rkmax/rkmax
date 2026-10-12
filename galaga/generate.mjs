#!/usr/bin/env node
// Usage: node galaga/generate.mjs --user <login> --out <dir> [--input calendar.json]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { renderSvg } from "./render.mjs";

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { date weekday contributionCount contributionLevel } }
      }
    }
  }
}`;

async function fetchCalendar(login) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required to query the contribution calendar");
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(`GitHub GraphQL request failed: ${JSON.stringify(payload.errors ?? payload)}`);
  }
  return payload.data.user.contributionsCollection.contributionCalendar;
}

const { values } = parseArgs({
  options: {
    user: { type: "string" },
    out: { type: "string", default: "dist" },
    input: { type: "string" },
  },
});
if (!values.user) throw new Error("--user is required");

const calendar = values.input
  ? JSON.parse(await readFile(values.input, "utf8"))
  : await fetchCalendar(values.user);

await mkdir(values.out, { recursive: true });
await writeFile(join(values.out, "galaga.svg"), renderSvg(calendar, { user: values.user, theme: "light" }));
await writeFile(join(values.out, "galaga-dark.svg"), renderSvg(calendar, { user: values.user, theme: "dark" }));
