const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const { ethers } = require("ethers");
const check = require('check-types');
const { MerkleTree } = require('merkletreejs')
const keccak256 = require("keccak256")
const AWS = require("aws-sdk")
const { headers } = require("./headers")
const { LUCKBOX_ABI } = require("../abi")
const Event = require("../types/event")
const Registration = require("../types/registration")
const { generateWinners, finalizeWinners, getProvider, parseBody, dataURLtoFile } = require("../utils")
const { accessKeyId, secretAccessKey, region } = require("../config.json");
const { allowedAccountIds } = require("@pulumi/aws/config");




const getParticipants = async (currentTimestamp, projectTable, projectIds) => {

    // find the timestamp
    const last3DayTimestamp = currentTimestamp - (86400 * 3)

    let participants = []
    let snapshotTimestamp

    for (let projectId of projectIds) {

        const client = new aws.sdk.DynamoDB.DocumentClient()

        const projectParams = {
            TableName: projectTable,
            KeyConditionExpression: "#projectId = :projectId and #timestamp BETWEEN :from AND :to",
            ExpressionAttributeNames: {
                "#projectId": "projectId",
                "#timestamp": "timestamp"
            },
            ExpressionAttributeValues: {
                ":projectId": Number(projectId),
                ":from": last3DayTimestamp,
                ":to": currentTimestamp
            }
        };

        const { Items } = await client.query(projectParams).promise()
        const lastItem = Items[Items.length - 1]
        const { holders } = lastItem

        snapshotTimestamp = lastItem.timestamp

        participants = participants.concat(holders)
    }

    return {
        participants: participants.sort(),
        snapshotTimestamp
    }
}

