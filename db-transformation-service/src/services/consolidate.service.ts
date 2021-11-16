import { logger } from '../shared/logger';
import {getPodRelations} from "../providers/strapi/strapi.provider";
import { consolidateDeploymentFrequency } from '../consolidate_functions/deploymeny_frequency'
import { consolidateChangeFailureRate } from '../consolidate_functions/change_failure_rate';

const metricsToConsolidate: Record<string, Function> = {
  deployment_frequency: consolidateDeploymentFrequency,
  change_failure_rate: consolidateChangeFailureRate
};

export async function consolidateMetrics() {
  try {  
    const podRelations = await getPodRelations();
    logger.info(`Starting consolidate metrics for: ${podRelations.name}`);
    for(let metricName in metricsToConsolidate){
      logger.info(`Starting consolidate metric: ${metricName}`);
      const metricFn = metricsToConsolidate[metricName];
      await metricFn(metricName, podRelations);
      logger.info(`Finishing consolidate metric: ${metricName}`);  
    }
  } catch (err) {
    logger.error(err, `Error consolidating metrics`);
  }
}
