const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const { headers } = require("./")

const getAllEvents = async (event, tableName) => {

    try {

        const params = {
            TableName: tableName,
            KeyConditionExpression: "#key = :key",
            ExpressionAttributeNames: {
                "#key": "key"
            },
            ExpressionAttributeValues: {
                ":key": "event"
            }
        };

        const client = new aws.sdk.DynamoDB.DocumentClient()
        const { Items } = await client.query(params).promise()

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: "ok",
                events: Items.filter(item => item.visible)
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
    getAllEvents
}