const createEvent = async (event, { dataTable, projectTable }) => {

    try {
        if (event && event.pathParameters) {

            const base64String = event.pathParameters.proxy

            const buff = Buffer.from(base64String, "base64");
            const eventBodyStr = buff.toString('UTF-8');
            const eventBody = JSON.parse(eventBodyStr);

            console.log("Receiving payload : ", eventBody)

            // example payload
            // {
            //     title : Naga DAO NFT,
            //     description : 3x Naga DAO NFT rewards for 3 lucky owners who held Naga DAO NFT at the time of snapshot (Saturday, 26 March 2022, 00:00:00 UTC).,
            //     imageUrl : https://img.tamago.finance/luckbox/event/event-2.png ,
            //     claimStart : 1648252800, 
            //     claimEnd : 1648684800 ,
            //     snapshotDate : 1648252800,
            //     chainId : 137,
            //     community : Naga DAO,
            //     owner : 0xaF00d9c1C7659d205e676f49Df51688C9f053740,
            //     communityImageUrl : https://img.tamago.finance/luckbox/naga-dao-logo.png,
            //     participants : [1,2,3]
            //     rewards : [] 
            // }

            if (eventBody && check.like(eventBody, Event)) {

                // looks for Event ID
                let params = {
                    TableName: dataTable,
                    KeyConditionExpression: "#key = :key",
                    ExpressionAttributeNames: {
                        "#key": "key"
                    },
                    ExpressionAttributeValues: {
                        ":key": "event"
                    },
                    ProjectionExpression: "eventId"
                };

                const client = new aws.sdk.DynamoDB.DocumentClient()
                const { Items } = await client.query(params).promise()

                const eventId = Items.reduce((result, item) => {
                    if (Number(item.eventId) > result) {
                        result = Number(item.eventId)
                    }
                    return result
                }, 0) + 1

                console.log("Adding new event with ID : ", eventId)

                const spots = eventBody.rewards.length
                const requiredTimestamp = Number(eventBody.snapshotDate) || Number(eventBody.claimStart)

                const participants = await getParticipants(requiredTimestamp, projectTable, eventBody.participants)

                const wallets = participants.length

                params = {
                    TableName: dataTable,
                    Item: {
                        ...eventBody,
                        "key": "event",
                        "value": `${eventId}`,
                        "eventId": `${eventId}`,
                        spots,
                        wallets
                    }
                }

                console.log("saving : ", params)

                await client.put(params).promise()

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        "status": "ok",
                        "eventId": eventId
                    }),
                }

            } else {
                throw new Error("Invalid JSON structure")
            }

        } else {
            throw new Error("Params is not provided")
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

//to be editted
// const _createEvent = async (event, { dataTable, projectTable, bucket }) => {

//     console.log("creating ")
//     try {
//         if (event) {

//             // const base64String = event.pathParameters.proxy

//             // const buff = Buffer.from(base64String, "base64");
//             // const eventBodyStr = buff.toString('UTF-8');
//             // const eventBody = JSON.parse(eventBodyStr);
//             const body = parseBody(event)

//             console.log("Receiving payload : ", body)

//             // example payload
//             // {
//             //     title : Naga DAO NFT,
//             //     description : 3x Naga DAO NFT rewards for 3 lucky owners who held Naga DAO NFT at the time of snapshot (Saturday, 26 March 2022, 00:00:00 UTC).,
//             //     imageUrl : https://img.tamago.finance/luckbox/event/event-2.png ,
//             //     claimStart : 1648252800, 
//             //     claimEnd : 1648684800 ,
//             //     snapshotDate : 1648252800,
//             //     chainId : 137,
//             //     community : Naga DAO,
//             //     owner : 0xaF00d9c1C7659d205e676f49Df51688C9f053740,
//             //     communityImageUrl : https://img.tamago.finance/luckbox/naga-dao-logo.png,
//             //     participants : [1,2,3]
//             //     rewards : [] 
//             // }

//             if (body && check.like(body, Event)) {

//                 console.log("line202")
//                 const s3 = new AWS.S3({
//                     accessKeyId,
//                     secretAccessKey
//                 })

//                 const fileContent = dataURLtoFile(body.imageUrl, body.slug)



//                 const s3Params = {
//                     Bucket: "images-b70d9d1",
//                     Key: fileContent.name,
//                     Body: fileContent
//                 }

//                 console.log({ s3Params })
//                 const uploadedImage = await s3.upload(s3Params).promise()
//                 console.log("line219 ", { uploadedImage })
//                 const newBody = { ...body, imageUrl: uploadedImage.Location }
//                 console.log("Updating imageUrl: ", newBody)
//                 // looks for Event ID
//                 let params = {
//                     TableName: dataTable,
//                     KeyConditionExpression: "#key = :key",
//                     ExpressionAttributeNames: {
//                         "#key": "key"
//                     },
//                     ExpressionAttributeValues: {
//                         ":key": "event"
//                     },
//                     ProjectionExpression: "eventId"
//                 };

//                 const client = new aws.sdk.DynamoDB.DocumentClient()
//                 const { Items } = await client.query(params).promise()

//                 const eventId = Items.reduce((result, item) => {
//                     if (Number(item.eventId) > result) {
//                         result = Number(item.eventId)
//                     }
//                     return result
//                 }, 0) + 1

//                 console.log("Adding new event with ID : ", eventId)

//                 const spots = body.rewards.length
//                 const requiredTimestamp = Number(body.snapshotDate) || Number(body.claimStart)

//                 const participants = await getParticipants(requiredTimestamp, projectTable, body.participants)

//                 const wallets = participants.length

//                 params = {
//                     TableName: dataTable,
//                     Item: {
//                         ...newBody,
//                         "key": "event",
//                         "value": `${eventId}`,
//                         "eventId": `${eventId}`,
//                         spots,
//                         wallets
//                     }
//                 }

//                 console.log("saving : ", params)

//                 await client.put(params).promise()

//                 return {
//                     statusCode: 200,
//                     headers,
//                     body: JSON.stringify({
//                         "status": "ok",
//                         "eventId": eventId
//                     }),
//                 }

//             } else {
//                 throw new Error("Invalid JSON structure")
//             }

//         } else {
//             throw new Error("Body is not provided")
//         }
//     } catch (error) {
//         return {
//             statusCode: 400,
//             headers,
//             body: JSON.stringify({
//                 status: "error",
//                 message: `${error || "Unknown error."}`
//             }),
//         };
//     }

// }

const _createEvent = async (event, { dataTable, projectTable, bucket }) => {

    console.log("creating ")
    try {
        if (event) {

            // const base64String = event.pathParameters.proxy

            // const buff = Buffer.from(base64String, "base64");
            // const eventBodyStr = buff.toString('UTF-8');
            // const eventBody = JSON.parse(eventBodyStr);
            const body = parseBody(event)

            console.log("Receiving payload : ", body)

            const s3 = new AWS.S3({
                accessKeyId,
                secretAccessKey
            })

            if (body && check.like(body, Event)) {

                const fileContent = Buffer.from(body.imageUrl.replace(/^data:image\/\w+;base64,/, ""), 'base64')
                var arr = body.imageUrl.split(',')
                let contentType = ""
                switch (arr[1][0]) {
                    case '/': contentType = 'image/jpeg'
                        break;
                    case 'i': contentType = 'image/png'
                        break;
                    case 'R': contentType = 'image/gif'
                        break;
                    case 'U': contentType = 'image/webp'
                        break;
                }

                const s3Params = {
                    Key: body.slug + String(Date.parse(new Date())).slice(-10, -3),
                    Bucket: bucket.bucket,
                    Body: fileContent,
                    ContentEncoding: 'base64',
                    ContentType: 'image/jpeg'
                }

                // await bucket.upload(s3Params, function (err, data) {
                //     if (err) {
                //         console.log(err);
                //         console.log('Error uploading data: ', data);
                //     } else {
                //         console.log('successfully uploaded the image!');
                //     }
                // });
                console.log({ s3Params })
                const uploadedImage = await s3.upload(s3Params).promise()
                console.log("line219 ", { uploadedImage })
                const newBody = { ...body, imageUrl: uploadedImage.Location }
                console.log("Updating imageUrl: ", newBody)
                // looks for Event ID
                let params = {
                    TableName: dataTable,
                    KeyConditionExpression: "#key = :key",
                    ExpressionAttributeNames: {
                        "#key": "key"
                    },
                    ExpressionAttributeValues: {
                        ":key": "event"
                    },
                    ProjectionExpression: "eventId"
                };

                const client = new aws.sdk.DynamoDB.DocumentClient()
                const { Items } = await client.query(params).promise()

                const eventId = Items.reduce((result, item) => {
                    if (Number(item.eventId) > result) {
                        result = Number(item.eventId)
                    }
                    return result
                }, 0) + 1

                console.log("Adding new event with ID : ", eventId)

                const spots = body.rewards.length
                const requiredTimestamp = Number(body.snapshotDate) || Number(body.claimStart)

                const participants = await getParticipants(requiredTimestamp, projectTable, body.participants)

                const wallets = participants.length

                params = {
                    TableName: dataTable,
                    Item: {
                        ...newBody,
                        "key": "event",
                        "value": `${eventId}`,
                        "eventId": `${eventId}`,
                        spots,
                        wallets
                    }
                }

                console.log("saving : ", params)

                await client.put(params).promise()

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        "status": "ok",
                        "eventId": eventId
                    }),
                }

            } else {
                throw new Error("Invalid JSON structure")
            }

        } else {
            throw new Error("Body is not provided")
        }
    } catch (error) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                status: "error",
                message: `${error || "Unknown error."}`
            }),
        };
    }

}

