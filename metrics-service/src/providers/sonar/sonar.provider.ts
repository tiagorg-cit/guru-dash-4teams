import { ISonarMeasureHistory, ISonarMeasure, ISonarMeasureResponse, ISonarMetadata } from './sonar.types';
import { InfluxDB, IPoint } from 'influx';
import { logger } from '../../shared/logger';
import axios from 'axios';

export async function getSonarMetrics(metadata: ISonarMetadata) {
  const result: IPoint[] = [];
  const stepInsert:Boolean = metadata?.stepInsert;
  let influxDBInstance: InfluxDB = new InfluxDB(process.env.INFLUXDB!);

  for (const project of metadata.projects) {
    logger.info(`Getting sonar measures for: ${project}`);

    let next = true;
    let page = 1;

    while (next) {
      page > 1 && logger.debug(`Getting next page: ${page}`);
      try {
        const res = await axios.post<ISonarMeasureResponse>(`${metadata.url}/api/measures/search_history?component=${project}&metrics=${metadata.metrics}&p=${page}`, {}, {
          auth: { username: metadata.key, password: '' }
        });
        
        for (const measure of res.data.measures) {
          result.push(...map(project, measure));
        }

        if(stepInsert){
          logger.info(`Writing InfluxDB points in BABY STEPS for PROJECT NAME: ${project}`);
          influxDBInstance.writePoints(result);
          result.length = 0;
        }

        next = page < res.data.paging.total / res.data.paging.pageSize;
        page++;
      } catch (err) {
        logger.error(err, `Error while get sonar information about project: ${project}`);
        next = false;
      }
    }
  }

  return result;
}

function map(project: string, measure: ISonarMeasure):IPoint[] {
  if(measure.metric === 'ncloc_language_distribution'){
    const allTechnologies:IPoint[] = [];
    for (let historyMeasure of measure.history.filter(registry => !!registry.value)){
      allTechnologies.push(...mapTechnologies(project, measure.metric, historyMeasure));
    }
    return allTechnologies;
  } else {
    return measure.history.filter(registry => !!registry.value).map(registry => ({
      measurement: measure.metric,
      tags: {
        project,
      },
      fields: {
        value: Number(registry.value) || 0,
        project: project
      },
      timestamp: new Date(registry.date),
    }));
  }
}

function mapTechnologies(project: string, measureName: string, registry: ISonarMeasureHistory):IPoint[] {      
  const technologies = registry.value.split(';');
  const allTechnologies:IPoint[] = [];

  const technologyNames = [];
  const technologyUsages = [];
  
  for(let technology of technologies){
    const splitedValue = technology.split('=')
    technologyNames.push(splitedValue[0]);
    technologyUsages.push(new Number(splitedValue[1]));
  }

  allTechnologies.push({
    measurement: measureName,
    tags: {
      project,
      technology: technologyNames.join(' | ') || '',
    },
    fields: {
      value: technologyUsages.join(' | ') || '',
      technology: technologyNames.join(' | ') || '',
      project: project
    },
    timestamp: new Date(registry.date),
  });

  return allTechnologies;
}