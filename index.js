"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const Headers = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
}

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
                                name : "Lucky Red Envelope NFT collection from Tamago Finance, each presents the specific amount of USD and backs by the value of SushiSwap LP tokens",
                                description : "The first value-backed NFT",
                                external_url : "https://tamago.finance",
                                image : `https://img.tamago.finance/lucky-red-envelope/${tokenId}.png`
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
            method: "GET", path: "/polygon/{proxy+}", eventHandler: async (event) => {

                if (event && event.pathParameters) {
                    const tokenId = event.pathParameters.proxy
                    if (["1", "2", "3"].indexOf(tokenId) !== -1) {
                        return {
                            statusCode: 200,
                            headers: Headers,
                            body: JSON.stringify({ 
                                name : "Lucky Red Envelope NFT on Polygon",
                                description : "The first value-backed NFT from Tamago Finance, each presents the specific amount of USD and backs by the value of QuickSwap LP tokens",
                                external_url : "https://tamago.finance",
                                image : `https://img.tamago.finance/lucky-red-envelope/polygon/${tokenId}.png`
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

