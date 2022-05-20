const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const { ethers } = require("ethers");
const check = require('check-types');
const { MerkleTree } = require('merkletreejs')
const keccak256 = require("keccak256")

const { headers } = require("./headers")
const { getProvider } = require("../utils")
const Order = require("../types/order")
const { parseBody } = require("../utils")

const getAllOrders = async (event, tableName) => {

    console.log("get all orders...")

    try {

        const params = {
            TableName: tableName,
            KeyConditionExpression: "#version = :version",
            ExpressionAttributeNames: {
                "#version": "version"
            },
            ExpressionAttributeValues: {
                ":version": 1
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
                orders: Items.filter(item => item.visible)
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

const getOrder = async (event, tableName) => {

    try {

        let orderId

        if (event && event.pathParameters) {
            orderId = event.pathParameters.proxy
        } else {
            throw new Error("Invalid query params")
        }

        const client = new aws.sdk.DynamoDB.DocumentClient()

        const params = {
            TableName: tableName,
            Key: {
                "version": 1,
                "orderId": Number(orderId)
            }
        };

        const { Item } = await client.get(params).promise()

        if (Item) {

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    "status": "ok",
                    "order": Item
                }),
            }

        } else {
            throw new Error("Given order Id is invalid")
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

const createOrder = async (event, tableName) => {

    console.log("Creating a new order")

    try {

        console.log("EVENT: \n" + JSON.stringify(event, null, 2))

        const body = parseBody(event)

        console.log("BODY: \n", body)

        if (body) {

            // looks for Order ID
            let params = {
                TableName: tableName,
                KeyConditionExpression: "#version = :version",
                ExpressionAttributeNames: {
                    "#version": "version"
                },
                ExpressionAttributeValues: {
                    ":version": 1
                },
                ProjectionExpression: "orderId"
            };

            const client = new aws.sdk.DynamoDB.DocumentClient()
            const { Items } = await client.query(params).promise()

            const orderId = Items.reduce((result, item) => {
                if (Number(item.orderId) > result) {
                    result = Number(item.orderId)
                }
                return result
            }, 0) + 1

            console.log("Adding new order with ID : ", orderId)

            const orderItem = {
                ...body,
                "version": 1,
                "orderId": orderId,
                "confirmed": false,
                "visible": false,
                "canceled": false,
                "locked": false,
                "timestamp": Math.floor(new Date().valueOf() / 1000)
            }

            params = {
                TableName: tableName,
                Item: orderItem
            }

            // if (!check.like(orderItem, Order)) {
            //     throw new Error("Invalid JSON structure")
            // }

            console.log("saving : ", params)

            await client.put(params).promise()

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: "ok",
                    body,
                    orderId: orderId
                }),
            }

        } else {
            throw new Error("Invalid JSON structure")
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

const confirmOrder = async (event, tableName) => {

    // orderId, message, signature -> ownerAddress
    console.log("Confirming an order")

    try {

        console.log("EVENT: \n" + JSON.stringify(event, null, 2))

        const body = parseBody(event)

        console.log("BODY: \n", body)

        const { orderId, message, signature } = body

        const client = new aws.sdk.DynamoDB.DocumentClient()

        let params = {
            TableName: tableName,
            Key: {
                "version": 1,
                "orderId": orderId
            }
        };

        const { Item } = await client.get(params).promise()

        if (Item) {

            const ownerAddress = Item.ownerAddress

            console.log("Verifying order's owner address :  ", ownerAddress)

            const recoveredAddress = ethers.utils.verifyMessage(message, signature)

            console.log("Recovered address : ", recoveredAddress)

            if (recoveredAddress.toLowerCase() === ownerAddress.toLowerCase()) {

                Item["confirmed"] = true
                Item["visible"] = true

                params = {
                    TableName: tableName,
                    Item
                }

                console.log("Saving: \n", Item)

                await client.put(params).promise()

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        "status": "ok",
                        "orderId": orderId
                    }),
                }

            } else {
                throw new Error("You are not authorized to confirm the order")
            }

        } else {
            throw new Error("Given order Id is invalid")
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

const cancelOrder = async (event, tableName) => {

    console.log("Cancelling an order")

    try {

        console.log("EVENT: \n" + JSON.stringify(event, null, 2))

        const body = parseBody(event)

        console.log("BODY: \n", body)

        const { orderId, message, signature } = body

        const client = new aws.sdk.DynamoDB.DocumentClient()

        let params = {
            TableName: tableName,
            Key: {
                "version": 1,
                "orderId": orderId
            }
        };

        const { Item } = await client.get(params).promise()

        if (Item) {

            const ownerAddress = Item.ownerAddress

            console.log("Verifying order's owner address :  ", ownerAddress)

            const recoveredAddress = ethers.utils.verifyMessage(message, signature)

            console.log("Recovered address : ", recoveredAddress)

            if (recoveredAddress.toLowerCase() === ownerAddress.toLowerCase()) {

                Item["canceled"] = true
                Item["visible"] = false

                params = {
                    TableName: tableName,
                    Item
                }

                console.log("Saving: \n", Item)

                await client.put(params).promise()

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        "status": "ok",
                        "orderId": orderId
                    }),
                }

            } else {
                throw new Error("You are not authorized to confirm the order")
            }
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
    createOrder,
    getAllOrders,
    getOrder,
    confirmOrder,
    cancelOrder
}