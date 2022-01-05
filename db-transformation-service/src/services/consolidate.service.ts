import { logger } from '../shared/logger';
import { getPodRelations, getGalaxyFromTo } from "../providers/strapi/strapi.provider";
import { consolidateDeploymentFrequency } from '../consolidate_functions/deploymeny_frequency'
import { consolidateChangeFailureRate } from '../consolidate_functions/change_failure_rate';
import { consolidateCycleTimePostDev } from '../consolidate_functions/cycle_time_post_dev';
import { consolidateMeanTimeToRecoverFromJira } from '../consolidate_functions/mean_time_to_recover_jira';
import { IGalaxyFromTo } from '../providers/strapi/strapi.types';

const metricsToConsolidateByPod: Record<string, Function> = {
  deployment_frequency: consolidateDeploymentFrequency,
  change_failure_rate: consolidateChangeFailureRate,
  cycle_time_post_dev: consolidateCycleTimePostDev,
};

const metricsToConsolidateByProduct: Record<string, any> = {
  mean_time_to_recover: {"jira": consolidateMeanTimeToRecoverFromJira},
};


export async function consolidateMetrics() {
  try {  
    consolidateByPod();
    consolidateByProduct();    
  } catch (err) {
    logger.error(err, `Error consolidating metrics`);
  }
}

async function consolidateByPod() {
  const podRelations = await getPodRelations();
  logger.info(`Starting consolidate metrics for: ${podRelations.name}`);
  if(podRelations){
    for(const metricName in metricsToConsolidateByPod){
      logger.info(`Starting consolidate metric: ${metricName}`);
      const metricFn = metricsToConsolidateByPod[metricName];
      await metricFn(metricName, podRelations);
      logger.info(`Finishing consolidate metric: ${metricName}`);  
    }
  }
  logger.info(`Finish to consolidate metrics for: ${podRelations.name}`);
}

async function consolidateByProduct() {
  const galaxyFromToEntries: IGalaxyFromTo[] = await getGalaxyFromTo();

  if(galaxyFromToEntries && galaxyFromToEntries.length > 0){
    for(const metricName in metricsToConsolidateByProduct){
      logger.info(`Starting consolidate metric: ${metricName}`);
      const fnByProvider = metricsToConsolidateByProduct[metricName];
      const functionAndEntry = getDatasourceFromProvider(fnByProvider, galaxyFromToEntries, metricName);
      await functionAndEntry.fn(metricName, functionAndEntry.entry);
      logger.info(`Finishing consolidate metric: ${metricName}`);  
    }
  }
}

function getDatasourceFromProvider(fnByProvider:any, galaxyFromToEntries: IGalaxyFromTo[], metricName: string): any {
    for(const entryProviderKey in fnByProvider){
      for(const galaxyFromToEntry of galaxyFromToEntries){
        if(entryProviderKey === galaxyFromToEntry.provider){
          return {
            "fn": fnByProvider[entryProviderKey],
            "entry": galaxyFromToEntry
          }
        }
      }
    }
    throw new Error(`No valid provider was found that can be used for metrics consolidation for metric: ${metricName}!`);
}
