# Rhaiteous

[![npm](https://img.shields.io/npm/v/rhaiteous.svg?logoColor=CB3837&style=plastic&logo=npm&labelColor=silver&color=3269a0)](https://www.npmjs.com/package/rhaiteous)
[![license](https://img.shields.io/npm/l/rhaiteous.svg?style=plastic&labelColor=silver)](./LICENSE)

**Create complex workflows using JSON and Markdown** for [Grok Build](https://x.ai/) workflows.  
*A righteous way to author Grok Build workflows.*

With **Rhaiteous**, multi-agent pipelines are defined in straightforward, easy-to-understand JSON and Markdown prompt files. Rather than requiring a developer to manage yet another language, Rhaiteous compiles them into **Rhai** scripts under `.grok/workflows/` that Grok Build uses internally to execute its workflows.

# Documentation

This README contains two primary content sections:

1. **Content for All Audiences** — concepts, installation, use cases.
2. **Content for AI Agents** — portable project-rule text (for `AGENTS.md` / Grok rules) so an agent can set up and guide a host project without inventing a parallel system.

**Package:** [npmjs.com/package/rhaiteous](https://www.npmjs.com/package/rhaiteous)  
**Source & extended docs:** [github.com/Bromezz/Rhaiteous](https://github.com/Bromezz/Rhaiteous) (see especially [`docs/`](https://github.com/Bromezz/Rhaiteous/tree/main/docs))

---

# Content for All Audiences

The following content is intended for all audiences including AI agents.

## Rhaiteous Concepts

- Each Rhaiteous **workflow** is defined in its own (unshared) `workflow.json` file.
- The `workflow.json` file for each **workflow** resides in a **workflow pack** - a Rhaiteous term for a user-named subdirectory of the Rhaiteous project's `workflows/` directory.
- Several example **workflow packs** are copied into `workflows/` under the project root when you run **`npx rhaiteous init`** after installing with **npm** (see **Installation** below).  These can be cloned with the Rhaiteous `clonepack` command to create new packs that can be modified for experimentation or development. **NOTE:** The `workflows/` directory is excluded from revision control by default so that additional **workflow packs** may be added via **Git** as sub-projects for ease of cloning and management.
- **Workflows** operate by **routing** a single conversational **thread** between **stations** that are assignable to AI **agents**.
- **Stations** are similar to "roles," each with a specific area of responsibility (e.g. research, content generation, fact-checking, etc.)
- Each **station's** responsibilities are defined using its own Markdown **prompt** and JSON **schema** files (named as `<station-name>.prompt.md` and `<station-name>.schema.json` respectively) in the `stations` subdirectory of the **workflow pack**. Operational and behavioral guidance applicable to **all stations** lives in `common.prompt.md` (which has no corresponding `common.schema.json` file).
- Each **station** uses both Rhaiteous-standard and (optionally) user-defined **tools** to access and manipulate the **thread** during a **workflow run** (a single execution of the workflow).
- Each **station** adds its generated results/responses to the shared **thread** as a single **post** containing both mime-typed **content** and **attachments** before **routing** the thread to the next **station**.
- **Routing** is based on the `metadata.to` value in the performing station’s **post**
  - a named **station**
  - flow termination with an empty value (`[]` or `""`)
  - the station named by **`default_route`** in `workflow.json` if `metadata.to` is not present in the **post**.
- Rhaiteous **stations** are **re-entrant** - meaning they can be **routed** to more than once during a single **workflow run** - and can be configured to avoid endless loops.
- The **thread** for each **workflow run** is persisted (and continually updated by **stations**) in a `thread.json` file within a timestamp-named directory (e.g. "2026.09.05.18.47.33.134" in **yyyy.MM.dd.HH.mm.ss.SSS** format) under the **workflow pack's** `output/threads` subdirectory.
- Upon **run** completion, a **finalizer** script will be run if named in the `finalizer` property of `workflow.json` (e.g.`"finalizer": "finalize.mjs"`).

## Installation

### Requirements

To **compile** packs and **run** them you need:

| Requirement | Why |
|-------------|-----|
| **[Grok Build](https://x.ai/)** | Executes the compiled `.rhai` workflows (`/workflow …`). |
| **xAI account** | Sign-in / auth for Grok Build (and model usage under your plan). |
| **Node.js 18+** | Runs the Rhaiteous CLI and toolbox (developed on 24 LTS). |
| **[fnm](https://github.com/Schniz/fnm)** (recommended) | Fast Node version manager: use a different Node per directory via `.nvmrc` / `.node-version` when you juggle multiple projects. Not required if a single system Node 18+ is enough. |
| **npm** | Installs the `rhaiteous` package and runs `npx rhaiteous …` (ships with Node). |
| **npx** | Runs the project-local CLI from `node_modules` (part of npm). |
| **A project directory** | Grok workspace / git root where `package.json`, `./workflows/`, and `./.grok/workflows/` live. |

Rhaiteous itself has **no runtime npm dependencies** (Node standard library only). Station agents also use whatever tools Grok Build exposes (shell, file tools, etc.) according to each station’s capabilities.

Confirm with `node -v` and `npm -v` before installing (with **fnm**, `cd` into the project so the pinned version is active). Install Grok Build and complete xAI login per [xAI / Grok Build](https://x.ai/) docs if you have not already.

### Install and Verify

To install Rhaiteous and verify its successful installation, you'll clone and run an existing example workflow. 

The workflow is an example of re-entrant **routing** between **stations** that produces a classic **knock-knock joke** by orchestrating the interaction of two **stations** named "Joker" and "Audience":

- **Joker:** "Knock-knock"
- **Audience:** "Who's there?"
- **Joker:** "\<answer\>"
- **Audience:** "\<answer\> who?"
- **Joker:** "\<punchline\>"
- **Audience:** "\<laughter\>"

To perform this live confirmation, run the following commands in order from your **Grok / workflow project root**:

```bash
npm install --save-dev rhaiteous
npx rhaiteous --help
npx rhaiteous init
npx rhaiteous clonepack --source example-knock-knock --destination verify-joke
npx rhaiteous compile verify-joke
```
Here is what each command does:

- **`npm install --save-dev rhaiteous`** — installs the latest **Rhaiteous** npm package into this project. The `--save-dev` flag records it as a **devDependency** in `package.json`: a tool used to develop and build the project (here: compile workflows), not something your application ships to end users at runtime. Teammates and CI then install the same tooling with `npm install`.
- **`npx rhaiteous --help`** — recommended to **verify the CLI is available**. It prints a short confirmation and a link to the web README (no command reference).
- **`npx rhaiteous init`** — creates `./workflows/`, copies `example-*` seeds from the package, adjusts gitignore for host sandboxing as designed.
- **`npx rhaiteous clonepack --source example-knock-knock --destination verify-joke`** — (or `npx rhaiteous clonepack example-knock-knock verify-joke`) copies the knock-knock seed into a new pack named `verify-joke`, rewriting `workflow.json` paths, keeping `stations/` and sample `input/`, and omitting `output/` contents plus compile products. Fails if `verify-joke` already exists.
- **`npx rhaiteous compile verify-joke`** — compiles that clone into pack `workflow.rhai` + `workflow.md`, and publishes `.grok/workflows/verify-joke.rhai` for Grok discovery. On success it prints a confirmation listing the source and each path written, plus the `/workflow` command to run next.

Then open this project in **Grok Build** (workspace = the same project root). Compiled packs are discovered from `.grok/workflows/*.rhai`. Launch the clone:

```text
/workflow verify-joke {}
```

When the run finishes, open the durable **thread** under:

```text
workflows/verify-joke/output/threads/<yyyy.MM.dd.HH.mm.ss.SSS>/thread.json
```

You should see the Joker ⇄ Audience posts for a complete knock-knock exchange (ending with the Audience laugh). That confirms install, `clonepack`, compile, and a live `/workflow` run.

**Pin the Rhaiteous package version** when you want every machine to use the same release of the compiler/CLI (not “whatever latest happens to be”). That way teammates, CI, and a future `npm install` will not silently pick up a newer Rhaiteous major/minor. Record it in `package.json` by installing with an explicit version, for example: `npm install --save-dev rhaiteous@0.6.0`.

Rhaiteous is **currently designed to only be invoked from inside the project where it is installed** (typically `npx rhaiteous …` after `npm install --save-dev rhaiteous`). That keeps the compiler and the toolbox on paths that belong to the project. **Do not install it globally** (`npm install -g`) for normal use — a global CLI can stamp machine-specific toolbox paths into compiled workflows and break runs on other machines or in CI. A one-off `npx rhaiteous@latest …` without adding the package to this project is fine for a quick look at the CLI, not as the way you maintain a real workflow project.

### Common Use Case

A common use case for Rhaiteous looks like this:

A person has been assigned a **processing task** that's well-suited to previously-defined automation practices. For example:

- Analyze and produce structured reporting for one or more documents
- Collect, manipulate, and distribute data from one or more sources
- Implement a plan to handle new functional requirements for an application under active development

That person **clones** an existing **workflow pack** and runs it using relevant input:

1. **Clone a pack** — pick a seed or prior pack under `./workflows/` and copy it to a new name (`clone-name`), for example  
   `npx rhaiteous clonepack --source example-office-shopping --destination clone-name`.  
   Adjust station prompts and schemas only as needed for the task; leave `common.prompt.md` alone unless you intentionally change pack-wide station behavior.
2. **Supply source material** — open the clone’s `workflow.json` and read its **`args`**: those entries tell stations **where** to look for inputs (paths, directories, or other locators). Gather the files, notes, or other materials the task requires and put them at the locations those args describe (or update the args / pass matching `/workflow` launch args so they match where you placed the material).
3. **Compile the clone** — from the project root, run `npx rhaiteous compile clone-name`. Confirm the success summary lists the pack IR, `workflow.md`, and `.grok/workflows/clone-name.rhai`.
4. **Run the workflow** — in Grok Build (workspace = project root), launch `/workflow clone-name {…}`. When it finishes, inspect results under `workflows/clone-name/output/` (including `threads/<id>/thread.json` and any reports the stations wrote).
5. **Manage revision control** — create a **Git** repository for the clone (run `git init` in its pack directory) to make it a first-class **workflow pack** in which you can track changes and manage/swap versions. This allows packs (i.e. subdirectories of the `workflows/` directory) to be easily shared and cloned by other team members or even the general public (e.g. by placing them on GitHub).

## The `workflow.json` file

Top-level fields (summary):

| Field | Required | Role |
|-------|----------|------|
| `name` | yes | Grok workflow id (lowercase, digits, hyphens) |
| `description` | yes | Short summary |
| `stations` | yes | Ordered station list |
| `args` | no | Launch defaults / required args — including **where inputs live** (`station_dir`, `out_dir`, and any path args stations read) |
| `finalizer` | no | Optional pack script relative to the pack dir (e.g. `finalize.mjs`); run after the last station as `node <script> <thread.json>`. Omit / `""` / `false` to skip |
| `schemas` | no | Binding → schema file under the pack |
| `prompts` | no | Binding → Markdown under `stations/` (or legacy `prompts/`) |

Each **station** typically has `name`, `prompt` (binding list), `schemas`, optional `max_visits`, `default_route`, `capability_mode`, `uiDescription`. **`default_route`** is another station’s name used only when the returned post omits `metadata.to` (not when `to` is `[]`). After `clonepack`, `name` and path args already target `workflows/clone-name/…`; adjust other `args` when your source material lives elsewhere.

Full field reference: [`docs/workflow-json.md`](https://github.com/Bromezz/Rhaiteous/blob/main/docs/workflow-json.md).

## Schemas — where they live and what they are

Schemas are **JSON Schema** documents that define the shape of **structured attachments** on station posts (not the whole chat transcript).

By convention they live next to prompts:

```text
stations/intake.schema.json
```

and are declared in `workflow.json`:

```json
"schemas": {
  "intake": "intake.schema.json"
}
```

A station lists the bindings it may emit (`"schemas": ["intake"]`). At Init, schemas are loaded into the workflow context. Prefer one schema per station unless you have a clear reason to share.

Dialect notes and post shape: [`docs/workflow-json.md`](https://github.com/Bromezz/Rhaiteous/blob/main/docs/workflow-json.md).

## The common prompt — why not to touch it lightly

The shared file (usually `stations/common.prompt.md`, bound as `thread_common`) is **Operational Guidance**. Every station agent receives it **before** Input and Station Instructions.

It is the **shared contract** for how stations behave in this product model: workflow context, toolbox get/add, append vs replace, caps / benching, routing via `metadata.to`, and what not to freestyle (for example inventing a second persistence path).

**Do not edit the common prompt casually** when adapting a seed or maintaining a pack. Small wording changes can silently break every station’s assumptions. Change it only when you intentionally revise that shared contract for the whole pack — and then re-test every station.

Station-specific behavior belongs in **station prompts**, not in common.

## Creating and editing station prompts

Station prompts are Markdown files under `stations/` (for example `intake.prompt.md`), bound in `workflow.json` `prompts`, and listed on each station’s `prompt` array **after** the common binding:

```json
"prompt": ["thread_common", "intake"]
```

**Station Instructions** should cover that station’s job, what to read from context, what to write (attachments / schemas), and where to route next. They should **not** restate the entire Operational Guidance.

Practical approach (same arc as **Common Use Case**):

1. `npx rhaiteous clonepack --source example-office-shopping --destination clone-name` (or another seed / prior pack).
2. Align inputs with `workflow.json` **`args`**; edit station prompts and schemas as needed; leave `common.prompt.md` alone unless you intentionally change pack-wide behavior.
3. `npx rhaiteous compile clone-name`
4. `/workflow clone-name {…}` and inspect `workflows/clone-name/output/`

Examples and catalog: [`examples/README.md`](https://github.com/Bromezz/Rhaiteous/blob/main/examples/README.md).

## CLI (short)

```text
npx rhaiteous --help    # verify install; points at the web README
npx rhaiteous init
npx rhaiteous clonepack --source <pack> --destination clone-name
npx rhaiteous clonepack <source> clone-name
npx rhaiteous compile clone-name
npx rhaiteous compile clone-name --dry-run
```

Default IR path: `./.grok/workflows/clone-name.rhai`.  
CLI details: [`docs/cli-and-api.md`](https://github.com/Bromezz/Rhaiteous/blob/main/docs/cli-and-api.md).

## License and contributing

[MIT](./LICENSE). Contributors: [`CONTRIBUTING.md`](./CONTRIBUTING.md). Design notes: [`docs/design.md`](https://github.com/Bromezz/Rhaiteous/blob/main/docs/design.md).

Not affiliated with xAI. Grok Build is an xAI product; Rhaiteous is an independent helper for its workflow format.

---

# Content for AI Agents

The rest of this section is **designed to be placed** into an upper-level guidance file for the host project, for example:

- `AGENTS.md` at the project root, or
- `<project>/.grok/rules/RhaiteousGuidance.md` (Grok Build project rules)

**Do not write those files without the user’s approval.** During install, if a step must be done by the user, give clear instructions and wait.

After approval, copy **this entire “Content for AI Agents” section** (from this heading through the end of the section) into that guidance file so later sessions keep the same rules.

## GitHub documentation (required reading)

This npm README is enough to install and run. **Extended documentation lives on GitHub** and you must use it when guiding design, dialect, layout, or troubleshooting:

| Resource | URL |
|----------|-----|
| Repository | https://github.com/Bromezz/Rhaiteous |
| Docs index | https://github.com/Bromezz/Rhaiteous/tree/main/docs |
| Using in a Grok project | https://github.com/Bromezz/Rhaiteous/blob/main/docs/using-in-a-grok-project.md |
| Workflow JSON reference | https://github.com/Bromezz/Rhaiteous/blob/main/docs/workflow-json.md |
| CLI / API | https://github.com/Bromezz/Rhaiteous/blob/main/docs/cli-and-api.md |
| Design | https://github.com/Bromezz/Rhaiteous/blob/main/docs/design.md |
| Changelog | https://github.com/Bromezz/Rhaiteous/blob/main/CHANGELOG.md |

Open and read those pages (or clone/fetch the files) when the README summary is not enough. Prefer documented Rhaiteous behavior over inventing new layouts or persistence schemes.

npm package page (same README when published): https://www.npmjs.com/package/rhaiteous  
Homepage / README on GitHub: https://github.com/Bromezz/Rhaiteous#readme

## Requirements — gather before installing

Before installing or creating files, obtain from the user (ask clearly; do not assume):

1. **Project directory** — absolute or relative path where the workflow project should live (Grok workspace / git root).
2. **Project name** — folder name if creating a new directory.
3. **Git** — whether to `git init` the **host** project / use an existing repo (pack-level Git under `workflows/clone-name/` is a later Common Use Case step).
4. **Version policy** — latest **Rhaiteous package** vs a pinned `rhaiteous@x.y.z`.
5. **Approval** to write project rules (`AGENTS.md` or `.grok/rules/…`) after setup.

Confirm **Grok Build**, an **xAI account**, **Node.js 18+**, and **npm** (see **Installation → Requirements**). Recommend **fnm** when they juggle Node versions. If Node/npm is missing, explain how to install for their OS and confirm before continuing.

Work only inside the agreed project root. Invoke Rhaiteous via project-local `npx` after `npm install --save-dev rhaiteous` — **not** a global install. Do not scatter `workflows/` or thread output into an unrelated parent tree. Prefer documented Rhaiteous paths (`clonepack`, toolbox, `out_dir/threads`) over inventing parallel layouts.

## Installation instructions

Follow **Content for All Audiences → Installation → Install and Verify** in this README. In short, from the agreed project root:

```bash
npm init -y
npm install --save-dev rhaiteous@latest
npx rhaiteous --help
npx rhaiteous init
npx rhaiteous clonepack --source example-knock-knock --destination verify-joke
npx rhaiteous compile verify-joke
```

Then launch `/workflow verify-joke {}` and inspect `workflows/verify-joke/output/threads/<id>/thread.json`.

Re-read this README from `node_modules/rhaiteous/README.md` after install. Use GitHub `docs/` for anything beyond that.

## How to treat the user

- **Questions are questions.** If the user asks something, **answer it**. Do not treat a question as a call to action or an instruction to change the system unless they clearly ask you to act.
- **Seek approval before changes.** Do not edit project files, reconfigure git, rewrite prompts, or “fix” product behavior unless the user approved that change (or they have explicitly told you to act more autonomously for a defined scope). One approval is not a blank check for unrelated work.
- **No silent mid-run product fixes.** Change pack source and recompile; do not invent parallel tools or persistence.
- **Common prompt:** do not alter `common.prompt.md` / Operational Guidance without a stated reason and user approval — see All Audiences above.
- **New packs:** use **`clonepack`** from a seed or prior pack; do not hand-copy trees and forget to rewrite `workflow.json` paths.

## After you understand this README and requirements are met

When:

- you have read this README (and relevant GitHub docs as needed), and
- the requirements above are satisfied, and
- the user has approved proceeding with install,

then:

1. Install Rhaiteous in the agreed project root as above (including **`clonepack`** → `verify-joke` and **`compile verify-joke`**).
2. Inform the user that you are running **`verify-joke`** (cloned from knock-knock) as a **quick validation** of the installation.
3. Launch:

   ```text
   /workflow verify-joke {}
   ```

4. Report the result (success/failure). Show or summarize posts from `workflows/verify-joke/output/threads/<id>/thread.json` when present.
5. With approval, install this AI Agents section into `AGENTS.md` or `.grok/rules/RhaiteousGuidance.md`, and remind the user of the **Common Use Case** loop (`clonepack` → inputs per `args` → `compile clone-name` → `/workflow clone-name` → pack-level Git as they choose).

Ongoing guidance: help them follow **Common Use Case**, edit station prompts and schemas, recompile, run `/workflow`, interpret `output/`, and manage pack RCS — always preferring documented Rhaiteous behavior.
