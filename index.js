"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const {
    mainnet,
    polygon,
    bsc,
    getAllProjects,
    getProject,
    getAllEvents,
    getEvent,
    generateProof,
    getAccount,
    createAccountWithSigning,
    createEvent,
    _createEvent,
    getAllRewards,
    createReward,
    register,
    updateEvent,
    getRegistered,
    getCollections,
    getCollection,
    createCollection,
    proxy,
    createCampaign,
    confirmCampaign,
    getAllCampaigns,
    getCampaign,
    updateCampaign,
    removeCampaign
} = require("./routes")

const Headers = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
}

const imageBucket = new aws.s3.Bucket("luckbox-images");

const dataTable = new aws.dynamodb.Table(
    "dataTable",
    {
        attributes: [
            {
                name: "key",
                type: "S"
            },
            {
                name: "value",
                type: "S"
            }
        ],
        hashKey: "key",
        rangeKey: "value",
        billingMode: "PAY_PER_REQUEST"
    }
)

const projectTable = new aws.dynamodb.Table(
    "projectTable",
    {
        attributes: [
            {
                name: "projectId",
                type: "N"
            },
            {
                name: "timestamp",
                type: "N"
            }
        ],
        hashKey: "projectId",
        rangeKey: "timestamp",
        billingMode: "PAY_PER_REQUEST"
    }
)

const campaignTable = new aws.dynamodb.Table(
    "campaignTable",
    {
        attributes: [
            {
                name: "version",
                type: "N"
            },
            {
                name: "campaignId",
                type: "N"
            }
        ],
        hashKey: "version",
        rangeKey: "campaignId",
        billingMode: "PAY_PER_REQUEST"
    }
)

const collectionTable = new aws.dynamodb.Table(
    "collectionTable",
    {
        attributes: [
            {
                name: "chainId",
                type: "N"
            },
            {
                name: "contractAddress",
                type: "S"
            }
        ],
        hashKey: "chainId",
        rangeKey: "contractAddress",
        billingMode: "PAY_PER_REQUEST"
    }
)

const angpowApi = new awsx.apigateway.API("angpow-api", {
    routes: [
        {
            method: "GET",
            path: "/account/{proxy+}",
            eventHandler: async (event) => await getAccount(event, dataTable.name.get())
        }
    ]
});

