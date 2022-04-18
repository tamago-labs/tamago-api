const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const { headers } = require("./")

const getAccount = async (event, tableName) => {

    if (event && event.pathParameters) {
        const client = new aws.sdk.DynamoDB.DocumentClient()
        const accountId = event.pathParameters.proxy

        const params = {
            TableName: tableName,
            Key: {
                "key": "account",
                "value": accountId
            }
        };

        const { Item } = await client.get(params).promise()

        if (Item) {
            return {
                statusCode: 200,
                headers,
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
        headers,
        body: JSON.stringify({
            status: "error",
            message: "Invalid ID"
        }),
    }

}


const createAccount = async (event, tableName) => {

    if (event && event.pathParameters) {

        // const client = new aws.sdk.DynamoDB.DocumentClient()
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
                TableName: tableName,
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
                headers,
                body: JSON.stringify({
                    "status": "ok",
                    "username": eventBody.username
                }),
            }

        }

    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            status: "error",
            message: "Invalid Input"
        }),
    }
}


module.exports = {
    getAccount,
    createAccount
}