const updateEvent = async (event, { dataTable, projectTable }) => {
    try {
        if (event && event.pathParameters) {

            const base64String = event.pathParameters.proxy

            const buff = Buffer.from(base64String, "base64");
            const eventBodyStr = buff.toString('UTF-8');
            const eventBody = JSON.parse(eventBodyStr);

            console.log("Receiving payload : ", eventBody)

            // example payload
            // {
            //     title : Naga DAO NFT,
            //     description : 3x Naga DAO NFT rewards for 3 lucky owners who held Naga DAO NFT at the time of snapshot (Saturday, 26 March 2022, 00:00:00 UTC).,
            //     imageUrl : https://img.tamago.finance/luckbox/event/event-2.png ,
            //     claimStart : 1648252800, 
            //     claimEnd : 1648684800 ,
            //     snapshotDate : 1648252800,
            //     chainId : 137,
            //     community : Naga DAO,
            //     owner : 0xaF00d9c1C7659d205e676f49Df51688C9f053740,
            //     communityImageUrl : https://img.tamago.finance/luckbox/naga-dao-logo.png,
            //     participants : [1,2,3]
            //     rewards : [] 
            // }
            if (eventBody) {
                const eventId = eventBody.eventId
                let params = {
                    TableName: dataTable,
                    Key: {
                        "key": "event",
                        "value": eventId
                    }
                };
                const _client = new aws.sdk.DynamoDB.DocumentClient()
                let { Item } = await _client.get(params).promise()
                console.log("Updating new event with ID : ", eventId)


                const requiredTimestamp = Number(eventBody.snapshotDate) || Number(eventBody.claimStart)
                const _projectIDs = Item.participants || []
                let { participants } = await getParticipants(requiredTimestamp, projectTable, _projectIDs)


                const updateData = {
                    ...eventBody, "key": "event",
                    "value": `${eventId}`,
                    "eventId": `${eventId}`,
                    participants,
                }

                if (updateData && check.like(updateData, Event)) {
                    const spots = eventBody.rewards.length
                    const wallets = participants.length
                    console.log("saving : ", params)
                    params = {
                        TableName: dataTable,
                        // Key: { key: "event", value: `${eventId}` },
                        Item: { ...updateData, spots, wallets, }

                    }

                }

                await _client.put(params).promise()

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        "status": "ok",
                        "eventId": eventId
                    }),
                }

            } else {
                throw new Error("Invalid JSON structure")
            }

        } else {
            throw new Error("Params is not provided")
        }
    } catch (error) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                status: "error",
                message: `Updating Error ${error}`
            }),
        };
    }

}

