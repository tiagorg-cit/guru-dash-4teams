import { IJiraMetadata, IJiraQuery } from './jira.types';
import { getJiraBugs } from "./queries/jira.bugs";
import { getJiraHours } from "./queries/jira.hours";
import { getJiraIncidents } from "./queries/jira.incidents";
import { getJiraActionPlans } from "./queries/jira.actionPlans";


import {JiraProviderFunction} from "./jira.provider.types";
import {logger} from "../../shared/logger";
import { IPoint } from 'influx';

const queries: Record<string, JiraProviderFunction> = {
    BUG: getJiraBugs,
    HOUR: getJiraHours,
    INCIDENT: getJiraIncidents,
    ACTION_PLAN: getJiraActionPlans,
};

export async function jiraQueryFactory(metadata: IJiraMetadata, jiraQuery: IJiraQuery) {
    const jiraQueryType:string = jiraQuery.type;
    const jiraQueryName:string = jiraQuery.name;
    const jiraQueryFunction = queries[jiraQueryType];
  
    if (!jiraQueryFunction) {
      throw new Error(`Unimplemented JIRA query type: ${jiraQueryType}`);
    }
  
    logger.info(`Executing JIRA query: ${jiraQueryName}`);
    const queryResult:IPoint[] = await jiraQueryFunction(metadata, jiraQuery);
    logger.info(`Finishing JIRA query: ${jiraQueryName}`);
  
    return queryResult;
  }
  