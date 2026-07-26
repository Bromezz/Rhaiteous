#!/usr/bin/env node
/*
 * CLI entrypoint for Rhaiteous (JSON → Rhai workflow compiler).
 * Delegates to the shared library used by tests and programmatic callers.
 */

//load the shared CLI implementation
import "../src/cli.js";
