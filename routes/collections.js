const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const check = require('check-types');

const Moralis = require("moralis/node")

const { parseBody, generateMoralisParams, collectErc721Holders, collectErc1155Holders } = require("../utils")
const { CollectionCreate } = require("../types/collection")

const { headers } = require("./headers")
const { SUPPORT_MAINNET, SUPPORT_TESTNET } = require("../constants")

const getCollections = async (event, tableName) => {

    console.log("get collections...")

    try {

        let collections = []

        const client = new aws.sdk.DynamoDB.DocumentClient()

        for (let chainId of SUPPORT_MAINNET) {

            const params = {
                TableName: tableName,
                KeyConditionExpression: "#chainId = :chainId",
                ExpressionAttributeNames: {
                    "#chainId": "chainId"
                },
                ExpressionAttributeValues: {
                    ":chainId": chainId
                }
            };

            const { Items } = await client.query(params).promise()

            collections = collections.concat(Items)
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: "ok",
                collections
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


const getCollection = async (event, tableName) => {

    console.log("getting collection info...")

    try {

        console.log("EVENT: \n" + JSON.stringify(event, null, 2))

        if (event && event.pathParameters) {
            const client = new aws.sdk.DynamoDB.DocumentClient()

            let currentTimestamp = Math.floor(new Date().valueOf() / 1000)

            if (event.queryStringParameters && event.queryStringParameters.timestamp) {
                currentTimestamp = Number(event.queryStringParameters.timestamp)
            }

            const proxy = event.pathParameters.proxy

            const chainId = proxy.split("/")[0]
            const contractAddress = proxy.split("/")[1]

            const params = {
                TableName: tableName,
                Key: {
                    "chainId": Number(chainId),
                    "contractAddress": `${contractAddress.toLowerCase()}`
                }
            }

            const { Item } = await client.get(params).promise()

            if (Item) {

                const { chainId, name, is1155, contractAddress, verified, tableName } = Item

                let holders = []
                let ids = []

                // checking events

                console.log("Checking transfers events...")

                if (is1155) {
                    const response = await collectErc1155Holders(chainId, tableName, currentTimestamp)
                    holders = response.holders
                    ids = response.ids
                } else {
                    const response = await collectErc721Holders(chainId, tableName, currentTimestamp)
                    holders = response.holders
                    ids = response.ids
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: "ok",
                        name,
                        chainId,
                        is1155,
                        contractAddress,
                        verified,
                        holders,
                        tokenIds: ids,
                        timestamp: currentTimestamp
                    }),
                }
            } else {
                throw new Error("Your contract address and/or chain id is invalid")
            }
        }

        throw new Error("Invalid query params")

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

const createCollection = async (event, tableName) => {

    console.log("creating a collection...")

    try {

        console.log("EVENT: \n" + JSON.stringify(event, null, 2))

        const body = parseBody(event)

        console.log("BODY: \n", body)

        if (body && check.like(body, CollectionCreate)) {

            const {
                name,
                chainId,
                contractAddress,
                is1155
            } = body

            if (name.length < 3) {
                throw new Error("Given name must be longer than 3 characters")
            }

            // checking if it's duplicated
            const client = new aws.sdk.DynamoDB.DocumentClient()
            let params = {
                TableName: tableName,
                Key: {
                    "chainId": chainId,
                    "contractAddress": contractAddress.toLowerCase()
                }
            };

            let { Item } = await client.get(params).promise()

            if (Item) {
                throw new Error("Contract address is duplicated")
            }

            console.log("Subscribe Smart Contract events on Moralis...")

            let moralisTableName = `${name.replace(/\./g, '').replace(/\s+/g, '').replace(/[0-9]/g, '').replace(/[^a-zA-Z ]/g, "").toLowerCase()}`

            if (moralisTableName.length >= 16) {
                moralisTableName = moralisTableName.substring(0, 16)
            }

            await Moralis.start(generateMoralisParams(chainId));

            // ERC-721
            if (!is1155) {
                const options = {
                    chainId: `0x${chainId.toString(16)}`,
                    address: contractAddress.toLowerCase(),
                    topic: "Transfer(address, address, uint256)",
                    abi: {
                        "anonymous": false,
                        "inputs": [
                            {
                                "indexed": true,
                                "internalType": "address",
                                "name": "from",
                                "type": "address"
                            },
                            {
                                "indexed": true,
                                "internalType": "address",
                                "name": "to",
                                "type": "address"
                            },
                            {
                                "indexed": true,
                                "internalType": "uint256",
                                "name": "tokenId",
                                "type": "uint256"
                            }
                        ],
                        "name": "Transfer",
                        "type": "event"
                    },
                    limit: 500000,
                    tableName: moralisTableName,
                    sync_historical: true,
                };

                Moralis.Cloud.run("watchContractEvent", options, { useMasterKey: true });
            } else {

                // ERC-1155

                let options = {
                    chainId: `0x${chainId.toString(16)}`,
                    address: contractAddress.toLowerCase(),
                    topic: "TransferSingle(address, address, address, uint256, uint256)",
                    abi: {
                        "anonymous": false,
                        "inputs": [
                            {
                                "indexed": true,
                                "internalType": "address",
                                "name": "operator",
                                "type": "address"
                            },
                            {
                                "indexed": true,
                                "internalType": "address",
                                "name": "from",
                                "type": "address"
                            },
                            {
                                "indexed": true,
                                "internalType": "address",
                                "name": "to",
                                "type": "address"
                            },
                            {
                                "indexed": false,
                                "internalType": "uint256",
                                "name": "id",
                                "type": "uint256"
                            },
                            {
                                "indexed": false,
                                "internalType": "uint256",
                                "name": "value",
                                "type": "uint256"
                            }
                        ],
                        "name": "TransferSingle",
                        "type": "event"
                    },
                    limit: 500000,
                    tableName: `${moralisTableName}Single`,
                    sync_historical: true,
                };

                Moralis.Cloud.run("watchContractEvent", options, { useMasterKey: true });

                options = {
                    chainId: `0x${chainId.toString(16)}`,
                    address: contractAddress.toLowerCase(),
                    topic: "TransferBatch(address, address, address, uint256[], uint256[])",
                    abi: {
                        "anonymous": false,
                        "inputs": [
                            {
                                "indexed": true,
                                "internalType": "address",
                                "name": "operator",
                                "type": "address"
                            },
                            {
                                "indexed": true,
                                "internalType": "address",
                                "name": "from",
                                "type": "address"
                            },
                            {
                                "indexed": true,
                                "internalType": "address",
                                "name": "to",
                                "type": "address"
                            },
                            {
                                "indexed": false,
                                "internalType": "uint256[]",
                                "name": "ids",
                                "type": "uint256[]"
                            },
                            {
                                "indexed": false,
                                "internalType": "uint256[]",
                                "name": "values",
                                "type": "uint256[]"
                            }
                        ],
                        "name": "TransferBatch",
                        "type": "event"
                    },
                    limit: 500000,
                    tableName: `${moralisTableName}Batch`,
                    sync_historical: true,
                };

                Moralis.Cloud.run("watchContractEvent", options, { useMasterKey: true });
            }

            params = {
                TableName: tableName,
                Item: {
                    "chainId": chainId,
                    "contractAddress": contractAddress.toLowerCase(),
                    name,
                    tableName: moralisTableName,
                    is1155,
                    verified: false
                }
            }

            console.log("saving : ", params)

            await client.put(params).promise()

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    "status": "ok",
                    name,
                    tableName: moralisTableName
                }),
            }
        } else {
            throw new Error("Invalid entry")
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
    getCollections,
    createCollection,
    getCollection
}