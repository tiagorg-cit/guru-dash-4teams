import { logger } from '../shared/logger';
import {getPodRelations} from "../providers/strapi/strapi.provider";
import { consolidateDeploymentFrequency } from '../consolidate_functions/deploymeny_frequency'

const metricsToConsolidate: Record<string, Function> = {
  deployment_frequency: consolidateDeploymentFrequency
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
