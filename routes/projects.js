const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const config = new pulumi.Config();

const { headers } = require("./")

let projects = config.getObject("projects") || []

projects = projects.map(project => {
    const { ID, NAME, CHAIN_ID, ASSETS, IMAGE_URL, DESCRIPTION, TOTAL_ITEMS } = require(`../projects/${project}/constants`)
    return {
        projectId: ID,
        name: NAME,
        description: DESCRIPTION,
        chainId: CHAIN_ID,
        assets: ASSETS,
        imageUrl: IMAGE_URL,
        total: TOTAL_ITEMS
    }
})

const getAllProjects = async (event) => {

    try {

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({
                status: "ok",
                projects
            })
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

const getProject = async (event, tableName) => {

    try {

        if (event && event.pathParameters) {

            const projectId = event.pathParameters.proxy
            const client = new aws.sdk.DynamoDB.DocumentClient()

            let currentTimestamp = Math.floor(new Date().valueOf() / 1000)
            let attachedList = false

            if (event.queryStringParameters && event.queryStringParameters.timestamp) {
                currentTimestamp = Number(event.queryStringParameters.timestamp)   
            }
            if (event.queryStringParameters && event.queryStringParameters.holderlist) {
                attachedList = event.queryStringParameters.holderlist === "yes" ? true : false
            }

            const lastWeekTimestamp = currentTimestamp - (86400 * 7)

            const params = {
                TableName: tableName,
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

            const { Items } = await client.query(params).promise()

            if (Items && Items.length > 0) {

                let lastItem = Items[Items.length - 1]
                const holderList = lastItem.holders
                lastItem.holders = lastItem.holders.length
                const extend = projects.find(item => Number(item.projectId) === Number(projectId))

                if (attachedList) {
                    lastItem['holderList'] = holderList
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: "ok",
                        name: extend.name,
                        description: extend.description,
                        chainId: extend.chainId,
                        imageUrl: extend.imageUrl,
                        total: extend.total || 0,
                        ...lastItem,
                    }),
                }
            }

        }

        throw new Error("Invalid project ID")

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
    getAllProjects,
    getProject
}