const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const check = require('check-types');
const { ethers } = require("ethers");
const { getProvider, parseBody, dataURLtoFile } = require("../utils")
const { headers } = require("./headers")
const { Campaign } = require("../types/campaign")

const createCampaign = async (event, tableName) => {

    console.log("creating a new campaign...")

    try {

        console.log("EVENT: \n" + JSON.stringify(event, null, 2))

        const body = parseBody(event)

        console.log("Receiving payload : ", body)

        if (body) {

            // looks for Event ID
            let params = {
                TableName: tableName,
                KeyConditionExpression: "#version = :version",
                ExpressionAttributeNames: {
                    "#version": "version"
                },
                ExpressionAttributeValues: {
                    ":version": 2
                },
                ProjectionExpression: "campaignId"
            };

            const client = new aws.sdk.DynamoDB.DocumentClient()
            const { Items } = await client.query(params).promise()

            const campaignId = Items.reduce((result, item) => {
                if (Number(item.campaignId) > result) {
                    result = Number(item.campaignId)
                }
                return result
            }, 0) + 1

            const spots = body.rewards.length
            console.log("Adding new event with ID : ", campaignId)

            params = {
                TableName: tableName,
                Item: {
                    ...body,
                    "version": 2,
                    "campaignId": campaignId,
                    spots,
                    visible: false,
                    confirmed: false
                }
            }

            console.log("saving : ", params)

            await client.put(params).promise()

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    "status": "ok",
                    "campaignId": campaignId
                }),
            }

        } else {
            throw new Error("Invalid JSON stucture")
        }

    } catch (error) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                status: "error",
                message: `Updating Error ${error}`
            }),
        }
    }

}

const confirmCampaign = async (event, tableName) => {

    console.log("Confirming...")

    try {

        const client = new aws.sdk.DynamoDB.DocumentClient()
        const type = event.pathParameters.proxy

        console.log("EVENT: \n" + JSON.stringify(event, null, 2))

        const body = parseBody(event)

        console.log("BODY: \n", body)

        if (type === "update") {

            const { campaign, message, signature, ownerAddress } = body
            const { campaignId } = campaign

            // verify the address
            console.log("Verifying the address :  ", ownerAddress)

            const recoveredAddress = ethers.utils.verifyMessage(message, signature)

            if (recoveredAddress.toLowerCase() === ownerAddress.toLowerCase()) {

                let params = {
                    TableName: tableName,
                    Key: {
                        "version": 2,
                        "campaignId": campaignId
                    }
                };

                const { Item } = await client.get(params).promise()

                if (Item) {

                    params = {
                        TableName: tableName,
                        Item: {
                            ...Item,
                            ...campaign
                        }
                    }

                    console.log("updating : ", params)

                    await client.put(params).promise()

                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            "status": "ok",
                            "campaignId": campaignId
                        }),
                    }

                } else {
                    throw new Error("Invalid given campaign ID")
                }

            } else {
                throw new Error("Invalid signed message")
            }


        } else if (type === "remove") {

            const { campaignId, message, signature, ownerAddress } = body

            // verify the address
            console.log("Verifying the address :  ", ownerAddress)

            const recoveredAddress = ethers.utils.verifyMessage(message, signature)

            if (recoveredAddress.toLowerCase() === ownerAddress.toLowerCase()) {

                let params = {
                    TableName: tableName,
                    Key: {
                        "version": 2,
                        "campaignId": campaignId
                    }
                };


                const { Item } = await client.get(params).promise()

                if (Item) {

                    params = {
                        TableName: tableName,
                        Item: {
                            ...Item,
                            visible: false
                        }
                    }

                    console.log("saving : ", params)

                    await client.put(params).promise()

                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            "status": "ok",
                            "campaignId": campaignId
                        }),
                    }

                } else {
                    throw new Error("Invalid given campaign ID")
                }

            } else {
                throw new Error("Invalid signed message")
            }


        } else if (type === "confirm") {
            const { campaignId, contractAddress, message, signature, ownerAddress } = body
            // verify the address
            console.log("Verifying the address :  ", ownerAddress)

            const recoveredAddress = ethers.utils.verifyMessage(message, signature)

            if (recoveredAddress.toLowerCase() === ownerAddress.toLowerCase()) {

                let params = {
                    TableName: tableName,
                    Key: {
                        "version": 2,
                        "campaignId": campaignId
                    }
                };


                const { Item } = await client.get(params).promise()

                if (Item) {

                    params = {
                        TableName: tableName,
                        Item: {
                            ...Item,
                            contractAddress,
                            registered: [],
                            visible: true,
                            confirmed: true
                        }
                    }

                    console.log("saving : ", params)

                    await client.put(params).promise()

                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            "status": "ok",
                            "campaignId": campaignId
                        }),
                    }

                } else {
                    throw new Error("Invalid given campaign ID")
                }

            } else {
                throw new Error("Invalid signed message")
            }

        } else if (type === "winners") {

            const { winners, campaignId, message, signature, ownerAddress } = body

            const recoveredAddress = ethers.utils.verifyMessage(message, signature)

            if (recoveredAddress.toLowerCase() === ownerAddress.toLowerCase()) {

                let params = {
                    TableName: tableName,
                    Key: {
                        "version": 2,
                        "campaignId": Number(campaignId)
                    }
                };

                const { Item } = await client.get(params).promise()

                if (Item) {

                    if (!Item["winners"]) {
                        Item["winners"] = []
                    }
    
                    Item["winners"] = winners
    
                    params = {
                        TableName: tableName,
                        Item
                    }
    
                    console.log("saving: \n", Item)
    
                    await client.put(params).promise()
    
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            "status": "ok",
                            "campaignId": campaignId
                        }),
                    }

                } else {
                    throw new Error("Invalid given campaign ID")
                }

            } else {
                throw new Error("Invalid signed message")
            }

        }


        else if (type === "register") {

            const { walletAddress, campaignId } = body

            let params = {
                TableName: tableName,
                Key: {
                    "version": 2,
                    "campaignId": Number(campaignId)
                }
            };

            let { Item } = await client.get(params).promise()

            if (Item) {

                if (!Item["registered"]) {
                    Item["registered"] = []
                }

                if (Item["registered"].indexOf(walletAddress) === -1) {
                    Item["registered"].push(walletAddress)
                }

                params = {
                    TableName: tableName,
                    Item
                }

                console.log("saving: \n", Item)

                await client.put(params).promise()

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        "status": "ok",
                        "campaignId": campaignId
                    }),
                }

            } else {
                throw new Error("Invalid campaign ID")
            }

        }

        throw new Error("Invalid type")


    } catch (e) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                status: "error",
                message: `${e.message}`
            }),
        }
    }

}

