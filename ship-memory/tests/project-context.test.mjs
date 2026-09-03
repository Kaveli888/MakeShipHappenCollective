import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ShipMemory } from "../packages/core/dist/index.js";
import { nodeFs } from "../packages/core/dist/node-fs.js";
import { connectContext } from "../packages/mcp/dist/context.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const cli = fileURLToPath(new URL("../packages/cli/dist/index.js", import.meta.url));
const mcp = fileURLToPath(new URL("../packages/mcp/dist/index.js", import.meta.url));

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "ship-memory-project-context-"));
  const project = join(root, "Future Project");
  const secondProject = join(root, "Another Project");
  const store = join(root, "store");
  await mkdir(project);
  await mkdir(secondProject);
  return { root, project, secondProject, store };
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    env: { ...process.env },
  });
}

test("existing flat hubs keep cross-agent create/read behavior", async (t) => {
  const { root } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = await ShipMemory.create(join(root, "legacy"), nodeFs);
  await first.create({ title: "Existing Workflow", body: "Saved by agent A." });
  const second = await ShipMemory.open(join(root, "legacy"), nodeFs);
  assert.match((await second.read("existing-workflow")).body, /agent A/);
});

test("connect creates an isolated project hub and curated entry context", async (t) => {
  const { root, project, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = runCli(["connect", project, "--store", store]);
  assert.equal(result.status, 0, result.stderr);
  const hub = join(store, "future-project", ".shipmemory");
  assert.equal(await realpath(join(project, ".shipmemory")), await realpath(hub));
  assert.match(await readFile(join(hub, "index.md"), "utf8"), /status: draft/);
  const context = await connectContext(project);
  assert.equal(context.connected, true);
  assert.equal(context.configured, true);
  assert.equal(context.project, "future-project");
  assert.equal(context.entry.slug, "index");
});

test("dry-run performs no writes", async (t) => {
  const { root, project, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = runCli(["connect", project, "--store", store, "--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  await assert.rejects(realpath(join(project, ".shipmemory")));
  await assert.rejects(realpath(store));
});

test("connect refuses collisions and never replaces an existing project path", async (t) => {
  const { root, project, secondProject, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal(runCli(["connect", project, "--store", store]).status, 0);
  const collision = runCli([
    "connect",
    secondProject,
    "--name",
    "Future Project",
    "--store",
    store,
  ]);
  assert.notEqual(collision.status, 0);
  assert.match(collision.stderr, /--attach-existing/);

  await mkdir(join(secondProject, ".shipmemory"));
  const protectedPath = runCli([
    "connect",
    secondProject,
    "--name",
    "Different Project",
    "--store",
    store,
  ]);
  assert.notEqual(protectedPath.status, 0);
  assert.match(protectedPath.stderr, /Refusing to replace/);
});

test("connect_context does not reinterpret a legacy hub without index.md", async (t) => {
  const { root } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const memory = await ShipMemory.create(join(root, "legacy"), nodeFs);
  await memory.create({ title: "Legacy Note", body: "Keep this unchanged." });
  const context = await connectContext(join(root, "legacy"));
  assert.equal(context.connected, true);
  assert.equal(context.configured, false);
  assert.equal(context.count, 1);
});

test("MCP starts, advertises connect_context, and exits with its client", async () => {
  const client = new Client({ name: "ship-memory-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcp],
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "connect_context"));
  } finally {
    await client.close();
  }
});

test("one MCP agent can save and a fresh MCP agent can read the same memory", async (t) => {
  const { root } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, "existing-terminal-workflow");
  await ShipMemory.create(project, nodeFs);

  const first = new Client({ name: "agent-a", version: "1.0.0" });
  const firstTransport = new StdioClientTransport({
    command: process.execPath,
    args: [mcp],
    stderr: "pipe",
  });
  try {
    await first.connect(firstTransport);
    const saved = await first.callTool({
      name: "create_memory",
      arguments: {
        cwd: project,
        title: "Cross Terminal Context",
        body: "Saved through agent A and available to agent B.",
      },
    });
    assert.notEqual(saved.isError, true);
  } finally {
    await first.close();
  }

  const second = new Client({ name: "agent-b", version: "1.0.0" });
  const secondTransport = new StdioClientTransport({
    command: process.execPath,
    args: [mcp],
    stderr: "pipe",
  });
  try {
    await second.connect(secondTransport);
    const loaded = await second.callTool({
      name: "read_memory",
      arguments: { cwd: project, identifier: "cross-terminal-context" },
    });
    const text = loaded.content.find((item) => item.type === "text")?.text ?? "";
    assert.match(text, /available to agent B/);
  } finally {
    await second.close();
  }
});
