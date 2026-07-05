import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { VirtualPlayer } from './actor.mjs';

export class AutotestRunner {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.results = [];
    this.players = [];
    this.startedAt = new Date().toISOString();
  }

  log(message) {
    console.log(`  ${message}`);
  }

  player(id, name) {
    const player = new VirtualPlayer({ baseUrl: this.baseUrl, id, name, log: (message) => this.log(message) });
    this.players.push(player);
    return player;
  }

  async step(name, action) {
    const started = Date.now();
    try {
      await action(assert);
      this.results.push({ name, status: 'passed', durationMs: Date.now() - started });
      console.log(`✓ ${name}`);
    } catch (error) {
      this.results.push({ name, status: 'failed', durationMs: Date.now() - started, error: error.message });
      console.error(`✗ ${name}: ${error.message}`);
      throw error;
    }
  }

  async runScenario(scenario) {
    console.log(`\n${scenario.name}`);
    await scenario.run(this);
  }

  async writeReport(file = 'artifacts/autotest-report.json') {
    const report = {
      target: this.baseUrl,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      passed: this.results.filter((result) => result.status === 'passed').length,
      failed: this.results.filter((result) => result.status === 'failed').length,
      steps: this.results,
    };
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return report;
  }

  close() {
    this.players.forEach((player) => player.disconnect());
  }
}
