import {IPoint} from "influx";
import { IJiraMetadata, IJiraQuery } from './jira.types';

export type JiraProviderFunction = (metadata: IJiraMetadata, jiraQuery: IJiraQuery) => Promise<IPoint[]>;
