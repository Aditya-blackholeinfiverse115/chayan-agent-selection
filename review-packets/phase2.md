# Phase 2 Review Packet — chayan-agent-selection

---

## 1. Entry Point

```
node src/pipeline.demo.js
```

`pipeline.demo.js` feeds five mock intents into `runPipeline()` and prints the
three-stage log (intent → selection → proposal) for each one.

---

## 2. Three Core Files

| File | Role |
|---|---|
| `src/taskMap.js` | Static lookup table — maps task strings to ordered agent-ID arrays. Zero logic. |
| `src/selectAgents.js` | Layer-1 (Chayan). Reads the task from the intent, looks it up in `TASK_MAP`, returns a structured `agent_selection_output`. Makes no decisions. |
| `src/pipeline.js` | Orchestrator. Calls `selectAgents`, then `buildActionProposal` (inline), returns a single log object `{ intent, selection, proposal }`. |

---

## 3. Live Flow

```
Intent (actor, action, context.task)
        │
        ▼
  selectAgents()          ← taskMap lookup only
        │
        ▼
  agent_selection_output  ← { actor, action, agents, sequence, context }
        │
        ▼
  buildActionProposal()   ← registry lookup + structural validation
        │
        ▼
  ActionProposal          ← { constraints, governance_request }
        │
        ▼
  runPipeline log         ← { intent, selection, proposal }
```

`selectAgents` never touches the registry or validates lifecycle state.
`buildActionProposal` never touches `TASK_MAP` or decides which agents to use.
The boundary is strict.

---

## 4. Sample JSON

### 4a. Intent Input

```json
{
  "actor": "intent-router",
  "action": "task.route",
  "context": { "task": "summarize-and-format" }
}
```

### 4b. agent_selection_output

```json
{
  "actor": "intent-router",
  "action": "task.route",
  "agents": ["1", "2"],
  "sequence": ["1", "2"],
  "context": { "task": "summarize-and-format" }
}
```

### 4c. ActionProposal output — valid path

```json
{
  "actor": "intent-router",
  "action": "task.route",
  "agents": ["1", "2"],
  "sequence": ["1", "2"],
  "constraints": { "lifecycle_valid": true },
  "context": { "task": "summarize-and-format" },
  "governance_request": {
    "actor": "intent-router",
    "action": "task.route",
    "resource": ["1", "2"],
    "context": { "task": "summarize-and-format" }
  }
}
```

### 4d. ActionProposal output — suspended agent (classify-and-format → agent 4)

```json
{
  "actor": "intent-router",
  "action": "task.route",
  "agents": ["4", "2"],
  "sequence": ["4", "2"],
  "constraints": { "lifecycle_valid": false },
  "context": { "task": "classify-and-format" },
  "governance_request": null
}
```

---

## 5. Failure Cases

| Case | Trigger | Observed behaviour |
|---|---|---|
| Suspended agent | `classify-and-format` → agent 4 (`lifecycle_state: "Suspended"`) | `constraints.lifecycle_valid: false`, `governance_request: null` |
| Unknown task | `context.task: "unknown.task"` | `agents: []`, `sequence: []`, proposal still emits with empty resource list |
| Unresolvable agent ID | Any ID not in `REGISTRY` | `getAgentById` returns `null`; proposal sets `lifecycle_valid: false`, `governance_request: null` |
| Duplicate agents | Same ID appears twice in a sequence | `validateStructure` pushes `DUPLICATE_AGENTS` error; proposal blocked |
| Forbidden chain | Agent 3 immediately followed by agent 1, or agent 6 by agent 2 | `validateStructure` pushes `INVALID_CHAIN` error; proposal blocked |

---

## 6. Proof — Test Run

```
> chayan-agent-selection@0.1.0 test
> vitest run

 ✓ src/pipeline.test.js    (6 tests)
 ✓ src/selectAgents.test.js (6 tests)

 Test Files  2 passed (2)
       Tests  12 passed (12)
    Duration  409ms
```

All 12 tests pass. Tests cover:

- `TC-01 – TC-03` correct agent mapping for three known tasks
- `TC-04` empty arrays for unknown task
- `TC-05` output shape contract
- `TC-06` `sequence` is an independent copy (mutation isolation)
- `TC-R01 – TC-R03` determinism across 10 replays for valid tasks
- `TC-R04` determinism + `lifecycle_valid: false` + `governance_request: null` for suspended agent
- `TC-R05` determinism + empty agents for unknown task
- `TC-R06` log always contains all three stages

---

## 7. 5-Minute Demo Script

### System Split (0:00 – 1:00)

The system is split into two layers with a hard contract between them.

- Layer-1 (Chayan / `selectAgents`) — selection only. Given a task string, it
  returns an ordered list of agent IDs. It has no knowledge of agent state,
  registry, or governance.
- Layer-2 (Sūtradhāra / `buildActionProposal`) — structural validation and
  proposal construction. It resolves IDs against the registry, checks lifecycle
  state and chain rules, and either emits a `governance_request` or blocks with
  `lifecycle_valid: false`.

### Pipeline Flow (1:00 – 3:00)

Walk through `pipeline.demo.js` output live:

1. Intent arrives with `context.task`.
2. `selectAgents` does a single `TASK_MAP` lookup — no branching, no registry
   call.
3. `agent_selection_output` is handed to `buildActionProposal`.
4. `buildActionProposal` resolves each ID, runs `validateStructure`, and
   returns the proposal.
5. `runPipeline` wraps all three stages into one log object.

Show the `classify-and-format` case: selection succeeds (agents `["4","2"]`),
but the proposal is blocked because agent 4 is `Suspended`.

### Why Decision Was Removed from Chayan (3:00 – 5:00)

In an earlier version, `selectAgents` also checked lifecycle state and returned
an error when an agent was suspended. That was wrong for two reasons:

1. Selection and validation are different concerns. Selection answers "which
   agents?". Validation answers "are they safe to use?". Mixing them means a
   single function has two reasons to change.
2. It made `selectAgents` depend on the registry. The registry is a runtime
   concern; the task map is a configuration concern. Coupling them breaks
   testability — you can no longer test selection without mocking agent state.

Removing the decision from Chayan means `selectAgents` is a pure function of
its input. It can be tested, replayed, and reasoned about in isolation.

---

## 8. Short Reflection

### What changed in your thinking?

Initially I thought "selection" included fitness — pick agents and verify they
can run. That felt complete. What changed is understanding that selection is
only about identity (which agents, in what order), and fitness is a separate
gate that belongs downstream. The moment you mix them, you've created a
function that knows too much.

### Where did you overstep earlier?

I put lifecycle validation inside `selectAgents`. That was overstepping because
`selectAgents` is supposed to be a pure lookup. Adding a registry call gave it
a second dependency and a second failure mode. It also meant the output of
selection was already partially decided — a suspended agent would never even
appear in the list, which hides information from the layer that should be
making that call.

### Why separation matters?

Because each layer should have exactly one reason to change. If the task
mapping changes, only `taskMap.js` changes. If the validation rules change
(new forbidden chains, new lifecycle states), only `buildActionProposal`
changes. If the selection contract changes, only `selectAgents` changes. When
the layers are mixed, every change touches multiple places and every test
requires the full stack to be set up.
