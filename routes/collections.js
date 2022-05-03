const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const { headers } = require("./")

const getCollections = async (event, tableName) => {

    console.log("get collections...")

    try {

        const params = {
            TableName: tableName,
            KeyConditionExpression: "#chainId = :chainId",
            ExpressionAttributeNames: {
                "#chainId": "chainId"
            },
            ExpressionAttributeValues: {
                ":chainId": 42
            },
            // ProjectionExpression: "orderId"
        };

        const client = new aws.sdk.DynamoDB.DocumentClient()
        const { Items } = await client.query(params).promise()

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: "ok",
                collections: Items
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

module.exports = {
    getCollections
}