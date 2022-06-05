const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const check = require('check-types');
const { ethers } = require("ethers");
const Account = require("../types/account")
const { parseBody } = require("../utils")

const { headers } = require("./headers")

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
                    email: Item.email,
                    nickname : Item.nickname,
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

// no longer used
const createAccount = async (event, tableName) => {

    try {

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

            if (eventBody && check.like(eventBody, Account)) {

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

            } else {
                throw new Error("Invalid JSON structure")
            }

        } else {
            throw new Error("Invalid input")
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

const createAccountWithSigning = async (event, tableName) => {

    console.log("Createing an account")

    try {

        console.log("EVENT: \n" + JSON.stringify(event, null, 2))

        const body = parseBody(event)

        console.log("BODY: \n", body)

        const { username, address, disabled, email, message, signature, nickname } = body

        // verify the address
        console.log("Verifying the address :  ", address)

        const recoveredAddress = ethers.utils.verifyMessage(message, signature)

        console.log("Recovered address : ", recoveredAddress)

        if (recoveredAddress.toLowerCase() === address.toLowerCase()) {

            const params = {
                TableName: tableName,
                Item: {
                    username,
                    nickname,
                    address,
                    disabled,
                    email,
                    "key": "account",
                    "value": username
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
                    "username": username
                }),
            }

        } else {
            throw new Error("Invalid singed message")
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
    getAccount,
    createAccount,
    createAccountWithSigning
}