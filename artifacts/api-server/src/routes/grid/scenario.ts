import type { Request, Response } from "express";
import { runScenario, SCENARIO_META, type ScenarioId } from "../../lib/scenarios";
import { logger } from "../../lib/logger";

const VALID_SCENARIOS: ScenarioId[] = [
  "ddos_surge", "cascade_failure", "zero_day", "power_outage", "ransomware_wave"
];

export async function runScenarioHandler(req: Request, res: Response) {
  const { scenario } = req.body as { scenario: string };

  if (!scenario || !VALID_SCENARIOS.includes(scenario as ScenarioId)) {
    res.status(400).json({
      error: `Invalid scenario. Valid options: ${VALID_SCENARIOS.join(", ")}`,
    });
    return;
  }

  try {
    const result = await runScenario(scenario as ScenarioId);
    res.json({
      scenario,
      scenarioName: result.scenarioName,
      affectedNodes: result.affectedNodes,
      message: `Scenario "${result.scenarioName}" executed. ${result.affectedNodes.length} node(s) affected.`,
    });
  } catch (err) {
    logger.error({ err }, "Scenario execution error");
    res.status(500).json({ error: "Failed to execute scenario" });
  }
}
