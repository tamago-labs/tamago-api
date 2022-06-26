const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const { ethers } = require("ethers");
const check = require('check-types');
const { parseBody } = require("../utils")
const { headers } = require("./headers")
const Reward = require("../types/event")

const getAllRewards = async (event, tableName) => {

    try {

        const params = {
            TableName: tableName,
            KeyConditionExpression: "#key = :key",
            ExpressionAttributeNames: {
                "#key": "key"
            },
            ExpressionAttributeValues: {
                ":key": "reward"
            },
            ProjectionExpression: "assetAddress, tokenId, is1155, rewardId, owner"
        };

        const client = new aws.sdk.DynamoDB.DocumentClient()
        const { Items } = await client.query(params).promise()

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: "ok",
                rewards: Items
            }),
        }

    } catch (error) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                status: "error",
                message: `${error.message || "Unknown error."}`
            }),
        };
    }

}

const createReward = async (event, tableName) => {

    console.log("creating a reward...")

    try {

        console.log("EVENT: \n" + JSON.stringify(event, null, 2))

        const body = parseBody(event)

        console.log("BODY: \n", body)

        if (body) {

            // looks for Reward ID
            let params = {
                TableName: tableName,
                KeyConditionExpression: "#key = :key",
                ExpressionAttributeNames: {
                    "#key": "key"
                },
                ExpressionAttributeValues: {
                    ":key": "reward"
                },
                ProjectionExpression: "rewardId"
            };

            const client = new aws.sdk.DynamoDB.DocumentClient()
            const { Items } = await client.query(params).promise()

            const rewardId = Items.reduce((result, item) => {
                if (Number(item.rewardId) > result) {
                    result = Number(item.rewardId)
                }
                return result
            }, 0) + 1

            console.log("Adding new reward with ID : ", rewardId)

            params = {
                TableName: tableName,
                Item: {
                    ...body,
                    "key" : "reward",
                    "value": `${rewardId}`,
                    "rewardId": `${rewardId}`
                }
            }

            console.log("saving : ", params)

            await client.put(params).promise()

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    "status": "ok",
                    "rewardId": rewardId
                }),
            }

        } else {
            throw new Error("Invalid JSON Structure")
        }

    } catch (error) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                status: "error",
                message: `${error.message || "Unknown error."}`
            }),
        };
    }

}

module.exports = {
    getAllRewards,
    createReward
}