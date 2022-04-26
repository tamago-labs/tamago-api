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
    createAccount,
    createEvent,
    getAllRewards,
    register,
    getRegistered
} = require("./routes")

const Headers = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
}

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

const orderTable = new aws.dynamodb.Table(
    "orderTable",
    {
        attributes: [
            {
                name: "network",
                type: "S"
            },
            {
                name: "orderId",
                type: "N"
            }
        ],
        hashKey: "network",
        rangeKey: "orderId",
        billingMode: "PAY_PER_REQUEST"
    }
)

const angpowApi = new awsx.apigateway.API("angpow-api", {
    routes: [
        {
            method: "GET",
            path: "/{proxy+}",
            eventHandler: async (event) => await mainnet(event)
        },
        {
            method: "GET",
            path: "/polygon/{proxy+}",
            eventHandler: async (event) => await polygon(event)
        },
        {
            method: "GET",
            path: "/bsc/{proxy+}",
            eventHandler: async (event) => await bsc(event)
        },
        {
            method: "GET",
            path: "/account/{proxy+}",
            eventHandler: async (event) => await getAccount(event, dataTable.name.get())
        },
        // FIXME: sign the message and verify before add a new record / use POST method and fix CORS issues
        {
            method: "GET", path: "/accountUpdate/{proxy+}", eventHandler: async (event) => await createAccount(event, dataTable.name.get()),
        }
    ]
});

const LuckboxApi = new awsx.apigateway.API("luckbox-api", {
    routes: [
        {
            method: "GET",
            path: "/projects",
            eventHandler: async (event) => await getAllProjects(event)
        },
        {
            method: "GET",
            path: "/projects/{proxy+}",
            eventHandler: async (event) => await getProject(event, projectTable.name.get())
        },
        {
            method: "GET",
            path: "/events",
            eventHandler: async (event) => await getAllEvents(event, dataTable.name.get())
        },
        {
            method: "GET",
            path: "/events/{proxy+}",
            eventHandler: async (event) => await getEvent(event, { dataTable: dataTable.name.get(), projectTable: projectTable.name.get() })
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
            path: "/accounts/{proxy+}",
            eventHandler: async (event) => await getAccount(event, dataTable.name.get())
        },
        {
            method: "GET", path: "/createAccount/{proxy+}", eventHandler: async (event) => await createAccount(event, dataTable.name.get()),
        },
        {
            method: "GET",
            path: "/rewards",
            eventHandler: async (event) => await getAllRewards(event, dataTable.name.get())
        }
        // {
        //     method: "GET",
        //     path: "/orders",
        //     eventHandler: async (event) => await getOrders(event, orderTable.name.get())
        // },
    ]
})

const domainName = "api.tamago.finance";
const route53DomainZoneId = "Z0280059321XPD7H3US7L";
const certARN = "arn:aws:acm:us-east-1:057386374967:certificate/293cdab5-5dda-48bc-a120-4c96c9dd7dab";

const domain = new aws.apigateway.DomainName("domain", {
    certificateArn: certARN,
    domainName: domainName,
});

const mapping = new aws.apigateway.BasePathMapping("mapping", {
    restApi: angpowApi.restAPI,
    basePath: "lucky-red-envelope",
    stageName: angpowApi.stage.stageName,
    domainName: domain.domainName,
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