const getAllCampaigns = async (event, tableName) => {

    console.log("listing all campaigns...")

    try {

        console.log("EVENT: \n" + JSON.stringify(event, null, 2))

        const params = {
            TableName: tableName,
            KeyConditionExpression: "#version = :version",
            ExpressionAttributeNames: {
                "#version": "version"
            },
            ExpressionAttributeValues: {
                ":version": 2
            },
            ProjectionExpression: "campaignId, slug, title, imageUrl, claimStart, claimEnd, chainId, participants, visible, confirmed, community, spots, registered, ownerAddress"
        };

        const client = new aws.sdk.DynamoDB.DocumentClient()
        let { Items } = await client.query(params).promise()

        Items = Items.map(item => {
            if (!item['registered']) {
                item['registered'] = []
            }
            return {
                ...item,
                registered: item.registered.length
            }
        })

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                "status": "ok",
                "campaigns": Items.filter(item => item.visible && item.confirmed)
            }),
        }

    } catch (e) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                status: "error",
                message: `${e.message}`
            }),
        }
    }

}

const getCampaign = async (event, tableName) => {

    try {

        if (event && event.pathParameters) {

            const campaignId = event.pathParameters.proxy
            const client = new aws.sdk.DynamoDB.DocumentClient()

            const params = {
                TableName: tableName,
                Key: {
                    "version": 2,
                    "campaignId": Number(campaignId)
                }
            };

            const { Item } = await client.get(params).promise()

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: "ok",
                    campaign: Item

                }),
            }

        }
        throw new Error("Invalid campaignId")
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

const registerEmail = async (event, tableName) => {

    try {

        if (event && event.pathParameters) {

            const campaignId = event.pathParameters.proxy
            const client = new aws.sdk.DynamoDB.DocumentClient()

            console.log("EVENT: \n" + JSON.stringify(event, null, 2))

            const body = parseBody(event)

            console.log("BODY: \n", body)

            const { walletAddress } = body

            let params = {
                TableName: tableName,
                Key: {
                    "version": 2,
                    "campaignId": Number(campaignId)
                }
            };

            let { Item } = await client.get(params).promise()

            if (Item) {

                if (!Item["registered"]) {
                    Item["registered"] = []
                }

                if (Item["registered"].indexOf(walletAddress) === -1) {
                    Item["registered"].push(walletAddress)
                }

                params = {
                    TableName: tableName,
                    Item
                }

                console.log("saving: \n", Item)

                await client.put(params).promise()

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        "status": "ok",
                        "campaignId": campaignId
                    }),
                }

            } else {
                throw new Error("Invalid campaign ID")
            }

        }
        throw new Error("Invalid campaignId")

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


const updateCampaign = async (event, tableName) => {
    // TODO: Complete the function
}

const removeCampaign = async (event, tableName) => {
    // TODO: Complete the function
}

module.exports = {
    createCampaign,
    confirmCampaign,
    getAllCampaigns,
    getCampaign,
    updateCampaign,
    removeCampaign,
    registerEmail
}