#!/usr/bin/env node
import { main } from "../src/cli.js";

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(`crucible: ${err && err.message ? err.message : err}`);
    process.exit(2);
  }
);
