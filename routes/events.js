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


const getEvent = async (event, { dataTable , projectTable}) => {
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

                    participants = participants.concat(holders)
                }

                participants.sort()

                // generate the winner list

                let rpcUrl

                switch (Number(Item.chainId)) {
                    case 137:
                        rpcUrl = process.env.POLYGON_RPC_SERVER
                        break;
                    case 1:
                        rpcUrl = process.env.MAINNET_RPC_SERVER
                    default:
                        break;
                }

                // if (rpcUrl) {
                //     const provider = ethers.providers.JsonRpcProvider(rpcUrl)
                    
                //     const luckboxContract = 

                // }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: "ok", 
                        ...Item,
                        participants : participants.length,
                        rpcUrl
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