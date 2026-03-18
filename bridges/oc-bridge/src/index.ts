#!/usr/bin/env node
import { Command } from "commander";
import { setupCommand } from "./cli/setup.js";
import { startCommand } from "./cli/start.js";
import { statusCommand } from "./cli/status.js";
import { stopCommand } from "./cli/stop.js";

const program = new Command();

program
  .name("oc-bridge")
  .description("Nexus Bridge client — connects local AI agents to Nexus")
  .version("1.0.0");

program.addCommand(setupCommand());
program.addCommand(startCommand());
program.addCommand(statusCommand());
program.addCommand(stopCommand());

program.parse();
