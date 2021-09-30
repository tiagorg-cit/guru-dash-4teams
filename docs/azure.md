## AZURE Details

### The Meta should be configured as follows (* are mandatory):
```
{
  (*) "key": "123",
  (*) "organization": "Your Organization",
  (*) "project": "Your Project",
  (*) "releases": [
    "Name of the stages in the pipeline that should be considered as deploys"
  ],
  "bugsQuery": "WIQL to query bugs in Azure Devops",
  "builds": {
    "getLastNumMonths": "Number of previous months to obtain data",
    (*) "repositories": [{
      (*) "id": "Git repository id to count build",
      (*) "type": "Git repository type to count build. Can be: Git and TfsGit",
      "name": "Git repository name. Using just to log" 		
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