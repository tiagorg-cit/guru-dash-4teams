import { IJiraQueryCustomField, IJiraQuery } from '../jira.types';
import { getJiraQuerySearchUrl } from './jira.queryUtils';
import { getQuery } from '../jira.send';
import { IPoint } from 'influx';
import { logger } from '../../../shared/logger';

const actionPlanProjectsVariable = "actionPlanProjects";

export async function getJiraActionPlans(url: string, apiVersion: string, authUser: string, authPass:string, jiraQuery: IJiraQuery): Promise<IPoint[]> {
    const result: IPoint[] = [];
    const fieldVariables: any = jiraQuery?.variables || {};
    const actionPlanProjects: string[] = fieldVariables[actionPlanProjectsVariable];

    if(jiraQuery?.filter.indexOf("?") > -1){
        if(actionPlanProjects && actionPlanProjects.length > 0){
            for(const actionPlanProjectKey of actionPlanProjects){
                try {
                    result.push(...await getActionPlans(
                        getJiraQuerySearchUrl(url, apiVersion, jiraQuery, actionPlanProjectKey), 
                        apiVersion, 
                        authUser, 
                        authPass, 
                        jiraQuery
                        )
                    );
                } catch (err) {
                    logger.error(err, `Error while getting action plans for project key: ${actionPlanProjectKey}`);
                }
                
            }
        } else {
            throw new Error(`Mandatory variable ${actionPlanProjectsVariable} not found for query: ${jiraQuery.name}`);
        }
    } else {
        try{
            result.push(...await getActionPlans(
                getJiraQuerySearchUrl(url, apiVersion, jiraQuery), 
                apiVersion, 
                authUser, 
                authPass, 
                jiraQuery
                )
            );
        } catch (err) {
            logger.error(err, `Error while getting action plans!`);
        }
        
    }
        
    return result
}

async function getActionPlans(url: string, apiVersion: string, authUser: string, authPass:string, jiraQuery: IJiraQuery): Promise<IPoint[]>{
    const result: IPoint[] = [];
    let next = true;
    let startAt = 0;
    let page = 1;
    
    while (next){
        const queryActionPlanResult = await getQuery(
            {
                auth: { 
                    username: authUser, 
                    password: authPass 
                }
            }, url.concat(`&startAt=${startAt}`));
    
        const total = queryActionPlanResult.data.total;
        const maxResults = queryActionPlanResult.data.maxResults;

        logger.info(`Retrieving: ${total} items.`);
        logger.info(`Max results: ${maxResults}.`);
        logger.info(`Start at: ${startAt}.`);

        for(const issue of queryActionPlanResult.data.issues){
            result.push(map(jiraQuery, issue));
        }
        
        next = page < total / maxResults;
        page++;
        startAt += maxResults;
    }
    return result;
}

function map(jiraQuery: IJiraQuery, issue: any): IPoint {
    const createdDate: Date = new Date(issue.fields?.created);
    
    let register:IPoint =  {
      measurement: jiraQuery.name,
      timestamp: createdDate,
    };

    const ipointTags:any = {
      issueType: issue.fields.issuetype.name || "Not classified",
      statusCategory: issue.fields?.status?.statusCategory?.name || "Not classified",
      projectKey: issue.fields?.project?.key || "Not Found"
    };

    const ipointFields:any = {
      projectKey: issue.fields?.project?.key || "Not Found",
      issueName: issue.key || "Not classified",
      summary: issue.fields.summary || "Not classified",
      updatedDate: issue.fields?.updated || "",
      resolutionDate: issue.fields?.resolutiondate || "",
      statusCategory: issue.fields?.status?.statusCategory?.name || "Not classified",
      status: issue.fields?.status?.name || "Not classified",
      priority: issue.fields?.priority?.name || "Not classified",
    };

    const customFields:IJiraQueryCustomField[] = jiraQuery?.customFields || [];
    const iPointPropertiesForCustomFields = getPropertiesForActionPlansCustomFields(customFields, issue);

    register.tags = { ...ipointTags, ...iPointPropertiesForCustomFields.ipointTags };
    register.fields = {...ipointFields, ...iPointPropertiesForCustomFields.ipointFields };
    
    return register;
}

function getPropertiesForActionPlansCustomFields(customFields:IJiraQueryCustomField[], issue: any) {
    const ipointTags:any = {};
    const ipointFields:any = {};
    const hasCustomFields = customFields && customFields.length > 0;
    if(hasCustomFields){
        for(const field of customFields){
            switch (field.name) {
                //TODO: ADICIONAR CASE DO CAMPO DE CAPABILITIES DO DORA
                case 'metricsimpact':
                    applyArrayValues(ipointTags, ipointFields, issue, field);
                    break;
                default:
                    const defaultValue = getDefaultValue(issue, field);
                    ipointTags[field.name] = defaultValue;
                    ipointFields[field.name] = defaultValue;
                    break;
            }  
        }
    }
    return {
        "ipointTags": ipointTags,
        "ipointFields": ipointFields
    };
}

function getDefaultValue(issue: any, field:IJiraQueryCustomField) {
    return issue.fields[field.key]?.value  
        || issue.fields[field.key] 
        || field.defaultValue 
        || null;
}

function applyArrayValues(ipointTags: any, ipointFields:any, issue: any, field: IJiraQueryCustomField){
    const arrayValue: any[] = issue.fields[field.key];
    let resultArray: any[] = [];
    if(arrayValue && arrayValue.length > 0){
        resultArray = issue.fields[field.key]?.map(function(obj: any) {
            return obj.value;
        });
    }
    ipointTags[field.name] = resultArray.length > 0 ? resultArray.join(",") : field.defaultValue || null;
    ipointFields[field.name] = resultArray.length > 0 ? resultArray.join(",") : field.defaultValue || null;
}