# Tamago API

### Introduction

The repo contains backend applications including databases, email & notification services, DNS configurationos as well as the API endpoints for Ang Bao NFT, stats, lagging-indicators. Those all have been packing in [Pulumi](https://www.pulumi.com/)'s CI/CD script of AWS-specific serverless resources.  

#### API Endpoints

The current version of the API lives at ```https://api.tamago.finance/v2```.

- The API allows the backend fetch the project and event information
- Generation of the merkle tree proof for claim and submit the proof to the smart contract

| Endpoint | What it does |
| ------------- | -------------|
| ```/projects``` | Returns an array of Projects  
| ```/projects/{id}``` | Returns an object of the project from the given project ID. (Example: to retrieve the holder list from 22/3/2022 using /projects/1?holderlist=yes&timestamp=1648166400)
| ```/events``` | Returns an array of Events  
| ```/events/{id}``` | Returns an object of the event from the given event ID.

<body id="basics"></body>

### Dependencies

- aws-cli (https://docs.aws.amazon.com/cli/index.html)
- pulumi (https://www.pulumi.com/docs/)

### Deployment

Assuming you've already setup the credential of AWS CLI & Pulumi, once ready you can deploy it all by run: 

```
pulumi up
```

To get a log stream from the container, use (Or checkout on Cloudwatch)

```
pulumi logs --follow
```


## License

MIT ©
