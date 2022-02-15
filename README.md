# Tamago API

### Introduction

The repo contains backend applications including databases, email & notification services, DNS configurationos as well as the API endpoints for Ang Bao NFT, stats, lagging-indicators. Those all have been packing in [Pulumi](https://www.pulumi.com/)'s CI/CD script of AWS-specific serverless resources.  

### Dependencies

- aws-cli (https://docs.aws.amazon.com/cli/index.html)
- pulumi (https://www.pulumi.com/docs/)

### Deployment

Assuming you've already setup the credential of AWS CLI & Pulumi, once ready you can setup liquidation and disputer bots on your AWS account by the following scripts:

```
pulumi up
```

To get a log stream from the container, use (Or checkout on Cloudwatch)

```
pulumi logs --follow
```