const register = async (event, { dataTable }) => {

    try {

        const base64String = event.pathParameters.proxy

        const buff = Buffer.from(base64String, "base64");
        const eventBodyStr = buff.toString('UTF-8');
        const eventBody = JSON.parse(eventBodyStr);

        console.log("Receiving payload : ", eventBody)

        if (eventBody && check.like(eventBody, Registration)) {

            const eventId = eventBody.eventId
            const client = new aws.sdk.DynamoDB.DocumentClient()

            let params = {
                TableName: dataTable,
                Key: {
                    "key": "event",
                    "value": eventId
                }
            };

            let { Item } = await client.get(params).promise()

            if (Item) {

                if (!Item["registered"]) {
                    Item["registered"] = []
                }

                if (Item["registered"].indexOf(eventBody.walletAddress) === -1) {
                    Item["registered"].push(eventBody.walletAddress)
                }

                params = {
                    TableName: dataTable,
                    Item
                }

                console.log("saving: \n", Item)

                await client.put(params).promise()

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        "status": "ok",
                        "eventId": eventId
                    }),
                }

            } else {
                throw new Error("Invalid event ID")
            }

        } else {
            throw new Error("Invalid incoming data struture")
        }

    } catch (error) {
        console.log(error)
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

const getAllEvents = async (event, tableName) => {

    try {

        let showAll = false

        if (event.queryStringParameters && event.queryStringParameters.all && event.queryStringParameters.all === "yes") {
            showAll = true
        }

        const params = {
            TableName: tableName,
            KeyConditionExpression: "#key = :key",
            ExpressionAttributeNames: {
                "#key": "key"
            },
            ExpressionAttributeValues: {
                ":key": "event"
            },
            ProjectionExpression: "visible, community, eventId, participants, wallets, slug, spots, ended, imageUrl, claimStart, claimEnd, title"
        };

        const client = new aws.sdk.DynamoDB.DocumentClient()
        const { Items } = await client.query(params).promise()

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: "ok",
                events: showAll ? Items : Items.filter(item => item.visible)
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


const getEvent = async (event, { dataTable, projectTable }) => {
    try {

        if (event && event.pathParameters) {

            const eventId = event.pathParameters.proxy
            const client = new aws.sdk.DynamoDB.DocumentClient()

            const params = {
                TableName: dataTable,
                Key: {
                    "key": "event",
                    "value": eventId
                }
            };

            const { Item } = await client.get(params).promise()

            const requiredTimestamp = Number(Item.snapshotDate) || Number(Item.claimStart)

            if (Item) {

                // get the holder list
                const projectIds = Item.participants
                const { participants, snapshotTimestamp } = await getParticipants(requiredTimestamp, projectTable, projectIds)

                // check who registered to the event
                const registered = Item.registered ? (Item.registered).map(item => item.toLowerCase()) : []

                console.log("all registered wallets :\n", registered)
                const eligibleParticipants = participants.filter(item => registered.indexOf(item.toLowerCase()) !== -1)

                console.log("all eligible participants :\n", eligibleParticipants)

                // generate the winner list
                let onchainData
                let totalWinners = 0

                if (Item.rewardContract && Item.chainId) {
                    const provider = getProvider(Number(Item.chainId))
                    const luckboxContract = new ethers.Contract(Item.rewardContract, LUCKBOX_ABI, provider)

                    const eventInfo = await luckboxContract.events(eventId)

                    console.log("eventInfo --> ", eventInfo)

                    onchainData = {
                        resultAttached: eventInfo['merkleRoot'] !== "0x0000000000000000000000000000000000000000000000000000000000000000",
                        totalClaim: eventInfo['claimCount'].toString(),
                        eventEnded: eventInfo['ended'],
                        seedNumber: eventInfo['seed'].toString(),
                        winners: generateWinners({
                            rewards: Item.rewards,
                            participants: eligibleParticipants.length === 0 ? participants : eligibleParticipants,
                            seedNumber: eventInfo['seed'].toString()
                        })
                    }

                    onchainData.winners = await finalizeWinners(luckboxContract, onchainData)
                    totalWinners = onchainData.winners.length
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: "ok",
                        community: {
                            name: Item.community,
                            image: Item.communityImageUrl
                        },
                        ...Item,
                        participants: participants.length,
                        ...onchainData,
                        totalWinners,
                        timestamp: {
                            requiredTimestamp,
                            latestSnapshot: snapshotTimestamp
                        }

                    }),
                }
            }
        }

        throw new Error("Invalid event ID")

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


const getRegistered = async (event, { dataTable, projectTable }) => {

    try {

        if (event && event.pathParameters) {

            const eventId = event.pathParameters.proxy
            const client = new aws.sdk.DynamoDB.DocumentClient()

            const params = {
                TableName: dataTable,
                Key: {
                    "key": "event",
                    "value": eventId
                }
            };

            const { Item } = await client.get(params).promise()

            if (Item) {
                let registered = []

                if (Item.registered) {
                    registered = Item.registered
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: "ok",
                        registered
                    }),
                }
            }
        }

        throw new Error("Invalid event ID")

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

const generateProof = async (event, { dataTable, projectTable }) => {

    try {

        if (event && event.pathParameters) {

            const eventId = event.pathParameters.proxy
            const client = new aws.sdk.DynamoDB.DocumentClient()

            const params = {
                TableName: dataTable,
                Key: {
                    "key": "event",
                    "value": eventId
                }
            };

            const { Item } = await client.get(params).promise()

            const requiredTimestamp = Number(Item.snapshotDate) || Number(Item.claimStart)

            if (Item) {

                // get the holder list
                const projectIds = Item.participants
                const { participants } = await getParticipants(requiredTimestamp, projectTable, projectIds)

                // check who registered to the event
                const registered = Item.registered ? (Item.registered).map(item => item.toLowerCase()) : []

                console.log("all registered wallets :\n", registered)
                const eligibleParticipants = participants.filter(item => registered.indexOf(item.toLowerCase()) !== -1)

                console.log("all eligible participants :\n", eligibleParticipants)

                let totalWinners = 0

                // generate winner list
                const provider = getProvider(Number(Item.chainId))
                const luckboxContract = new ethers.Contract(Item.rewardContract, LUCKBOX_ABI, provider)

                const eventInfo = await luckboxContract.events(eventId)

                const data = {
                    resultAttached: eventInfo['merkleRoot'] !== "0x0000000000000000000000000000000000000000000000000000000000000000",
                    totalClaim: eventInfo['claimCount'].toString(),
                    eventEnded: eventInfo['ended'],
                    seedNumber: eventInfo['seed'].toString(),
                    winners: generateWinners({
                        rewards: Item.rewards,
                        participants: eligibleParticipants.length === 0 ? participants : eligibleParticipants,
                        seedNumber: eventInfo['seed'].toString()
                    })
                }

                const winners = await finalizeWinners(luckboxContract, data)
                totalWinners = winners.length

                // generate Merkle tree 
                const leaves = winners.map(item => ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256"], [item.winnerAddress, Number(item.rewardId)])))
                const tree = new MerkleTree(leaves, keccak256, { sortPairs: true })

                const root = tree.getHexRoot()

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: "ok",
                        eventId,
                        rewardContract: Item.rewardContract,
                        totalWinners,
                        root,
                        winners: winners.map((item => {
                            const proof = tree.getHexProof(ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256"], [item.winnerAddress, Number(item.rewardId)])))
                            return {
                                proof,
                                ...item
                            }
                        }))
                    }),
                }
            }
        }

        throw new Error("Invalid event ID")

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
    getAllEvents,
    getEvent,
    generateProof,
    createEvent,
    _createEvent,
    register,
    getRegistered,
    updateEvent,
}