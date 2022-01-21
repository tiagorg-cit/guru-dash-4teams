import { logger } from "../../shared/logger";
import { Post, Route,  } from "tsoa";
import { StatusCodes } from 'http-status-codes';
import { MetricsServiceResponse } from "../shared.controllers.types";
import { loadActionPlansByProject } from "../../providers/jira/queries/jira.actionPlans";
import { getDatasourceByProviderName } from "../../providers/strapi/strapi.provider";
import { IDataSource } from "../../shared/common.types";
import { IJiraMetadata, IJiraQuery } from "../../providers/jira/jira.types";
 
@Route("action-plan")  
export default class ActionPlanController {

    @Post("/:provider/project/:projectKey/reload")
    public async reloadActionPlansByProject(provider:string, projectKey: string): Promise<MetricsServiceResponse> {
        logger.info(`Calling POST: /${provider}/project/${projectKey}/reload`);
        const datasourcesByProvider: IDataSource[] = 
            await getDatasourceByProviderName(provider);
        if(datasourcesByProvider && datasourcesByProvider.length > 0){
            for(const datasource of datasourcesByProvider){
                try {
                    switch (provider) {
                        case "jira":
                            await reloadJira(projectKey, datasource);
                            break;
                        default:
                            throw new Error(`Provider ${provider} not implemented!`);
                    }
                } catch (err) {
                    return {
                        code: StatusCodes.UNPROCESSABLE_ENTITY,
                        error: {
                            message: err.message
                        }
                    }                   
                }
            }
        }    
        return {
            code: StatusCodes.OK
        };
    }
}

async function reloadJira(projectKey:string, datasource: IDataSource) {
    const actionPlanQueryType = "ACTION_PLAN";
    const jiraMetadata: IJiraMetadata = datasource.meta;
    const jiraQueries: IJiraQuery[] = jiraMetadata.queries;
    if(jiraQueries && jiraQueries.length > 0){
        for(const query of jiraQueries){
            const queryType: string = query.type;
            if(actionPlanQueryType === queryType){
                try{
                    await loadActionPlansByProject(jiraMetadata, query, projectKey);
                } catch (err) {
                    const msg: string = `Error while getting action plans for project key: ${projectKey}`;
                    logger.error(err, msg);
                    throw new Error(msg);
                } 
            }
        }
    }
}