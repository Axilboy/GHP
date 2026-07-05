import { AutotestRunner } from './core/runner.mjs';
import { startLocalServer, waitForServer } from './core/server.mjs';
import { siteSmokeScenario } from './scenarios/site-smoke.mjs';
import { spyClassicScenario } from './scenarios/spy-classic.mjs';
import { profileStoreScenario } from './scenarios/profile-store.mjs';

const targetArgument = process.argv.find((argument) => argument.startsWith('--target='));
const externalTarget = targetArgument?.slice('--target='.length);
const localPort = Number(process.env.AUTOTEST_PORT || 3299);
let server;
let runner;

try {
  server = externalTarget ? { baseUrl: externalTarget.replace(/\/$/, ''), stop: () => {} } : await startLocalServer(localPort);
  await waitForServer(server.baseUrl);
  runner = new AutotestRunner(server.baseUrl);
  await runner.runScenario(siteSmokeScenario);
  await runner.runScenario(spyClassicScenario);
  await runner.runScenario(profileStoreScenario);
  const report = await runner.writeReport();
  console.log(`\nГотово: ${report.passed} проверок пройдено, отчёт: artifacts/autotest-report.json`);
} catch (error) {
  if (runner) await runner.writeReport();
  console.error(`\nАвтотест остановлен: ${error.message}`);
  process.exitCode = 1;
} finally {
  runner?.close();
  server?.stop();
}
