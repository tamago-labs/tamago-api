"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

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

const angpowApi = new awsx.apigateway.API("angpow-api", {
    routes: [
        {
            method: "GET", path: "/{proxy+}", eventHandler: async (event) => {

                if (event && event.pathParameters) {
                    const tokenId = event.pathParameters.proxy
                    if (["1", "2", "3"].indexOf(tokenId) !== -1) {
                        return {
                            statusCode: 200,
                            headers: Headers,
                            body: JSON.stringify({
                                name: "Lucky Red Envelope NFT collection from Tamago Finance, each presents the specific amount of USD and backs by the value of SushiSwap LP tokens",
                                description: "The first value-backed NFT",
                                external_url: "https://tamago.finance",
                                image: `https://img.tamago.finance/lucky-red-envelope/${tokenId}.png`
                            }),
                        }
                    }
                }

                return {
                    statusCode: 400,
                    headers: Headers,
                    body: JSON.stringify({
                        status: "error",
                        message: "Invalid ID"
                    }),
                }
            }
        },
        {
            method: "GET", path: "/polygon/{proxy+}", eventHandler: async (event) => {

                if (event && event.pathParameters) {
                    const tokenId = event.pathParameters.proxy
                    if (["1", "2", "3"].indexOf(tokenId) !== -1) {
                        return {
                            statusCode: 200,
                            headers: Headers,
                            body: JSON.stringify({
                                name: "Lucky Red Envelope NFT on Polygon",
                                description: "The first value-backed NFT from Tamago Finance, each presents the specific amount of USD and backs by the value of QuickSwap LP tokens",
                                external_url: "https://tamago.finance",
                                image: `https://img.tamago.finance/lucky-red-envelope/polygon/${tokenId}.png`
                            }),
                        }
                    }
                }

                return {
                    statusCode: 200,
                    headers: Headers,
                    body: JSON.stringify({
                        status: "error",
                        message: "Invalid ID"
                    }),
                }
            }
        },
        {
            method: "GET", path: "/bsc/{proxy+}", eventHandler: async (event) => {

                if (event && event.pathParameters) {
                    const tokenId = event.pathParameters.proxy
                    if (["1", "2", "3"].indexOf(tokenId) !== -1) {
                        return {
                            statusCode: 200,
                            headers: Headers,
                            body: JSON.stringify({
                                name: "Lucky Red Envelope NFT on BSC",
                                description: "The first value-backed NFT from Tamago Finance, each presents the specific amount of USD and backs by the value of PancakeSwap LP tokens",
                                external_url: "https://tamago.finance",
                                image: `https://img.tamago.finance/lucky-red-envelope/bsc/${tokenId}.png`
                            }),
                        }
                    }
                }

                return {
                    statusCode: 200,
                    headers: Headers,
                    body: JSON.stringify({
                        status: "error",
                        message: "Invalid ID"
                    }),
                }
            }
        },
        {
            method: "GET", path: "/account/{proxy+}", eventHandler: async (event) => {

                if (event && event.pathParameters) {
                    const client = new aws.sdk.DynamoDB.DocumentClient()
                    const accountId = event.pathParameters.proxy

                    const params = {
                        TableName: dataTable.name.get(),
                        Key: {
                            "key": "account",
                            "value": accountId
                        }
                    };

                    const { Item } = await client.get(params).promise()

                    if (Item) {
                        return {
                            statusCode: 200,
                            headers: Headers,
                            body: JSON.stringify({
                                status: "ok",
                                account: accountId,
                                disabled: Item.disabled
                            }),
                        }
                    }
                }

                return {
                    statusCode: 200,
                    headers: Headers,
                    body: JSON.stringify({
                        status: "error",
                        message: "Invalid ID"
                    }),
                }
            }
        },
        // FIXME: sign the message and verify before add a new record / use POST method and fix CORS issues
        {
            method: "GET", path: "/accountUpdate/{proxy+}", eventHandler: async (event) => {

                console.log("Incoming event --> ", event)

                if (event && event.pathParameters) {

                    const client = new aws.sdk.DynamoDB.DocumentClient()
                    const base64String = event.pathParameters.proxy

                    const buff = Buffer.from(base64String, "base64");
                    const eventBodyStr = buff.toString('UTF-8');
                    const eventBody = JSON.parse(eventBodyStr);

                    console.log("Receiving payload : ", eventBody)

                    // example payload
                    // {
                    //     username : pisuthd.nft,
                    //     address : xxxx,
                    //     disabled : false,
                    //     email : pisuth@tamago.finance
                    // }

                    if (eventBody && eventBody.username) {

                        const params = {
                            TableName: dataTable.name.get(),
                            Item: {
                                ...eventBody,
                                "key": "account",
                                "value": eventBody.username
                            }
                        }

                        console.log("saving : ", params)

                        const client = new aws.sdk.DynamoDB.DocumentClient()

                        await client.put(params).promise()

                        return {
                            statusCode: 200,
                            headers: Headers,
                            body: JSON.stringify({
                                "status": "ok",
                                "username": eventBody.username
                            }),
                        }

                    }

                }

                return {
                    statusCode: 200,
                    headers: Headers,
                    body: JSON.stringify({
                        status: "error",
                        message: "Invalid Input"
                    }),
                }
            },
        }
    ]
});

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




