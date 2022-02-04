import { logger } from '../shared/logger';
import { IPoint } from "influx";
import { IPodRelations, IPodRelationsMetaItem } from "../providers/strapi/strapi.types";
import { 
    IDeploymentIntervalLastPeriodMeasureResponse, 
    IDeploymentIntervalLastPeriodMeasure 
} from "../database/database.types";
import { getMeanOfDeploysByRepositoryIdsForLastDays } from "../database/database.deploy";
import { dropMeasurement, parsePoints, save } from "../database/database.functions";

const LAST_PERIOD_IN_DAYS = 90;


export async function consolidateCycleTimePostDevLastPeriod(metricName: string, 
    podRelations: IPodRelations){
    try{
        if(podRelations?.meta?.relations?.length > 0){
            const pointsToSave: IPoint[] = [];
            for(let relation of podRelations?.meta?.relations){
                const idRepositories = relation.idRepositories;
                if(idRepositories && idRepositories.length > 0){
                    const deploymentIntervalOnLastDays:IDeploymentIntervalLastPeriodMeasureResponse | null = 
                        await getMeanOfDeploysByRepositoryIdsForLastDays(LAST_PERIOD_IN_DAYS, idRepositories);
                    if(deploymentIntervalOnLastDays && deploymentIntervalOnLastDays.deploymentIntervalForLastDays){
                        logger.debug(`For POD ${relation.podName}, the Deployment Interval in Last Period query: ${deploymentIntervalOnLastDays.deploymentIntervalForLastDays}`);    
                        const pointToSave: IPoint = 
                            getPoint(metricName, relation, deploymentIntervalOnLastDays.deploymentIntervalForLastDays);
                        pointsToSave.push(pointToSave);    
                    } 
                }
            }
            if(pointsToSave.length > 0){
                parsePoints(pointsToSave);
                await dropMeasurement(metricName);
                await save(pointsToSave);
            }
        }
    } catch (err) {
        logger.error(err, `Error consolidating metric ${metricName} for: ${podRelations.name}`);
    }
}

/* With all succeeded deploys for this POD we can persist in databse, calculating 
    the deployment interval in last period 
    using the rational: mean of <duration of deployments in period> */
function getPoint(metricName: string, relation:IPodRelationsMetaItem, meanOfDeploymentIntervalInLastPeriod:number): IPoint {      
    //Return IPoint in InfluxDB the measurement with deployment frequency in period defined above.
    return mapDeploymentIntervalLastPeriod(
        metricName, 
        {
        "productId": relation.productId,
        "productName": relation.productName,
        "valueStreamId": relation.valueStreamId,
        "valueStreamName": relation.valueStreamName,
        "podId": relation.podId,
        "podName": relation.podName,
        "meanOfDeploymentIntervalInLastPeriod": meanOfDeploymentIntervalInLastPeriod || null,
        "time": new Date()
        }
    );
}

function mapDeploymentIntervalLastPeriod(metricName: string, measure: IDeploymentIntervalLastPeriodMeasure):IPoint {
    return {
      measurement: metricName,
      tags: {
        podName: measure.podName,
        valueStreamName: measure.valueStreamName,
        productName: measure.productName,
      },
      fields: {
        productId: measure.productId,
        valueStreamId: measure.valueStreamId,
        podId: measure.podId,
        meanOfDeploymentIntervalInLastPeriod: measure.meanOfDeploymentIntervalInLastPeriod
      },
      timestamp: measure.time
    };
  }