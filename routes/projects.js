const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const config = new pulumi.Config();

const { headers } = require("./")

let projects = config.getObject("projects") || []

projects = projects.map(project => {
    const { ID, NAME, CHAIN_ID, ASSETS, IMAGE_URL } = require(`../projects/${project}/constants`)
    return {
        projectId: ID,
        name: NAME,
        chainid: CHAIN_ID,
        assets: ASSETS,
        imageUrl: IMAGE_URL
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

            const currentTimestamp =  Math.floor(new Date().valueOf() / 1000)
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
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: "ok",
                        ...lastItem
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