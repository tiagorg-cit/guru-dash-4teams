export interface IStrapiMetadata {

}

export interface ICustomMetric {
  name: string;
  value: number;
  date: string;
}

export interface IGalaxyFromTo {
  name: string;
  meta: IGalaxyFromToMeta;
  provider: string;
}

export interface IGalaxyFromToMeta {
  entries: any[];
}

export interface IGalaxyFromToMetaJiraItem {
  jiraProductName: string;
  galaxyProductId: string;
}