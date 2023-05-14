# WebMonitor

## What is WebMonitor

WebMonitor is a microservice backend system that periodically monitors websites
and reporting their availability.
It can assist website administrators in monitoring their sites
and promptly identify potential problems.

What it does:

- Read a list of URLs and their content requirements from the configuration.
- Periodically makes a GET Request to each URL.
- Check if the response content passes the requirements.
- Measure the elapsed time it takes for the website to respond.
- Store these pieces of information in databases.
- Expose a user-friendly HTTP endpoint to get these pieces of information.

Its features:

- Users can view and modify application configuration with AWS AppConfig.
  AWS AppConfig will **validate configuration content** to match a JSON schema
  before deployment.
- Monitoring activities take place from **more than one**
  geographically distributed location simultaneously.
- Developers can set checking periods and checking locations in the **IaC file**.

## Getting started

You can view

## How does WebMonitor work

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template
