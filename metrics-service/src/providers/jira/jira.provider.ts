import { IJiraMetadata } from './jira.types';
import { jiraQueryFactory } from './jira.query.factory';
import { InfluxDB, IPoint } from 'influx';
import { logger } from '../../shared/logger';

const influxDBInstance: InfluxDB = new InfluxDB(process.env.INFLUXDB!);

export async function getJiraMetrics(metadata: IJiraMetadata) {
  const result: IPoint[] = [];
  const url:string = metadata.url
  const apiVersion:string = metadata.apiVersion
  const user:string = metadata.user
  const password:string = metadata.key
  const stepInsert:Boolean = metadata?.stepInsert;

  for (const query of metadata.queries) {
      const queryResults:IPoint[] = await jiraQueryFactory(url, apiVersion, user, password, query);
      try {
        parsePoints(queryResults);
        result.push(...queryResults);
        await influxDBInstance.dropMeasurement(query.name);
        if(stepInsert){
          await influxDBInstance.writePoints(queryResults);
        }
      } catch (e) {
        logger.error(`Error while validating data from ${query.name} query results to insert in database!`, e);
      } 
  }
  return result;
}

function parsePoints(results: IPoint[]){
  for(let result of results){
    influxDBInstance.parsePoint(result);  
  }
}
