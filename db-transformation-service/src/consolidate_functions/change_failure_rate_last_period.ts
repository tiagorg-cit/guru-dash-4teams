import { logger } from '../shared/logger';
import { IPoint } from "influx";
import { IPodRelations, IPodRelationsMetaItem } from "../providers/strapi/strapi.types";
import { 
    IChangeFailureRateLastPeriodMeasureResponse, 
    ITotalDeploysLastPeriodMeasureResponse,
    IChangeFailureRateLastPeriodMeasure 
} from "../database/database.types";
import { 
    getAllFailedDeploysByRepositoryIdsForLastDays, 
    getAllDeploysByRepositoryIdsForLastDays 
} from "../database/database.deploy";
import { dropMeasurement, parsePoints, save } from "../database/database.functions";

const LAST_PERIOD_IN_DAYS = 90;

export async function consolidateChangeFailureRateLastPeriod(metricName: string, 
    podRelations: IPodRelations){
    try{
        if(podRelations?.meta?.relations?.length > 0){
            const pointsToSave: IPoint[] = [];
            for(let relation of podRelations?.meta?.relations){
                const idRepositories = relation.idRepositories;
                if(idRepositories && idRepositories.length > 0){
                    const allDeploysInLastDays:ITotalDeploysLastPeriodMeasureResponse | null = 
                        await getAllDeploysByRepositoryIdsForLastDays(LAST_PERIOD_IN_DAYS, idRepositories);
                    if(allDeploysInLastDays){
                        const qtDeploysInPeriod = allDeploysInLastDays.qtDeploysInPeriod;
                        if(qtDeploysInPeriod && qtDeploysInPeriod > 0){
                            logger.debug(`For POD ${relation.podName}, all deployments in Last Period query: ${qtDeploysInPeriod}`);    
                            const allFailedDeploysInLastDays:IChangeFailureRateLastPeriodMeasureResponse | null = 
                                await getAllFailedDeploysByRepositoryIdsForLastDays(LAST_PERIOD_IN_DAYS, idRepositories);
                            const numberOfFailedDeploys = allFailedDeploysInLastDays?.failedDeploysOnPeriod || 0;
                            const pointToSave: IPoint = 
                                getPoint(metricName, relation, qtDeploysInPeriod, numberOfFailedDeploys);
                            pointsToSave.push(pointToSave);    
                        }
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

/* With all deploys and all failed deploys for this POD we can persist in databse, calculating 
    the change failure rate in last period 
    using the rational: 100-((<number of succeeded deploys in period>/<number of all deployments in period>)*100) */
function getPoint(metricName: string, relation:IPodRelationsMetaItem, qtDeploysInPeriod:number, numberOfFailedDeploys:number): IPoint {      
    //Return IPoint in InfluxDB the measurement with deployment frequency in period defined above.
    const succeededDeploys = qtDeploysInPeriod - numberOfFailedDeploys;
    const changeFailureRate: number = 100-((succeededDeploys/qtDeploysInPeriod)*100);
    return mapChangeFailureRateLastPeriod(
        metricName, 
        {
        "productId": relation.productId,
        "productName": relation.productName,
        "valueStreamId": relation.valueStreamId,
        "valueStreamName": relation.valueStreamName,
        "podId": relation.podId,
        "podName": relation.podName,
        "qtDeploysInPeriod": qtDeploysInPeriod,
        "numberOfSucceededDeploysInPeriod": succeededDeploys,
        "numberOfFailedDeploysInPeriod": numberOfFailedDeploys,
        "changeFailureRateInLastPeriod": changeFailureRate,
        "time": new Date()
        }
    );
}

function mapChangeFailureRateLastPeriod(metricName: string, measure: IChangeFailureRateLastPeriodMeasure):IPoint {
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
        qtDeploysInPeriod: measure.qtDeploysInPeriod,
        numberOfSucceededDeploysInPeriod: measure.numberOfSucceededDeploysInPeriod,
        numberOfFailedDeploysInPeriod: measure.numberOfFailedDeploysInPeriod,
        changeFailureRateInLastPeriod: measure.changeFailureRateInLastPeriod,
      },
      timestamp: measure.time
    };
  }