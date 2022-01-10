import { IJiraQueryCustomField, IJiraQuery } from '../jira.types';
import { getJiraQuerySearchUrl } from './jira.queryUtils';
import { getGalaxyFromTo } from "../../strapi/strapi.provider";
import { generateMonthYearDateKey } from "../../../shared/data_utils";
import { IGalaxyFromTo, IGalaxyFromToMeta , IGalaxyFromToMetaJiraItem } from "../../strapi/strapi.types";
import { getQuery } from '../jira.send';
import { IPoint } from 'influx';
import { logger } from '../../../shared/logger';

let jiraGalaxyFromTo:IGalaxyFromToMeta;
const fromToType:string = "jira";

export async function getJiraIncidents(url: string, apiVersion: string, authUser: string, authPass:string, jiraQuery: IJiraQuery): Promise<IPoint[]> {
    const result: IPoint[] = [];

    const urlJiraQuery = getJiraQuerySearchUrl(url, apiVersion, jiraQuery);

    jiraGalaxyFromTo = await getJiraFromTo();

    let next = true;
    let startAt = 0;
    let page = 1;
    while (next){
      const queryIncidentResult = await getQuery({auth: { username: authUser, password: authPass }}, urlJiraQuery.concat(`&startAt=${startAt}`));
      
      const total = queryIncidentResult.data.total;
      const maxResults = queryIncidentResult.data.maxResults;

      logger.info(`Retrieving: ${total} items.`);
      logger.info(`Max results: ${maxResults}.`);
      logger.info(`Start at: ${startAt}.`);

      for(const issue of queryIncidentResult.data.issues){
        result.push(map(jiraQuery, issue));
      }
      
      next = page < total / maxResults;
      page++;
      startAt += maxResults;
    }
    return result
}

async function getJiraFromTo(): Promise<IGalaxyFromToMeta> {
    const datasetFromTo: IGalaxyFromTo[] =  await getGalaxyFromTo();
    if(datasetFromTo && datasetFromTo.length > 0){
        for(const fromToItem of datasetFromTo){
            if(fromToItem.provider === fromToType){
                return fromToItem.meta;
            }
        }
    }
    throw new Error('No from/to defined to get product ids from JIRA');
}

function map(jiraQuery: IJiraQuery, issue: any): IPoint {
    let register:IPoint =  {
      measurement: jiraQuery.name,
    };

    const ipointTags:any = {
      issueType: issue.fields.issuetype.name || "Not classified",
      statusCategory: issue.fields?.status?.statusCategory?.name || "Not classified",
    };

    const ipointFields:any = {
      issueName: issue.key || "Not classified",
      summary: issue.fields.summary || "Not classified",
      createdDate: issue.fields?.created || "",
      resolutionDate: issue.fields?.resolutiondate || "",
      statusCategory: issue.fields?.status?.statusCategory?.name || "Not classified",
      status: issue.fields?.status?.name || "Not classified",
      components: getComponents(issue.fields?.components) || "Not classified",
      priority: issue.fields?.priority?.name || "Not classified",
    };

    const customFields:IJiraQueryCustomField[] = jiraQuery.customFields;
    const iPointPropertiesForCustomFields = getPropertiesForIncidentCustomFields(customFields, issue);

    register.timestamp = iPointPropertiesForCustomFields.timestamp;
    register.tags = { ...ipointTags, ...iPointPropertiesForCustomFields.ipointTags };
    register.fields = {...ipointFields, ...iPointPropertiesForCustomFields.ipointFields };
    
    return register;
}

function getComponents(components: any[]) {
    const result = [];
    if(components && components.length){
        for(let c of components){
            const name = c?.name;
            if(name){
                result.push(name);
            }
        }
    }
    return result && result.length > 0 ? result.join(',') : null;
}

