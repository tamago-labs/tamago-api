const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const { headers } = require("./headers")

const axios = require("axios")

const proxy = async (event) => {
    try {

        if (event && event.pathParameters) {

            const site = event.pathParameters.proxy

            const { data } = await axios.get( site )

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    "status": "ok",
                    "site": site,
                    data
                }),
            }

        } else {
            throw new Error("Invalid query params")
        }

    } catch (error) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                status: "error",
                message: `${error.message || "Unknown error."}`
            }),
        }
    }
}

module.exports = {
    proxy
}