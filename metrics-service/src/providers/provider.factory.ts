import {IDataSource} from "../shared/common.types";
import {InfluxDB} from "influx";
import {ProviderFunction} from "./provider.types";
import {logger} from "../shared/logger";

import {getAzureMetrics} from "./azure/azure.provider";
import {getBambooMetrics} from "./bamboo/bamboo.provider";
import {getSonarMetrics} from "./sonar/sonar.provider";
import {getStrapiMetrics} from "./strapi/strapi.provider";
import {getJiraMetrics} from "./jira/jira.provider";

const providers: Record<string, ProviderFunction> = {
  azure: getAzureMetrics,
  bamboo: getBambooMetrics,
  sonar: getSonarMetrics,
  strapi: getStrapiMetrics,
  jira: getJiraMetrics,
};

export async function providerFactory(datasource: IDataSource) {
  const provider = providers[datasource.provider]

  if (!provider) {
    throw new Error('Unimplemented provider ' + datasource.provider);
  }

  logger.info('Starting ' + datasource.name);
  const metrics = await provider(datasource.meta);
  
  if (metrics?.length > 0 && !datasource?.meta.stepInsert) {
    logger.info('Writing InfluxDB points for ' + datasource.name);
    logger.info('Finishing ' + datasource.name);
    return new InfluxDB(process.env.INFLUXDB!).writePoints(metrics);
  }
  logger.info('Finishing ' + datasource.name);
}
