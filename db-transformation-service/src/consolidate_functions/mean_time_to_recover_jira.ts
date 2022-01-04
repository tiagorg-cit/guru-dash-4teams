import { IGalaxyFromTo, IGalaxyFromToMetaJiraItem } from "../providers/strapi/strapi.types";

export async function consolidateMeanTimeToRecoverFromJira(metricName: string, galaxyFromTo: IGalaxyFromTo){   
    const entries: IGalaxyFromToMetaJiraItem[] = galaxyFromTo.meta?.entries;
    if(entries && entries.length > 0){
        for(let entry of entries){
            const jiraProductName = entry.jiraProductName;
            const galaxyProductId = entry.galaxyProductId;
        }
    } 
} 