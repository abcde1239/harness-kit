#!/usr/bin/env node
import { main } from '../src/cli.mjs';
import {assertRuntime} from '../src/runtime.mjs';
try {assertRuntime();process.exitCode=await main(process.argv.slice(2));}
catch(error){console.error(error.message);process.exitCode=2;}
