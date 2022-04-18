const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const { ethers } = require("ethers");
const { MerkleTree } = require('merkletreejs')
const keccak256 = require("keccak256")

const { headers } = require("./")
const { LUCKBOX_ABI } = require("../abi")
const { generateWinners, finalizeWinners, getProvider } = require("../utils")

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

            let snapshotTimestamp
            const requiredTimestamp = Number(Item.snapshotDate) || Number(Item.claimStart)

            if (Item) {

                // find the timestamp
                const currentTimestamp = requiredTimestamp
                const last3DayTimestamp = currentTimestamp - (86400 * 3)

                // get the holder list
                let participants = []

                const projectIds = Item.participants

                for (let projectId of projectIds) {
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

                participants.sort()

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
                            participants,
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

            let snapshotTimestamp
            const requiredTimestamp = Number(Item.snapshotDate) || Number(Item.claimStart)

            if (Item) {

                // find the timestamp
                const currentTimestamp = requiredTimestamp
                const last3DayTimestamp = currentTimestamp - (86400 * 3)

                // get the holder list
                let participants = []

                const projectIds = Item.participants

                for (let projectId of projectIds) {
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

                participants.sort()

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
                        participants,
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
    generateProof
}