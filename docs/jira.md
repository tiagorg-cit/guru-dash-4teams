## JIRA Details

### The Meta should be configured as follows:
```
{
  "user": "User Jira",
  "key": "User Key",
  "url": "Url Jira",
  "apiVersion": "Api Version",
  "queries": [
    {
      "name": "jira_bug",
      "type": "BUG",
      "description": "Query Description",
      "filter": "JQL Bug Filter (Ex: project=P2M and (issuetype in (Bug, Sub-bug, Incidente) and status not in (Cancelado, Cancelada)))",
      "variables": {}, "Objeto que pode conter variaveis a serem utilizadas no filter. Nesse caso, basta colocar '?' no filtro nos locais onde se quer trocar pelas variáveis aqui definidas. Necessário programar essa feature para seu cenário"
      "customFields": [
        {
          "key": "Customfield key for BUG phase (Ex: customfield_11913)",
          "name": "phase",
          "defaultValue": "Default value for empty value (Ex: DEV)"
        },
        {
          "key": "Customfield key for BUG root cause (Ex: customfield_11900)",
          "name": "rootcause",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        },
        {
          "key": "Customfield key for sprint (Ex: customfield_10000)",
          "name": "sprint",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        },
        {
          "key": "Customfield key for BUG sprint (Ex: customfield_11899)",
          "name": "category",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        }
      ]
    },
    {
      "name": "jira_hour",
      "type": "HOUR",
      "description": "Query Description",
      "filter": JQL Get all issues to get logged hours (Ex: "project=P2M and status not in (Cancelado, Cancelada))",
      "variables": {}, "Objeto que pode conter variaveis a serem utilizadas no filter. Nesse caso, basta colocar '?' no filtro nos locais onde se quer trocar pelas variáveis aqui definidas. Necessário programar essa feature para seu cenário"
      "customFields": [
        {
          "key": "Customfield key for sprint (Ex: customfield_10000)",
          "name": "sprint",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        }
      ]
    },
    {
      "name": "jira_incidents",
      "type": "INCIDENT",
      "description": "Query para obter os incidentes",
      "filter": "JQL Bug Filter (Ex: project=BEESOE and issuetype=Incident and priority=Blocker and cf[13364] in (L2, L3) and cf[13588] is not EMPTY and cf[13589] is not EMPTY and status not in (Cancelled))",
      "variables": {}, "Objeto que pode conter variaveis a serem utilizadas no filter. Nesse caso, basta colocar '?' no filtro nos locais onde se quer trocar pelas variáveis aqui definidas. Necessário programar essa feature para seu cenário"
      "customFields": [
        {
          "key": "Custom field for correction level (Ex: customfield_13364"),
          "name": "correctionlevel",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        },
        {
          "key": "Custom field for affected product (Ex: customfield_13578)",
          "name": "affectedproduct",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        },
        {
          "key": "Custom field for error type (Ex: customfield_13558)",
          "name": "errortype",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        },
        {
          "key": "Custom field for affected platforms (Ex: customfield_13409)",
          "name": "affectedplataforms",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        },
        {
          "key": "Custom field for affected squads (Ex: customfield_13598)",
          "name": "affectedsquads",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        },
        {
          "key": "Custom field for target squad (Ex: customfield_13699)",
          "name": "targetsquad",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        },
        {
          "key": "Custom field for affected countries (Ex: customfield_13365)",
          "name": "affectedcountries",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        },
        {
          "key": "Custom field for crisis start date (Ex: customfield_13588)",
          "name": "crisisstartdate",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        },
        {
          "key": "Custom field for crisis end date (Ex: customfield_13589)",
          "name": "crisisenddate",
          "defaultValue": "Default value for empty value (Ex: Not classified)"
        }
  ]
}
```
#### Provider name: jira

In this metadata, you have the option of passing multiple queries within the "queries" array. Each element of this array represents a data set (according to the query's return) and will be stored in an "MEASUREMENT" of InfluxDB whose name is defined in the "name" property.

The standard queries names of this example metadata (**jira_bug**, **jira_hour** and **jira_incidents**) are necessary to load the standard "Plug & Play" dashboards.

If you want to define other queries, just add new elements to the "queries" array and use them in your grafana dashboards.

Currently, three types of queries are implemented: "BUG", "HOUR" and "INDICENT".

Implementing query types helps us to map from/to the jira API versus the points to be stored in the InfluxDB Measurement.

In addition, every custom field that has the name "sprint" will have a special treatment in the code, because in this field an array of sprints is returned in which this issue may have passed over time.

New types of queries can be implemented, for that it is enough:

**Create a new JIRA query definition in:**
```
./metrics-service/src/providers/jira/queries/jira.<<type>>.ts
```
**Then it is necessary to add it to the Record of jira provider factory in:**

```
./metrics-service/src/providers/jira/jira.query.factory.ts
```

```
const queries: Record<string, JiraProviderFunction> = {
    BUG: getJiraBugs,
    HOUR: getJiraHours,
    INCIDENT: getJiraIncidents
};
```

**And lastly, register the types of fields in which you want to import from the JIRA API for your query type in:**
```
./metrics-service/src/providers/jira/queries/jira.queryTypes.ts
```

```
export const fieldsByQueryType: Record<string,string>  = {
    BUG: "issuekey, summary, status, issuetype, created, resolutiondate",
    HOUR: "created, timespent, issuetype, issuekey, summary",
    INCIDENT: "issuekey, summary, status, issuetype, created, resolutiondate, components, priority"
};
```
**IMPORTANT: Your jira preferred language must be English (Because dash filter use conditions "status='Done'").**