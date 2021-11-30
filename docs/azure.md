## AZURE Details

### The Meta should be configured as follows (* are mandatory):
```
{
  (*) "key": "123",
  (*) "organization": "Your Organization",
  (*) "project": "Your Project",
  "stepInsert": "true/false: Indicates to metrics-service proceed a batch insert by repository in database. For big quantities of repositories, use this flag in 'true' mode",
  "deployOnBuild": "true/false: If true, builds section is mandatory. This flag indicates if in build pipeline have a deploy (release) step",
  (*) "releases": [
    "Name of the stages in the pipeline that should be considered as deploys"
  ],
  "bugsQuery": "WIQL to query bugs in Azure Devops",
  "connectors": {
    "galaxy": {
      "apiKey": "GALAXY API KEY",
      "apiUrl": "Galaxy url for deployments"
    }
  },
  "builds": {
    "getLastNumMonths": "Number of previous months to obtain data",
    (*) "defaultBuildStep": "Default step name in build pipeline that should be considered as build",
    (*) "defaultDeployStep": "Default step name in build pipeline that should be considered as deploy"
    (*) "repositories": [{
      (*) "id": "Git repository id to count build",
      (*) "type": "Git repository type to count build. Can be: Git and TfsGit",
      (*) "name": "Git repository name.",
      "buildSteps": "Array of custom step name in build pipeline that should be considered as build"
      "deploySteps": "Array of custom step name in build pipeline that should be considered as build" 		
      }
    ]
  }
}
```
OBS: If you don't enter the "builds" attribute, all builds from all git repositories found in your Azure project will be counted.

If you need to find out the ids of the repositories, an alternative is to use the 'az repos list' (https://docs.microsoft.com/pt-br/cli/azure/repos?view=azure-cli-latest)

#### Provider name: azure

The supported metrics are:
- build
- release
- bug