const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const { headers } = require("./")

exports.mainnet = async (event) => {

    if (event && event.pathParameters) {
        const tokenId = event.pathParameters.proxy
        if (["1", "2", "3"].indexOf(tokenId) !== -1) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    name: "Lucky Red Envelope NFT collection from Tamago Finance, each presents the specific amount of USD and backs by the value of SushiSwap LP tokens",
                    description: "The first value-backed NFT",
                    external_url: "https://tamago.finance",
                    image: `https://img.tamago.finance/lucky-red-envelope/${tokenId}.png`
                }),
            }
        }
    }

    return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
            status: "error",
            message: "Invalid ID"
        }),
    }

}

exports.polygon = async (event) => {

    if (event && event.pathParameters) {
        const tokenId = event.pathParameters.proxy
        if (["1", "2", "3"].indexOf(tokenId) !== -1) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    name: "Lucky Red Envelope NFT on Polygon",
                    description: "The first value-backed NFT from Tamago Finance, each presents the specific amount of USD and backs by the value of QuickSwap LP tokens",
                    external_url: "https://tamago.finance",
                    image: `https://img.tamago.finance/lucky-red-envelope/polygon/${tokenId}.png`
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

exports.bsc = async (event) => {

    if (event && event.pathParameters) {
        const tokenId = event.pathParameters.proxy
        if (["1", "2", "3"].indexOf(tokenId) !== -1) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    name: "Lucky Red Envelope NFT on BSC",
                    description: "The first value-backed NFT from Tamago Finance, each presents the specific amount of USD and backs by the value of PancakeSwap LP tokens",
                    external_url: "https://tamago.finance",
                    image: `https://img.tamago.finance/lucky-red-envelope/bsc/${tokenId}.png`
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