const LuckboxApi = new awsx.apigateway.API("luckbox-api", {
    routes: [
        {
            method: "GET",
            path: "/account/{proxy+}",
            eventHandler: async (event) => await getAccount(event, dataTable.name.get())
        },
        {
            method: "GET",
            path: "/events",
            eventHandler: async (event) => await getAllEvents(event, dataTable.name.get())
        },
        {
            method: "GET",
            path: "/projects",
            eventHandler: async (event) => await getAllProjects(event)
        },
        {
            method: "POST",
            path: "/account",
            eventHandler: new aws.lambda.CallbackFunction("create-account-with-signing", {
                memorySize: 256,
                callback: async (event) => await createAccountWithSigning(event, dataTable.name.get()),
            })
        },
        {
            method: "GET",
            path: "/projects/{proxy+}",
            eventHandler: async (event) => await getProject(event, projectTable.name.get())
        },

        {
            method: "GET",
            path: "/events/{proxy+}",
            eventHandler: new aws.lambda.CallbackFunction("getEvent", {
                memorySize: 512,
                callback: async (event) => await getEvent(event, { dataTable: dataTable.name.get(), projectTable: projectTable.name.get() }),
            })
        },
        {
            method: "GET",
            path: "/events/proof/{proxy+}",
            eventHandler: async (event) => await generateProof(event, { dataTable: dataTable.name.get(), projectTable: projectTable.name.get() })
        },
        {
            method: "GET",
            path: "/events/registered/{proxy+}",
            eventHandler: async (event) => await getRegistered(event, { dataTable: dataTable.name.get(), projectTable: projectTable.name.get() })
        },

        //create new endpoint method:'POST' remove proxy, send payload in request body, path : /createevents/
        {
            method: "POST",
            path: "/events/create",
            eventHandler: async (event) => await _createEvent(event, { dataTable: dataTable.name.get(), projectTable: projectTable.name.get(), bucket: imageBucket })
        },

        {
            method: "GET",
            path: "/createEvent/{proxy+}",
            eventHandler: async (event) => await createEvent(event, { dataTable: dataTable.name.get(), projectTable: projectTable.name.get() })
        },
        {
            method: "GET",
            path: "/register/{proxy+}",
            eventHandler: async (event) => await register(event, { dataTable: dataTable.name.get(), projectTable: projectTable.name.get() })
        },
        {
            method: "GET",
            path: "/updateEvent/{proxy+}",
            eventHandler: async (event) => await updateEvent(event, { dataTable: dataTable.name.get(), projectTable: projectTable.name.get() })
        },
        {
            method: "GET",
            path: "/accounts/{proxy+}",
            eventHandler: async (event) => await getAccount(event, dataTable.name.get())
        },
        {
            method: "GET",
            path: "/rewards",
            eventHandler: async (event) => await getAllRewards(event, dataTable.name.get())
        },
        {
            method: "POST",
            path: "/rewards",
            eventHandler: async (event) => await createReward(event, dataTable.name.get())
        },
        {
            method: "GET",
            path: "/collections",
            eventHandler: async (event) => await getCollections(event, collectionTable.name.get())
        },
        {
            method: "POST",
            path: "/collection",
            eventHandler: new aws.lambda.CallbackFunction("create-collection", {
                memorySize: 256,
                callback: async (event) => await createCollection(event, collectionTable.name.get()),
            })
        },
        {
            method: "GET",
            path: "/collection/{proxy+}",
            eventHandler: new aws.lambda.CallbackFunction("get-collection", {
                memorySize: 512,
                callback: async (event) => await getCollection(event, collectionTable.name.get()),
            })
        },
        {
            method: "POST",
            path: "/campaigns",
            eventHandler: new aws.lambda.CallbackFunction("create-campaign", {
                memorySize: 256,
                callback: async (event) => await createCampaign(event, campaignTable.name.get()),
            })
        },
        {
            method: "POST",
            path: "/campaigns/{proxy+}",
            eventHandler: new aws.lambda.CallbackFunction("confirm-campaign", {
                memorySize: 256,
                callback: async (event) => await confirmCampaign(event, campaignTable.name.get()),
            })
        },
        {
            method: "GET",
            path: "/campaigns",
            eventHandler: new aws.lambda.CallbackFunction("get-all-campaigns", {
                memorySize: 256,
                callback: async (event) => await getAllCampaigns(event, campaignTable.name.get()),
            })
        },
        {
            method: "GET",
            path: "/campaign/{proxy+}",
            eventHandler: new aws.lambda.CallbackFunction("get-campaign", {
                memorySize: 512,
                callback: async (event) => await getCampaign(event, campaignTable.name.get()),
            })
        },
        // {
        //     method: "POST",
        //     path: "/campaign/{proxy+}",
        //     eventHandler: new aws.lambda.CallbackFunction("update-campaign", {
        //         memorySize: 256,
        //         callback: async (event) => await updateCampaign(event, campaignTable.name.get()),
        //     })
        // },
        // {
        //     method: "GET",
        //     path: "/proxy/{proxy+}",
        //     eventHandler: async (event) => await proxy(event)
        // },
    ]
})

// // PRODUCTION constants 
const domainName = "api.tamago.finance";
const route53DomainZoneId = "Z0280059321XPD7H3US7L";
const certARN = "arn:aws:acm:us-east-1:057386374967:certificate/293cdab5-5dda-48bc-a120-4c96c9dd7dab";


// Create an S3 Bucket Policy to allow public read of all objects in bucket
const publicReadPolicyForBucket = (bucketName) => {
    return {
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: "*",
            Action: [
                "s3:GetObject"
            ],
            Resource: [
                `arn:aws:s3:::${bucketName}/*` // policy refers to bucket name explicitly
            ]
        }]
    };
}

// Set the access policy for the bucket so all objects are readable
let bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
    bucket: imageBucket.bucket, // refer to the bucket created earlier
    policy: imageBucket.bucket.apply(publicReadPolicyForBucket) // use output property `siteBucket.bucket`
});


const domain = new aws.apigateway.DomainName("domain", {
    certificateArn: certARN,
    domainName: domainName,
});


const mapping2 = new aws.apigateway.BasePathMapping("mapping-2", {
    restApi: LuckboxApi.restAPI,
    basePath: "v2",
    stageName: LuckboxApi.stage.stageName,
    domainName: domain.domainName,
});

const record = new aws.route53.Record("record", {
    type: "A",
    zoneId: route53DomainZoneId,
    name: domainName,
    aliases: [{
        name: domain.cloudfrontDomainName,
        zoneId: domain.cloudfrontZoneId,
        evaluateTargetHealth: true,
    }],
});

exports.projectTable = projectTable.name
exports.LuckboxApi = LuckboxApi.url;
exports.bucketName = imageBucket.bucket;
exports.websiteUrl = imageBucket.websiteEndpoint;


