const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const { ethers } = require("ethers");

const { headers } = require("./")
const { LUCKBOX_ABI } = require("../abi")
const { finalizeWinners } = require("../utils")

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

            if (Item) {

                // find the timestamp
                const currentTimestamp = Number(Item.claimStart)
                const lastWeekTimestamp = currentTimestamp - (86400 * 3)

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
                            ":from": lastWeekTimestamp,
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

                let rpcUrl

                switch (Number(Item.chainId)) {
                    case 137:
                        rpcUrl = process.env.POLYGON_RPC_SERVER || "https://polygon-mainnet.g.alchemy.com/v2/jucVpnvhzklnSjwTPXs5sTdz3IkIELwx"
                        break;
                    case 1:
                        rpcUrl = process.env.MAINNET_RPC_SERVER || "https://nd-454-395-901.p2pify.com/aa03c13657e5ccc30a12bba624297b80"
                    default:
                        break;
                }

                let onchainData
                let rewards = []

                if (rpcUrl && Item.rewardContract) {
                    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
                    const luckboxContract = new ethers.Contract(Item.rewardContract, LUCKBOX_ABI, provider)

                    const eventInfo = await luckboxContract.events(eventId)

                    console.log("eventInfo --> ", eventInfo)

                    onchainData = {
                        resultAttached: eventInfo['merkleRoot'] !== "0x0000000000000000000000000000000000000000000000000000000000000000",
                        totalClaim: eventInfo['claimCount'].toString(),
                        eventEnded: eventInfo['ended'],
                        seedNumber: eventInfo['seed'].toString(),
                        winners: finalizeWinners({
                            rewards: Item.rewards,
                            participants,
                            seedNumber: eventInfo['seed'].toString()
                        })
                    }

                    if (onchainData && onchainData.seedNumber !== "0" && onchainData.winners && onchainData.winners.length > 0) {

                        const getAsset = async (item) => {

                            const assetInfo = await luckboxContract.poaps(item[0])

                            return {
                                "rewardId": item[0],
                                "assetAddress": assetInfo[0],
                                "winnerAddress": item[1],
                                "tokenId": assetInfo[1].toString(),
                                "assetIs1155": assetInfo[2]
                            }
                        }

                        onchainData.winners = await Promise.all(onchainData.winners.map(item => getAsset(item)))

                    } else {
                        onchainData.winners = []
                    }

                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: "ok",
                        ...Item,
                        participants: participants.length,
                        rewards,
                        ...onchainData,
                        snapshotTimestamp
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
    getEvent
}