function getPropertiesForIncidentCustomFields(customFields:IJiraQueryCustomField[], issue: any) {
    const ipointTags:any = {};
    const ipointFields:any = {};
    let timestamp: Date = new Date(issue.fields?.created);
    const hasCustomFields = customFields && customFields.length > 0;
    if(hasCustomFields){
        for(const field of customFields){
            switch (field.name) {
                case 'errortype':
                    applyErrorType(ipointTags, ipointFields, issue, field);
                    break;
                case 'affectedsquads':
                case 'targetsquad':
                case 'affectedplataforms':
                case 'affectedcountries':
                    applyArrayValues(ipointTags, ipointFields, issue, field);
                    break;
                case 'crisisstartdate':
                    timestamp = new Date(issue.fields[field.key]);
                    const crisisStartDateValue = getDefaultValue(issue, field);
                    const crisisMonthYear = generateMonthYearDateKey(new Date(crisisStartDateValue));
                    ipointFields['crisismonthyear'] = crisisMonthYear;
                    ipointTags['crisismonthyear'] = crisisMonthYear;
                    ipointTags[field.name] = crisisStartDateValue;
                    ipointFields[field.name] = crisisStartDateValue;
                    break;
                case 'affectedproduct':
                    const productId = getProductIdByName(issue.fields[field.key].value);
                    ipointTags['productId'] = productId;
                    ipointFields['productId'] = productId;
                    const affectedProductValue = getDefaultValue(issue, field);
                    ipointTags[field.name] = affectedProductValue;
                    ipointFields[field.name] = affectedProductValue;
                    break;
                default:
                    const defaultValue = getDefaultValue(issue, field);
                    ipointTags[field.name] = defaultValue;
                    ipointFields[field.name] = defaultValue;
                    break;
            }  
        }
        const crisisStartDate = new Date(ipointFields['crisisstartdate']);
        const crisisEndDate = new Date(ipointFields['crisisenddate']);
        if(crisisStartDate && crisisEndDate){
            const crisisDuration = crisisEndDate.getTime() - crisisStartDate.getTime();
            ipointFields['crisisduration'] = crisisDuration;
            ipointTags['crisisduration'] = crisisDuration;
        }
    }
    return {
        "timestamp": timestamp,
        "ipointTags": ipointTags,
        "ipointFields": ipointFields
    };
}

function getProductIdByName(productName:string) {
   if(productName && jiraGalaxyFromTo && jiraGalaxyFromTo.entries && jiraGalaxyFromTo.entries.length > 0){
        const productNameToSearch = productName.toUpperCase();
        const entries: IGalaxyFromToMetaJiraItem[] = jiraGalaxyFromTo.entries;
        for(const fromTo of entries){
            if(productNameToSearch === fromTo?.jiraProductName?.toUpperCase()){
                return fromTo.galaxyProductId;
            }
        }
   }
   return null; 
}

function getDefaultValue(issue: any, field:IJiraQueryCustomField) {
    return issue.fields[field.key]?.value?.toUpperCase() 
        || issue.fields[field.key]?.value 
        || issue.fields[field.key]?.toUpperCase() 
        || issue.fields[field.key] 
        || field.defaultValue?.toUpperCase() 
        || field.defaultValue 
        || null;
}

function applyErrorType(ipointTags: any, ipointFields:any, issue: any, field: IJiraQueryCustomField){
    const errorType = issue.fields[field.key]?.value;
    const errorSubType = issue.fields[field.key]?.child?.value;

    ipointTags[field.name] = errorType || field.defaultValue || null;
    ipointFields[field.name] = errorType || field.defaultValue || null;
    
    ipointTags['errorsubtype'] = errorSubType || field.defaultValue || null;
    ipointFields['errorsubtype'] = errorSubType || field.defaultValue || null;
}

function applyArrayValues(ipointTags: any, ipointFields:any, issue: any, field: IJiraQueryCustomField){
    const arrayValue: any[] = issue.fields[field.key];
    let affectedPlataforms: any[] = [];
    if(arrayValue && arrayValue.length > 0){
        affectedPlataforms = issue.fields[field.key]?.map(function(obj: any) {
            return obj.value;
        });
    }
    ipointTags[field.name] = affectedPlataforms.length > 0 ? affectedPlataforms.join(",") : field.defaultValue || null;
    ipointFields[field.name] = affectedPlataforms.length > 0 ? affectedPlataforms.join(",") : field.defaultValue || null;
    
}