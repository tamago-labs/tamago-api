const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const check = require('check-types');

const Moralis = require("moralis/node")


const { parseBody } = require("../utils")
const { CollectionCreate } = require("../types/collection")

const { headers } = require("./headers")

const getCollections = async (event, tableName) => {

    console.log("get collections...")

    try {

        const params = {
            TableName: tableName,
            KeyConditionExpression: "#chainId = :chainId",
            ExpressionAttributeNames: {
                "#chainId": "chainId"
            },
            ExpressionAttributeValues: {
                ":chainId": 42
            },
            // ProjectionExpression: "orderId"
        };

        const client = new aws.sdk.DynamoDB.DocumentClient()
        const { Items } = await client.query(params).promise()

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: "ok",
                collections: Items
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

const generateMoralisParams = (chainId) => {
    if ([42, 80001, 97, 43113].indexOf(chainId) !== -1) {
        return {
            serverUrl: "https://1ovp3qunsgo4.usemoralis.com:2053/server",
            appId: "enCW1fXy8eMazgGNIgwKdOicHVw67k0AegYAr2eE",
            masterKey: "AdNlpYjZuuiCGzlPaonWrJoGSIB6Scnae2AiNY6B"
        }
    }
    if ([56, 137, 43114, 1].indexOf(chainId) !== -1) {
        return {
            serverUrl: "https://cybgqjtb97zb.usemoralis.com:2053/server",
            appId: "c5pJEepQAhugEYhT4xmn5FUvWRij5Rvbpn7yZGJ9",
            masterKey: "1OKt4BCqp7OcDwKmJGmrJTBeadyhfyznSrFnU1IB"
        }
    }
    throw new Error("Chain isn't supported")
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

            let moralisTableName = `${name.replace(/\./g, '').replace(/\s+/g, '').toLowerCase()}`

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
                    "contractAddress": contractAddress,
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
    createCollection
}